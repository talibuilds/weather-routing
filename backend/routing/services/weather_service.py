"""
Weather Service.
Fetches, batches, and interpolates weather data from Open-Meteo forecast API
for truck route checkpoints and corridor heatmap grids.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import math
import logging
import requests
from dateutil import parser as dt_parser

from .risk_calculator import RiskCalculator

logger = logging.getLogger(__name__)


class WeatherService:
    OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
    REQUEST_TIMEOUT = 12  # seconds
    MAX_BATCH_SIZE = 35    # coordinates per batch to stay within URL length limits

    @classmethod
    def fetch_checkpoints_weather(
        cls,
        checkpoints: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Enriches a list of checkpoints with interpolated weather at their exact ETA.
        Each checkpoint dict must contain 'lat', 'lng', and 'eta' (datetime or ISO str).
        Returns the updated checkpoints list with a 'weather' key added to each.
        """
        if not checkpoints:
            return []

        # Determine required forecast horizon based on latest ETA
        now = datetime.now(timezone.utc)
        max_eta = now
        for cp in checkpoints:
            eta = cp.get("eta")
            if isinstance(eta, str):
                try:
                    eta_dt = dt_parser.isoparse(eta)
                except Exception:
                    eta_dt = now
            elif isinstance(eta, datetime):
                eta_dt = eta
            else:
                eta_dt = now

            if eta_dt.tzinfo is None:
                eta_dt = eta_dt.replace(tzinfo=timezone.utc)

            if eta_dt > max_eta:
                max_eta = eta_dt

        delta_days = max(1, math.ceil((max_eta - now).total_seconds() / 86400.0) + 1)
        forecast_days = min(16, max(3, delta_days))

        # Batch checkpoints to query Open-Meteo efficiently
        enriched_checkpoints = []
        for i in range(0, len(checkpoints), cls.MAX_BATCH_SIZE):
            batch = checkpoints[i : i + cls.MAX_BATCH_SIZE]
            batch_results = cls._fetch_batch(batch, forecast_days)
            enriched_checkpoints.extend(batch_results)

        return enriched_checkpoints

    @classmethod
    def _fetch_batch(
        cls,
        batch: List[Dict[str, Any]],
        forecast_days: int
    ) -> List[Dict[str, Any]]:
        """
        Fetches hourly weather data for a single batch of checkpoints.
        """
        latitudes = ",".join(f"{cp['lat']:.4f}" for cp in batch)
        longitudes = ",".join(f"{cp['lng']:.4f}" for cp in batch)

        params = {
            "latitude": latitudes,
            "longitude": longitudes,
            "hourly": "temperature_2m,wind_speed_10m,rain,snowfall",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "temperature_unit": "fahrenheit",
            "forecast_days": forecast_days,
            "timezone": "UTC",
        }

        raw_weather_list = []
        try:
            resp = requests.get(cls.OPEN_METEO_URL, params=params, timeout=cls.REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    raw_weather_list = data
                elif isinstance(data, dict):
                    # Single item returned when batch length is 1
                    raw_weather_list = [data]
            else:
                logger.warning("Open-Meteo returned status %s: %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Error connecting to Open-Meteo: %s", e)

        # Process each checkpoint in the batch
        result = []
        for idx, cp in enumerate(batch):
            eta_dt = cls._parse_datetime(cp.get("eta"))
            hourly_data = None
            if idx < len(raw_weather_list) and "hourly" in raw_weather_list[idx]:
                hourly_data = raw_weather_list[idx]["hourly"]

            if hourly_data and "time" in hourly_data and len(hourly_data["time"]) > 0:
                weather_at_eta = cls._interpolate_weather(hourly_data, eta_dt)
            else:
                # Graceful synthetic fallback if Open-Meteo data is missing
                weather_at_eta = cls._fallback_weather(cp["lat"], cp["lng"], eta_dt)

            cp_copy = dict(cp)
            cp_copy["weather"] = weather_at_eta
            result.append(cp_copy)

        return result

    @classmethod
    def _interpolate_weather(
        cls,
        hourly: Dict[str, List[Any]],
        target_dt: datetime
    ) -> Dict[str, float]:
        """
        Performs linear interpolation of hourly forecast variables at the target ETA.
        """
        times_str = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        winds = hourly.get("wind_speed_10m", [])
        rains = hourly.get("rain", [])
        snows = hourly.get("snowfall", [])

        if not times_str:
            return cls._fallback_weather(40.0, -90.0, target_dt)

        # Parse forecast timestamps
        times_dt = []
        for t_str in times_str:
            try:
                dt = dt_parser.isoparse(t_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                times_dt.append(dt)
            except Exception:
                continue

        if not times_dt:
            return cls._fallback_weather(40.0, -90.0, target_dt)

        # Target datetime in UTC
        if target_dt.tzinfo is None:
            target_dt = target_dt.replace(tzinfo=timezone.utc)

        # If target is before the first hour
        if target_dt <= times_dt[0]:
            return {
                "temperature_f": round(float(temps[0] if temps else 50.0), 1),
                "wind_speed_mph": round(float(winds[0] if winds else 10.0), 1),
                "rain_in_hr": round(max(0.0, float(rains[0] if rains else 0.0)), 2),
                "snow_in_hr": round(max(0.0, float(snows[0] if snows else 0.0)), 2),
            }

        # If target is after the last hour
        if target_dt >= times_dt[-1]:
            last = len(times_dt) - 1
            return {
                "temperature_f": round(float(temps[last] if temps else 50.0), 1),
                "wind_speed_mph": round(float(winds[last] if winds else 10.0), 1),
                "rain_in_hr": round(max(0.0, float(rains[last] if rains else 0.0)), 2),
                "snow_in_hr": round(max(0.0, float(snows[last] if snows else 0.0)), 2),
            }

        # Locate interval [idx, idx+1]
        idx = 0
        for i in range(len(times_dt) - 1):
            if times_dt[i] <= target_dt <= times_dt[i + 1]:
                idx = i
                break

        t0 = times_dt[idx]
        t1 = times_dt[idx + 1]
        span = (t1 - t0).total_seconds()
        alpha = 0.0 if span <= 0 else (target_dt - t0).total_seconds() / span
        alpha = max(0.0, min(1.0, alpha))

        def interp(arr: List[Any], default_val: float) -> float:
            if not arr or idx >= len(arr):
                return default_val
            v0 = float(arr[idx] if arr[idx] is not None else default_val)
            v1 = float(arr[idx + 1] if (idx + 1 < len(arr) and arr[idx + 1] is not None) else v0)
            return (1.0 - alpha) * v0 + alpha * v1

        return {
            "temperature_f": round(interp(temps, 50.0), 1),
            "wind_speed_mph": round(max(0.0, interp(winds, 10.0)), 1),
            "rain_in_hr": round(max(0.0, interp(rains, 0.0)), 2),
            "snow_in_hr": round(max(0.0, interp(snows, 0.0)), 2),
        }

    @classmethod
    def get_corridor_weather_grid(
        cls,
        checkpoints: List[Dict[str, Any]],
        load_weight: float = 35000.0,
        hours_ahead: int = 48
    ) -> Dict[str, Any]:
        """
        Fetches hourly weather along the trip corridor for the next 0-48 hours.
        Produces grid/corridor data used for the interactive forecast slider in the UI.
        """
        if not checkpoints:
            return {"grid_points": [], "forecast_hours": []}

        # Select a representative set of points along the corridor (up to 15 key corridor nodes)
        step = max(1, len(checkpoints) // 12)
        corridor_points = [checkpoints[i] for i in range(0, len(checkpoints), step)]
        if checkpoints[-1] not in corridor_points:
            corridor_points.append(checkpoints[-1])

        latitudes = ",".join(f"{cp['lat']:.4f}" for cp in corridor_points)
        longitudes = ",".join(f"{cp['lng']:.4f}" for cp in corridor_points)

        params = {
            "latitude": latitudes,
            "longitude": longitudes,
            "hourly": "temperature_2m,wind_speed_10m,rain,snowfall",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "temperature_unit": "fahrenheit",
            "forecast_days": 3,
            "timezone": "UTC",
        }

        raw_list = []
        try:
            resp = requests.get(cls.OPEN_METEO_URL, params=params, timeout=cls.REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                raw_list = data if isinstance(data, list) else [data]
        except Exception as e:
            logger.error("Error fetching corridor heatmap: %s", e)

        grid_output = []
        forecast_hours_list = []
        now = datetime.now(timezone.utc)

        for p_idx, pt in enumerate(corridor_points):
            hourly_data = raw_list[p_idx]["hourly"] if (p_idx < len(raw_list) and "hourly" in raw_list[p_idx]) else {}
            times = hourly_data.get("time", [])[: hours_ahead + 1]
            temps = hourly_data.get("temperature_2m", [])[: hours_ahead + 1]
            winds = hourly_data.get("wind_speed_10m", [])[: hours_ahead + 1]
            rains = hourly_data.get("rain", [])[: hours_ahead + 1]
            snows = hourly_data.get("snowfall", [])[: hours_ahead + 1]

            timeline = []
            num_slots = max(hours_ahead + 1, len(times))

            for h in range(min(hours_ahead + 1, max(1, len(times)))):
                ts_str = times[h] if h < len(times) else (now + timedelta(hours=h)).strftime("%Y-%m-%dT%H:00")
                temp_val = round(float(temps[h] if h < len(temps) and temps[h] is not None else 52.0), 1)
                wind_val = round(max(0.0, float(winds[h] if h < len(winds) and winds[h] is not None else 8.0)), 1)
                rain_val = round(max(0.0, float(rains[h] if h < len(rains) and rains[h] is not None else 0.0)), 2)
                snow_val = round(max(0.0, float(snows[h] if h < len(snows) and snows[h] is not None else 0.0)), 2)

                weather_snapshot = {
                    "temperature_f": temp_val,
                    "wind_speed_mph": wind_val,
                    "rain_in_hr": rain_val,
                    "snow_in_hr": snow_val,
                }
                risk_info = RiskCalculator.calculate_checkpoint_risk(weather_snapshot, load_weight)

                timeline.append({
                    "hour_offset": h,
                    "timestamp": ts_str,
                    "temperature_f": temp_val,
                    "wind_speed_mph": wind_val,
                    "rain_in_hr": rain_val,
                    "snow_in_hr": snow_val,
                    "risk_level": risk_info["risk_level"],
                    "risk_score": risk_info["risk_score"],
                    "color": risk_info["color"],
                    "primary_hazard": risk_info["risk_details"]["primary_hazard"],
                })

            grid_output.append({
                "point_index": p_idx,
                "lat": pt["lat"],
                "lng": pt["lng"],
                "mile_marker": pt.get("mile_marker", 0.0),
                "timeline": timeline,
            })

        # Generate list of hour metadata [0..48]
        if grid_output and grid_output[0]["timeline"]:
            forecast_hours_list = [
                {
                    "hour_offset": item["hour_offset"],
                    "timestamp": item["timestamp"],
                }
                for item in grid_output[0]["timeline"]
            ]

        # Calculate bounding box of corridor
        lats = [p["lat"] for p in corridor_points]
        lngs = [p["lng"] for p in corridor_points]
        bounds = {
            "min_lat": min(lats),
            "max_lat": max(lats),
            "min_lng": min(lngs),
            "max_lng": max(lngs),
        }

        return {
            "bounds": bounds,
            "forecast_hours": forecast_hours_list,
            "grid_points": grid_output,
        }

    @classmethod
    def _parse_datetime(cls, val: Any) -> datetime:
        """Parses various datetime input representations into UTC datetime."""
        if isinstance(val, datetime):
            return val if val.tzinfo is not None else val.replace(tzinfo=timezone.utc)
        if isinstance(val, str):
            try:
                dt = dt_parser.isoparse(val)
                return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass
        return datetime.now(timezone.utc)

    @classmethod
    def _fallback_weather(
        cls,
        lat: float,
        lng: float,
        dt: datetime
    ) -> Dict[str, float]:
        """
        Realistic synthetic fallback if Open-Meteo is unreachable.
        Generates consistent physical approximations based on geography and time.
        """
        hour = dt.hour
        # Diurnal temperature cycle
        temp_base = 50.0 - (lat - 35.0) * 1.5
        temp = temp_base + 10.0 * math.sin((hour - 8) * math.pi / 12)
        # Moderate wind pattern
        wind = 12.0 + 5.0 * math.sin((lat + lng) * 0.1)

        return {
            "temperature_f": round(temp, 1),
            "wind_speed_mph": round(max(2.0, wind), 1),
            "rain_in_hr": 0.0,
            "snow_in_hr": 0.0,
        }
