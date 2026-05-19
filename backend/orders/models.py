# orders/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from addresses.models import Address
from products.models import Product, ProductVariant


class Order(models.Model):
    """
    Order model for customer purchases
    """
    ORDER_STATUS_CHOICES = (
        ('pending', 'Pending Payment'),
        ('processing', 'Processing'),
        ('paid', 'Paid'),
        ('collected', 'Collected by Agent'),  # New status - agent picked up from SME
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    )
    
    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )
    
    ORDER_TYPE_CHOICES = (
        ('platform', 'Platform Order'),
        ('agent', 'Agent Assisted Order'),
    )
    
    # Core fields
    order_number = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='orders'
    )
    
    # Agent information (for assisted orders)
    agent = models.ForeignKey(
        'agents.AgentProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assisted_orders'
    )
    
    # Order type
    order_type = models.CharField(
        max_length=20,
        choices=ORDER_TYPE_CHOICES,
        default='platform'
    )
    
    # Order status
    status = models.CharField(
        max_length=20,
        choices=ORDER_STATUS_CHOICES,
        default='pending'
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    
    # Customer information (snapshot at time of order)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=20)
    customer_full_name = models.CharField(max_length=255)
    
    # Addresses (snapshot at time of order)
    shipping_address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True,
        related_name='shipping_orders'
    )
    shipping_address_snapshot = models.JSONField(default=dict)
    
    billing_address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True,
        related_name='billing_orders'
    )
    billing_address_snapshot = models.JSONField(default=dict)
    
    # Financials
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Payment
    payment_method = models.CharField(max_length=100, blank=True, null=True)
    payment_reference = models.CharField(max_length=100, blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    
    # Shipping
    shipping_method = models.CharField(max_length=100, blank=True, null=True)
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    carrier = models.CharField(max_length=100, blank=True, null=True)  # New field for shipping carrier
    
    # Agent tracking fields - who handled each stage
    collected_by = models.ForeignKey(
        'agents.AgentProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collected_orders'
    )
    collected_at = models.DateTimeField(null=True, blank=True)
    
    shipped_by = models.ForeignKey(
        'agents.AgentProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipped_orders'
    )
    shipped_at = models.DateTimeField(null=True, blank=True)
    
    delivered_by = models.ForeignKey(
        'agents.AgentProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='delivered_orders'
    )
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    # Notes
    customer_notes = models.TextField(blank=True, null=True)
    admin_notes = models.TextField(blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['agent', 'created_at']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['status', 'collected_by']),  # New index for agent queries
            models.Index(fields=['status', 'shipped_by']),    # New index for agent queries
            models.Index(fields=['status', 'delivered_by']),  # New index for agent queries
        ]
    
    def __str__(self):
        return f"Order #{self.order_number}"
    
    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self.generate_order_number()
        super().save(*args, **kwargs)
    
    def generate_order_number(self):
        """Generate unique order number"""
        import random
        import string
        timestamp = timezone.now().strftime('%Y%m%d')
        random_chars = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"ORD-{timestamp}-{random_chars}"
    
    @property
    def item_count(self):
        """Get total number of items in order"""
        return self.items.aggregate(total=models.Sum('quantity'))['total'] or 0
    
    @property
    def unique_product_count(self):
        """Get number of unique products in order"""
        return self.items.values('product_id').distinct().count()
    
    @property
    def agent_commission_total(self):
        """Get total commission for all agents from this order"""
        return self.items.aggregate(total=models.Sum('commission_amount'))['total'] or 0
    
    def get_sme_items(self, sme_id):
        """Get items belonging to a specific SME"""
        return self.items.filter(sme_id=sme_id)
    
    def get_sme_revenue(self, sme_id):
        """Get total revenue for a specific SME from this order"""
        return self.items.filter(sme_id=sme_id).aggregate(
            total=models.Sum('total')
        )['total'] or 0


class OrderItem(models.Model):
    """
    Individual items within an order
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items'
    )
    
    # Product information (snapshot at time of order)
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        related_name='order_items'
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_items'
    )
    
    # Product snapshot
    product_id_snapshot = models.IntegerField(null=True, blank=True)
    product_name = models.CharField(max_length=255)
    product_sku = models.CharField(max_length=100, blank=True, null=True)
    variant_name = models.CharField(max_length=255, blank=True, null=True)
    variant_attributes = models.JSONField(default=dict, blank=True)
    
    # Pricing
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField(default=1)
    
    # Totals
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Commission (for agent orders)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # SME information (for agent commission tracking)
    sme = models.ForeignKey(
        'smes.SMEProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_items'
    )
    
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'order_items'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', 'product']),
            models.Index(fields=['product', 'created_at']),
            models.Index(fields=['sme']),
            models.Index(fields=['order', 'sme']),  # New index for SME queries
        ]
    
    def __str__(self):
        return f"{self.product_name} x{self.quantity} - Order #{self.order.order_number}"
    
    def save(self, *args, **kwargs):
        # Calculate subtotal and total
        self.subtotal = self.unit_price * self.quantity
        self.total = self.subtotal - self.discount_amount + self.tax_amount
        
        # Calculate commission
        if self.commission_rate > 0:
            self.commission_amount = (self.subtotal * self.commission_rate) / Decimal('100')
        
        # Set product snapshot
        if self.product and not self.product_id_snapshot:
            self.product_id_snapshot = self.product.id
            self.product_sku = self.product.sku or self.product_sku
            
        super().save(*args, **kwargs)


class OrderStatusHistory(models.Model):
    """
    Track order status changes
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='status_history'
    )
    status = models.CharField(max_length=20, choices=Order.ORDER_STATUS_CHOICES)
    notes = models.TextField(blank=True, null=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='order_status_changes'
    )
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'order_status_history'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', 'created_at']),
        ]
    
    def __str__(self):
        return f"Order #{self.order.order_number} - {self.status} at {self.created_at}"


class AgentCommission(models.Model):
    """
    Track agent commissions separately (optional - for detailed tracking)
    """
    COMMISSION_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('cancelled', 'Cancelled'),
    )
    
    agent = models.ForeignKey(
        'agents.AgentProfile',
        on_delete=models.CASCADE,
        related_name='commissions'
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='agent_commissions'
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='agent_commission'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=COMMISSION_STATUS_CHOICES,
        default='pending'
    )
    sme = models.ForeignKey(
        'smes.SMEProfile',
        on_delete=models.SET_NULL,
        null=True,
        related_name='agent_commissions'
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'agent_commissions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['agent', 'created_at']),
            models.Index(fields=['order']),
        ]
    
    def __str__(self):
        return f"Commission for {self.agent.user.email} - R{self.amount} - Order #{self.order.order_number}"
    
    def mark_as_paid(self):
        self.status = 'paid'
        self.paid_at = timezone.now()
        self.save()