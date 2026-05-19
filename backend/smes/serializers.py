from rest_framework import serializers
from users.models import User
from users.serializers import UserSerializer
from .models import SMEProfile

class SMERegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(write_only=True, required=True)
    phone = serializers.CharField(write_only=True, required=True)
    source = serializers.CharField(write_only=True, required=False, allow_blank=True)  # Add this
    
    class Meta:
        model = SMEProfile
        fields = [
            'email', 'password', 'full_name', 'phone',
            'business_name', 'owner_name', 'business_type', 
            'business_address', 'address',
            'source'  # Add this
        ]
        extra_kwargs = {
            'business_name': {'required': True},
            'owner_name': {'required': True},
        }
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value
    
    def create(self, validated_data):
        # Extract source before creating user
        source = validated_data.pop('source', '')
        
        # Create user first
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            phone=validated_data['phone'],
            role='sme',
            status='pending'
        )
        
        # Create SME profile
        sme_profile = SMEProfile.objects.create(
            user=user,
            business_name=validated_data['business_name'],
            owner_name=validated_data['owner_name'],
            business_type=validated_data.get('business_type'),
            business_address=validated_data.get('business_address'),
            address=validated_data.get('address')
        )
        
        # Log registration with source
        from users.models import RegistrationLog
        request = self.context.get('request')
        RegistrationLog.objects.create(
            user=user,
            email=user.email,
            role=user.role,
            source=source,  # Now passing the source
            ip_address=request.META.get('REMOTE_ADDR') if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT') if request else None,
            status='SME registered successfully'
        )
        
        return sme_profile

class SMEProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = SMEProfile
        fields = [
            'id', 'business_name', 'owner_name', 'business_type',
            'business_address', 'address', 'created_at', 'user'
        ]
        read_only_fields = ['id', 'created_at', 'user']

class SMEProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMEProfile
        fields = [
            'business_name', 'owner_name', 'business_type',
            'business_address', 'address'
        ]