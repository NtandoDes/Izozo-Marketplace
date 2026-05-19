from rest_framework import status, generics, viewsets, permissions  # Add permissions here
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.db.models import Q, Count
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from datetime import timedelta

from users.models import User, RegistrationLog
from smes.models import SMEProfile
from agents.models import AgentProfile, AgentSMEAssignment
from delivery.models import DeliveryProfile
# from backend.permissions import IsAdminUser  # Comment this out for now
from .models import AdminActionLog, SystemSettings, AdminNotification, BulkAction
from .serializers import (
    AdminUserSerializer, AdminUserUpdateSerializer,
    AdminSMEProfileSerializer, AdminAgentProfileSerializer,
    AdminDeliveryProfileSerializer, AdminAssignmentSerializer,
    AdminAssignmentCreateSerializer
)

User = get_user_model()


# Define IsAdminUser permission here instead of importing
class IsAdminUser(permissions.BasePermission):
    """Custom permission to only allow admin users"""
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role == 'admin' or request.user.is_superuser)
        )


class AdminUserListView(generics.ListAPIView):
    """List all users with filtering and search"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminUserSerializer
    
    def get_queryset(self):
        queryset = User.objects.all().order_by('-created_at')
        
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) |
                Q(full_name__icontains=search) |
                Q(phone__icontains=search)
            )
        
        role = self.request.query_params.get('role', '')
        if role and role != 'all':
            queryset = queryset.filter(role=role)
        
        status_param = self.request.query_params.get('status', '')
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)
        
        return queryset


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update user details"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = User.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return AdminUserUpdateSerializer
        return AdminUserSerializer
    
    def perform_update(self, serializer):
        old_status = self.get_object().status
        instance = serializer.save()
        new_status = instance.status
        
        AdminActionLog.objects.create(
            admin=self.request.user,
            action_type=f'user_{new_status}' if old_status != new_status else 'user_update',
            target_user=instance,
            description=f"Updated user {instance.email}",
            metadata={'old_status': old_status, 'new_status': new_status},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


class AdminUserBulkActionView(APIView):
    """Handle bulk operations on users"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    @transaction.atomic
    def post(self, request):
        action = request.data.get('action')
        user_ids = request.data.get('user_ids', [])
        
        if not action or not user_ids:
            return Response(
                {'error': 'Action and user_ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        users = User.objects.filter(id__in=user_ids)
        bulk_action = BulkAction.objects.create(
            admin=request.user,
            action_type=action,
            total_items=users.count(),
            metadata={'user_ids': user_ids, 'action': action}
        )
        
        successful = []
        failed = []
        
        for user in users:
            try:
                if action == 'approve_users':
                    user.status = 'active'
                    user.save()
                    successful.append(user.id)
                elif action == 'suspend_users':
                    user.status = 'suspended'
                    user.save()
                    successful.append(user.id)
                elif action == 'activate_users':
                    user.status = 'active'
                    user.save()
                    successful.append(user.id)
                elif action == 'delete_users':
                    user.delete()
                    successful.append(user.id)
            except Exception as e:
                failed.append({'id': user.id, 'error': str(e)})
        
        bulk_action.processed_items = len(successful) + len(failed)
        bulk_action.successful_items = len(successful)
        bulk_action.failed_items = len(failed)
        bulk_action.error_log = failed
        bulk_action.status = 'completed'
        bulk_action.completed_at = timezone.now()
        bulk_action.save()
        
        return Response({
            'message': f'Bulk action completed: {len(successful)} successful, {len(failed)} failed',
            'successful': successful,
            'failed': failed,
            'bulk_action_id': bulk_action.id
        })


class AdminAssignmentViewSet(viewsets.ModelViewSet):
    """CRUD operations for agent-sme assignments"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        queryset = AgentSMEAssignment.objects.select_related(
            'agent__user', 'sme__user'
        ).order_by('-assigned_at')
        
        agent_id = self.request.query_params.get('agent_id')
        if agent_id:
            queryset = queryset.filter(agent_id=agent_id)
        
        sme_id = self.request.query_params.get('sme_id')
        if sme_id:
            queryset = queryset.filter(sme_id=sme_id)
        
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')
        
        return queryset
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AdminAssignmentCreateSerializer
        return AdminAssignmentSerializer
    
    def perform_create(self, serializer):
        assignment = serializer.save()
        AdminActionLog.objects.create(
            admin=self.request.user,
            action_type='assignment_create',
            description=f"Created assignment: Agent {assignment.agent.id} -> SME {assignment.sme.id}",
            metadata={
                'assignment_id': assignment.id,
                'agent_id': assignment.agent.id,
                'sme_id': assignment.sme.id
            },
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_update(self, serializer):
        old_active = self.get_object().active
        assignment = serializer.save()
        AdminActionLog.objects.create(
            admin=self.request.user,
            action_type='assignment_update',
            description=f"Updated assignment {assignment.id}",
            metadata={
                'assignment_id': assignment.id,
                'old_active': old_active,
                'new_active': assignment.active
            },
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_destroy(self, instance):
        AdminActionLog.objects.create(
            admin=self.request.user,
            action_type='assignment_delete',
            description=f"Deleted assignment {instance.id}",
            metadata={
                'assignment_id': instance.id,
                'agent_id': instance.agent.id,
                'sme_id': instance.sme.id
            },
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        instance.delete()


class AdminProfileListView(generics.ListAPIView):
    """List all profiles by role"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_serializer_class(self):
        role = self.kwargs.get('role')
        if role == 'sme':
            return AdminSMEProfileSerializer
        elif role == 'agent':
            return AdminAgentProfileSerializer
        elif role == 'delivery':
            return AdminDeliveryProfileSerializer
        return None
    
    def get_queryset(self):
        role = self.kwargs.get('role')
        if role == 'sme':
            return SMEProfile.objects.select_related('user').all().order_by('-created_at')
        elif role == 'agent':
            return AgentProfile.objects.select_related('user').all().order_by('-created_at')
        elif role == 'delivery':
            return DeliveryProfile.objects.select_related('user').all().order_by('-created_at')
        return []


class AdminDashboardStatsView(APIView):
    """Get dashboard statistics"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        stats = {
            'total_users': User.objects.count(),
            'pending_users': User.objects.filter(status='pending').count(),
            'active_users': User.objects.filter(status='active').count(),
            'suspended_users': User.objects.filter(status='suspended').count(),
            'total_smes': User.objects.filter(role='sme').count(),
            'total_agents': User.objects.filter(role='agent').count(),
            'total_delivery': User.objects.filter(role='delivery').count(),
            'total_customers': User.objects.filter(role='customer').count(),
            'total_assignments': AgentSMEAssignment.objects.count(),
            'active_assignments': AgentSMEAssignment.objects.filter(active=True).count(),
            'recent_registrations': User.objects.filter(created_at__gte=start_date).count(),
            'recent_logins': User.objects.filter(last_login__gte=start_date).count(),
        }
        
        return Response(stats)


class AdminRegistrationLogView(generics.ListAPIView):
    """View registration logs"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        return RegistrationLog.objects.select_related('user').order_by('-created_at')
    
    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        data = []
        for log in queryset[:50]:  # Limit to 50 most recent
            data.append({
                'id': log.id,
                'email': log.email,
                'role': log.role,
                'source': log.source,
                'ip_address': log.ip_address,
                'status': log.status,
                'created_at': log.created_at,
                'user': {
                    'id': log.user.id if log.user else None,
                    'email': log.user.email if log.user else None,
                    'full_name': log.user.full_name if log.user else None
                } if log.user else None
            })
        return Response(data)


class AdminActionLogView(generics.ListAPIView):
    """View admin action logs"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        return AdminActionLog.objects.select_related(
            'admin', 'target_user'
        ).order_by('-created_at')
    
    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        data = []
        for log in queryset[:50]:  # Limit to 50 most recent
            data.append({
                'id': log.id,
                'admin': {
                    'id': log.admin.id if log.admin else None,
                    'email': log.admin.email if log.admin else None,
                    'full_name': log.admin.full_name if log.admin else None
                } if log.admin else None,
                'action_type': log.action_type,
                'action_type_display': log.get_action_type_display(),
                'target_user': {
                    'id': log.target_user.id if log.target_user else None,
                    'email': log.target_user.email if log.target_user else None,
                    'full_name': log.target_user.full_name if log.target_user else None
                } if log.target_user else None,
                'description': log.description,
                'metadata': log.metadata,
                'ip_address': log.ip_address,
                'created_at': log.created_at
            })
        return Response(data)


class SystemSettingsView(APIView):
    """Manage system settings"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        public_only = request.query_params.get('public_only', 'false').lower() == 'true'
        if public_only:
            settings = SystemSettings.objects.filter(is_public=True)
        else:
            settings = SystemSettings.objects.all()
        
        data = []
        for setting in settings:
            data.append({
                'id': setting.id,
                'key': setting.key,
                'value': setting.value,
                'description': setting.description,
                'is_public': setting.is_public,
                'updated_at': setting.updated_at
            })
        return Response(data)
    
    def post(self, request):
        key = request.data.get('key')
        value = request.data.get('value')
        description = request.data.get('description', '')
        is_public = request.data.get('is_public', False)
        
        if not key:
            return Response({'error': 'Key is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        setting, created = SystemSettings.objects.update_or_create(
            key=key,
            defaults={
                'value': value,
                'description': description,
                'is_public': is_public,
                'updated_by': request.user
            }
        )
        
        AdminActionLog.objects.create(
            admin=request.user,
            action_type='system_config',
            description=f"{'Created' if created else 'Updated'} system setting: {key}",
            metadata={'key': key, 'value': value},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        
        return Response({
            'id': setting.id,
            'key': setting.key,
            'value': setting.value,
            'description': setting.description,
            'is_public': setting.is_public,
            'updated_at': setting.updated_at
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    def delete(self, request, key):
        try:
            setting = SystemSettings.objects.get(key=key)
            setting.delete()
            
            AdminActionLog.objects.create(
                admin=request.user,
                action_type='system_config',
                description=f"Deleted system setting: {key}",
                metadata={'key': key},
                ip_address=self.request.META.get('REMOTE_ADDR')
            )
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except SystemSettings.DoesNotExist:
            return Response(
                {'error': 'Setting not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AdminNotificationViewSet(viewsets.ModelViewSet):
    """Manage admin notifications"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        return AdminNotification.objects.filter(
            recipient=self.request.user
        ).order_by('-priority', '-created_at')
    
    def get_serializer_class(self):
        # Return a simple dict serializer
        return None
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        data = []
        for notification in queryset[:20]:
            data.append({
                'id': notification.id,
                'title': notification.title,
                'message': notification.message,
                'priority': notification.priority,
                'priority_display': notification.get_priority_display(),
                'status': notification.status,
                'action_url': notification.action_url,
                'metadata': notification.metadata,
                'created_at': notification.created_at,
                'read_at': notification.read_at
            })
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        AdminNotification.objects.filter(
            recipient=request.user,
            status='unread'
        ).update(status='read', read_at=timezone.now())
        return Response({'status': 'all marked as read'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = AdminNotification.objects.filter(
            recipient=request.user,
            status='unread'
        ).count()
        return Response({'count': count})