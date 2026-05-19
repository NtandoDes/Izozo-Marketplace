# agents/views.py
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from decimal import Decimal

from orders.models import Order, OrderItem, OrderStatusHistory
from orders.serializers import OrderSerializer
from products.models import Product
from products.serializers import ProductDetailSerializer
from notifications.services import NotificationService

from .models import AgentProfile, AgentSMEAssignment
from .serializers import (
    AgentRegisterSerializer, AgentProfileSerializer, AgentProfileUpdateSerializer,
    AgentSMEAssignmentSerializer, AgentSMEAssignmentCreateSerializer
)
from users.models import User
from users.serializers import UserSerializer

import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared delivery field helper (mirrors products/views.py)
# ---------------------------------------------------------------------------

DELIVERY_FIELDS = ('length_cm', 'width_cm', 'height_cm', 'weight_kg')


def _parse_delivery_fields(request_data, errors: dict) -> dict:
    """
    Extract and validate the four PAXI sizing fields from request.data.
    Populates *errors* dict on failure; returns a (possibly partial) dict.
    """
    result = {}
    int_fields = ('length_cm', 'width_cm', 'height_cm')
    dec_fields = ('weight_kg',)

    for field in int_fields:
        raw = request_data.get(field)
        if raw is None:
            errors[field] = f'{field} is required'
            continue
        try:
            val = int(raw)
            if val <= 0:
                raise ValueError
            result[field] = val
        except (ValueError, TypeError):
            errors[field] = f'{field} must be a positive integer'

    for field in dec_fields:
        raw = request_data.get(field)
        if raw is None:
            errors[field] = f'{field} is required'
            continue
        try:
            val = Decimal(str(raw))
            if val <= 0:
                raise ValueError
            result[field] = val
        except (ValueError, TypeError, Decimal.InvalidOperation):
            errors[field] = f'{field} must be a positive number'

    return result


# ============================================================================
# AUTH / PROFILE
# ============================================================================

class AgentRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AgentRegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            agent_profile = serializer.save()
            user = agent_profile.user

            refresh = RefreshToken.for_user(user)

            return Response({
                'message': 'Agent registered successfully',
                'user': UserSerializer(user).data,
                'agent_profile': AgentProfileSerializer(agent_profile).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AgentProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent_profile = AgentProfile.objects.get(user=request.user)
            serializer = AgentProfileSerializer(agent_profile)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    def put(self, request):
        try:
            agent_profile = AgentProfile.objects.get(user=request.user)
            user = request.user

            user_updated = False
            if 'full_name' in request.data and request.data['full_name'] != user.full_name:
                user.full_name = request.data['full_name']
                user_updated = True
            if 'phone' in request.data and request.data['phone'] != user.phone:
                user.phone = request.data['phone']
                user_updated = True

            if user_updated:
                user.save()
                logger.info(f"Updated user {user.id} fields: full_name={user.full_name}, phone={user.phone}")

            profile_serializer = AgentProfileUpdateSerializer(agent_profile, data=request.data, partial=True)
            if profile_serializer.is_valid():
                profile_serializer.save()
                logger.info(f"Updated agent profile {agent_profile.id}")

                response_data = {
                    'id': agent_profile.id,
                    'user': UserSerializer(user).data,
                    'home_address': agent_profile.home_address,
                    'has_internet': agent_profile.has_internet,
                    'has_smartphone': agent_profile.has_smartphone,
                    'created_at': agent_profile.created_at,
                    'updated_at': timezone.now()
                }

                return Response(response_data, status=status.HTTP_200_OK)

            return Response(profile_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AgentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        agents = AgentProfile.objects.all()
        serializer = AgentProfileSerializer(agents, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ============================================================================
# SME ASSIGNMENTS
# ============================================================================

class AgentSMEAssignmentListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AgentSMEAssignmentCreateSerializer
        return AgentSMEAssignmentSerializer

    def get_queryset(self):
        queryset = AgentSMEAssignment.objects.all()

        agent_id = self.request.query_params.get('agent_id')
        if agent_id:
            queryset = queryset.filter(agent_id=agent_id)

        sme_id = self.request.query_params.get('sme_id')
        if sme_id:
            queryset = queryset.filter(sme_id=sme_id)

        return queryset


class AgentSMEAssignmentDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = AgentSMEAssignment.objects.all()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return AgentSMEAssignmentCreateSerializer
        return AgentSMEAssignmentSerializer


# ============================================================================
# PRODUCT MANAGEMENT FOR AGENTS
# ============================================================================

class AgentProductDetailView(APIView):
    """
    Get, update or delete a product (agent access)
    GET    /api/agent/products/{pk}/
    PUT    /api/agent/products/{pk}/
    DELETE /api/agent/products/{pk}/

    PUT accepts all standard product fields PLUS the four PAXI delivery fields:
        length_cm  (positive integer, cm)
        width_cm   (positive integer, cm)
        height_cm  (positive integer, cm)
        weight_kg  (positive decimal, kg)

    Delivery fields are optional on update — if none are supplied the existing
    values are left unchanged.  If any one is supplied, all four are required
    so the size category can be computed correctly.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, pk, user):
        try:
            product = Product.objects.get(pk=pk)

            if user.role == 'agent':
                agent = AgentProfile.objects.get(user=user)

                if product.agent == agent:
                    return product

                if product.sme and AgentSMEAssignment.objects.filter(
                    agent=agent,
                    sme=product.sme,
                    active=True
                ).exists():
                    return product

            elif user.role == 'sme':
                from smes.models import SMEProfile
                sme = SMEProfile.objects.get(user=user)
                if product.sme == sme:
                    return product

            elif user.role == 'admin':
                return product

            return None

        except (Product.DoesNotExist, AgentProfile.DoesNotExist):
            return None

    def get(self, request, pk):
        product = self.get_object(pk, request.user)
        if not product:
            return Response(
                {'error': 'Product not found or access denied'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ProductDetailSerializer(product, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        product = self.get_object(pk, request.user)
        if not product:
            return Response(
                {'error': 'Product not found or access denied'},
                status=status.HTTP_404_NOT_FOUND
            )

        logger.info(f"Agent {request.user.email} attempting to update product {pk}")
        logger.info(f"Product owner SME: {product.sme.business_name if product.sme else 'None'}")
        logger.info(f"Product created by agent: {product.agent.user.email if product.agent else 'System'}")

        if request.user.role == 'agent':
            agent = AgentProfile.objects.get(user=request.user)
            is_assigned = product.sme and AgentSMEAssignment.objects.filter(
                agent=agent,
                sme=product.sme,
                active=True
            ).exists()

            if not is_assigned and product.status not in ['draft', 'pending', 'rejected']:
                logger.warning(f"Agent {request.user.email} cannot edit approved product {pk}")
                return Response(
                    {'error': 'Cannot edit approved products'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # ---- standard scalar fields ---------------------------------------
        str_fields = {
            'name': str,
            'description': str,
            'sku': str,
            'barcode': str,
        }
        for field, _ in str_fields.items():
            val = request.data.get(field)
            if val is not None:
                setattr(product, field, val)

        if request.data.get('short_description') is not None:
            product.short_description = request.data.get('short_description')

        decimal_fields = ('base_price', 'selling_price', 'discount_percentage', 'commission_rate')
        for field in decimal_fields:
            raw = request.data.get(field)
            if raw is not None:
                try:
                    product.__dict__[field] = Decimal(str(raw)) if raw != '' else None
                except (ValueError, TypeError, Decimal.InvalidOperation):
                    pass

        int_qty_fields = ('stock_quantity', 'low_stock_threshold')
        for field in int_qty_fields:
            raw = request.data.get(field)
            if raw is not None:
                try:
                    setattr(product, field, int(raw))
                except ValueError:
                    pass

        # ---- PAXI / delivery fields (all-or-nothing when any are present) -
        delivery_fields_present = any(
            request.data.get(f) is not None for f in DELIVERY_FIELDS
        )
        if delivery_fields_present:
            delivery_errors = {}
            delivery_data = _parse_delivery_fields(request.data, delivery_errors)
            if delivery_errors:
                return Response(delivery_errors, status=status.HTTP_400_BAD_REQUEST)
            for field, value in delivery_data.items():
                setattr(product, field, value)
            logger.info(
                f"Product {pk} delivery updated: "
                f"{delivery_data} → size={product.delivery_size_category}"
            )
        # -------------------------------------------------------------------

        product.save()

        if 'featured_image' in request.FILES:
            product.featured_image = request.FILES['featured_image']
            product.save()

        is_agent_approved = request.user.status == 'active'

        if request.user.role == 'agent':
            if is_agent_approved:
                product.status = 'active'
                product.is_active = True
                product.published_at = timezone.now()
                product.approved_by = request.user
                product.approved_at = timezone.now()
            else:
                product.status = 'pending'
                product.is_active = False
            product.save()

        serializer = ProductDetailSerializer(product, context={'request': request})
        logger.info(f"Product {pk} updated successfully by {request.user.email}")
        return Response(serializer.data)

    def delete(self, request, pk):
        product = self.get_object(pk, request.user)
        if not product:
            return Response(
                {'error': 'Product not found or access denied'},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.user.role == 'agent' and product.status not in ['draft', 'pending', 'rejected']:
            return Response(
                {'error': 'Cannot delete approved products'},
                status=status.HTTP_403_FORBIDDEN
            )

        product.delete()
        logger.info(f"Product {pk} deleted by {request.user.email}")
        return Response(
            {'message': 'Product deleted successfully'},
            status=status.HTTP_200_OK
        )


# ============================================================================
# ORDER MANAGEMENT FOR AGENTS
# ============================================================================

class AgentOrderListView(APIView):
    """
    Get orders for assigned SMEs (agent access)
    GET /api/agent/orders/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            assignments = AgentSMEAssignment.objects.filter(
                agent=agent,
                active=True
            ).values_list('sme_id', flat=True)

            orders = Order.objects.filter(
                items__sme_id__in=assignments
            ).distinct().order_by('-created_at').prefetch_related(
                'items__sme',
                'items__sme__user',
                'customer'
            )

            status_filter = request.query_params.get('status')
            if status_filter:
                orders = orders.filter(status=status_filter)

            sme_id = request.query_params.get('sme_id')
            if sme_id and int(sme_id) in assignments:
                orders = orders.filter(items__sme_id=sme_id).distinct()

            search = request.query_params.get('search')
            if search:
                orders = orders.filter(order_number__icontains=search)

            start_date = request.query_params.get('start_date')
            if start_date:
                orders = orders.filter(created_at__date__gte=start_date)

            end_date = request.query_params.get('end_date')
            if end_date:
                orders = orders.filter(created_at__date__lte=end_date)

            limit = request.query_params.get('limit')
            if limit:
                try:
                    orders = orders[:int(limit)]
                except ValueError:
                    pass

            enhanced_orders = []
            for order in orders:
                order_data = OrderSerializer(order, context={'request': request}).data

                sme_info = {}
                for item in order.items.all():
                    if item.sme and item.sme.id not in sme_info:
                        sme_info[item.sme.id] = {
                            'id': item.sme.id,
                            'business_name': item.sme.business_name,
                            'business_address': item.sme.business_address
                        }

                if len(sme_info) > 1:
                    order_data['sme_name'] = 'Multiple SMEs'
                    order_data['sme_id'] = None
                    order_data['sme_list'] = list(sme_info.values())
                elif len(sme_info) == 1:
                    first_sme = list(sme_info.values())[0]
                    order_data['sme_name'] = first_sme['business_name']
                    order_data['sme_id'] = first_sme['id']
                    order_data['sme_address'] = first_sme['business_address']
                else:
                    order_data['sme_name'] = 'N/A'
                    order_data['sme_id'] = None

                enhanced_orders.append(order_data)

            return Response(enhanced_orders, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in AgentOrderListView: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AgentOrderDetailView(APIView):
    """
    Get order details for agent
    GET /api/agent/orders/{order_number}/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, order_number):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            assignments = AgentSMEAssignment.objects.filter(
                agent=agent,
                active=True
            ).values_list('sme_id', flat=True)

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


class AgentOrderStatusUpdateView(APIView):
    """
    Update order status (agent)
    PATCH /api/agent/orders/{order_number}/status/
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, order_number):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            try:
                order = Order.objects.get(order_number=order_number)
            except Order.DoesNotExist:
                return Response(
                    {'error': 'Order not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            order_sme_ids = order.items.values_list('sme_id', flat=True).distinct()
            has_access = AgentSMEAssignment.objects.filter(
                agent=agent,
                sme_id__in=order_sme_ids,
                active=True
            ).exists()

            if not has_access:
                logger.warning(f"Agent {agent.user.email} attempted to update order {order_number} without permission")
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

            valid_transitions = {
                'pending': ['processing', 'cancelled'],
                'processing': ['paid', 'shipped', 'cancelled'],
                'paid': ['shipped', 'cancelled'],
                'collected': ['shipped', 'cancelled'],
                'shipped': ['delivered', 'cancelled'],
                'delivered': [],
                'cancelled': []
            }

            if new_status not in valid_transitions.get(order.status, []):
                logger.warning(f"Invalid status transition from {order.status} to {new_status}")
                return Response({
                    'error': f'Cannot transition from {order.status} to {new_status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            old_status = order.status
            order.status = new_status

            if new_status == 'shipped':
                order.shipped_by = agent
                order.shipped_at = timezone.now()
            elif new_status == 'delivered':
                order.delivered_by = agent
                order.delivered_at = timezone.now()
            elif new_status == 'paid':
                order.paid_at = timezone.now()

            order.save()

            OrderStatusHistory.objects.create(
                order=order,
                status=new_status,
                notes=notes or f'Status updated from {old_status} to {new_status} by agent',
                changed_by=request.user
            )

            # ===== NOTIFICATIONS =====
            if new_status == 'shipped':
                tracking_number = request.data.get('tracking_number') or order.tracking_number
                carrier = request.data.get('carrier') or order.carrier

                if order.customer:
                    NotificationService.create_notification(
                        recipient=order.customer,
                        notification_type='order_shipped',
                        title=f'Order #{order.order_number} Shipped',
                        message=f'Your order has been shipped. Tracking: {tracking_number or "N/A"}',
                        related_object=order,
                        data={
                            'order_number': order.order_number,
                            'tracking_number': tracking_number,
                            'carrier': carrier,
                            'status': 'shipped'
                        }
                    )

                for sme_id in order_sme_ids:
                    from smes.models import SMEProfile
                    try:
                        sme = SMEProfile.objects.get(id=sme_id)
                        if sme.user:
                            NotificationService.create_notification(
                                recipient=sme.user,
                                notification_type='order_shipped',
                                title=f'Order #{order.order_number} Shipped',
                                message=f'Order has been picked up and shipped. Tracking: {tracking_number or "N/A"}',
                                related_object=order,
                                data={'order_number': order.order_number, 'tracking_number': tracking_number}
                            )
                    except SMEProfile.DoesNotExist:
                        pass

            elif new_status == 'delivered':
                if order.customer:
                    NotificationService.create_notification(
                        recipient=order.customer,
                        notification_type='order_delivered',
                        title=f'Order #{order.order_number} Delivered',
                        message='Your order has been delivered. Thank you for shopping with Izozo!',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )

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
                                data={'order_number': order.order_number, 'revenue': str(sme_revenue)}
                            )
                    except SMEProfile.DoesNotExist:
                        pass

                total_commission = order.items.aggregate(total=Sum('commission_amount'))['total'] or 0
                NotificationService.create_notification(
                    recipient=agent.user,
                    notification_type='agent_commission',
                    title=f'Commission Earned - Order #{order.order_number}',
                    message=f'You earned R{total_commission:.2f} commission from this order',
                    related_object=order,
                    data={'order_number': order.order_number, 'commission': str(total_commission)}
                )

            elif new_status == 'cancelled':
                if order.customer:
                    NotificationService.create_notification(
                        recipient=order.customer,
                        notification_type='order_cancelled',
                        title=f'Order #{order.order_number} Cancelled',
                        message=f'Your order has been cancelled. Reason: {notes or "No reason provided"}',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )

                for sme_id in order_sme_ids:
                    from smes.models import SMEProfile
                    try:
                        sme = SMEProfile.objects.get(id=sme_id)
                        if sme.user:
                            NotificationService.create_notification(
                                recipient=sme.user,
                                notification_type='order_cancelled',
                                title=f'Order #{order.order_number} Cancelled',
                                message='An order for your business has been cancelled.',
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


class AgentPickupOrdersView(APIView):
    """
    Get orders ready for pickup (for agents)
    GET /api/agent/orders/ready-for-pickup/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent = AgentProfile.objects.get(user=request.user)
            logger.info(f"Fetching pickup orders for agent {agent.user.email}")

            assignments = AgentSMEAssignment.objects.filter(
                agent=agent,
                active=True
            ).values_list('sme_id', flat=True)

            logger.info(f"Agent has {len(assignments)} assigned SMEs: {list(assignments)}")

            if not assignments:
                return Response([])

            orders = Order.objects.filter(
                items__sme_id__in=assignments,
                status='processing'
            ).distinct().order_by('-created_at').prefetch_related(
                'items__sme',
                'items__sme__user',
                'shipping_address'
            )

            logger.info(f"Found {orders.count()} processing orders for agent")

            enhanced_orders = []
            for order in orders:
                first_item = order.items.filter(sme_id__in=assignments).first()
                order_data = OrderSerializer(order, context={'request': request}).data

                if first_item and first_item.sme:
                    order_data['sme_name'] = first_item.sme.business_name
                    order_data['sme_address'] = first_item.sme.business_address or 'Address not available'
                    order_data['sme_phone'] = first_item.sme.user.phone if first_item.sme.user else 'N/A'
                    order_data['commission_amount'] = order.items.filter(
                        sme_id__in=assignments
                    ).aggregate(total=Sum('commission_amount'))['total'] or 0
                    order_data['ready_at'] = order.updated_at

                    # Include per-item delivery sizing for PAXI label generation
                    order_data['items_delivery'] = [
                        {
                            'product_id': item.product_id,
                            'product_name': item.product_name,
                            'length_cm': item.product.length_cm if item.product else None,
                            'width_cm': item.product.width_cm if item.product else None,
                            'height_cm': item.product.height_cm if item.product else None,
                            'weight_kg': str(item.product.weight_kg) if item.product else None,
                            'delivery_size_category': item.product.delivery_size_category if item.product else None,
                        }
                        for item in order.items.filter(sme_id__in=assignments).select_related('product')
                    ]
                else:
                    order_data['sme_name'] = 'Unknown SME'
                    order_data['sme_address'] = 'Address not available'
                    order_data['sme_phone'] = 'N/A'
                    order_data['commission_amount'] = 0
                    order_data['ready_at'] = order.updated_at
                    order_data['items_delivery'] = []

                enhanced_orders.append(order_data)

            return Response(enhanced_orders, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            logger.error(f"Agent profile not found for user {request.user.email}")
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in AgentPickupOrdersView: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TestPickupOrdersView(APIView):
    """Simple test view to verify URL routing — GET /api/agent/test-pickup/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'message': 'Test endpoint working',
            'user': request.user.email,
            'method': 'GET'
        })


class AgentCollectedOrdersView(APIView):
    """
    Get orders collected by agent (ready to ship)
    GET /api/agent/orders/collected/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            orders = Order.objects.filter(
                collected_by=agent,
                status='collected'
            ).order_by('-collected_at')

            serializer = OrderSerializer(orders, many=True, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AgentShippedOrdersView(APIView):
    """
    Get orders shipped by agent (in transit)
    GET /api/agent/orders/shipped/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            orders = Order.objects.filter(
                shipped_by=agent,
                status='shipped'
            ).order_by('-shipped_at')

            serializer = OrderSerializer(orders, many=True, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AgentMarkOrderCollectedView(APIView):
    """
    Mark order as collected (agent picks up from SME)
    POST /api/agent/orders/{order_id}/collect/
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, order_id):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            try:
                order = Order.objects.get(id=order_id)
            except Order.DoesNotExist:
                return Response(
                    {'error': 'Order not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if order.status != 'processing':
                return Response({
                    'error': f'Order cannot be collected in current status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            order_sme_ids = order.items.values_list('sme_id', flat=True).distinct()
            has_access = AgentSMEAssignment.objects.filter(
                agent=agent,
                sme_id__in=order_sme_ids,
                active=True
            ).exists()

            if not has_access:
                return Response(
                    {'error': 'You are not authorized to collect this order'},
                    status=status.HTTP_403_FORBIDDEN
                )

            order.status = 'collected'
            order.collected_by = agent
            order.collected_at = timezone.now()
            order.save()

            OrderStatusHistory.objects.create(
                order=order,
                status='collected',
                notes=request.data.get('notes', 'Order collected by agent'),
                changed_by=request.user
            )

            for sme_id in order_sme_ids:
                from smes.models import SMEProfile
                try:
                    sme = SMEProfile.objects.get(id=sme_id)
                    if sme.user:
                        NotificationService.create_notification(
                            recipient=sme.user,
                            notification_type='order_collected',
                            title=f'Order #{order.order_number} Collected',
                            message=f'Your order has been collected by agent {agent.user.full_name}',
                            related_object=order,
                            data={'order_number': order.order_number}
                        )
                except SMEProfile.DoesNotExist:
                    pass

            logger.info(f"Order {order.order_number} marked as collected by agent {agent.user.email}")

            serializer = OrderSerializer(order, context={'request': request})
            return Response({
                'success': True,
                'message': 'Order marked as collected',
                'order': serializer.data
            }, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error marking order as collected: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AgentMarkOrderShippedView(APIView):
    """
    Mark order as shipped (agent ships to customer)
    POST /api/agent/orders/{order_id}/ship/
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, order_id):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            try:
                order = Order.objects.get(id=order_id)
            except Order.DoesNotExist:
                return Response(
                    {'error': 'Order not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if order.status != 'collected':
                return Response({
                    'error': f'Order cannot be shipped in current status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            if order.collected_by != agent:
                return Response(
                    {'error': 'You can only ship orders you collected'},
                    status=status.HTTP_403_FORBIDDEN
                )

            tracking_number = request.data.get('tracking_number')
            carrier = request.data.get('carrier')

            if not tracking_number:
                return Response(
                    {'error': 'Tracking number is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not carrier:
                return Response(
                    {'error': 'Carrier is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            order.status = 'shipped'
            order.shipped_by = agent
            order.shipped_at = timezone.now()
            order.tracking_number = tracking_number
            order.carrier = carrier
            order.save()

            OrderStatusHistory.objects.create(
                order=order,
                status='shipped',
                notes=request.data.get('notes', f'Order shipped via {carrier}. Tracking: {tracking_number}'),
                changed_by=request.user
            )

            if order.customer:
                NotificationService.create_notification(
                    recipient=order.customer,
                    notification_type='order_shipped',
                    title=f'Order #{order.order_number} Shipped',
                    message=f'Your order has been shipped via {carrier}. Tracking: {tracking_number}',
                    related_object=order,
                    data={
                        'order_number': order.order_number,
                        'tracking_number': tracking_number,
                        'carrier': carrier
                    }
                )

            logger.info(f"Order {order.order_number} marked as shipped by agent {agent.user.email}")

            serializer = OrderSerializer(order, context={'request': request})
            return Response({
                'success': True,
                'message': 'Order marked as shipped',
                'order': serializer.data
            }, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error marking order as shipped: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AgentMarkOrderDeliveredView(APIView):
    """
    Mark order as delivered (customer receives order)
    POST /api/agent/orders/{order_id}/deliver/
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, order_id):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            try:
                order = Order.objects.get(id=order_id)
            except Order.DoesNotExist:
                return Response(
                    {'error': 'Order not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if order.status != 'shipped':
                return Response({
                    'error': f'Order cannot be delivered in current status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            if order.shipped_by != agent:
                return Response(
                    {'error': 'You can only deliver orders you shipped'},
                    status=status.HTTP_403_FORBIDDEN
                )

            order.status = 'delivered'
            order.delivered_by = agent
            order.delivered_at = timezone.now()
            order.save()

            OrderStatusHistory.objects.create(
                order=order,
                status='delivered',
                notes=request.data.get('notes', 'Order delivered successfully'),
                changed_by=request.user
            )

            if order.customer:
                NotificationService.create_notification(
                    recipient=order.customer,
                    notification_type='order_delivered',
                    title=f'Order #{order.order_number} Delivered',
                    message='Your order has been delivered. Thank you for shopping with Izozo!',
                    related_object=order,
                    data={'order_number': order.order_number}
                )

            order_sme_ids = order.items.values_list('sme_id', flat=True).distinct()
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
                            data={'order_number': order.order_number, 'revenue': str(sme_revenue)}
                        )
                except SMEProfile.DoesNotExist:
                    pass

            total_commission = order.items.aggregate(total=Sum('commission_amount'))['total'] or 0
            NotificationService.create_notification(
                recipient=agent.user,
                notification_type='agent_commission',
                title=f'Commission Earned - Order #{order.order_number}',
                message=f'You earned R{total_commission:.2f} commission from this order',
                related_object=order,
                data={'order_number': order.order_number, 'commission': str(total_commission)}
            )

            logger.info(f"Order {order.order_number} marked as delivered by agent {agent.user.email}")

            serializer = OrderSerializer(order, context={'request': request})
            return Response({
                'success': True,
                'message': 'Order marked as delivered',
                'order': serializer.data,
                'commission_earned': total_commission
            }, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error marking order as delivered: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================================
# DEBUG ENDPOINTS
# ============================================================================

class DebugAgentPermissionsView(APIView):
    """GET /api/agent/debug/permissions/{product_id}/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        try:
            agent = AgentProfile.objects.get(user=request.user)
            product = Product.objects.get(id=product_id)

            is_assigned = False
            if product.sme:
                is_assigned = AgentSMEAssignment.objects.filter(
                    agent=agent,
                    sme=product.sme,
                    active=True
                ).exists()

            is_creator = product.agent == agent

            return Response({
                'agent_id': agent.id,
                'agent_email': agent.user.email,
                'product_id': product.id,
                'product_name': product.name,
                'product_status': product.status,
                'product_sme': product.sme.business_name if product.sme else None,
                'product_agent': product.agent.user.email if product.agent else None,
                'is_creator': is_creator,
                'is_assigned_to_sme': is_assigned,
                'can_edit': is_creator or is_assigned or request.user.role == 'admin',
                'editable_states': product.status in ['draft', 'pending', 'rejected'],
                # Delivery info
                'delivery': {
                    'length_cm': product.length_cm,
                    'width_cm': product.width_cm,
                    'height_cm': product.height_cm,
                    'weight_kg': str(product.weight_kg),
                    'volume_cm3': product.volume_cm3,
                    'delivery_size_category': product.delivery_size_category,
                }
            }, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response({'error': 'Agent not found'}, status=404)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class DebugPickupOrdersView(APIView):
    """GET /api/agent/debug/pickup-orders/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            all_processing = Order.objects.filter(status='processing')

            assignments = AgentSMEAssignment.objects.filter(
                agent=agent,
                active=True
            ).values_list('sme_id', flat=True)

            agent_processing = Order.objects.filter(
                items__sme_id__in=assignments,
                status='processing'
            ).distinct()

            all_agent_orders = Order.objects.filter(
                items__sme_id__in=assignments
            ).distinct()

            return Response({
                'agent_id': agent.id,
                'agent_email': agent.user.email,
                'assigned_smes': list(assignments),
                'assigned_smes_count': len(assignments),
                'total_processing_orders': all_processing.count(),
                'agent_processing_orders': agent_processing.count(),
                'agent_total_orders': all_agent_orders.count(),
                'processing_orders': [
                    {
                        'id': order.id,
                        'order_number': order.order_number,
                        'status': order.status,
                        'created_at': order.created_at,
                        'sme_ids': list(order.items.values_list('sme_id', flat=True).distinct())
                    }
                    for order in all_processing[:10]
                ],
                'agent_orders': [
                    {
                        'id': order.id,
                        'order_number': order.order_number,
                        'status': order.status,
                        'created_at': order.created_at,
                        'sme_ids': list(order.items.values_list('sme_id', flat=True).distinct())
                    }
                    for order in all_agent_orders[:10]
                ]
            }, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response({'error': 'Agent profile not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# ============================================================================
# COMMISSION MANAGEMENT
# ============================================================================

class AgentCommissionSummaryView(APIView):
    """GET /api/agent/commission/summary/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            delivered_orders = Order.objects.filter(
                delivered_by=agent,
                status='delivered'
            )

            total_commission = OrderItem.objects.filter(
                order__in=delivered_orders
            ).aggregate(total=Sum('commission_amount'))['total'] or 0

            shipped_orders = Order.objects.filter(
                shipped_by=agent,
                status='shipped'
            )
            pending_commission = OrderItem.objects.filter(
                order__in=shipped_orders
            ).aggregate(total=Sum('commission_amount'))['total'] or 0

            first_of_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            this_month_orders = delivered_orders.filter(delivered_at__gte=first_of_month)
            this_month_commission = OrderItem.objects.filter(
                order__in=this_month_orders
            ).aggregate(total=Sum('commission_amount'))['total'] or 0

            last_month = first_of_month - timezone.timedelta(days=1)
            last_month_start = last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_orders = delivered_orders.filter(
                delivered_at__gte=last_month_start,
                delivered_at__lt=first_of_month
            )
            last_month_commission = OrderItem.objects.filter(
                order__in=last_month_orders
            ).aggregate(total=Sum('commission_amount'))['total'] or 0

            by_sme = []
            sme_ids = delivered_orders.values_list('items__sme_id', flat=True).distinct()

            for sme_id in sme_ids:
                if sme_id:
                    from smes.models import SMEProfile
                    try:
                        sme = SMEProfile.objects.get(id=sme_id)
                        sme_orders = delivered_orders.filter(items__sme_id=sme_id).distinct()
                        sme_commission = OrderItem.objects.filter(
                            order__in=sme_orders,
                            sme_id=sme_id
                        ).aggregate(total=Sum('commission_amount'))['total'] or 0

                        by_sme.append({
                            'sme_id': sme_id,
                            'sme_name': sme.business_name,
                            'orders_count': sme_orders.count(),
                            'commission': sme_commission
                        })
                    except SMEProfile.DoesNotExist:
                        pass

            return Response({
                'total_commission': total_commission,
                'pending_commission': pending_commission,
                'paid_commission': 0,
                'this_month': this_month_commission,
                'last_month': last_month_commission,
                'by_sme': by_sme
            }, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error fetching commission summary: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AgentCommissionHistoryView(APIView):
    """GET /api/agent/commission/history/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent = AgentProfile.objects.get(user=request.user)

            orders = Order.objects.filter(
                delivered_by=agent,
                status='delivered'
            ).order_by('-delivered_at')

            limit = request.query_params.get('limit', 20)
            try:
                limit = int(limit)
                orders = orders[:limit]
            except ValueError:
                pass

            history = []
            for order in orders:
                commission = OrderItem.objects.filter(
                    order=order
                ).aggregate(total=Sum('commission_amount'))['total'] or 0

                history.append({
                    'order_id': order.id,
                    'order_number': order.order_number,
                    'sme_name': (
                        order.items.first().sme.business_name
                        if order.items.first() and order.items.first().sme
                        else 'Unknown'
                    ),
                    'amount': commission,
                    'date': order.delivered_at,
                    'status': 'paid'
                })

            return Response(history, status=status.HTTP_200_OK)

        except AgentProfile.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error fetching commission history: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )