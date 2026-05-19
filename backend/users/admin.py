from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, RegistrationLog

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ("id", "email", "full_name", "role", "phone", "status", "is_active", "created_at")
    list_filter = ("role", "status", "is_active", "created_at")
    search_fields = ("email", "full_name", "phone")
    ordering = ("-created_at",)
    
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal Info", {"fields": ("full_name", "phone", "source")}),
        ("Role & Status", {"fields": ("role", "status")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined", "created_at")}),
    )
    
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name", "phone", "role", "password1", "password2"),
        }),
    )
    
    readonly_fields = ("created_at",)

@admin.register(RegistrationLog)
class RegistrationLogAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "source", "ip_address", "created_at")
    list_filter = ("role", "created_at")
    search_fields = ("email", "source")
    readonly_fields = ("created_at",)