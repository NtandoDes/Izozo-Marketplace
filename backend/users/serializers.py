# users/serializers.py
from venv import logger
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from .models import User, RegistrationLog, PasswordReset

# ============================================================================
# AUTHENTICATION SERIALIZERS
# ============================================================================

class LandingPageRegistrationSerializer(serializers.Serializer):
    """Base serializer for landing page registration"""
    name = serializers.CharField(max_length=255, write_only=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(max_length=20)
    source = serializers.CharField(max_length=255, required=False, allow_blank=True)
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value


class SMELandingPageSerializer(LandingPageRegistrationSerializer):
    """Serializer for SME landing page registration"""
    businessName = serializers.CharField(write_only=True, max_length=255)
    businessAddress = serializers.CharField(write_only=True)
    products = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    otherProduct = serializers.CharField(write_only=True, required=False, allow_blank=True)


class AgentLandingPageSerializer(LandingPageRegistrationSerializer):
    """Serializer for Agent landing page registration"""
    homeAddress = serializers.CharField(write_only=True)
    hasInternetData = serializers.BooleanField(write_only=True)
    hasSmartphone = serializers.BooleanField(write_only=True)


class DeliveryLandingPageSerializer(LandingPageRegistrationSerializer):
    """Serializer for Delivery landing page registration"""
    homeAddress = serializers.CharField(write_only=True)
    hasInternetData = serializers.BooleanField(write_only=True)
    hasSmartphone = serializers.BooleanField(write_only=True)
    hasMotorbike = serializers.BooleanField(write_only=True, required=False, default=False)
    hasVehicle = serializers.BooleanField(write_only=True, required=False, default=False)
    hasFleet = serializers.BooleanField(write_only=True, required=False, default=False)


class CustomerRegisterSerializer(serializers.ModelSerializer):
    """Serializer for customer registration - Auto-approved"""
    password = serializers.CharField(write_only=True, min_length=6)
    
    class Meta:
        model = User
        fields = ['full_name', 'email', 'password']
        extra_kwargs = {
            'full_name': {'required': True},
            'email': {'required': True},
        }
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value
    
    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            role='customer',
            status='active'  # ✅ Auto-approve customers - no admin approval needed
        )
        return user


class AdminRegisterSerializer(serializers.ModelSerializer):
    """Serializer for admin registration"""
    password = serializers.CharField(write_only=True, min_length=8)
    admin_secret_key = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['email', 'password', 'full_name', 'phone', 'admin_secret_key']
        extra_kwargs = {
            'full_name': {'required': True},
            'email': {'required': True},
            'phone': {'required': True},
        }
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value
    
    def validate_admin_secret_key(self, value):
        from django.conf import settings
        admin_secret = getattr(settings, 'ADMIN_REGISTRATION_SECRET_KEY', 'izozo-admin-secret-2024')
        
        if value != admin_secret:
            raise serializers.ValidationError("Invalid admin registration key")
        return value
    
    def create(self, validated_data):
        validated_data.pop('admin_secret_key')
        
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            phone=validated_data['phone'],
            role='admin',
            status='active'
        )
        
        # Log admin registration
        request = self.context.get('request')
        RegistrationLog.objects.create(
            user=user,
            email=user.email,
            role=user.role,
            source='admin_registration',
            ip_address=request.META.get('REMOTE_ADDR') if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT') if request else None,
            status='Admin registered successfully'
        )
        
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    
    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        
        if email and password:
            user = authenticate(request=self.context.get('request'), 
                              username=email, password=password)
            if not user:
                raise serializers.ValidationError("Invalid email or password")
            if user.status != 'active':
                raise serializers.ValidationError("Account is not active. Please contact support.")
        else:
            raise serializers.ValidationError("Must include email and password")
        
        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'phone', 'role', 'role_display', 
                 'status', 'status_display', 'created_at']
        read_only_fields = ['id', 'role', 'status', 'created_at']


class CustomerProfileSerializer(serializers.ModelSerializer):
    """Serializer for customer profile updates"""
    class Meta:
        model = User
        fields = ['full_name', 'phone']
    
    def update(self, instance, validated_data):
        instance.full_name = validated_data.get('full_name', instance.full_name)
        instance.phone = validated_data.get('phone', instance.phone)
        instance.save()
        return instance


# ============================================================================
# PASSWORD RESET SERIALIZERS
# ============================================================================

class ForgotPasswordSerializer(serializers.Serializer):
    """
    Serializer for forgot password request
    """
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            # Return a specific error message for user not found
            raise serializers.ValidationError("User not found with this email address.")
        
        # Check if user is active
        if user.status != 'active':
            raise serializers.ValidationError("This account is inactive. Please contact support.")
        
        return value

    def save(self):
        from django.core.mail import send_mail
        from django.core.mail import EmailMultiAlternatives
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags
        
        email = self.validated_data['email']
        user = User.objects.get(email=email)
        
        # Invalidate any existing unused tokens for this user
        PasswordReset.objects.filter(
            user=user, 
            is_used=False,
            expires_at__gt=timezone.now()
        ).update(is_used=True)
        
        # Create new reset token (valid for 24 hours)
        reset = PasswordReset.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(hours=24)
        )
        
        # Generate reset URL
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset.token}"
        
        # Send email
        subject = "Password Reset Request - Izozo Marketplace"
        
        # Plain text version
        text_content = f"""
Hi {user.full_name},

We received a request to reset your password for your Izozo account.

Click the link below to reset your password:
{reset_url}

This link will expire in 24 hours.

If you didn't request this, please ignore this email or contact support.

Thanks,
The Izozo Team
        """
        
        # HTML version
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f2c01a; padding: 20px; text-align: center; }}
        .header h1 {{ color: #150c09; margin: 0; }}
        .content {{ padding: 30px 20px; background-color: #f9f9f9; }}
        .button {{
            display: inline-block;
            padding: 12px 30px;
            background-color: #f2c01a;
            color: #150c09;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        .warning {{ color: #b03e3b; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Izozo Marketplace</h1>
        </div>
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi <strong>{user.full_name}</strong>,</p>
            <p>We received a request to reset your password for your Izozo account.</p>
            
            <div style="text-align: center;">
                <a href="{reset_url}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
                {reset_url}
            </p>
            
            <p class="warning">This link will expire in 24 hours.</p>
            
            <p>If you didn't request this, please ignore this email or contact our support team.</p>
        </div>
        <div class="footer">
            <p>&copy; {timezone.now().year} Izozo Marketplace. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
        </div>
    </body>
</html>
        """
        
        try:
            # Send email
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email]
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=False)
            
        except Exception as e:
            logger.error(f"Failed to send email to {email}: {e}")
            # Re-raise as ValidationError to be caught by the view
            raise serializers.ValidationError("Failed to send reset email. Please try again later.")
        
        return reset

class ResetPasswordSerializer(serializers.Serializer):
    """
    Serializer for resetting password with token
    """
    token = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        # Check if passwords match
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        
        # Validate token
        try:
            reset = PasswordReset.objects.get(token=data['token'])
        except PasswordReset.DoesNotExist:
            raise serializers.ValidationError({"token": "Invalid or expired reset token."})
        
        # Check if token is valid
        if not reset.is_valid():
            raise serializers.ValidationError({"token": "This reset link has expired or already been used."})
        
        data['reset'] = reset
        return data

    def save(self):
        reset = self.validated_data['reset']
        user = reset.user
        
        # Set new password
        user.set_password(self.validated_data['new_password'])
        user.save()
        
        # Mark token as used
        reset.mark_as_used()
        
        # Invalidate all other unused tokens for this user
        PasswordReset.objects.filter(
            user=user, 
            is_used=False
        ).update(is_used=True)
        
        return user


class ValidateTokenSerializer(serializers.Serializer):
    """
    Serializer to validate reset token
    """
    token = serializers.UUIDField()

    def validate_token(self, value):
        try:
            reset = PasswordReset.objects.get(token=value)
        except PasswordReset.DoesNotExist:
            raise serializers.ValidationError("Invalid token.")
        
        if not reset.is_valid():
            raise serializers.ValidationError("Token has expired or already been used.")
        
        return value