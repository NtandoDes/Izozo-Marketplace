from django.contrib import admin
from .models import DeliveryProfile

@admin.register(DeliveryProfile)
class DeliveryProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "vehicle_type", "has_internet", "has_smartphone", "created_at")
    list_filter = ("vehicle_type", "has_internet", "has_smartphone", "created_at")
    search_fields = ("user__email", "user__full_name", "home_address", "vehicle_type")
    readonly_fields = ("created_at",)