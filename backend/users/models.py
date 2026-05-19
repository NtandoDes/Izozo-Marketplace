from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
import uuid

class UserManager(BaseUserManager):
    """Custom manager for User model with email as username"""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('status', 'active')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = (
        ('customer', 'Customer'),
        ('sme', 'SME'),
        ('agent', 'Agent'),
        ('delivery', 'Delivery'),
        ('admin', 'Admin'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
    )
    
    username = models.CharField(
    max_length=150,
    blank=True,
    null=True,
    unique=False
)
    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    source = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(default=timezone.now)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']
    
    objects = UserManager()
    
    def __str__(self):
        return f"{self.full_name} ({self.email})"
    
    def get_role_display(self):
        """Get human-readable role display"""
        return dict(self.ROLE_CHOICES).get(self.role, self.role)
    
    def get_status_display(self):
        """Get human-readable status display"""
        return dict(self.STATUS_CHOICES).get(self.status, self.status)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']


class PasswordReset(models.Model):
    """
    Model to store password reset tokens
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_resets'
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'password_resets'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Password reset for {self.user.email} - {self.token}"
    
    def is_valid(self):
        """Check if token is still valid"""
        return not self.is_used and timezone.now() < self.expires_at
    
    def mark_as_used(self):
        """Mark token as used"""
        self.is_used = True
        self.save()


class RegistrationLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    email = models.EmailField()
    role = models.CharField(max_length=50)
    source = models.CharField(max_length=255, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    status = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"{self.email} - {self.role} - {self.created_at}"
    
    class Meta:
        db_table = 'registration_logs'
        ordering = ['-created_at']