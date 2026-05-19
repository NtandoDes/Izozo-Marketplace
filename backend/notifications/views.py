# notifications/views.py
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.models import Q
from django.contrib.contenttypes.models import ContentType
from .models import Notification, NotificationPreference
from .serializers import (
    NotificationSerializer, NotificationPreferenceSerializer,
    MarkAsReadSerializer
)
import logging

logger = logging.getLogger(__name__)


class NotificationListView(APIView):
    """
    List notifications for authenticated user
    GET /api/notifications/
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Base queryset
            notifications = Notification.objects.filter(
                recipient=request.user,
                is_archived=False
            ).order_by('-created_at')

            # Apply filters
            notification_type = request.query_params.get('type')
            if notification_type:
                notifications = notifications.filter(notification_type=notification_type)

            is_read = request.query_params.get('is_read')
            if is_read is not None:
                is_read_bool = is_read.lower() == 'true'
                notifications = notifications.filter(is_read=is_read_bool)

            # Search
            search = request.query_params.get('search')
            if search:
                notifications = notifications.filter(
                    Q(title__icontains=search) | 
                    Q(message__icontains=search)
                )

            # Date range
            start_date = request.query_params.get('start_date')
            if start_date:
                notifications = notifications.filter(created_at__date__gte=start_date)

            end_date = request.query_params.get('end_date')
            if end_date:
                notifications = notifications.filter(created_at__date__lte=end_date)

            # Limit
            limit = request.query_params.get('limit', 50)
            try:
                limit = int(limit)
                notifications = notifications[:limit]
            except ValueError:
                pass

            serializer = NotificationSerializer(notifications, many=True)
            
            # Get unread count
            unread_count = Notification.objects.filter(
                recipient=request.user,
                is_read=False,
                is_archived=False
            ).count()

            return Response({
                'notifications': serializer.data,
                'unread_count': unread_count,
                'total': notifications.count()
            })
            
        except Exception as e:
            logger.error(f"Error in NotificationListView: {e}")
            return Response(
                {'error': 'Failed to fetch notifications'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UnreadCountView(APIView):
    """
    Get unread notification count
    GET /api/notifications/unread-count/
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            count = Notification.objects.filter(
                recipient=request.user,
                is_read=False,
                is_archived=False
            ).count()
            
            return Response({'unread_count': count})
        except Exception as e:
            logger.error(f"Error in UnreadCountView: {e}")
            return Response(
                {'unread_count': 0},  # Return 0 on error instead of 401
                status=status.HTTP_200_OK
            )


class NotificationDetailView(APIView):
    """
    Get or update notification
    GET /api/notifications/{id}/
    PATCH /api/notifications/{id}/
    DELETE /api/notifications/{id}/
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Notification.objects.get(pk=pk, recipient=user)
        except Notification.DoesNotExist:
            return None

    def get(self, request, pk):
        notification = self.get_object(pk, request.user)
        if not notification:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = NotificationSerializer(notification)
        return Response(serializer.data)

    def patch(self, request, pk):
        notification = self.get_object(pk, request.user)
        if not notification:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        is_read = request.data.get('is_read')
        if is_read is not None:
            if is_read:
                notification.mark_as_read()
            else:
                notification.is_read = False
                notification.read_at = None
                notification.save()

        serializer = NotificationSerializer(notification)
        return Response(serializer.data)

    def delete(self, request, pk):
        notification = self.get_object(pk, request.user)
        if not notification:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        notification.is_archived = True
        notification.save()
        return Response(
            {'message': 'Notification archived successfully'},
            status=status.HTTP_200_OK
        )


class MarkNotificationsReadView(APIView):
    """
    Mark notifications as read
    POST /api/notifications/mark-read/
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MarkAsReadSerializer(data=request.data)
        if serializer.is_valid():
            if serializer.validated_data.get('mark_all'):
                # Mark all as read
                Notification.objects.filter(
                    recipient=request.user,
                    is_read=False,
                    is_archived=False
                ).update(is_read=True, read_at=timezone.now())
                
                return Response({
                    'message': 'All notifications marked as read'
                })
            else:
                # Mark specific notifications
                notification_ids = serializer.validated_data.get('notification_ids', [])
                if not notification_ids:
                    return Response(
                        {'error': 'No notification IDs provided'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                updated = Notification.objects.filter(
                    id__in=notification_ids,
                    recipient=request.user
                ).update(is_read=True, read_at=timezone.now())

                return Response({
                    'message': f'{updated} notifications marked as read'
                })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationPreferencesView(APIView):
    """
    Get or update notification preferences
    GET /api/notifications/preferences/
    PUT /api/notifications/preferences/
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        preferences, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(preferences)
        return Response(serializer.data)

    def put(self, request):
        preferences, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(
            preferences,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)