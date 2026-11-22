from django.db import models


class RouteQueryLog(models.Model):
    """Logs route requests and analysis for auditing, debugging, and analytics."""
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    departure_datetime = models.DateTimeField()
    load_weight = models.FloatField(help_text="Load weight in pounds (lbs)")
    sampling_interval_miles = models.IntegerField(default=25)
    recommended_route_index = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.origin} -> {self.destination} ({self.load_weight:,.0f} lbs, {self.created_at:%Y-%m-%d %H:%M})"

    class Meta:
        ordering = ['-created_at']
