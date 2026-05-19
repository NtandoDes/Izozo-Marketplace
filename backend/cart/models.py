from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class Cart(models.Model):
    """
    Shopping cart model for customers (authenticated and guest)
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='carts'
    )
    session_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'carts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session_id']),
            models.Index(fields=['user', 'created_at']),
        ]
    
    def __str__(self):
        if self.user:
            return f"Cart - {self.user.email}"
        return f"Cart - {self.session_id}"
    
    @property
    def item_count(self):
        """Get total number of items in cart"""
        return self.items.aggregate(total=models.Sum('quantity'))['total'] or 0
    
    @property
    def subtotal(self):
        """Calculate cart subtotal"""
        return sum(item.subtotal for item in self.items.all())
    
    @property
    def unique_product_count(self):
        """Get number of unique products in cart"""
        return self.items.values('product_id').distinct().count()


class CartItem(models.Model):
    """
    Individual items within a cart
    """
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='cart_items'
    )
    variant = models.ForeignKey(
        'products.ProductVariant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cart_items'
    )
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)  # Price at time of adding to cart
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'cart_items'
        ordering = ['-created_at']
        unique_together = ['cart', 'product', 'variant']  # Prevent duplicate items
    
    def __str__(self):
        return f"{self.quantity}x {self.product.name} in cart"
    
    @property
    def subtotal(self):
        """Calculate item subtotal"""
        return self.price * self.quantity
    
    @property
    def product_name(self):
        """Get product name"""
        return self.product.name
    
    @property
    def product_sku(self):
        """Get product SKU"""
        return self.product.sku
    
    @property
    def variant_name(self):
        """Get variant name if exists"""
        return self.variant.name if self.variant else None
    
    @property
    def sme_id(self):
        """Get SME ID from product"""
        return self.product.sme_id
    
    @property
    def sme_name(self):
        """Get SME name from product"""
        return self.product.sme.business_name if self.product.sme else None
    
    @property
    def commission_rate(self):
        """Get commission rate from product"""
        return self.product.commission_rate