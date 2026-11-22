"""
URL patterns for the routing app.
"""
from django.urls import path
from .views import (
    RoutePlanningView,
    WeatherHeatmapView,
    GeocodeView,
    HealthCheckView,
)

urlpatterns = [
    path('routes/', RoutePlanningView.as_view(), name='route-planning'),
    path('weather-heatmap/', WeatherHeatmapView.as_view(), name='weather-heatmap'),
    path('geocode/', GeocodeView.as_view(), name='geocode'),
    path('health/', HealthCheckView.as_view(), name='health-check'),
]
