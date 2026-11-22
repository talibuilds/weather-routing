"""
Route Service.
Handles geocoding (Nominatim), fetching route alternatives (OSRM),
guaranteeing 3 distinct route options, checkpoint sampling at 10/25/50 miles,
and accurate ETA calculation for truck trips.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple, Optional
import math
import logging
import requests
from dateutil import parser as dt_parser

logger = logging.getLogger(__name__)

# Fallback geocoding dictionary for major US logistics hubs and cities
MAJOR_US_CITIES = {
    "chicago": {"lat": 41.8781, "lng": -87.6298, "name": "Chicago, IL, USA"},
    "denver": {"lat": 39.7392, "lng": -104.9903, "name": "Denver, CO, USA"},
    "dallas": {"lat": 32.7767, "lng": -96.7970, "name": "Dallas, TX, USA"},
    "atlanta": {"lat": 33.7490, "lng": -84.3880, "name": "Atlanta, GA, USA"},
    "los angeles": {"lat": 34.0522, "lng": -118.2437, "name": "Los Angeles, CA, USA"},
    "new york": {"lat": 40.7128, "lng": -74.0060, "name": "New York, NY, USA"},
    "seattle": {"lat": 47.6062, "lng": -122.3321, "name": "Seattle, WA, USA"},
    "miami": {"lat": 25.7617, "lng": -80.1918, "name": "Miami, FL, USA"},
    "houston": {"lat": 29.7604, "lng": -95.3698, "name": "Houston, TX, USA"},
    "phoenix": {"lat": 33.4484, "lng": -112.0740, "name": "Phoenix, AZ, USA"},
    "philadelphia": {"lat": 39.9526, "lng": -75.1652, "name": "Philadelphia, PA, USA"},
    "san antonio": {"lat": 29.4241, "lng": -98.4936, "name": "San Antonio, TX, USA"},
    "san diego": {"lat": 32.7157, "lng": -117.1611, "name": "San Diego, CA, USA"},
    "san francisco": {"lat": 37.7749, "lng": -122.4194, "name": "San Francisco, CA, USA"},
    "columbus": {"lat": 39.9612, "lng": -82.9988, "name": "Columbus, OH, USA"},
    "indianapolis": {"lat": 39.7684, "lng": -86.1581, "name": "Indianapolis, IN, USA"},
    "charlotte": {"lat": 35.2271, "lng": -80.8431, "name": "Charlotte, NC, USA"},
    "kansas city": {"lat": 39.0997, "lng": -94.5786, "name": "Kansas City, MO, USA"},
    "st. louis": {"lat": 38.6270, "lng": -90.1994, "name": "St. Louis, MO, USA"},
    "memphis": {"lat": 35.1495, "lng": -90.0490, "name": "Memphis, TN, USA"},
    "nashville": {"lat": 36.1627, "lng": -86.7816, "name": "Nashville, TN, USA"},
    "detroit": {"lat": 42.3314, "lng": -83.0458, "name": "Detroit, MI, USA"},
    "minneapolis": {"lat": 44.9778, "lng": -93.2650, "name": "Minneapolis, MN, USA"},
    "salt lake city": {"lat": 40.7608, "lng": -111.8910, "name": "Salt Lake City, UT, USA"},
    "las vegas": {"lat": 36.1699, "lng": -115.1398, "name": "Las Vegas, NV, USA"},
    "portland": {"lat": 45.5152, "lng": -122.6784, "name": "Portland, OR, USA"},
    "cleveland": {"lat": 41.4993, "lng": -81.6944, "name": "Cleveland, OH, USA"},
    "pittsburgh": {"lat": 40.4406, "lng": -79.9959, "name": "Pittsburgh, PA, USA"},
    "omaha": {"lat": 41.2565, "lng": -95.9345, "name": "Omaha, NE, USA"},
    "boston": {"lat": 42.3601, "lng": -71.0589, "name": "Boston, MA, USA"},
    "oklahoma city": {"lat": 35.4676, "lng": -97.5164, "name": "Oklahoma City, OK, USA"},
}

METERS_TO_MILES = 0.000621371
MILES_TO_METERS = 1609.34


class RouteService:
    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
    OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"
    USER_AGENT = "SpotterWeatherTruckRouting/1.0 (contact@spotter-routing.com)"
    REQUEST_TIMEOUT = 12

    # In-memory geocoding cache
    _geo_cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def geocode(cls, query: str) -> Dict[str, Any]:
        """
        Geocodes a place name string or coordinates to {lat, lng, name, display_name}.
        Supports coordinate inputs like "41.8781, -87.6298" directly.
        """
        query_str = str(query).strip()
        if not query_str:
            raise ValueError("Origin/destination query cannot be empty.")

        # Check in-memory cache
        cache_key = query_str.lower()
        if cache_key in cls._geo_cache:
            return cls._geo_cache[cache_key]

        # Check if the user entered direct coordinates "lat, lng"
        if "," in query_str:
            parts = query_str.split(",")
            if len(parts) == 2:
                try:
                    lat = float(parts[0].strip())
                    lng = float(parts[1].strip())
                    if -90 <= lat <= 90 and -180 <= lng <= 180:
                        res = {
                            "name": f"{lat:.4f}, {lng:.4f}",
                            "display_name": f"Coordinates ({lat:.4f}, {lng:.4f})",
                            "lat": lat,
                            "lng": lng,
                        }
                        cls._geo_cache[cache_key] = res
                        return res
                except ValueError:
                    pass

        # Check major city dictionary
        clean_key = cache_key.replace(",", " ").replace(".", "").strip()
        for city_key, city_data in MAJOR_US_CITIES.items():
            if city_key in clean_key:
                res = {
                    "name": query_str,
                    "display_name": city_data["name"],
                    "lat": city_data["lat"],
                    "lng": city_data["lng"],
                }
                cls._geo_cache[cache_key] = res
                return res

        # Query Nominatim OpenStreetMap Geocoder
        try:
            headers = {"User-Agent": cls.USER_AGENT}
            params = {
                "q": query_str,
                "format": "json",
                "limit": 1,
                "addressdetails": 1,
            }
            resp = requests.get(cls.NOMINATIM_URL, params=params, headers=headers, timeout=cls.REQUEST_TIMEOUT)
            if resp.status_code == 200:
                results = resp.json()
                if results and len(results) > 0:
                    top = results[0]
                    res = {
                        "name": top.get("name") or query_str,
                        "display_name": top.get("display_name", query_str),
                        "lat": float(top["lat"]),
                        "lng": float(top["lon"]),
                    }
                    cls._geo_cache[cache_key] = res
                    return res
        except Exception as e:
            logger.warning("Nominatim geocoding failed for '%s': %s", query_str, e)

        # Fallback to nearest major city match
        for city_key, city_data in MAJOR_US_CITIES.items():
            first_word = clean_key.split()[0] if clean_key else ""
            if first_word and first_word in city_key:
                res = {
                    "name": query_str,
                    "display_name": city_data["name"],
                    "lat": city_data["lat"],
                    "lng": city_data["lng"],
                }
                cls._geo_cache[cache_key] = res
                return res

        raise ValueError(f"Unable to geocode location: '{query_str}'. Please provide a valid city, state, or coordinates.")

    @classmethod
    def get_routes(
        cls,
        origin_geo: Dict[str, Any],
        dest_geo: Dict[str, Any],
        departure_dt: datetime,
        sampling_interval_miles: int = 25
    ) -> List[Dict[str, Any]]:
        """
        Fetches 3 route options from OSRM between origin and destination.
        Samples checkpoints along each route at the specified mile interval.
        Calculates ETA at each checkpoint.
        """
        lat1, lng1 = origin_geo["lat"], origin_geo["lng"]
        lat2, lng2 = dest_geo["lat"], dest_geo["lng"]

        # 1. Fetch direct routes from OSRM with alternatives=3
        routes_raw = cls._fetch_osrm_routes(lng1, lat1, lng2, lat2, alternatives=3)

        # 2. If fewer than 3 routes returned, generate additional distinct routes via intermediate waypoints
        if len(routes_raw) < 3:
            routes_raw = cls._supplement_routes_with_waypoints(routes_raw, lng1, lat1, lng2, lat2)

        # 3. If OSRM was completely unavailable, fallback to synthesized geodesic routes
        if not routes_raw:
            routes_raw = cls._synthesize_fallback_routes(lng1, lat1, lng2, lat2)

        # Ensure we take exactly 3 distinct routes (or as many as produced, capped at 3)
        selected_raw = routes_raw[:3]

        # 4. Process each route: sample checkpoints and calculate ETAs
        processed_routes = []
        for idx, r_raw in enumerate(selected_raw):
            route_obj = cls._process_route(
                route_idx=idx,
                route_raw=r_raw,
                origin_name=origin_geo.get("name", "Origin"),
                dest_name=dest_geo.get("name", "Destination"),
                departure_dt=departure_dt,
                sampling_interval_miles=sampling_interval_miles
            )
            processed_routes.append(route_obj)

        return processed_routes

    @classmethod
    def _fetch_osrm_routes(
        cls,
        lng1: float,
        lat1: float,
        lng2: float,
        lat2: float,
        alternatives: int = 3
    ) -> List[Dict[str, Any]]:
        """Queries OSRM driving service."""
        url = f"{cls.OSRM_BASE_URL}/{lng1:.6f},{lat1:.6f};{lng2:.6f},{lat2:.6f}"
        params = {
            "alternatives": str(alternatives),
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
        }
        try:
            resp = requests.get(url, params=params, timeout=cls.REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and "routes" in data:
                    return data["routes"]
        except Exception as e:
            logger.warning("OSRM request failed: %s", e)
        return []

    @classmethod
    def _supplement_routes_with_waypoints(
        cls,
        existing_routes: List[Dict[str, Any]],
        lng1: float,
        lat1: float,
        lng2: float,
        lat2: float
    ) -> List[Dict[str, Any]]:
        """
        Synthesizes alternative routes via lateral waypoint offsets
        (e.g., northern detour and southern detour) to guarantee 3 distinct route options.
        """
        combined = list(existing_routes)

        # Vector from origin to destination
        d_lat = lat2 - lat1
        d_lng = lng2 - lng1
        dist = math.sqrt(d_lat**2 + d_lng**2)

        if dist < 0.001:
            return combined

        # Perpendicular unit vector
        perp_lat = -d_lng / dist
        perp_lng = d_lat / dist

        # Offsets for northern detour (+offset) and southern detour (-offset)
        # Scale offset proportional to distance (approx 1.0 to 2.5 degrees)
        offset_magnitude = min(2.5, max(1.0, dist * 0.18))
        offsets = [offset_magnitude, -offset_magnitude, offset_magnitude * 1.5]

        for off in offsets:
            if len(combined) >= 3:
                break

            mid_lat = (lat1 + lat2) / 2.0 + perp_lat * off
            mid_lng = (lng1 + lng2) / 2.0 + perp_lng * off

            wp_url = f"{cls.OSRM_BASE_URL}/{lng1:.6f},{lat1:.6f};{mid_lng:.6f},{mid_lat:.6f};{lng2:.6f},{lat2:.6f}"
            params = {
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
            }
            try:
                resp = requests.get(wp_url, params=params, timeout=cls.REQUEST_TIMEOUT)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        alt_route = data["routes"][0]
                        # Verify it's not identical to existing distances
                        is_duplicate = any(
                            abs(alt_route["distance"] - r["distance"]) < 5000 for r in combined
                        )
                        if not is_duplicate:
                            combined.append(alt_route)
            except Exception as e:
                logger.debug("Failed waypoint alternative: %s", e)

        return combined

    @classmethod
    def _synthesize_fallback_routes(
        cls,
        lng1: float,
        lat1: float,
        lng2: float,
        lat2: float
    ) -> List[Dict[str, Any]]:
        """
        Generates 3 synthetic highway routes in case OSRM service is completely offline.
        Uses great-circle line with varied curvature arcs.
        """
        routes = []
        curvatures = [0.0, 0.15, -0.15]  # Direct, North arc, South arc

        for idx, curve in enumerate(curvatures):
            coords = []
            num_points = 60
            for i in range(num_points + 1):
                t = i / num_points
                # Base linear
                lat = lat1 + t * (lat2 - lat1)
                lng = lng1 + t * (lng2 - lng1)
                # Add parabolic arc perpendicular offset
                arc = 4.0 * t * (1.0 - t) * curve
                lat += arc * (lng2 - lng1) * 0.2
                lng -= arc * (lat2 - lat1) * 0.2
                coords.append([round(lng, 6), round(lat, 6)])

            # Compute approximate distance
            tot_dist = 0.0
            for i in range(len(coords) - 1):
                tot_dist += cls.haversine_distance(
                    coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]
                )

            dist_meters = tot_dist * MILES_TO_METERS
            # Truck speed ~60 mph = ~26.8 m/s
            duration_sec = dist_meters / 26.82

            routes.append({
                "distance": dist_meters,
                "duration": duration_sec,
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords,
                },
                "legs": [],
            })

        return routes

    @classmethod
    def _process_route(
        cls,
        route_idx: int,
        route_raw: Dict[str, Any],
        origin_name: str,
        dest_name: str,
        departure_dt: datetime,
        sampling_interval_miles: int
    ) -> Dict[str, Any]:
        """
        Samples checkpoints along the route geometry at regular mile intervals
        and calculates arrival ETA for each checkpoint.
        """
        coords = route_raw.get("geometry", {}).get("coordinates", [])
        total_distance_meters = float(route_raw.get("distance", 0.0))
        total_duration_seconds = float(route_raw.get("duration", 0.0))

        total_distance_miles = round(total_distance_meters * METERS_TO_MILES, 1)
        total_duration_hours = round(total_duration_seconds / 3600.0, 2)

        # Human-friendly duration string
        hrs = int(total_duration_seconds // 3600)
        mins = int((total_duration_seconds % 3600) // 60)
        duration_formatted = f"{hrs}h {mins:02d}m" if hrs > 0 else f"{mins}m"

        # Route names
        route_labels = [
            f"Route 1 (Primary Direct)",
            f"Route 2 (Northern Corridor)",
            f"Route 3 (Southern Corridor)",
        ]
        route_name = route_labels[route_idx] if route_idx < len(route_labels) else f"Route {route_idx + 1}"

        # Sample checkpoints along LineString
        checkpoints = cls._sample_line_string(
            coords=coords,
            total_dist_miles=total_distance_miles,
            total_dur_seconds=total_duration_seconds,
            departure_dt=departure_dt,
            interval_miles=sampling_interval_miles,
            origin_name=origin_name,
            dest_name=dest_name
        )

        return {
            "route_index": route_idx,
            "name": route_name,
            "total_distance_miles": total_distance_miles,
            "total_duration_hours": total_duration_hours,
            "total_duration_formatted": duration_formatted,
            "total_duration_seconds": int(total_duration_seconds),
            "geometry": route_raw.get("geometry", {}),
            "checkpoints": checkpoints,
        }

    @classmethod
    def _sample_line_string(
        cls,
        coords: List[List[float]],
        total_dist_miles: float,
        total_dur_seconds: float,
        departure_dt: datetime,
        interval_miles: int,
        origin_name: str,
        dest_name: str
    ) -> List[Dict[str, Any]]:
        """
        Samples coordinates at interval_miles along the GeoJSON coordinate path.
        """
        if not coords:
            return []

        if len(coords) == 1:
            return [{
                "index": 0,
                "name": origin_name,
                "mile_marker": 0.0,
                "lat": coords[0][1],
                "lng": coords[0][0],
                "eta": departure_dt.isoformat(),
                "segment_miles": 0.0,
            }]

        # Compute cumulative distance at each coordinate vertex
        cum_dist = [0.0]
        for i in range(len(coords) - 1):
            p1 = coords[i]
            p2 = coords[i + 1]
            seg_dist = cls.haversine_distance(p1[1], p1[0], p2[1], p2[0])
            cum_dist.append(cum_dist[-1] + seg_dist)

        path_total_miles = cum_dist[-1]
        # Use path total if greater than 0, otherwise total_dist_miles
        effective_total_miles = path_total_miles if path_total_miles > 0 else max(1.0, total_dist_miles)

        # Target mile markers: 0, S, 2S, 3S, ..., Destination
        target_markers = [0.0]
        curr = float(interval_miles)
        while curr < effective_total_miles - 2.0:  # don't duplicate if close to end
            target_markers.append(round(curr, 1))
            curr += interval_miles
        target_markers.append(round(effective_total_miles, 1))

        checkpoints = []
        for c_idx, target_m in enumerate(target_markers):
            # Locate position along coordinate path
            if target_m <= 0.0:
                c_lat = coords[0][1]
                c_lng = coords[0][0]
            elif target_m >= path_total_miles:
                c_lat = coords[-1][1]
                c_lng = coords[-1][0]
            else:
                # Find segment containing target_m
                seg_idx = 0
                for s in range(len(cum_dist) - 1):
                    if cum_dist[s] <= target_m <= cum_dist[s + 1]:
                        seg_idx = s
                        break
                d0 = cum_dist[seg_idx]
                d1 = cum_dist[seg_idx + 1]
                t = 0.0 if d1 <= d0 else (target_m - d0) / (d1 - d0)
                c_lng = coords[seg_idx][0] + t * (coords[seg_idx + 1][0] - coords[seg_idx][0])
                c_lat = coords[seg_idx][1] + t * (coords[seg_idx + 1][1] - coords[seg_idx][1])

            # Calculate ETA proportionally
            progress_ratio = 0.0 if effective_total_miles <= 0 else target_m / effective_total_miles
            progress_ratio = max(0.0, min(1.0, progress_ratio))
            elapsed_seconds = progress_ratio * total_dur_seconds
            eta_dt = departure_dt + timedelta(seconds=elapsed_seconds)

            # Segment miles between consecutive checkpoints
            prev_m = target_markers[c_idx - 1] if c_idx > 0 else 0.0
            seg_miles = round(target_m - prev_m, 1)

            # Checkpoint name
            if c_idx == 0:
                name = f"Origin ({origin_name})"
            elif c_idx == len(target_markers) - 1:
                name = f"Destination ({dest_name})"
            else:
                name = f"Checkpoint {c_idx} (Mile {target_m:.0f})"

            checkpoints.append({
                "index": c_idx,
                "name": name,
                "mile_marker": round(target_m, 1),
                "lat": round(c_lat, 6),
                "lng": round(c_lng, 6),
                "eta": eta_dt.isoformat(),
                "segment_miles": seg_miles,
            })

        return checkpoints

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates Great-Circle distance in miles between two coordinates
        using the Haversine formula.
        """
        r_earth_miles = 3958.8
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return r_earth_miles * c
