"""
API Views for Weather-Aware Truck Routing.
Provides endpoints for route generation, weather sampling, risk analysis,
recommendation, corridor weather heatmap, and geocoding.
"""
from datetime import datetime, timezone
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import RoutePlanRequestSerializer, HeatmapRequestSerializer
from .models import RouteQueryLog
from .services import RouteService, WeatherService, RiskCalculator, RouteRecommender

logger = logging.getLogger(__name__)


class RoutePlanningView(APIView):
    """
    POST /api/routes/
    Accepts:
    - origin: string (e.g. "Chicago, IL")
    - destination: string (e.g. "Denver, CO")
    - departure_datetime: ISO string (e.g. "2026-11-23T08:00:00Z")
    - load_weight: float (lbs, e.g. 35000)
    - sampling_interval_miles: int (10, 25, or 50, default 25)

    Returns:
    - origin and destination geocoded data
    - routes: 3 route options with geometry, sampled checkpoints, weather, risk classifications, and route summary
    - recommendation: recommended route index, justification, and rankings
    """

    def post(self, request, *args, **kwargs):
        serializer = RoutePlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid request payload.", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        origin_str = data["origin"]
        dest_str = data["destination"]
        departure_dt = data["departure_datetime"]
        load_weight = data["load_weight"]
        interval_miles = data["sampling_interval_miles"]

        if departure_dt.tzinfo is None:
            departure_dt = departure_dt.replace(tzinfo=timezone.utc)

        # 1. Geocode origin and destination
        try:
            origin_geo = RouteService.geocode(origin_str)
        except Exception as e:
            return Response(
                {"error": f"Failed to geocode origin '{origin_str}': {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            dest_geo = RouteService.geocode(dest_str)
        except Exception as e:
            return Response(
                {"error": f"Failed to geocode destination '{dest_str}': {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Generate 3 route options with sampled checkpoints and ETAs
        try:
            routes = RouteService.get_routes(
                origin_geo=origin_geo,
                dest_geo=dest_geo,
                departure_dt=departure_dt,
                sampling_interval_miles=interval_miles
            )
        except Exception as e:
            logger.error("Routing error: %s", e)
            return Response(
                {"error": f"Failed to compute route options: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY
            )

        if not routes:
            return Response(
                {"error": "No viable routes could be found between the specified locations."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 3. For each route, fetch weather for checkpoints and calculate risks
        for r in routes:
            cps = r.get("checkpoints", [])
            # Enrich checkpoints with weather from Open-Meteo at their exact ETA
            enriched_cps = WeatherService.fetch_checkpoints_weather(cps)

            # Classify risk at each checkpoint using the exact assignment rules
            for cp in enriched_cps:
                weather_info = cp.get("weather", {})
                risk_res = RiskCalculator.calculate_checkpoint_risk(weather_info, load_weight)
                cp["risk_level"] = risk_res["risk_level"]
                cp["risk_score"] = risk_res["risk_score"]
                cp["color"] = risk_res["color"]
                cp["risk_details"] = risk_res["risk_details"]

            r["checkpoints"] = enriched_cps

        # 4. Rank routes and produce recommendation
        recommendation_data = RouteRecommender.evaluate_and_rank_routes(routes)

        # 5. Log query to database
        try:
            RouteQueryLog.objects.create(
                origin=origin_str,
                destination=dest_str,
                departure_datetime=departure_dt,
                load_weight=load_weight,
                sampling_interval_miles=interval_miles,
                recommended_route_index=recommendation_data.get("recommended_route_index")
            )
        except Exception as db_err:
            logger.warning("Could not log route query: %s", db_err)

        # 6. Build response
        response_data = {
            "query": {
                "origin": origin_geo,
                "destination": dest_geo,
                "departure_datetime": departure_dt.isoformat(),
                "load_weight_lbs": load_weight,
                "sampling_interval_miles": interval_miles,
            },
            "routes": routes,
            "recommendation": recommendation_data,
        }

        return Response(response_data, status=status.HTTP_200_OK)

    def get(self, request, *args, **kwargs):
        """Allow quick GET requests with query params for testing."""
        serializer = RoutePlanRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid query parameters.", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Delegate to post logic
        request.data = serializer.validated_data
        return self.post(request, *args, **kwargs)


class WeatherHeatmapView(APIView):
    """
    GET or POST /api/weather-heatmap/
    Returns corridor weather grid data with a 0-48 hour forecast slider timeline.
    Accepts query parameters:
    - origin: string (default "Chicago, IL")
    - destination: string (default "Denver, CO")
    - load_weight: float (default 35000)
    - hours: int (default 48)
    """

    def get(self, request, *args, **kwargs):
        serializer = HeatmapRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = serializer.validated_data
        return self._generate_heatmap(
            origin_str=params.get("origin", "Chicago, IL"),
            dest_str=params.get("destination", "Denver, CO"),
            load_weight=params.get("load_weight", 35000.0),
            hours=params.get("hours", 48)
        )

    def post(self, request, *args, **kwargs):
        serializer = HeatmapRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = serializer.validated_data
        return self._generate_heatmap(
            origin_str=params.get("origin", "Chicago, IL"),
            dest_str=params.get("destination", "Denver, CO"),
            load_weight=params.get("load_weight", 35000.0),
            hours=params.get("hours", 48)
        )

    def _generate_heatmap(self, origin_str: str, dest_str: str, load_weight: float, hours: int):
        try:
            origin_geo = RouteService.geocode(origin_str)
            dest_geo = RouteService.geocode(dest_str)
        except Exception as e:
            return Response(
                {"error": f"Geocoding failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        now = datetime.now(timezone.utc)
        try:
            routes = RouteService.get_routes(
                origin_geo=origin_geo,
                dest_geo=dest_geo,
                departure_dt=now,
                sampling_interval_miles=50
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to get corridor path: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY
            )

        primary_checkpoints = routes[0]["checkpoints"] if routes else []
        heatmap_data = WeatherService.get_corridor_weather_grid(
            checkpoints=primary_checkpoints,
            load_weight=load_weight,
            hours_ahead=hours
        )

        return Response({
            "corridor": {
                "origin": origin_geo,
                "destination": dest_geo,
            },
            "hours": hours,
            **heatmap_data
        }, status=status.HTTP_200_OK)


class GeocodeView(APIView):
    """
    GET /api/geocode/?q=Chicago
    Autocomplete and validation endpoint for locations.
    """

    def get(self, request, *args, **kwargs):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"error": "Query parameter 'q' is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = RouteService.geocode(q)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class HealthCheckView(APIView):
    """
    GET /api/health/
    Health verification endpoint.
    """

    def get(self, request, *args, **kwargs):
        return Response({
            "status": "healthy",
            "service": "Spotter Weather-Aware Truck Routing Backend",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "endpoints": [
                "POST /api/routes/ - Calculate 3 routes, weather checkpoints, risk, and recommendation",
                "GET/POST /api/weather-heatmap/ - 0-48hr forecast corridor heatmap grid",
                "GET /api/geocode/?q=<location> - Geocode city/address",
                "GET /api/health/ - Health check",
            ]
        }, status=status.HTTP_200_OK)
