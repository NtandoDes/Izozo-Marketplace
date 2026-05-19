# notifications/serializers.py
from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import Notification, NotificationPreference

class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for Notification model
    """
    time_ago = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    related_object_url = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'notification_type_display',
            'title', 'message', 'data', 'is_read',
            'created_at', 'time_ago', 'formatted_date',
            'related_object_url'
        ]
        read_only_fields = ['id', 'created_at']

    def get_time_ago(self, obj):
        """Get human-readable time ago"""
        from django.utils.timesince import timesince
        return timesince(obj.created_at)

    def get_formatted_date(self, obj):
        """Get formatted date"""
        return obj.created_at.strftime('%Y-%m-%d %H:%M')

    def get_related_object_url(self, obj):
        """Get URL for related object if available"""
        if not obj.related_object:
            return None
        
        # Map models to frontend URLs
        from orders.models import Order
        from products.models import Product
        
        if isinstance(obj.related_object, Order):
            return f'/orders/{obj.related_object.order_number}'
        elif isinstance(obj.related_object, Product):
            return f'/products/{obj.related_object.slug}'
        
        return None


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """
    Serializer for NotificationPreference model
    """
    class Meta:
        model = NotificationPreference
        fields = [
            'email_order_updates', 'email_product_updates', 'email_promotions',
            'push_order_updates', 'push_product_updates',
            'in_app_order_updates', 'in_app_product_updates'
        ]


class MarkAsReadSerializer(serializers.Serializer):
    """
    Serializer for marking notifications as read
    """
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False
    )
    mark_all = serializers.BooleanField(default=False)