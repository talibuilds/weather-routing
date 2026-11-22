"""
Unit and Integration tests for Weather-Aware Truck Routing Backend.
"""
from django.test import TestCase, Client
from datetime import datetime, timezone
import json

from routing.services.risk_calculator import RiskCalculator
from routing.services.route_service import RouteService
from routing.services.weather_service import WeatherService
from routing.services.recommendation import RouteRecommender


class RiskCalculatorTests(TestCase):
    def test_wind_thresholds_and_load_penalties(self):
        # < 25 mph -> Low
        self.assertEqual(RiskCalculator.classify_wind(15.0, 35000)["level"], "Low")
        self.assertEqual(RiskCalculator.classify_wind(15.0, 35000)["score"], 1)

        # 25-34 mph -> Moderate
        self.assertEqual(RiskCalculator.classify_wind(30.0, 35000)["level"], "Moderate")
        self.assertEqual(RiskCalculator.classify_wind(30.0, 35000)["score"], 2)

        # 35-44 mph with load <= 40,000 -> High
        self.assertEqual(RiskCalculator.classify_wind(40.0, 38000)["level"], "High")
        self.assertEqual(RiskCalculator.classify_wind(40.0, 38000)["score"], 3)

        # 35-44 mph with load > 40,000 -> Severe
        res_heavy = RiskCalculator.classify_wind(40.0, 42000)
        self.assertEqual(res_heavy["level"], "Severe")
        self.assertEqual(res_heavy["score"], 4)
        self.assertTrue(res_heavy["load_penalty_applied"])

        # 45-54 mph with load <= 30,000 -> Severe
        self.assertEqual(RiskCalculator.classify_wind(48.0, 28000)["level"], "Severe")
        self.assertEqual(RiskCalculator.classify_wind(48.0, 28000)["score"], 4)

        # 45-54 mph with load > 30,000 -> No Travel
        res_mid_heavy = RiskCalculator.classify_wind(48.0, 32000)
        self.assertEqual(res_mid_heavy["level"], "No Travel")
        self.assertEqual(res_mid_heavy["score"], 5)
        self.assertTrue(res_mid_heavy["load_penalty_applied"])

        # >= 55 mph -> No Travel for any load
        self.assertEqual(RiskCalculator.classify_wind(55.0, 10000)["level"], "No Travel")
        self.assertEqual(RiskCalculator.classify_wind(60.0, 50000)["level"], "No Travel")
        self.assertEqual(RiskCalculator.classify_wind(55.0, 10000)["score"], 5)

    def test_rain_thresholds(self):
        self.assertEqual(RiskCalculator.classify_rain(0.05)["level"], "Low")
        self.assertEqual(RiskCalculator.classify_rain(0.15)["level"], "Moderate")
        self.assertEqual(RiskCalculator.classify_rain(0.35)["level"], "High")
        self.assertEqual(RiskCalculator.classify_rain(0.75)["level"], "Severe")
        self.assertEqual(RiskCalculator.classify_rain(1.20)["level"], "No Travel")

    def test_snow_thresholds(self):
        self.assertEqual(RiskCalculator.classify_snow(0.2)["level"], "Low")
        self.assertEqual(RiskCalculator.classify_snow(0.7)["level"], "Moderate")
        self.assertEqual(RiskCalculator.classify_snow(1.5)["level"], "High")
        self.assertEqual(RiskCalculator.classify_snow(2.5)["level"], "Severe")
        self.assertEqual(RiskCalculator.classify_snow(3.5)["level"], "No Travel")

    def test_checkpoint_worst_condition(self):
        # Wind is Moderate (28mph), Rain is Severe (0.6in/hr), Snow is Low (0)
        weather = {
            "wind_speed_mph": 28.0,
            "rain_in_hr": 0.6,
            "snow_in_hr": 0.0,
            "temperature_f": 45.0,
        }
        res = RiskCalculator.calculate_checkpoint_risk(weather, load_weight=30000)
        self.assertEqual(res["risk_level"], "Severe")
        self.assertEqual(res["risk_score"], 4)
        self.assertIn("Rain", res["risk_details"]["primary_hazard"])


class RecommendationTests(TestCase):
    def test_recommendation_prefer_fewest_severe_and_high(self):
        route1 = {
            "route_index": 0,
            "name": "Route A",
            "total_distance_miles": 500.0,
            "total_duration_hours": 8.0,
            "total_duration_formatted": "8h 00m",
            "checkpoints": [
                {"segment_miles": 250.0, "risk_level": "Low", "risk_score": 1, "weather": {}},
                {"segment_miles": 250.0, "risk_level": "Low", "risk_score": 1, "weather": {}},
            ]
        }
        route2 = {
            "route_index": 1,
            "name": "Route B",
            "total_distance_miles": 480.0,
            "total_duration_hours": 7.5,
            "total_duration_formatted": "7h 30m",
            "checkpoints": [
                {"segment_miles": 240.0, "risk_level": "Severe", "risk_score": 4, "weather": {}},
                {"segment_miles": 240.0, "risk_level": "Low", "risk_score": 1, "weather": {}},
            ]
        }
        res = RouteRecommender.evaluate_and_rank_routes([route1, route2])
        # Route A has 0 severe miles vs Route B with severe miles -> Route A must be ranked #1
        self.assertEqual(res["recommended_route_index"], 0)
        self.assertEqual(res["rankings"][0]["name"], "Route A")


class ApiEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_health_check(self):
        resp = self.client.get('/api/health/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "healthy")

    def test_geocode(self):
        resp = self.client.get('/api/geocode/?q=Denver')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("lat", data)
        self.assertIn("lng", data)

    def test_routes_endpoint(self):
        payload = {
            "origin": "Chicago, IL",
            "destination": "Denver, CO",
            "departure_datetime": "2026-11-23T08:00:00Z",
            "load_weight": 42000,
            "sampling_interval_miles": 50
        }
        resp = self.client.post(
            '/api/routes/',
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("routes", data)
        self.assertEqual(len(data["routes"]), 3)
        self.assertIn("recommendation", data)
        self.assertIn("recommended_route_index", data["recommendation"])

        # Check checkpoints structure
        first_route = data["routes"][0]
        self.assertGreater(len(first_route["checkpoints"]), 0)
        cp0 = first_route["checkpoints"][0]
        self.assertIn("lat", cp0)
        self.assertIn("lng", cp0)
        self.assertIn("eta", cp0)
        self.assertIn("weather", cp0)
        self.assertIn("risk_level", cp0)
        self.assertIn("risk_details", cp0)

    def test_heatmap_endpoint(self):
        resp = self.client.get('/api/weather-heatmap/?origin=Chicago,%20IL&destination=Denver,%20CO')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("grid_points", data)
        self.assertIn("forecast_hours", data)
