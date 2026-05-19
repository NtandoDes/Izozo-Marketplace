from rest_framework import serializers
from users.models import User
from users.serializers import UserSerializer
from .models import DeliveryProfile

class DeliveryRegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(write_only=True, required=True)
    phone = serializers.CharField(write_only=True, required=True)
    source = serializers.CharField(write_only=True, required=False, allow_blank=True)  # Add this
    
    class Meta:
        model = DeliveryProfile
        fields = [
            'email', 'password', 'full_name', 'phone',
            'home_address', 'vehicle_type', 'has_internet', 'has_smartphone',
            'source'  # Add this
        ]
    
    def create(self, validated_data):
        # Extract source
        source = validated_data.pop('source', '')
        
        # Create user
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            phone=validated_data['phone'],
            role='delivery',
            status='pending'
        )
        
        # Create delivery profile
        delivery_profile = DeliveryProfile.objects.create(
            user=user,
            home_address=validated_data['home_address'],
            vehicle_type=validated_data.get('vehicle_type'),
            has_internet=validated_data.get('has_internet', False),
            has_smartphone=validated_data.get('has_smartphone', False)
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
            status='Delivery partner registered successfully'
        )
        
        return delivery_profile

class DeliveryProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = DeliveryProfile
        fields = [
            'id', 'home_address', 'vehicle_type', 'has_internet', 
            'has_smartphone', 'created_at', 'user'
        ]
        read_only_fields = ['id', 'created_at', 'user']

class DeliveryProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryProfile
        fields = ['home_address', 'vehicle_type', 'has_internet', 'has_smartphone']