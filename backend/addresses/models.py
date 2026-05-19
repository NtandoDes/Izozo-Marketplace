from django.db import models
from django.conf import settings
from django.utils import timezone

class Address(models.Model):
    """
    Address model for users (billing, shipping, etc.)
    """
    ADDRESS_TYPES = (
        ('billing', 'Billing Address'),
        ('shipping', 'Shipping Address'),
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='addresses'
    )
    address_type = models.CharField(
        max_length=20,
        choices=ADDRESS_TYPES,
        default='shipping'
    )
    
    # Recipient information
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    
    # Address details
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='South Africa')
    
    # Metadata
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'addresses'
        ordering = ['-is_default', '-created_at']
        indexes = [
            models.Index(fields=['user', 'is_default']),
            models.Index(fields=['user', 'address_type']),
        ]
    
    def __str__(self):
        return f"{self.full_name} - {self.address_line1}, {self.city}"
    
    def save(self, *args, **kwargs):
        # If this address is set as default, unset other default addresses of the same type
        if self.is_default:
            Address.objects.filter(
                user=self.user,
                address_type=self.address_type,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
    
    @property
    def full_address(self):
        """Return formatted full address"""
        parts = [self.address_line1]
        if self.address_line2:
            parts.append(self.address_line2)
        parts.append(f"{self.city}, {self.state} {self.postal_code}")
        parts.append(self.country)
        return ', '.join(parts)


class AddressBook(models.Model):
    """
    User's address book for managing multiple addresses
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='address_book'
    )
    addresses = models.ManyToManyField(
        Address,
        related_name='address_books',
        blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'address_books'
    
    def __str__(self):
        return f"Address Book - {self.user.email}"