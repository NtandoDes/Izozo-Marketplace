from django.db import models
from django.conf import settings
from django.utils import timezone

class DeliveryProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    home_address = models.TextField()
    vehicle_type = models.CharField(max_length=255, blank=True, null=True)
    has_internet = models.BooleanField(default=False)
    has_smartphone = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"{self.user.full_name} - Delivery"
    
    class Meta:
        db_table = 'delivery_profiles'
        ordering = ['-created_at']