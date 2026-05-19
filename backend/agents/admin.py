from django.contrib import admin
from .models import AgentProfile, AgentSMEAssignment

@admin.register(AgentProfile)
class AgentProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "has_internet", "has_smartphone", "created_at")
    list_filter = ("has_internet", "has_smartphone", "created_at")
    search_fields = ("user__email", "user__full_name", "home_address")
    readonly_fields = ("created_at",)

@admin.register(AgentSMEAssignment)
class AgentSMEAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "agent", "sme", "active", "assigned_at", "created_at")
    list_filter = ("active", "assigned_at", "created_at")
    search_fields = ("agent__user__email", "sme__business_name")
    readonly_fields = ("assigned_at", "created_at", "updated_at")