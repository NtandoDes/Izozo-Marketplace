from rest_framework import serializers
from users.models import User
from users.serializers import UserSerializer
from .models import AgentProfile, AgentSMEAssignment

class AgentRegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(write_only=True, required=True)
    phone = serializers.CharField(write_only=True, required=True)
    source = serializers.CharField(write_only=True, required=False, allow_blank=True)  # Add this
    
    class Meta:
        model = AgentProfile
        fields = [
            'email', 'password', 'full_name', 'phone',
            'home_address', 'has_internet', 'has_smartphone',
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
            role='agent',
            status='pending'
        )
        
        # Create agent profile
        agent_profile = AgentProfile.objects.create(
            user=user,
            home_address=validated_data['home_address'],
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
            status='Agent registered successfully'
        )
        
        return agent_profile

class AgentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = AgentProfile
        fields = [
            'id', 'home_address', 'has_internet', 'has_smartphone', 
            'created_at', 'user'
        ]
        read_only_fields = ['id', 'created_at', 'user']

class AgentProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentProfile
        fields = ['home_address', 'has_internet', 'has_smartphone']

class AgentSMEAssignmentSerializer(serializers.ModelSerializer):
    agent = AgentProfileSerializer(read_only=True)
    sme_info = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = AgentSMEAssignment
        fields = [
            'id', 'agent', 'sme', 'sme_info',
            'active', 'assigned_at', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'created_at']
    
    def get_sme_info(self, obj):
        return {
            'id': obj.sme.id,
            'business_name': obj.sme.business_name,
            'owner_name': obj.sme.owner_name
        }

class AgentSMEAssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSMEAssignment
        fields = ['agent', 'sme', 'active', 'notes']