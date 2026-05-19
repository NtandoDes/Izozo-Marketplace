# smes/views.py
from datetime import datetime  # Add this for Python datetime if needed
from django.utils import timezone  # Use Django's timezone utility
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.db.models import Sum, Q, F
import logging

from orders.models import Order, OrderStatusHistory, OrderItem
from products.models import Product
from .models import SMEProfile
from .serializers import SMERegisterSerializer, SMEProfileSerializer, SMEProfileUpdateSerializer
from users.models import User
from users.serializers import UserSerializer
from agents.models import AgentSMEAssignment
from agents.serializers import AgentSMEAssignmentSerializer

# Add logger
logger = logging.getLogger(__name__)

class SMERegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = SMERegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            sme_profile = serializer.save()
            user = sme_profile.user
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'SME registered successfully',
                'user': UserSerializer(user).data,
                'sme_profile': SMEProfileSerializer(sme_profile).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SMEProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            sme_profile = SMEProfile.objects.get(user=request.user)
            serializer = SMEProfileSerializer(sme_profile)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except SMEProfile.DoesNotExist:
            return Response(
                {'error': 'SME profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def put(self, request):
        try:
            sme_profile = SMEProfile.objects.get(user=request.user)
            user = request.user
            
            # Log the request data for debugging
            logger.info(f"Updating SME profile for user {user.email}")
            logger.info(f"Request data: {request.data}")
            
            # Update user fields (full_name, phone)
            user_updated = False
            if 'full_name' in request.data and request.data['full_name'] != user.full_name:
                user.full_name = request.data['full_name']
                user_updated = True
                logger.info(f"Updating full_name to: {user.full_name}")
                
            if 'phone' in request.data and request.data['phone'] != user.phone:
                user.phone = request.data['phone']
                user_updated = True
                logger.info(f"Updating phone to: {user.phone}")
            
            if user_updated:
                user.save()
                logger.info(f"Updated user {user.id} fields: full_name={user.full_name}, phone={user.phone}")
            
            # Update SME profile fields
            # Create a copy of request.data without user fields to avoid conflicts
            profile_data = {}
            for key, value in request.data.items():
                if key not in ['full_name', 'phone', 'email']:
                    profile_data[key] = value
            
            logger.info(f"Profile data for serializer: {profile_data}")
            
            profile_serializer = SMEProfileUpdateSerializer(sme_profile, data=profile_data, partial=True)
            if profile_serializer.is_valid():
                profile_serializer.save()
                logger.info(f"Updated SME profile {sme_profile.id}")
                
                # Return combined data - use Django's timezone.now()
                response_data = {
                    'id': sme_profile.id,
                    'user': UserSerializer(user).data,
                    'business_name': sme_profile.business_name,
                    'owner_name': sme_profile.owner_name,
                    'business_type': sme_profile.business_type,
                    'business_address': sme_profile.business_address,
                    'address': sme_profile.address,
                    'created_at': sme_profile.created_at,
                    'updated_at': timezone.now()  # This is Django's timezone.now()
                }
                
                return Response(response_data, status=status.HTTP_200_OK)
            
            logger.error(f"Profile serializer errors: {profile_serializer.errors}")
            return Response(profile_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except SMEProfile.DoesNotExist:
            logger.error(f"SME profile not found for user {request.user.email}")
            return Response(
                {'error': 'SME profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating SME profile: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SMEListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        smes = SMEProfile.objects.all()
        serializer = SMEProfileSerializer(smes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class SMEAssignedAgentsView(APIView):
    """
    Get all agents assigned to the current SME
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get the SME profile for the current user
            sme_profile = SMEProfile.objects.get(user=request.user)
            
            # Get all active assignments for this SME
            assignments = AgentSMEAssignment.objects.filter(
                sme=sme_profile,
                active=True
            ).select_related('agent__user')
            
            serializer = AgentSMEAssignmentSerializer(assignments, many=True)
            
            # Transform the data to a more frontend-friendly format
            assigned_agents = []
            for assignment in serializer.data:
                agent_data = {
                    'id': assignment['agent']['id'],
                    'assignment_id': assignment['id'],
                    'name': assignment['agent']['user']['full_name'],
                    'email': assignment['agent']['user']['email'],
                    'phone': assignment['agent']['user']['phone'],
                    'home_address': assignment['agent']['home_address'],
                    'has_internet': assignment['agent']['has_internet'],
                    'has_smartphone': assignment['agent']['has_smartphone'],
                    'assigned_at': assignment['assigned_at'],
                    'notes': assignment['notes'],
                    'active': assignment['active']
                }
                assigned_agents.append(agent_data)
            
            return Response(assigned_agents, status=status.HTTP_200_OK)
            
        except SMEProfile.DoesNotExist:
            return Response(
                {'error': 'SME profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in SMEAssignedAgentsView: {e}", exc_info=True)
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        

class SMEProductStatsView(APIView):
    """
    Get product statistics for the current SME
    GET /api/sme/products/stats/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sme = SMEProfile.objects.get(user=request.user)
            products = Product.objects.filter(sme=sme)
            
            stats = {
                'total_products': products.count(),
                'active_products': products.filter(status='active', is_active=True).count(),
                'pending_products': products.filter(status='pending').count(),
                'draft_products': products.filter(status='draft').count(),
                'rejected_products': products.filter(status='rejected').count(),
                'out_of_stock': products.filter(stock_quantity=0).count(),
                'low_stock': products.filter(stock_quantity__gt=0, stock_quantity__lte=F('low_stock_threshold')).count(),
                'total_value': products.aggregate(total=Sum(F('base_price') * F('stock_quantity')))['total'] or 0,
            }
            
            return Response(stats, status=status.HTTP_200_OK)
            
        except SMEProfile.DoesNotExist:
            return Response({'error': 'SME profile not found'}, status=404)


class SMEOrderStatsView(APIView):
    """
    Get order statistics for the current SME
    GET /api/sme/orders/stats/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sme = SMEProfile.objects.get(user=request.user)
            orders = Order.objects.filter(items__sme=sme).distinct()
            
            stats = {
                'total_orders': orders.count(),
                'pending_orders': orders.filter(status='pending').count(),
                'processing_orders': orders.filter(status='processing').count(),
                'paid_orders': orders.filter(status='paid').count(),
                'shipped_orders': orders.filter(status='shipped').count(),
                'delivered_orders': orders.filter(status='delivered').count(),
                'completed_orders': orders.filter(status='completed').count(),
                'cancelled_orders': orders.filter(status='cancelled').count(),
                'total_revenue': orders.filter(status__in=['delivered', 'paid', 'completed']).aggregate(total=Sum('total_amount'))['total'] or 0,
            }
            
            return Response(stats, status=status.HTTP_200_OK)
            
        except SMEProfile.DoesNotExist:
            return Response({'error': 'SME profile not found'}, status=404)


class SMEMarkOrderReadyForPickupView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, order_number):
        try:
            # Get SME profile
            sme = SMEProfile.objects.get(user=request.user)
            
            # Get the order
            order = Order.objects.get(order_number=order_number)
            
            # Check if order belongs to this SME
            if not order.items.filter(sme=sme).exists():
                return Response(
                    {'error': 'Order not found or access denied'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Log old status
            logger.info(f"Order {order.order_number} current status: {order.status}")
            
            # Update order status to 'processing' (ready for pickup)
            order.status = 'processing'
            order.save()
            
            logger.info(f"Order {order.order_number} new status: {order.status}")
            
            # Create status history
            OrderStatusHistory.objects.create(
                order=order,
                status='processing',
                notes='Order packaged and ready for pickup',
                changed_by=request.user
            )
            
            # Notify agents
            from notifications.services import NotificationService
            NotificationService.notify_order_ready_for_pickup(order)
            
            return Response({
                'success': True,
                'message': 'Order marked as ready for pickup',
                'order_number': order.order_number,
                'status': order.status
            }, status=status.HTTP_200_OK)
            
        except SMEProfile.DoesNotExist:
            logger.error(f"SME profile not found for user {request.user.email}")
            return Response({'error': 'SME profile not found'}, status=404)
        except Order.DoesNotExist:
            logger.error(f"Order {order_number} not found")
            return Response({'error': 'Order not found'}, status=404)
        except Exception as e:
            logger.error(f"Error packaging order: {e}", exc_info=True)
            return Response({'error': str(e)}, status=500)