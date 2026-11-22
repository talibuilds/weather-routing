"""
Serializers for Route Planning and Weather Heatmap requests.
"""
from rest_framework import serializers
from django.utils import timezone


class RoutePlanRequestSerializer(serializers.Serializer):
    """
    Validates user input for route planning:
    - origin (e.g., 'Chicago, IL' or '41.8781, -87.6298')
    - destination (e.g., 'Denver, CO' or '39.7392, -104.9903')
    - departure_datetime (ISO 8601 string, defaults to current time)
    - load_weight (lbs, e.g., 42000)
    - sampling_interval_miles (10, 25, or 50 miles, default 25)
    """
    origin = serializers.CharField(
        max_length=255,
        required=True,
        allow_blank=False,
        help_text="Origin location name, address, or lat,lng coordinates."
    )
    destination = serializers.CharField(
        max_length=255,
        required=True,
        allow_blank=False,
        help_text="Destination location name, address, or lat,lng coordinates."
    )
    departure_datetime = serializers.DateTimeField(
        required=False,
        default=timezone.now,
        help_text="Departure date and time in ISO 8601 format."
    )
    load_weight = serializers.FloatField(
        required=False,
        default=35000.0,
        min_value=0.0,
        max_value=150000.0,
        help_text="Total truck load weight in pounds (lbs). Affects high-wind safety thresholds."
    )
    sampling_interval_miles = serializers.ChoiceField(
        choices=[10, 25, 50],
        default=25,
        required=False,
        help_text="Checkpoint sampling frequency along the route in miles (10, 25, or 50)."
    )


class HeatmapRequestSerializer(serializers.Serializer):
    """
    Validates query parameters or body for corridor weather heatmap:
    - origin & destination (or coordinates)
    - load_weight (for wind risk classification)
    - hours (forecast duration, 1-48, default 48)
    """
    origin = serializers.CharField(required=False, allow_blank=True, default="Chicago, IL")
    destination = serializers.CharField(required=False, allow_blank=True, default="Denver, CO")
    load_weight = serializers.FloatField(required=False, default=35000.0, min_value=0.0)
    hours = serializers.IntegerField(required=False, default=48, min_value=1, max_value=72)
