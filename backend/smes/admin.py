from django.contrib import admin
from .models import SMEProfile

@admin.register(SMEProfile)
class SMEProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "business_name", "owner_name", "user", "created_at")
    list_filter = ("created_at",)
    search_fields = ("business_name", "owner_name", "user__email")
    readonly_fields = ("created_at",)