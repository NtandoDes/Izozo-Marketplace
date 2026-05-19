from django.contrib import admin
from .models import AdminActionLog, SystemSettings, AdminNotification, BulkAction

@admin.register(AdminActionLog)
class AdminActionLogAdmin(admin.ModelAdmin):
    list_display = ('admin', 'action_type', 'target_user', 'created_at')
    list_filter = ('action_type', 'created_at')
    search_fields = ('admin__email', 'target_user__email', 'description')
    readonly_fields = ('created_at',)

@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = ('key', 'is_public', 'updated_at')
    list_filter = ('is_public',)
    search_fields = ('key', 'description')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(AdminNotification)
class AdminNotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'recipient', 'priority', 'status', 'created_at')
    list_filter = ('priority', 'status', 'created_at')
    search_fields = ('title', 'message', 'recipient__email')
    readonly_fields = ('created_at', 'read_at')

@admin.register(BulkAction)
class BulkActionAdmin(admin.ModelAdmin):
    list_display = ('admin', 'action_type', 'status', 'created_at', 'completed_at')
    list_filter = ('action_type', 'status', 'created_at')
    readonly_fields = ('created_at', 'completed_at')