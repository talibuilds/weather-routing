"""
Risk Calculator Service.
Implements the exact weather risk and load rules specified for truck routing.

Risk Rules:
Condition    Low         Moderate    High        Severe      No Travel
Wind         <25 mph     25-34       35-44       45-54       >=55 mph
Rain         <0.10 in/hr 0.10-0.25   0.25-0.50   0.50-1.00   >1.00
Snow         <0.5 in/hr  0.5-1.0     1.0-2.0     2.0-3.0     >3.0

Load rules:
- >=55 mph -> No Travel for any load
- 45-54 mph + >30,000 lb -> No Travel
- 35-44 mph + >40,000 lb -> Severe

Risk levels numeric:
- Low = 1
- Moderate = 2
- High = 3
- Severe = 4
- No Travel = 5
"""
from typing import Dict, Any, Tuple


class RiskCalculator:
    LEVEL_LOW = "Low"
    LEVEL_MODERATE = "Moderate"
    LEVEL_HIGH = "High"
    LEVEL_SEVERE = "Severe"
    LEVEL_NO_TRAVEL = "No Travel"

    SCORE_TO_LEVEL = {
        1: LEVEL_LOW,
        2: LEVEL_MODERATE,
        3: LEVEL_HIGH,
        4: LEVEL_SEVERE,
        5: LEVEL_NO_TRAVEL,
    }

    LEVEL_TO_SCORE = {v: k for k, v in SCORE_TO_LEVEL.items()}

    COLOR_MAP = {
        LEVEL_LOW: "#10B981",       # Emerald Green
        LEVEL_MODERATE: "#F59E0B",  # Amber Yellow
        LEVEL_HIGH: "#F97316",      # Bright Orange
        LEVEL_SEVERE: "#EF4444",    # Red
        LEVEL_NO_TRAVEL: "#7F1D1D", # Dark Crimson / Maroon
    }

    @classmethod
    def classify_wind(cls, wind_mph: float, load_weight: float) -> Dict[str, Any]:
        """
        Classifies wind risk accounting for truck load weight:
        - <25 mph: Low
        - 25-34 mph: Moderate
        - 35-44 mph: High (elevated to Severe if load > 40,000 lb)
        - 45-54 mph: Severe (elevated to No Travel if load > 30,000 lb)
        - >=55 mph: No Travel for any load
        """
        wind = float(wind_mph or 0.0)
        weight = float(load_weight or 0.0)
        load_penalty_applied = False
        load_penalty_detail = ""

        if wind >= 55.0:
            score = 5
            level = cls.LEVEL_NO_TRAVEL
            reason = f"Wind speed ({wind:.1f} mph) >= 55 mph: Extreme blowover hazard. No Travel for all loads."
        elif wind >= 45.0:
            if weight > 30000.0:
                score = 5
                level = cls.LEVEL_NO_TRAVEL
                load_penalty_applied = True
                load_penalty_detail = f"Wind ({wind:.1f} mph) with load ({weight:,.0f} lb > 30,000 lb) escalated to No Travel."
                reason = f"Wind speed ({wind:.1f} mph) in 45-54 mph range with heavy load ({weight:,.0f} lb > 30,000 lb) poses critical tipping risk: No Travel."
            else:
                score = 4
                level = cls.LEVEL_SEVERE
                reason = f"Wind speed ({wind:.1f} mph) in 45-54 mph range: Severe crosswind conditions."
        elif wind >= 35.0:
            if weight > 40000.0:
                score = 4
                level = cls.LEVEL_SEVERE
                load_penalty_applied = True
                load_penalty_detail = f"Wind ({wind:.1f} mph) with load ({weight:,.0f} lb > 40,000 lb) escalated to Severe."
                reason = f"Wind speed ({wind:.1f} mph) in 35-44 mph range with very heavy load ({weight:,.0f} lb > 40,000 lb) elevated to Severe."
            else:
                score = 3
                level = cls.LEVEL_HIGH
                reason = f"Wind speed ({wind:.1f} mph) in 35-44 mph range: High crosswind risk."
        elif wind >= 25.0:
            score = 2
            level = cls.LEVEL_MODERATE
            reason = f"Wind speed ({wind:.1f} mph) in 25-34 mph range: Moderate gusting."
        else:
            score = 1
            level = cls.LEVEL_LOW
            reason = f"Wind speed ({wind:.1f} mph) < 25 mph: Safe operating conditions."

        return {
            "level": level,
            "score": score,
            "speed_mph": wind,
            "reason": reason,
            "load_penalty_applied": load_penalty_applied,
            "load_penalty_detail": load_penalty_detail,
        }

    @classmethod
    def classify_rain(cls, rain_in_hr: float) -> Dict[str, Any]:
        """
        Classifies rain precipitation risk:
        - <0.10 in/hr: Low
        - 0.10-0.25 in/hr: Moderate
        - 0.25-0.50 in/hr: High
        - 0.50-1.00 in/hr: Severe
        - >1.00 in/hr: No Travel
        """
        rain = float(rain_in_hr or 0.0)

        if rain > 1.00:
            score = 5
            level = cls.LEVEL_NO_TRAVEL
            reason = f"Torrential downpour ({rain:.2f} in/hr > 1.00 in/hr): Zero visibility and severe hydroplaning risk. No Travel."
        elif rain >= 0.50:
            score = 4
            level = cls.LEVEL_SEVERE
            reason = f"Heavy rain ({rain:.2f} in/hr in 0.50-1.00 in/hr): Severe standing water and poor visibility."
        elif rain >= 0.25:
            score = 3
            level = cls.LEVEL_HIGH
            reason = f"Moderate-heavy rain ({rain:.2f} in/hr in 0.25-0.50 in/hr): High hydroplaning hazard."
        elif rain >= 0.10:
            score = 2
            level = cls.LEVEL_MODERATE
            reason = f"Light-moderate rain ({rain:.2f} in/hr in 0.10-0.25 in/hr): Wet roadway conditions."
        else:
            score = 1
            level = cls.LEVEL_LOW
            reason = f"Negligible/light rain ({rain:.2f} in/hr < 0.10 in/hr): Low hazard."

        return {
            "level": level,
            "score": score,
            "rain_in_hr": rain,
            "reason": reason,
        }

    @classmethod
    def classify_snow(cls, snow_in_hr: float) -> Dict[str, Any]:
        """
        Classifies snowfall precipitation risk:
        - <0.5 in/hr: Low
        - 0.5-1.0 in/hr: Moderate
        - 1.0-2.0 in/hr: High
        - 2.0-3.0 in/hr: Severe
        - >3.0 in/hr: No Travel
        """
        snow = float(snow_in_hr or 0.0)

        if snow > 3.0:
            score = 5
            level = cls.LEVEL_NO_TRAVEL
            reason = f"Blizzard snowfall ({snow:.2f} in/hr > 3.0 in/hr): Total whiteout and unplowable accumulation. No Travel."
        elif snow >= 2.0:
            score = 4
            level = cls.LEVEL_SEVERE
            reason = f"Heavy snowfall ({snow:.2f} in/hr in 2.0-3.0 in/hr): Severe roadway obstruction and black ice."
        elif snow >= 1.0:
            score = 3
            level = cls.LEVEL_HIGH
            reason = f"Moderate snowfall ({snow:.2f} in/hr in 1.0-2.0 in/hr): High loss-of-traction risk."
        elif snow >= 0.5:
            score = 2
            level = cls.LEVEL_MODERATE
            reason = f"Light snowfall ({snow:.2f} in/hr in 0.5-1.0 in/hr): Slippery roadway conditions."
        else:
            score = 1
            level = cls.LEVEL_LOW
            reason = f"Trace snowfall ({snow:.2f} in/hr < 0.5 in/hr): Low hazard."

        return {
            "level": level,
            "score": score,
            "snow_in_hr": snow,
            "reason": reason,
        }

    @classmethod
    def calculate_checkpoint_risk(
        cls,
        weather: Dict[str, Any],
        load_weight: float
    ) -> Dict[str, Any]:
        """
        Calculates the overall risk at a single checkpoint.
        Overall risk = worst (maximum) of wind, rain, and snow risk scores.
        """
        wind_speed = weather.get("wind_speed_mph", 0.0)
        rain_rate = weather.get("rain_in_hr", 0.0)
        snow_rate = weather.get("snow_in_hr", 0.0)
        temp_f = weather.get("temperature_f", None)

        wind_res = cls.classify_wind(wind_speed, load_weight)
        rain_res = cls.classify_rain(rain_rate)
        snow_res = cls.classify_snow(snow_rate)

        scores = [
            ("Wind", wind_res["score"], wind_res["reason"]),
            ("Rain", rain_res["score"], rain_res["reason"]),
            ("Snow", snow_res["score"], snow_res["reason"]),
        ]

        # Overall risk is the highest severity across all conditions
        max_score = max(item[1] for item in scores)
        overall_level = cls.SCORE_TO_LEVEL[max_score]
        overall_color = cls.COLOR_MAP[overall_level]

        # Determine primary hazards (those reaching max_score)
        primary_hazards = [item[0] for item in scores if item[1] == max_score and item[1] > 1]
        primary_hazard_str = " & ".join(primary_hazards) if primary_hazards else "None"

        # Build descriptive narrative
        descriptions = [item[2] for item in scores if item[1] == max_score]
        hazard_summary = " | ".join(descriptions) if descriptions else "Favorable driving conditions."

        return {
            "risk_level": overall_level,
            "risk_score": max_score,
            "color": overall_color,
            "risk_details": {
                "wind_risk": wind_res["level"],
                "wind_score": wind_res["score"],
                "wind_reason": wind_res["reason"],
                "rain_risk": rain_res["level"],
                "rain_score": rain_res["score"],
                "rain_reason": rain_res["reason"],
                "snow_risk": snow_res["level"],
                "snow_score": snow_res["score"],
                "snow_reason": snow_res["reason"],
                "load_weight_lbs": float(load_weight),
                "load_penalty_applied": wind_res["load_penalty_applied"],
                "load_penalty_detail": wind_res["load_penalty_detail"],
                "primary_hazard": primary_hazard_str,
                "hazard_summary": hazard_summary,
            }
        }
