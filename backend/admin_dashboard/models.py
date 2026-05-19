from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class AdminActionLog(models.Model):
    """Log all admin actions for audit purposes"""
    ACTION_TYPES = (
        ('user_approve', 'User Approved'),
        ('user_reject', 'User Rejected'),
        ('user_suspend', 'User Suspended'),
        ('user_activate', 'User Activated'),
        ('user_delete', 'User Deleted'),
        ('assignment_create', 'Assignment Created'),
        ('assignment_update', 'Assignment Updated'),
        ('assignment_delete', 'Assignment Deleted'),
        ('system_config', 'System Configuration'),
        ('bulk_action', 'Bulk Action'),
    )
    
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='admin_actions'
    )
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES)
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='targeted_actions'
    )
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'admin_action_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['action_type']),
            models.Index(fields=['admin']),
        ]
    
    def __str__(self):
        return f"{self.admin} - {self.get_action_type_display()} - {self.created_at}"


class SystemSettings(models.Model):
    """System-wide configuration settings"""
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.JSONField(default=dict)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_settings'
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'system_settings'
        verbose_name_plural = 'System Settings'
    
    def __str__(self):
        return self.key


class AdminNotification(models.Model):
    """Admin notifications for important events"""
    PRIORITY_CHOICES = (
        (1, 'Low'),
        (2, 'Medium'),
        (3, 'High'),
        (4, 'Urgent'),
    )
    
    STATUS_CHOICES = (
        ('unread', 'Unread'),
        ('read', 'Read'),
        ('archived', 'Archived'),
    )
    
    title = models.CharField(max_length=255)
    message = models.TextField()
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unread')
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='admin_notifications'
    )
    action_url = models.CharField(max_length=500, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'admin_notifications'
        ordering = ['-priority', '-created_at']
        indexes = [
            models.Index(fields=['status', 'recipient']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.recipient.email}"
    
    def mark_as_read(self):
        self.status = 'read'
        self.read_at = timezone.now()
        self.save()


class BulkAction(models.Model):
    """Track bulk operations performed by admins"""
    ACTION_TYPES = (
        ('approve_users', 'Approve Users'),
        ('suspend_users', 'Suspend Users'),
        ('activate_users', 'Activate Users'),
        ('delete_users', 'Delete Users'),
        ('assign_agents', 'Assign Agents'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )
    
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='bulk_actions'
    )
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_items = models.IntegerField(default=0)
    processed_items = models.IntegerField(default=0)
    successful_items = models.IntegerField(default=0)
    failed_items = models.IntegerField(default=0)
    metadata = models.JSONField(default=dict)
    error_log = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'bulk_actions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_action_type_display()} - {self.created_at}"
    
    def update_progress(self, processed, successful, failed):
        self.processed_items = processed
        self.successful_items = successful
        self.failed_items = failed
        if processed >= self.total_items:
            self.status = 'completed'
            self.completed_at = timezone.now()
        self.save()