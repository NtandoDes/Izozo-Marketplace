from django.db import models
from django.conf import settings
from django.utils import timezone
from orders.models import Order
import uuid

class Payment(models.Model):
    """
    Payment model for tracking customer payments
    """
    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('cancelled', 'Cancelled'),
    )

    PAYMENT_METHOD_CHOICES = (
        ('card', 'Credit/Debit Card'),
        ('cash_on_delivery', 'Cash on Delivery'),
        ('eft', 'EFT/Bank Transfer'),
        ('snapscan', 'SnapScan'),
        ('zapper', 'Zapper'),
        ('mobile_money', 'Mobile Money'),
    )

    # Core fields
    payment_id = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name='payment'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payments'
    )
    
    # Payment details
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    
    # Transaction details
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    gateway_response = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment_id']),
            models.Index(fields=['order', 'payment_status']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"Payment {self.payment_id} - {self.amount} - {self.payment_status}"

    def mark_as_completed(self):
        self.payment_status = 'completed'
        self.completed_at = timezone.now()
        self.save()

    def mark_as_failed(self):
        self.payment_status = 'failed'
        self.save()

    def mark_as_refunded(self):
        self.payment_status = 'refunded'
        self.save()


class PaymentMethod(models.Model):
    """
    Saved payment methods for users (cards, etc.)
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payment_methods'
    )
    payment_type = models.CharField(max_length=20, choices=Payment.PAYMENT_METHOD_CHOICES)
    
    # Card details (tokenized/stored securely)
    card_last4 = models.CharField(max_length=4, blank=True, null=True)
    card_brand = models.CharField(max_length=50, blank=True, null=True)  # Visa, Mastercard, etc.
    card_expiry_month = models.CharField(max_length=2, blank=True, null=True)
    card_expiry_year = models.CharField(max_length=4, blank=True, null=True)
    card_token = models.CharField(max_length=255, blank=True, null=True)  # Token from payment gateway
    
    # Bank details for EFT
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    account_number = models.CharField(max_length=50, blank=True, null=True)  # Last 4 digits only
    account_holder = models.CharField(max_length=255, blank=True, null=True)
    
    # Mobile money
    mobile_provider = models.CharField(max_length=50, blank=True, null=True)
    mobile_number = models.CharField(max_length=20, blank=True, null=True)
    
    # Metadata
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'payment_methods'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        if self.card_last4:
            return f"{self.card_brand} ****{self.card_last4}"
        return f"{self.payment_type} - {self.user.email}"


class Transaction(models.Model):
    """
    Transaction log for all payment activities
    """
    TRANSACTION_TYPES = (
        ('authorization', 'Authorization'),
        ('capture', 'Capture'),
        ('sale', 'Sale'),
        ('refund', 'Refund'),
        ('void', 'Void'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('error', 'Error'),
    )

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Gateway response
    gateway_transaction_id = models.CharField(max_length=255, blank=True, null=True)
    gateway_response = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} - {self.status}"