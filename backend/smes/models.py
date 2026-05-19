from django.db import models
from django.conf import settings
from django.utils import timezone

class SMEProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    business_name = models.CharField(max_length=255)
    owner_name = models.CharField(max_length=255)
    business_type = models.TextField(blank=True, null=True)
    business_address = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return self.business_name
    
    class Meta:
        db_table = 'sme_profiles'
        ordering = ['-created_at']