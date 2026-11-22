"""
URL configuration for Weather-Aware Truck Routing backend.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('routing.urls')),
    path('', include('routing.urls')),  # Root fallback so both /api/routes/ and /routes/ resolve
]
