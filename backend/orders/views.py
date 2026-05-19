# orders/views.py
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django.db import transaction
from django.db.models import Q, Sum, Count, Avg
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.http import Http404
from decimal import Decimal
from .models import Order, OrderItem, OrderStatusHistory
from .serializers import (
    OrderSerializer, OrderCreateSerializer, OrderStatusUpdateSerializer,
    OrderStatsSerializer, OrderItemSerializer
)
from notifications.services import NotificationService
from agents.models import AgentProfile, AgentSMEAssignment
from smes.models import SMEProfile
import logging

logger = logging.getLogger(__name__)


# ============= CUSTOMER ORDER VIEWS =============

class CustomerOrderListView(APIView):
    """
    List orders for the authenticated customer
    GET /api/orders/
    POST /api/orders/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get orders where customer matches the authenticated user
        # OR where customer_email matches the user's email (as fallback)
        orders = Order.objects.filter(
            Q(customer=request.user) | 
            Q(customer_email=request.user.email)
        ).order_by('-created_at').distinct()
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            orders = orders.filter(status=status_filter)
        
        payment_status = request.query_params.get('payment_status')
        if payment_status:
            orders = orders.filter(payment_status=payment_status)
        
        # Date range
        start_date = request.query_params.get('start_date')
        if start_date:
            orders = orders.filter(created_at__date__gte=start_date)
        
        end_date = request.query_params.get('end_date')
        if end_date:
            orders = orders.filter(created_at__date__lte=end_date)
        
        # Limit
        limit = request.query_params.get('limit')
        if limit:
            try:
                orders = orders[:int(limit)]
            except ValueError:
                pass
        
        serializer = OrderSerializer(orders, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        serializer = OrderCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            order = serializer.save()
            
            # Update product stock
            for item in order.items.all():
                if item.product:
                    item.product.stock_quantity -= item.quantity
                    item.product.save()
                    
                    # Ensure SME is set on the order item
                    if not item.sme and item.product and item.product.sme:
                        item.sme = item.product.sme
                        item.save()
            
            # Create status history
            OrderStatusHistory.objects.create(
                order=order,
                status=order.status,
                notes='Order created',
                changed_by=request.user
            )
            
            # ===== TRIGGER NOTIFICATIONS =====
            try:
                # Notify SMEs and agents about the new order
                NotificationService.notify_order_placed(order)
                logger.info(f"Notifications triggered for order {order.order_number}")
            except Exception as e:
                logger.error(f"Error triggering notifications: {e}")
            
            return Response(
                OrderSerializer(order, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomerOrderDetailView(APIView):
    """
    Retrieve or cancel an order
    GET /api/orders/{order_number}/
    DELETE /api/orders/{order_number}/ (cancel)
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, order_number, user):
        # Try to find order by customer ID or email
        order = Order.objects.filter(
            Q(customer=user) | 
            Q(customer_email=user.email),
            order_number=order_number
        ).first()
        
        if not order:
            raise Http404("Order not found")
        
        return order

    def get(self, request, order_number):
        order = self.get_object(order_number, request.user)
        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, order_number):
        order = self.get_object(order_number, request.user)
        
        # Only allow cancellation of pending orders
        if order.status not in ['pending', 'processing']:
            return Response(
                {'error': 'Only pending or processing orders can be cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Restore stock
        for item in order.items.all():
            if item.product:
                item.product.stock_quantity += item.quantity
                item.product.save()
        
        order.status = 'cancelled'
        order.save()
        
        OrderStatusHistory.objects.create(
            order=order,
            status='cancelled',
            notes='Order cancelled by customer',
            changed_by=request.user
        )
        
        return Response(
            {'message': 'Order cancelled successfully'},
            status=status.HTTP_200_OK
        )


class CustomerOrderStatsView(APIView):
    """
    Get order statistics for the authenticated customer
    GET /api/orders/stats/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get orders for this customer
        orders = Order.objects.filter(
            Q(customer=request.user) | 
            Q(customer_email=request.user.email)
        )
        
        # Calculate statistics
        total_orders = orders.count()
        pending_orders = orders.filter(status='pending').count()
        processing_orders = orders.filter(status='processing').count()
        paid_orders = orders.filter(status='paid').count()
        shipped_orders = orders.filter(status='shipped').count()
        delivered_orders = orders.filter(status='delivered').count()
        completed_orders = orders.filter(status='completed').count()
        cancelled_orders = orders.filter(status='cancelled').count()
        
        # Calculate total spent (only from completed/delivered/paid orders)
        completed_statuses = ['delivered', 'completed', 'paid']
        total_spent = orders.filter(
            status__in=completed_statuses
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        # Calculate average order value
        completed_orders_count = orders.filter(status__in=completed_statuses).count()
        average_order_value = total_spent / completed_orders_count if completed_orders_count > 0 else 0
        
        return Response({
            'total_orders': total_orders,
            'pending_orders': pending_orders,
            'processing_orders': processing_orders,
            'paid_orders': paid_orders,
            'shipped_orders': shipped_orders,
            'delivered_orders': delivered_orders,
            'completed_orders': completed_orders,
            'cancelled_orders': cancelled_orders,
            'total_spent': total_spent,
            'average_order_value': average_order_value
        })


# ============= AGENT ORDER VIEWS =============

class AgentOrderListView(APIView):
    """
    Get orders for assigned SMEs (agent access)
    GET /api/agent/orders/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get agent profile
            agent = AgentProfile.objects.get(user=request.user)
            
            # Get assigned SMEs
            assignments = AgentSMEAssignment.objects.filter(
                agent=agent,
                active=True
            ).values_list('sme_id', flat=True)
            
            # Get orders containing products from assigned SMEs
            orders = Order.objects.filter(
                items__sme_id__in=assignments
            ).distinct().order_by('-created_at')
            
            # Apply filters
            status_filter = request.query_params.get('status')
            if status_filter:
                orders = orders.filter(status=status_filter)
            
            sme_id = request.query_params.get('sme_id')
            if sme_id and int(sme_id) in assignments:
                orders = orders.filter(items__sme_id=sme_id).distinct()
            
            # Search by order number
            search = request.query_params.get('search')
            if search:
                orders = orders.filter(order_number__icontains=search)
            
            # Date range
            start_date = request.query_params.get('start_date')
            if start_date:
                orders = orders.filter(created_at__date__gte=start_date)
            
            end_date = request.query_params.get('end_date')
            if end_date:
                orders = orders.filter(created_at__date__lte=end_date)
            
            # Limit
            limit = request.query_params.get('limit')
            if limit:
                try:
                    orders = orders[:int(limit)]
                except ValueError:
                    pass
            
            serializer = OrderSerializer(orders, many=True, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class AgentOrderDetailView(APIView):
    """
    Get order details for agent
    GET /api/agent/orders/{order_number}/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, order_number):
        try:
            # Get agent profile
            agent = AgentProfile.objects.get(user=request.user)
            
            # Get assigned SMEs
            assignments = AgentSMEAssignment.objects.filter(
                agent=agent,
                active=True
            ).values_list('sme_id', flat=True)
            
            # Get order
            order = Order.objects.filter(
                order_number=order_number,
                items__sme_id__in=assignments
            ).distinct().first()
            
            if not order:
                return Response(
                    {'error': 'Order not found or access denied'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = OrderSerializer(order, context={'request': request})
            return Response(serializer.data)
            
        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AgentOrderStatsView(APIView):
    """
    Get order statistics for agent
    GET /api/agent/orders/stats/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get agent profile
            agent = AgentProfile.objects.get(user=request.user)
            
            # Get assigned SMEs
            assignments = AgentSMEAssignment.objects.filter(
                agent=agent,
                active=True
            ).values_list('sme_id', flat=True)
            
            # Get orders containing products from assigned SMEs
            orders = Order.objects.filter(
                items__sme_id__in=assignments
            ).distinct()
            
            # Order statistics
            total_orders = orders.count()
            pending_orders = orders.filter(status='pending').count()
            processing_orders = orders.filter(status='processing').count()
            paid_orders = orders.filter(status='paid').count()
            shipped_orders = orders.filter(status='shipped').count()
            delivered_orders = orders.filter(status='delivered').count()
            cancelled_orders = orders.filter(status='cancelled').count()
            
            # Revenue statistics
            delivered_revenue = orders.filter(
                status='delivered'
            ).aggregate(total=Sum('total_amount'))['total'] or 0
            
            paid_revenue = orders.filter(
                status='paid'
            ).aggregate(total=Sum('total_amount'))['total'] or 0
            
            total_revenue = delivered_revenue + paid_revenue
            
            # Commission statistics
            commission_total = OrderItem.objects.filter(
                order__in=orders,
                order__status__in=['paid', 'delivered']
            ).aggregate(total=Sum('commission_amount'))['total'] or 0
            
            pending_commission = OrderItem.objects.filter(
                order__in=orders,
                order__status__in=['pending', 'processing']
            ).aggregate(total=Sum('commission_amount'))['total'] or 0
            
            # Statistics by SME
            by_sme = []
            for sme_id in assignments:
                sme_orders = orders.filter(items__sme_id=sme_id).distinct()
                sme_revenue = sme_orders.filter(
                    status__in=['paid', 'delivered']
                ).aggregate(total=Sum('total_amount'))['total'] or 0
                
                sme_commission = OrderItem.objects.filter(
                    order__in=sme_orders,
                    order__status__in=['paid', 'delivered']
                ).aggregate(total=Sum('commission_amount'))['total'] or 0
                
                from smes.models import SMEProfile
                try:
                    sme = SMEProfile.objects.get(id=sme_id)
                    by_sme.append({
                        'sme_id': sme_id,
                        'business_name': sme.business_name,
                        'orders_count': sme_orders.count(),
                        'total_revenue': sme_revenue,
                        'commission_earned': sme_commission
                    })
                except SMEProfile.DoesNotExist:
                    pass
            
            return Response({
                'total_orders': total_orders,
                'pending_orders': pending_orders,
                'processing_orders': processing_orders,
                'paid_orders': paid_orders,
                'shipped_orders': shipped_orders,
                'delivered_orders': delivered_orders,
                'cancelled_orders': cancelled_orders,
                'total_revenue': total_revenue,
                'delivered_revenue': delivered_revenue,
                'paid_revenue': paid_revenue,
                'total_commission': commission_total,
                'pending_commission': pending_commission,
                'paid_commission': commission_total - pending_commission,
                'by_sme': by_sme
            }, status=status.HTTP_200_OK)
            
        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
# orders/views.py - Add/Update this view for order status updates

class AgentOrderStatusUpdateView(APIView):
    """
    Update order status (agent)
    PATCH /api/agent/orders/{order_number}/status/
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, order_number):
        try:
            # Get agent profile
            agent = AgentProfile.objects.get(user=request.user)
            
            # Get the order
            try:
                order = Order.objects.get(order_number=order_number)
            except Order.DoesNotExist:
                return Response(
                    {'error': 'Order not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if agent has access to this order
            order_sme_ids = order.items.values_list('sme_id', flat=True).distinct()
            has_access = AgentSMEAssignment.objects.filter(
                agent=agent,
                sme_id__in=order_sme_ids,
                active=True
            ).exists()
            
            if not has_access:
                return Response(
                    {'error': 'You do not have permission to update this order'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            new_status = request.data.get('status')
            notes = request.data.get('notes', '')
            
            if not new_status:
                return Response(
                    {'error': 'Status is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate status transition
            valid_transitions = {
                'pending': ['processing', 'cancelled'],
                'processing': ['paid', 'shipped', 'cancelled'],
                'paid': ['shipped', 'cancelled'],
                'shipped': ['delivered', 'cancelled'],
                'delivered': [],
                'cancelled': []
            }
            
            if new_status not in valid_transitions.get(order.status, []):
                return Response({
                    'error': f'Cannot transition from {order.status} to {new_status}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update order based on new status
            old_status = order.status
            order.status = new_status
            
            # Set timestamps based on status
            if new_status == 'shipped':
                order.shipped_by = agent
                order.shipped_at = timezone.now()
            elif new_status == 'delivered':
                order.delivered_by = agent
                order.delivered_at = timezone.now()
            elif new_status == 'paid':
                order.paid_at = timezone.now()
            
            order.save()
            
            # Create status history
            OrderStatusHistory.objects.create(
                order=order,
                status=new_status,
                notes=notes or f'Status updated from {old_status} to {new_status} by agent',
                changed_by=request.user
            )
            
            # ===== SEND NOTIFICATIONS =====
            from notifications.services import NotificationService
            
            # Notify based on status change
            if new_status == 'shipped':
                # Notify customer
                if order.customer:
                    NotificationService.create_notification(
                        recipient=order.customer,
                        notification_type='order_shipped',
                        title=f'Order #{order.order_number} Shipped',
                        message=f'Your order has been shipped. Tracking: {order.tracking_number or "N/A"}',
                        related_object=order,
                        data={
                            'order_number': order.order_number,
                            'tracking_number': order.tracking_number,
                            'status': 'shipped'
                        }
                    )
                
                # Notify SME
                for sme_id in order_sme_ids:
                    from smes.models import SMEProfile
                    try:
                        sme = SMEProfile.objects.get(id=sme_id)
                        if sme.user:
                            NotificationService.create_notification(
                                recipient=sme.user,
                                notification_type='order_shipped',
                                title=f'Order #{order.order_number} Shipped',
                                message=f'Order has been picked up and shipped to customer.',
                                related_object=order,
                                data={'order_number': order.order_number}
                            )
                    except SMEProfile.DoesNotExist:
                        pass
                        
            elif new_status == 'delivered':
                # Notify customer
                if order.customer:
                    NotificationService.create_notification(
                        recipient=order.customer,
                        notification_type='order_delivered',
                        title=f'Order #{order.order_number} Delivered',
                        message='Your order has been delivered. Thank you for shopping with Izozo!',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )
                
                # Notify SME and calculate revenue
                for sme_id in order_sme_ids:
                    from smes.models import SMEProfile
                    try:
                        sme = SMEProfile.objects.get(id=sme_id)
                        if sme.user:
                            sme_items = order.items.filter(sme_id=sme_id)
                            sme_revenue = sum(float(item.total) for item in sme_items)
                            
                            NotificationService.create_notification(
                                recipient=sme.user,
                                notification_type='revenue_updated',
                                title=f'Revenue Updated - Order #{order.order_number}',
                                message=f'Your revenue from this order: R{sme_revenue:.2f}',
                                related_object=order,
                                data={
                                    'order_number': order.order_number,
                                    'revenue': str(sme_revenue)
                                }
                            )
                    except SMEProfile.DoesNotExist:
                        pass
                
                # Calculate and notify agent commission
                total_commission = order.items.aggregate(total=Sum('commission_amount'))['total'] or 0
                
                NotificationService.create_notification(
                    recipient=agent.user,
                    notification_type='agent_commission',
                    title=f'Commission Earned - Order #{order.order_number}',
                    message=f'You earned R{total_commission:.2f} commission from this order',
                    related_object=order,
                    data={
                        'order_number': order.order_number,
                        'commission': str(total_commission)
                    }
                )
                
            elif new_status == 'cancelled':
                # Notify customer
                if order.customer:
                    NotificationService.create_notification(
                        recipient=order.customer,
                        notification_type='order_cancelled',
                        title=f'Order #{order.order_number} Cancelled',
                        message=f'Your order has been cancelled. Reason: {notes or "No reason provided"}',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )
                
                # Notify SME
                for sme_id in order_sme_ids:
                    from smes.models import SMEProfile
                    try:
                        sme = SMEProfile.objects.get(id=sme_id)
                        if sme.user:
                            NotificationService.create_notification(
                                recipient=sme.user,
                                notification_type='order_cancelled',
                                title=f'Order #{order.order_number} Cancelled',
                                message=f'An order for your business has been cancelled.',
                                related_object=order,
                                data={'order_number': order.order_number}
                            )
                    except SMEProfile.DoesNotExist:
                        pass
            
            logger.info(f"Order {order.order_number} status updated from {old_status} to {new_status} by agent {agent.user.email}")
            
            serializer = OrderSerializer(order, context={'request': request})
            return Response({
                'success': True,
                'message': f'Order status updated to {new_status}',
                'order': serializer.data
            }, status=status.HTTP_200_OK)
            
        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating order status: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============= SME ORDER VIEWS =============

class SMEOrderListView(APIView):
    """
    Get orders for the current SME (view only)
    GET /api/sme/orders/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get SME profile
            sme = SMEProfile.objects.get(user=request.user)
            
            # Debug: Check what's in the database
            all_items = OrderItem.objects.filter(sme=sme)
            logger.info(f"SME {sme.id} has {all_items.count()} order items")
            
            # Get orders containing products from this SME
            orders = Order.objects.filter(
                items__sme=sme
            ).distinct().order_by('-created_at')
            
            logger.info(f"Found {orders.count()} orders for this SME")
            
            # Apply filters
            status_filter = request.query_params.get('status')
            if status_filter:
                orders = orders.filter(status=status_filter)
            
            agent_id = request.query_params.get('agent_id')
            if agent_id:
                orders = orders.filter(items__order__agent_id=agent_id).distinct()
            
            # Search by order number
            search = request.query_params.get('search')
            if search:
                orders = orders.filter(order_number__icontains=search)
            
            # Date range
            start_date = request.query_params.get('start_date')
            if start_date:
                orders = orders.filter(created_at__date__gte=start_date)
            
            end_date = request.query_params.get('end_date')
            if end_date:
                orders = orders.filter(created_at__date__lte=end_date)
            
            # Limit
            limit = request.query_params.get('limit')
            if limit:
                try:
                    orders = orders[:int(limit)]
                except ValueError:
                    pass
            
            serializer = OrderSerializer(orders, many=True, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except SMEProfile.DoesNotExist:
            return Response(
                {'error': 'SME profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class SMEOrderDetailView(APIView):
    """
    Get order details for SME (view only)
    GET /api/sme/orders/{order_number}/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, order_number):
        try:
            # Get SME profile
            sme = SMEProfile.objects.get(user=request.user)
            
            # Get order
            order = Order.objects.filter(
                order_number=order_number,
                items__sme=sme
            ).distinct().first()
            
            if not order:
                return Response(
                    {'error': 'Order not found or access denied'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = OrderSerializer(order, context={'request': request})
            return Response(serializer.data)
            
        except SMEProfile.DoesNotExist:
            return Response(
                {'error': 'SME profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class SMEOrderStatsView(APIView):
    """
    Get order statistics for SME (view only)
    GET /api/sme/orders/stats/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get SME profile
            sme = SMEProfile.objects.get(user=request.user)
            
            # Get orders containing products from this SME
            orders = Order.objects.filter(
                items__sme=sme
            ).distinct()
            
            # Order statistics
            total_orders = orders.count()
            pending_orders = orders.filter(status='pending').count()
            processing_orders = orders.filter(status='processing').count()
            paid_orders = orders.filter(status='paid').count()
            shipped_orders = orders.filter(status='shipped').count()
            delivered_orders = orders.filter(status='delivered').count()
            cancelled_orders = orders.filter(status='cancelled').count()
            completed_orders = orders.filter(status='completed').count()
            
            # Revenue statistics
            delivered_revenue = OrderItem.objects.filter(
                order__in=orders.filter(status='delivered'),
                sme=sme
            ).aggregate(total=Sum('total'))['total'] or 0
            
            paid_revenue = OrderItem.objects.filter(
                order__in=orders.filter(status='paid'),
                sme=sme
            ).aggregate(total=Sum('total'))['total'] or 0
            
            completed_revenue = OrderItem.objects.filter(
                order__in=orders.filter(status='completed'),
                sme=sme
            ).aggregate(total=Sum('total'))['total'] or 0
            
            total_revenue = delivered_revenue + paid_revenue + completed_revenue
            
            # Product statistics
            products_sold = OrderItem.objects.filter(
                order__in=orders,
                sme=sme
            ).values('product_name').annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('total')
            ).order_by('-total_revenue')[:10]
            
            # Orders by agent
            by_agent = orders.values(
                'items__order__agent__user__full_name'
            ).annotate(
                count=Count('id', distinct=True),
                revenue=Sum('total_amount')
            ).order_by('-revenue')
            
            # Calculate average order value
            average_order_value = total_revenue / total_orders if total_orders > 0 else 0
            
            return Response({
                'total_orders': total_orders,
                'pending_orders': pending_orders,
                'processing_orders': processing_orders,
                'paid_orders': paid_orders,
                'shipped_orders': shipped_orders,
                'delivered_orders': delivered_orders,
                'cancelled_orders': cancelled_orders,
                'completed_orders': completed_orders,
                'total_revenue': total_revenue,
                'delivered_revenue': delivered_revenue,
                'paid_revenue': paid_revenue,
                'completed_revenue': completed_revenue,
                'average_order_value': average_order_value,
                'products_sold': products_sold,
                'by_agent': by_agent
            }, status=status.HTTP_200_OK)
            
        except SMEProfile.DoesNotExist:
            return Response(
                {'error': 'SME profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


# ============= ADMIN ORDER VIEWS =============

class AdminOrderListView(APIView):
    """
    Get all orders (admin only)
    GET /api/admin/orders/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Check if user is admin
        if request.user.role != 'admin':
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        orders = Order.objects.all().order_by('-created_at')
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            orders = orders.filter(status=status_filter)
        
        customer_id = request.query_params.get('customer_id')
        if customer_id:
            orders = orders.filter(customer_id=customer_id)
        
        agent_id = request.query_params.get('agent_id')
        if agent_id:
            orders = orders.filter(agent_id=agent_id)
        
        # Date range
        start_date = request.query_params.get('start_date')
        if start_date:
            orders = orders.filter(created_at__date__gte=start_date)
        
        end_date = request.query_params.get('end_date')
        if end_date:
            orders = orders.filter(created_at__date__lte=end_date)
        
        # Pagination
        limit = request.query_params.get('limit', 20)
        offset = request.query_params.get('offset', 0)
        
        try:
            limit = int(limit)
            offset = int(offset)
            total = orders.count()
            orders = orders[offset:offset + limit]
        except ValueError:
            total = orders.count()
        
        serializer = OrderSerializer(orders, many=True, context={'request': request})
        
        return Response({
            'total': total,
            'limit': limit,
            'offset': offset,
            'results': serializer.data
        }, status=status.HTTP_200_OK)


class AdminOrderDetailView(APIView):
    """
    Get, update or delete order (admin only)
    GET /api/admin/orders/{order_number}/
    PATCH /api/admin/orders/{order_number}/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, order_number):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        order = get_object_or_404(Order, order_number=order_number)
        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, order_number):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        order = get_object_or_404(Order, order_number=order_number)
        serializer = OrderStatusUpdateSerializer(
            order,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        
        if serializer.is_valid():
            updated_order = serializer.save()
            return Response(
                OrderSerializer(updated_order, context={'request': request}).data
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============= DEBUG VIEWS =============

class DebugSMEOrdersView(APIView):
    """
    Debug endpoint to check SME orders
    GET /api/sme/debug-orders/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get SME profile
            sme = SMEProfile.objects.get(user=request.user)
            
            # Get all order items for this SME
            order_items = OrderItem.objects.filter(sme=sme).select_related('order')
            
            # Get all orders
            orders = Order.objects.filter(items__sme=sme).distinct()
            
            return Response({
                'sme_id': sme.id,
                'sme_name': sme.business_name,
                'total_order_items': order_items.count(),
                'total_orders': orders.count(),
                'order_items': [
                    {
                        'id': item.id,
                        'order_number': item.order.order_number,
                        'product_name': item.product_name,
                        'quantity': item.quantity,
                        'unit_price': str(item.unit_price),
                        'total': str(item.total),
                        'order_status': item.order.status,
                        'created_at': item.created_at
                    }
                    for item in order_items
                ],
                'orders': [
                    {
                        'id': order.id,
                        'order_number': order.order_number,
                        'status': order.status,
                        'total_amount': str(order.total_amount),
                        'created_at': order.created_at,
                        'item_count': order.items.filter(sme=sme).count()
                    }
                    for order in orders
                ]
            })
        except SMEProfile.DoesNotExist:
            return Response({'error': 'SME profile not found'}, status=404)

# orders/views.py - Add this new view

class SMEOrderReadyForPickupView(APIView):
    """
    Mark order as ready for pickup (SME packages the order)
    POST /api/sme/orders/{orderNumber}/ready-for-pickup/
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, order_number):
        try:
            # Get SME profile
            sme = SMEProfile.objects.get(user=request.user)
            
            # Get the order
            order = Order.objects.filter(
                order_number=order_number,
                items__sme=sme
            ).distinct().first()
            
            if not order:
                return Response(
                    {'error': 'Order not found or access denied'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if order can be packaged (paid or processing)
            if order.status not in ['paid', 'processing']:
                return Response({
                    'error': f'Order cannot be packaged in current status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update order status to 'processing' if it's paid
            if order.status == 'paid':
                order.status = 'processing'
                order.save()
            
            # Create status history entry
            OrderStatusHistory.objects.create(
                order=order,
                status='processing',
                notes=f'Order packaged and ready for pickup. Notes: {request.data.get("package_notes", "")}',
                changed_by=request.user
            )
            
            # ===== NOTIFY AGENTS =====
            from notifications.services import NotificationService
            
            # Get all agents assigned to this SME
            from agents.models import AgentSMEAssignment
            assignments = AgentSMEAssignment.objects.filter(
                sme=sme,
                active=True
            ).select_related('agent__user')
            
            notified_agents = []
            for assignment in assignments:
                if assignment.agent and assignment.agent.user:
                    # Create notification for agent
                    notification = NotificationService.create_notification(
                        recipient=assignment.agent.user,
                        notification_type='order_ready_pickup',
                        title=f'Order #{order.order_number} Ready for Pickup',
                        message=f'Order #{order.order_number} has been packaged and is ready for collection from {sme.business_name}. Please collect and ship to customer.',
                        related_object=order,
                        data={
                            'order_number': order.order_number,
                            'sme_name': sme.business_name,
                            'sme_address': sme.business_address,
                            'customer_name': order.customer_full_name,
                            'customer_address': order.shipping_address_snapshot,
                            'package_notes': request.data.get('package_notes', ''),
                            'estimated_pack_time': request.data.get('estimated_pack_time', 5)
                        }
                    )
                    
                    if notification:
                        notified_agents.append(assignment.agent.user.email)
                        
                        # You could also send email/SMS here if needed
                        # send_email_notification(assignment.agent.user.email, ...)
            
            logger.info(f"Notified {len(notified_agents)} agents about order {order.order_number} ready for pickup")
            
            return Response({
                'success': True,
                'message': 'Order marked as ready for pickup',
                'order_number': order.order_number,
                'status': order.status,
                'notified_agents': notified_agents,
                'package_data': {
                    'notes': request.data.get('package_notes', ''),
                    'estimated_time': request.data.get('estimated_pack_time', 5),
                    'items_confirmed': request.data.get('items_confirmed', {})
                }
            }, status=status.HTTP_200_OK)
            
        except SMEProfile.DoesNotExist:
            return Response(
                {'error': 'SME profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error marking order ready for pickup: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )