# notifications/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Notification(models.Model):
    """
    Notification model for all user types
    """
    NOTIFICATION_TYPES = (
        # Order notifications
        ('order_placed', 'New Order Placed'),
        ('order_paid', 'Order Paid'),
        ('order_shipped', 'Order Shipped'),
        ('order_delivered', 'Order Delivered'),
        ('order_cancelled', 'Order Cancelled'),
        
        # Product notifications
        ('product_created', 'New Product Created'),
        ('product_approved', 'Product Approved'),
        ('product_rejected', 'Product Rejected'),
        ('product_pending', 'Product Pending Approval'),
        
        # Agent notifications
        ('agent_assigned', 'Agent Assigned to SME'),
        ('agent_commission', 'Commission Earned'),
        
        # SME notifications
        ('order_ready_pickup', 'Order Ready for Pickup'),
        ('revenue_updated', 'Revenue Updated'),
        
        # Platform notifications
        ('platform_announcement', 'Platform Announcement'),
        ('account_approved', 'Account Approved'),
        ('account_suspended', 'Account Suspended'),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # For linking to related objects (order, product, etc.)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    # Additional data as JSON
    data = models.JSONField(default=dict, blank=True)
    
    # Status
    is_read = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
            models.Index(fields=['notification_type']),
        ]

    def __str__(self):
        return f"{self.recipient.email} - {self.title}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()

    @classmethod
    def mark_all_as_read(cls, user):
        cls.objects.filter(recipient=user, is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )


class NotificationPreference(models.Model):
    """
    User preferences for notifications
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    
    # Email notifications
    email_order_updates = models.BooleanField(default=True)
    email_product_updates = models.BooleanField(default=True)
    email_promotions = models.BooleanField(default=False)
    
    # Push notifications (for future)
    push_order_updates = models.BooleanField(default=True)
    push_product_updates = models.BooleanField(default=True)
    
    # In-app notifications
    in_app_order_updates = models.BooleanField(default=True)
    in_app_product_updates = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'notification_preferences'

    def __str__(self):
        return f"Preferences for {self.user.email}"