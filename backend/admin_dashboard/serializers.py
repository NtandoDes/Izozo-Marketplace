from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from users.models import User, RegistrationLog
from smes.models import SMEProfile
from agents.models import AgentProfile, AgentSMEAssignment
from delivery.models import DeliveryProfile
from .models import AdminActionLog, SystemSettings, AdminNotification, BulkAction

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    """Serializer for admin user management"""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    profile = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'full_name', 'phone', 'role', 'role_display',
            'status', 'status_display', 'source', 'created_at', 'last_login',
            'is_active', 'profile'
        ]
        read_only_fields = ['id', 'email', 'created_at', 'last_login']
    
    def get_profile(self, obj):
        """Get role-specific profile data"""
        if obj.role == 'sme' and hasattr(obj, 'smeprofile'):
            return {
                'id': obj.smeprofile.id,
                'business_name': obj.smeprofile.business_name,
                'business_type': obj.smeprofile.business_type,
                'business_address': obj.smeprofile.business_address,
                'owner_name': obj.smeprofile.owner_name
            }
        elif obj.role == 'agent' and hasattr(obj, 'agentprofile'):
            return {
                'id': obj.agentprofile.id,
                'home_address': obj.agentprofile.home_address,
                'has_internet': obj.agentprofile.has_internet,
                'has_smartphone': obj.agentprofile.has_smartphone
            }
        elif obj.role == 'delivery' and hasattr(obj, 'deliveryprofile'):
            return {
                'id': obj.deliveryprofile.id,
                'home_address': obj.deliveryprofile.home_address,
                'vehicle_type': obj.deliveryprofile.vehicle_type,
                'has_internet': obj.deliveryprofile.has_internet,
                'has_smartphone': obj.deliveryprofile.has_smartphone
            }
        return None


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user status and role"""
    
    class Meta:
        model = User
        fields = ['status', 'role', 'is_active']
    
    def validate(self, data):
        user = self.instance
        if 'role' in data and user.role == 'admin' and data['role'] != 'admin':
            raise serializers.ValidationError("Cannot change admin role")
        return data


class AdminSMEProfileSerializer(serializers.ModelSerializer):
    """Serializer for SME profiles in admin view"""
    user = AdminUserSerializer(read_only=True)
    assigned_agents = serializers.SerializerMethodField()
    
    class Meta:
        model = SMEProfile
        fields = [
            'id', 'user', 'business_name', 'owner_name', 'business_type',
            'business_address', 'address', 'created_at', 'assigned_agents'
        ]
    
    def get_assigned_agents(self, obj):
        assignments = AgentSMEAssignment.objects.filter(
            sme=obj,
            active=True
        ).select_related('agent__user')
        
        return [
            {
                'id': assignment.agent.id,
                'agent_id': assignment.agent.id,
                'name': assignment.agent.user.full_name,
                'email': assignment.agent.user.email,
                'assigned_at': assignment.assigned_at,
                'assignment_id': assignment.id
            }
            for assignment in assignments
        ]


class AdminAgentProfileSerializer(serializers.ModelSerializer):
    """Serializer for Agent profiles in admin view"""
    user = AdminUserSerializer(read_only=True)
    assigned_smes = serializers.SerializerMethodField()
    
    class Meta:
        model = AgentProfile
        fields = [
            'id', 'user', 'home_address', 'has_internet', 'has_smartphone',
            'created_at', 'assigned_smes'
        ]
    
    def get_assigned_smes(self, obj):
        assignments = AgentSMEAssignment.objects.filter(
            agent=obj,
            active=True
        ).select_related('sme')
        
        return [
            {
                'id': assignment.sme.id,
                'business_name': assignment.sme.business_name,
                'owner_name': assignment.sme.owner_name,
                'assigned_at': assignment.assigned_at,
                'assignment_id': assignment.id
            }
            for assignment in assignments
        ]


class AdminDeliveryProfileSerializer(serializers.ModelSerializer):
    """Serializer for Delivery profiles in admin view"""
    user = AdminUserSerializer(read_only=True)
    
    class Meta:
        model = DeliveryProfile
        fields = [
            'id', 'user', 'home_address', 'vehicle_type',
            'has_internet', 'has_smartphone', 'created_at'
        ]


class AdminAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for agent-sme assignments"""
    agent_details = serializers.SerializerMethodField()
    sme_details = serializers.SerializerMethodField()
    
    class Meta:
        model = AgentSMEAssignment
        fields = [
            'id', 'agent', 'agent_details', 'sme', 'sme_details',
            'active', 'assigned_at', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'created_at', 'updated_at']
    
    def get_agent_details(self, obj):
        return {
            'id': obj.agent.id,
            'name': obj.agent.user.full_name,
            'email': obj.agent.user.email,
            'phone': obj.agent.user.phone
        }
    
    def get_sme_details(self, obj):
        return {
            'id': obj.sme.id,
            'business_name': obj.sme.business_name,
            'owner_name': obj.sme.owner_name,
            'email': obj.sme.user.email,
            'phone': obj.sme.user.phone
        }


class AdminAssignmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new assignments"""
    
    class Meta:
        model = AgentSMEAssignment
        fields = ['agent', 'sme', 'active', 'notes']
    
    def validate(self, data):
        if AgentSMEAssignment.objects.filter(
            agent=data['agent'],
            sme=data['sme'],
            active=True
        ).exists():
            raise serializers.ValidationError(
                "This agent is already assigned to this SME"
            )
        return data