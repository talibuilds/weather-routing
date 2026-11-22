"""
Recommendation Service.
Implements the exact multi-criteria ranking rules:
Prefer:
1. Fewest Severe miles (and No Travel miles)
2. Fewest High miles
3. Lowest average risk
4. Shortest travel times
"""
from typing import List, Dict, Any, Tuple
from .risk_calculator import RiskCalculator


class RouteRecommender:

    @classmethod
    def evaluate_and_rank_routes(
        cls,
        routes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Evaluates summaries for all routes, applies the ranking rules,
        selects the best route, and compiles explanatory reasoning.
        """
        if not routes:
            return {
                "recommended_route_index": 0,
                "recommended_route_name": "",
                "reason": "No routes available to rank.",
                "rankings": [],
            }

        summarized_routes = []
        for r in routes:
            summary = cls.summarize_route(r)
            r["route_summary"] = summary
            summarized_routes.append((r, summary))

        # Sorting key according to assignment criteria:
        # 1. Fewest No Travel + Severe miles (Critical safety violation)
        # 2. Fewest High risk miles
        # 3. Lowest average risk score
        # 4. Shortest travel time (duration in hours)
        def sorting_key(item: Tuple[Dict[str, Any], Dict[str, Any]]):
            s = item[1]
            critical_miles = s["no_travel_miles"] + s["severe_miles"]
            return (
                round(critical_miles, 2),
                round(s["high_miles"], 2),
                round(s["avg_risk"], 2),
                round(s["total_duration_hours"], 2),
                round(s["total_distance_miles"], 2),
            )

        ranked = sorted(summarized_routes, key=sorting_key)

        rankings_list = []
        for rank_num, (r, s) in enumerate(ranked, start=1):
            rankings_list.append({
                "rank": rank_num,
                "route_index": r["route_index"],
                "name": r["name"],
                "avg_risk": s["avg_risk"],
                "max_risk_level": s["max_risk_level"],
                "no_travel_miles": s["no_travel_miles"],
                "severe_miles": s["severe_miles"],
                "high_miles": s["high_miles"],
                "moderate_miles": s["moderate_miles"],
                "low_miles": s["low_miles"],
                "total_distance_miles": s["total_distance_miles"],
                "total_duration_hours": s["total_duration_hours"],
                "total_duration_formatted": s["total_duration_formatted"],
            })

        best_route, best_summary = ranked[0]
        reason = cls._generate_recommendation_reason(ranked)

        return {
            "recommended_route_index": best_route["route_index"],
            "recommended_route_name": best_route["name"],
            "reason": reason,
            "rankings": rankings_list,
        }

    @classmethod
    def summarize_route(cls, route: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates cumulative miles per risk level, average risk,
        severe/high mile counts, and extreme weather metrics.
        """
        checkpoints = route.get("checkpoints", [])
        total_dist = float(route.get("total_distance_miles", 0.0))
        total_dur_hours = float(route.get("total_duration_hours", 0.0))
        total_dur_fmt = route.get("total_duration_formatted", "")

        if not checkpoints:
            return {
                "total_distance_miles": total_dist,
                "total_duration_hours": total_dur_hours,
                "total_duration_formatted": total_dur_fmt,
                "avg_risk": 1.0,
                "max_risk_level": RiskCalculator.LEVEL_LOW,
                "max_risk_score": 1,
                "low_miles": total_dist,
                "moderate_miles": 0.0,
                "high_miles": 0.0,
                "severe_miles": 0.0,
                "no_travel_miles": 0.0,
                "no_travel_segments": 0,
                "severe_miles_count": 0,
                "high_miles_count": 0,
                "weather_extremes": {
                    "max_wind_mph": 0.0,
                    "max_rain_in_hr": 0.0,
                    "max_snow_in_hr": 0.0,
                    "min_temp_f": 50.0,
                    "max_temp_f": 50.0,
                },
                "risk_distribution": {"Low": 0, "Moderate": 0, "High": 0, "Severe": 0, "No Travel": 0},
            }

        risk_scores = []
        low_miles = 0.0
        moderate_miles = 0.0
        high_miles = 0.0
        severe_miles = 0.0
        no_travel_miles = 0.0
        no_travel_count = 0
        severe_count = 0
        high_count = 0

        max_wind = 0.0
        max_rain = 0.0
        max_snow = 0.0
        temps = []
        distribution = {"Low": 0, "Moderate": 0, "High": 0, "Severe": 0, "No Travel": 0}

        # Calculate segment miles attributed to risk levels
        for idx, cp in enumerate(checkpoints):
            level = cp.get("risk_level", RiskCalculator.LEVEL_LOW)
            score = cp.get("risk_score", 1)
            risk_scores.append(score)
            distribution[level] = distribution.get(level, 0) + 1

            # Weather extremes
            w = cp.get("weather", {})
            wind = float(w.get("wind_speed_mph", 0.0))
            rain = float(w.get("rain_in_hr", 0.0))
            snow = float(w.get("snow_in_hr", 0.0))
            temp = w.get("temperature_f")

            if wind > max_wind:
                max_wind = wind
            if rain > max_rain:
                max_rain = rain
            if snow > max_snow:
                max_snow = snow
            if temp is not None:
                temps.append(float(temp))

            # Segment distance: for checkpoint 0, seg_miles is 0.
            # Segment k connects checkpoint k-1 to checkpoint k.
            seg_miles = float(cp.get("segment_miles", 0.0))

            # Conservative truck safety: assign segment risk to the higher of cp[k-1] and cp[k]
            if idx > 0:
                prev_cp = checkpoints[idx - 1]
                effective_score = max(score, prev_cp.get("risk_score", 1))
                effective_level = RiskCalculator.SCORE_TO_LEVEL[effective_score]
            else:
                effective_level = level

            if effective_level == RiskCalculator.LEVEL_NO_TRAVEL:
                no_travel_miles += seg_miles
                no_travel_count += 1
            elif effective_level == RiskCalculator.LEVEL_SEVERE:
                severe_miles += seg_miles
                severe_count += 1
            elif effective_level == RiskCalculator.LEVEL_HIGH:
                high_miles += seg_miles
                high_count += 1
            elif effective_level == RiskCalculator.LEVEL_MODERATE:
                moderate_miles += seg_miles
            else:
                low_miles += seg_miles

        # Reconcile mile sums with total distance
        total_seg_miles = low_miles + moderate_miles + high_miles + severe_miles + no_travel_miles
        if total_seg_miles > 0 and total_dist > 0:
            scale = total_dist / total_seg_miles
            low_miles = round(low_miles * scale, 1)
            moderate_miles = round(moderate_miles * scale, 1)
            high_miles = round(high_miles * scale, 1)
            severe_miles = round(severe_miles * scale, 1)
            no_travel_miles = round(no_travel_miles * scale, 1)

        avg_risk = round(sum(risk_scores) / len(risk_scores), 2) if risk_scores else 1.0
        max_score = max(risk_scores) if risk_scores else 1
        max_level = RiskCalculator.SCORE_TO_LEVEL[max_score]

        return {
            "total_distance_miles": total_dist,
            "total_duration_hours": total_dur_hours,
            "total_duration_formatted": total_dur_fmt,
            "avg_risk": avg_risk,
            "max_risk_level": max_level,
            "max_risk_score": max_score,
            "low_miles": low_miles,
            "moderate_miles": moderate_miles,
            "high_miles": high_miles,
            "severe_miles": severe_miles,
            "no_travel_miles": no_travel_miles,
            "no_travel_segments": no_travel_count,
            "severe_miles_count": severe_count,
            "high_miles_count": high_count,
            "weather_extremes": {
                "max_wind_mph": round(max_wind, 1),
                "max_rain_in_hr": round(max_rain, 2),
                "max_snow_in_hr": round(max_snow, 2),
                "min_temp_f": round(min(temps), 1) if temps else 50.0,
                "max_temp_f": round(max(temps), 1) if temps else 50.0,
            },
            "risk_distribution": distribution,
        }

    @classmethod
    def _generate_recommendation_reason(
        cls,
        ranked_items: List[Tuple[Dict[str, Any], Dict[str, Any]]]
    ) -> str:
        """
        Creates a clear, human-understandable justification explaining why
        the top route was chosen according to the 4 criteria.
        """
        best_route, best_summary = ranked_items[0]
        crit_miles = best_summary["no_travel_miles"] + best_summary["severe_miles"]
        high_miles = best_summary["high_miles"]
        avg_risk = best_summary["avg_risk"]
        duration_fmt = best_summary["total_duration_formatted"]

        bullet_points = []

        if crit_miles == 0.0:
            bullet_points.append("Zero Severe or No Travel miles detected (safest corridor)")
        else:
            bullet_points.append(f"Lowest critical hazard exposure ({crit_miles:.1f} mi Severe/No Travel)")

        if high_miles == 0.0:
            bullet_points.append("Zero High risk miles")
        else:
            bullet_points.append(f"Only {high_miles:.1f} mi in High risk conditions")

        bullet_points.append(f"Lowest average weather risk score: {avg_risk:.2f}/5.0")
        bullet_points.append(f"Optimal travel time of {duration_fmt} ({best_summary['total_distance_miles']:.1f} miles)")

        # Compare with 2nd place if available
        comparison_note = ""
        if len(ranked_items) > 1:
            second_route, second_summary = ranked_items[1]
            second_crit = second_summary["no_travel_miles"] + second_summary["severe_miles"]
            if second_crit > crit_miles:
                comparison_note = f" Avoids {second_crit:.1f} miles of Severe/No Travel hazards present on {second_route['name']}."
            elif second_summary["high_miles"] > high_miles:
                diff = second_summary["high_miles"] - high_miles
                comparison_note = f" Eliminates {diff:.1f} miles of High risk present on {second_route['name']}."
            elif second_summary["total_duration_hours"] > best_summary["total_duration_hours"]:
                diff_hours = second_summary["total_duration_hours"] - best_summary["total_duration_hours"]
                comparison_note = f" Saves ~{diff_hours:.1f} hours compared to {second_route['name']}."

        joined_bullets = "; ".join(bullet_points)
        return f"{best_route['name']} is recommended: {joined_bullets}.{comparison_note}"
