# notifications/services.py
from django.contrib.contenttypes.models import ContentType
from .models import Notification, NotificationPreference
from orders.models import Order, OrderItem
from products.models import Product
from agents.models import AgentProfile, AgentSMEAssignment
from smes.models import SMEProfile
from users.models import User
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Service class for creating notifications
    """

    @classmethod
    def create_notification(cls, recipient, notification_type, title, message, 
                           related_object=None, data=None):
        """
        Create a notification for a user
        """
        try:
            # Check if user wants this type of notification
            try:
                prefs = recipient.notification_preferences
                
                # Skip if in-app notifications are disabled for this type
                if 'order' in notification_type and not prefs.in_app_order_updates:
                    return None
                if 'product' in notification_type and not prefs.in_app_product_updates:
                    return None
            except NotificationPreference.DoesNotExist:
                pass  # User has no preferences set, proceed with notification

            notification = Notification.objects.create(
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                data=data or {}
            )

            if related_object:
                content_type = ContentType.objects.get_for_model(related_object)
                notification.content_type = content_type
                notification.object_id = related_object.id
                notification.save()

            logger.info(f"Created notification for {recipient.email}: {title}")
            return notification
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return None

    # ============= ORDER NOTIFICATIONS =============

    @classmethod
    def notify_order_placed(cls, order):
        """Notify SME and agent about new order"""
        try:
            logger.info(f"Notifying SMEs and agents for order {order.order_number}")
            
            # Get order items with prefetched relations
            order_items = OrderItem.objects.filter(order=order).select_related('product__sme', 'sme')
            
            # Track which SMEs we've already notified
            notified_smes = set()
            notified_agents = set()
            
            for item in order_items:
                # Get SME from either item.sme or item.product.sme
                sme = item.sme or (item.product.sme if item.product else None)
                
                if sme and sme.user and sme.user.id not in notified_smes:
                    # Notify SME
                    cls.create_notification(
                        recipient=sme.user,
                        notification_type='order_placed',
                        title=f'New Order #{order.order_number}',
                        message=f'You have received a new order. Order #{order.order_number}',
                        related_object=order,
                        data={
                            'order_number': order.order_number,
                            'total': str(order.total_amount),
                            'item_count': order_items.filter(sme=sme).count()
                        }
                    )
                    notified_smes.add(sme.user.id)
                    logger.info(f"Notified SME {sme.business_name}")
                
                # Find agents assigned to this SME
                if sme:
                    assignments = AgentSMEAssignment.objects.filter(
                        sme=sme,
                        active=True
                    ).select_related('agent__user')
                    
                    for assignment in assignments:
                        if assignment.agent and assignment.agent.user and assignment.agent.user.id not in notified_agents:
                            # Notify agent
                            cls.create_notification(
                                recipient=assignment.agent.user,
                                notification_type='order_placed',
                                title=f'New Order #{order.order_number}',
                                message=f'A new order has been placed for {sme.business_name}',
                                related_object=order,
                                data={
                                    'order_number': order.order_number,
                                    'sme_name': sme.business_name,
                                    'sme_id': sme.id
                                }
                            )
                            notified_agents.add(assignment.agent.user.id)
                            logger.info(f"Notified agent {assignment.agent.user.full_name}")
            
            logger.info(f"Order notifications complete: {len(notified_smes)} SMEs, {len(notified_agents)} agents notified")
            
        except Exception as e:
            logger.error(f"Error notifying order placed: {e}", exc_info=True)

    @classmethod
    def notify_order_paid(cls, order):
        """Notify SME and agent about payment"""
        try:
            logger.info(f"Notifying payment for order {order.order_number}")
            
            order_items = OrderItem.objects.filter(order=order).select_related('product__sme', 'sme')
            notified_smes = set()
            
            for item in order_items:
                sme = item.sme or (item.product.sme if item.product else None)
                
                if sme and sme.user and sme.user.id not in notified_smes:
                    cls.create_notification(
                        recipient=sme.user,
                        notification_type='order_paid',
                        title=f'Payment Received for Order #{order.order_number}',
                        message=f'Payment has been received. Order #{order.order_number} is ready for packaging.',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )
                    notified_smes.add(sme.user.id)
                    logger.info(f"Notified SME {sme.business_name} about payment")
        except Exception as e:
            logger.error(f"Error notifying order paid: {e}", exc_info=True)

    @classmethod
    def notify_order_ready_for_pickup(cls, order):
        """Notify agent that order is ready for pickup (SME has packaged it)"""
        try:
            logger.info(f"Notifying agents for order {order.order_number} ready for pickup")
            
            order_items = OrderItem.objects.filter(order=order).select_related('product__sme', 'sme')
            notified_agents = set()
            
            for item in order_items:
                sme = item.sme or (item.product.sme if item.product else None)
                
                if sme:
                    assignments = AgentSMEAssignment.objects.filter(
                        sme=sme,
                        active=True
                    ).select_related('agent__user')
                    
                    for assignment in assignments:
                        if assignment.agent and assignment.agent.user and assignment.agent.user.id not in notified_agents:
                            cls.create_notification(
                                recipient=assignment.agent.user,
                                notification_type='order_ready_pickup',
                                title=f'Order #{order.order_number} Ready for Pickup',
                                message=f'Order #{order.order_number} is ready for pickup from {sme.business_name}',
                                related_object=order,
                                data={
                                    'order_number': order.order_number,
                                    'sme_name': sme.business_name,
                                    'sme_address': sme.business_address
                                }
                            )
                            notified_agents.add(assignment.agent.user.id)
                            logger.info(f"Notified agent {assignment.agent.user.full_name}")
        except Exception as e:
            logger.error(f"Error notifying order ready for pickup: {e}", exc_info=True)

    @classmethod
    def notify_order_shipped(cls, order):
        """Notify customer that order has been shipped"""
        try:
            # Notify customer
            if order.customer:
                cls.create_notification(
                    recipient=order.customer,
                    notification_type='order_shipped',
                    title=f'Order #{order.order_number} Has Been Shipped',
                    message='Your order is on its way!',
                    related_object=order,
                    data={
                        'order_number': order.order_number,
                        'tracking_number': order.tracking_number
                    }
                )
                logger.info(f"Notified customer {order.customer.email}")
            
            # Also notify SME that order has been picked up
            order_items = OrderItem.objects.filter(order=order).select_related('product__sme', 'sme')
            notified_smes = set()
            
            for item in order_items:
                sme = item.sme or (item.product.sme if item.product else None)
                
                if sme and sme.user and sme.user.id not in notified_smes:
                    cls.create_notification(
                        recipient=sme.user,
                        notification_type='order_shipped',
                        title=f'Order #{order.order_number} Picked Up',
                        message='The order has been picked up by the agent and is on its way to the customer.',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )
                    notified_smes.add(sme.user.id)
                    logger.info(f"Notified SME {sme.business_name}")
        except Exception as e:
            logger.error(f"Error notifying order shipped: {e}", exc_info=True)

    @classmethod
    def notify_order_delivered(cls, order):
        """Notify all parties about delivery"""
        try:
            logger.info(f"Notifying delivery for order {order.order_number}")
            
            # Notify customer
            if order.customer:
                cls.create_notification(
                    recipient=order.customer,
                    notification_type='order_delivered',
                    title=f'Order #{order.order_number} Delivered',
                    message='Your order has been delivered. Thank you for shopping with Izozo!',
                    related_object=order,
                    data={'order_number': order.order_number}
                )
                logger.info(f"Notified customer {order.customer.email}")
            
            # Notify SMEs and calculate revenue
            order_items = OrderItem.objects.filter(order=order).select_related('product__sme', 'sme')
            notified_smes = set()
            
            for item in order_items:
                sme = item.sme or (item.product.sme if item.product else None)
                
                if sme and sme.user and sme.user.id not in notified_smes:
                    # Get all items for this SME in this order
                    sme_items = order_items.filter(sme=sme)
                    sme_revenue = sum(float(item.total) for item in sme_items)
                    
                    cls.create_notification(
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
                    notified_smes.add(sme.user.id)
                    logger.info(f"Notified SME {sme.business_name} with revenue R{sme_revenue}")
            
            # Notify agents about commission
            notified_agents = set()
            for item in order_items:
                sme = item.sme or (item.product.sme if item.product else None)
                
                if sme:
                    assignments = AgentSMEAssignment.objects.filter(
                        sme=sme,
                        active=True
                    ).select_related('agent__user')
                    
                    for assignment in assignments:
                        if assignment.agent and assignment.agent.user and assignment.agent.user.id not in notified_agents:
                            # Calculate commission for this agent across all items in this SME
                            agent_items = order_items.filter(sme=sme)
                            agent_commission = sum(float(item.commission_amount or 0) for item in agent_items)
                            
                            cls.create_notification(
                                recipient=assignment.agent.user,
                                notification_type='agent_commission',
                                title=f'Commission Earned - Order #{order.order_number}',
                                message=f'You earned R{agent_commission:.2f} commission from {sme.business_name}',
                                related_object=order,
                                data={
                                    'order_number': order.order_number,
                                    'commission': str(agent_commission),
                                    'sme_name': sme.business_name
                                }
                            )
                            notified_agents.add(assignment.agent.user.id)
                            logger.info(f"Notified agent {assignment.agent.user.full_name} with commission R{agent_commission}")
        except Exception as e:
            logger.error(f"Error notifying order delivered: {e}", exc_info=True)

    # ============= PRODUCT NOTIFICATIONS =============

    @classmethod
    def notify_product_created(cls, product):
        """Notify SME that product was created (and agent if applicable)"""
        try:
            # Notify SME
            if product.sme and product.sme.user:
                status_text = "pending approval" if product.status == 'pending' else "active"
                cls.create_notification(
                    recipient=product.sme.user,
                    notification_type='product_created',
                    title=f'Product Created: {product.name}',
                    message=f'Your product "{product.name}" has been created and is {status_text}.',
                    related_object=product,
                    data={'product_slug': product.slug}
                )
            
            # Notify agent who created it
            if product.agent and product.agent.user:
                cls.create_notification(
                    recipient=product.agent.user,
                    notification_type='product_created',
                    title=f'Product Created: {product.name}',
                    message=f'Your product "{product.name}" has been successfully created.',
                    related_object=product,
                    data={'product_slug': product.slug}
                )
        except Exception as e:
            logger.error(f"Error notifying product created: {e}")

    @classmethod
    def notify_product_approved(cls, product):
        """Notify agent that product was approved"""
        if product.agent and product.agent.user:
            cls.create_notification(
                recipient=product.agent.user,
                notification_type='product_approved',
                title=f'Product Approved: {product.name}',
                message=f'Your product "{product.name}" has been approved and is now live!',
                related_object=product,
                data={'product_slug': product.slug}
            )

    @classmethod
    def notify_product_rejected(cls, product, reason=None):
        """Notify agent that product was rejected"""
        if product.agent and product.agent.user:
            message = f'Your product "{product.name}" was rejected.'
            if reason:
                message += f' Reason: {reason}'
            
            cls.create_notification(
                recipient=product.agent.user,
                notification_type='product_rejected',
                title=f'Product Rejected: {product.name}',
                message=message,
                related_object=product,
                data={'product_slug': product.slug, 'reason': reason}
            )

    # ============= AGENT NOTIFICATIONS =============

    @classmethod
    def notify_agent_assigned(cls, assignment):
        """Notify agent that they've been assigned to an SME"""
        if assignment.agent.user:
            cls.create_notification(
                recipient=assignment.agent.user,
                notification_type='agent_assigned',
                title=f'Assigned to {assignment.sme.business_name}',
                message=f'You have been assigned to assist {assignment.sme.business_name}.',
                related_object=assignment.sme,
                data={'sme_id': assignment.sme.id, 'sme_name': assignment.sme.business_name}
            )

    # ============= ACCOUNT NOTIFICATIONS =============

    @classmethod
    def notify_account_approved(cls, user):
        """Notify user that their account has been approved"""
        cls.create_notification(
            recipient=user,
            notification_type='account_approved',
            title='Account Approved',
            message=f'Your {user.get_role_display()} account has been approved! You can now access all features.',
            data={'role': user.role}
        )

    @classmethod
    def notify_account_suspended(cls, user, reason=None):
        """Notify user that their account has been suspended"""
        message = 'Your account has been suspended.'
        if reason:
            message += f' Reason: {reason}'
        
        cls.create_notification(
            recipient=user,
            notification_type='account_suspended',
            title='Account Suspended',
            message=message,
            data={'role': user.role, 'reason': reason}
        )

@classmethod
def notify_order_ready_for_pickup(cls, order):
    """Notify agent that order is ready for pickup (SME has packaged it)"""
    try:
        logger.info(f"Notifying agents for order {order.order_number} ready for pickup")
        
        order_items = OrderItem.objects.filter(order=order).select_related('product__sme', 'sme')
        notified_agents = set()
        
        for item in order_items:
            sme = item.sme or (item.product.sme if item.product else None)
            
            if sme:
                from agents.models import AgentSMEAssignment
                assignments = AgentSMEAssignment.objects.filter(
                    sme=sme,
                    active=True
                ).select_related('agent__user')
                
                for assignment in assignments:
                    if assignment.agent and assignment.agent.user and assignment.agent.user.id not in notified_agents:
                        cls.create_notification(
                            recipient=assignment.agent.user,
                            notification_type='order_ready_pickup',
                            title=f'Order #{order.order_number} Ready for Pickup',
                            message=f'Order #{order.order_number} is ready for pickup from {sme.business_name}',
                            related_object=order,
                            data={
                                'order_number': order.order_number,
                                'sme_name': sme.business_name,
                                'sme_address': sme.business_address
                            }
                        )
                        notified_agents.add(assignment.agent.user.id)
                        logger.info(f"Notified agent {assignment.agent.user.full_name}")
    except Exception as e:
        logger.error(f"Error notifying order ready for pickup: {e}", exc_info=True)



# notifications/services.py - Add these methods if not present

@classmethod
def notify_order_shipped(cls, order):
    """Notify customer and SME that order has been shipped"""
    try:
        # Notify customer
        if order.customer:
            cls.create_notification(
                recipient=order.customer,
                notification_type='order_shipped',
                title=f'Order #{order.order_number} Shipped',
                message=f'Your order has been shipped. Tracking: {order.tracking_number or "N/A"}',
                related_object=order,
                data={
                    'order_number': order.order_number,
                    'tracking_number': order.tracking_number
                }
            )
        
        # Notify SMEs
        order_sme_ids = order.items.values_list('sme_id', flat=True).distinct()
        for sme_id in order_sme_ids:
            from smes.models import SMEProfile
            try:
                sme = SMEProfile.objects.get(id=sme_id)
                if sme.user:
                    cls.create_notification(
                        recipient=sme.user,
                        notification_type='order_shipped',
                        title=f'Order #{order.order_number} Shipped',
                        message='Order has been picked up and shipped to customer.',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )
            except SMEProfile.DoesNotExist:
                pass
    except Exception as e:
        logger.error(f"Error notifying order shipped: {e}")

@classmethod
def notify_order_delivered(cls, order):
    """Notify all parties about delivery"""
    try:
        # Notify customer
        if order.customer:
            cls.create_notification(
                recipient=order.customer,
                notification_type='order_delivered',
                title=f'Order #{order.order_number} Delivered',
                message='Your order has been delivered. Thank you for shopping with Izozo!',
                related_object=order,
                data={'order_number': order.order_number}
            )
        
        # Notify SMEs and calculate revenue
        order_sme_ids = order.items.values_list('sme_id', flat=True).distinct()
        for sme_id in order_sme_ids:
            from smes.models import SMEProfile
            try:
                sme = SMEProfile.objects.get(id=sme_id)
                if sme.user:
                    sme_items = order.items.filter(sme_id=sme_id)
                    sme_revenue = sum(float(item.total) for item in sme_items)
                    
                    cls.create_notification(
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
        
        # Notify agent about commission
        if order.delivered_by and order.delivered_by.user:
            total_commission = order.items.aggregate(total=Sum('commission_amount'))['total'] or 0
            cls.create_notification(
                recipient=order.delivered_by.user,
                notification_type='agent_commission',
                title=f'Commission Earned - Order #{order.order_number}',
                message=f'You earned R{total_commission:.2f} commission from this order',
                related_object=order,
                data={
                    'order_number': order.order_number,
                    'commission': str(total_commission)
                }
            )
    except Exception as e:
        logger.error(f"Error notifying order delivered: {e}")

@classmethod
def notify_order_cancelled(cls, order, reason=None):
    """Notify about cancelled order"""
    try:
        # Notify customer
        if order.customer:
            cls.create_notification(
                recipient=order.customer,
                notification_type='order_cancelled',
                title=f'Order #{order.order_number} Cancelled',
                message=f'Your order has been cancelled. Reason: {reason or "No reason provided"}',
                related_object=order,
                data={'order_number': order.order_number}
            )
        
        # Notify SMEs
        order_sme_ids = order.items.values_list('sme_id', flat=True).distinct()
        for sme_id in order_sme_ids:
            from smes.models import SMEProfile
            try:
                sme = SMEProfile.objects.get(id=sme_id)
                if sme.user:
                    cls.create_notification(
                        recipient=sme.user,
                        notification_type='order_cancelled',
                        title=f'Order #{order.order_number} Cancelled',
                        message='An order for your business has been cancelled.',
                        related_object=order,
                        data={'order_number': order.order_number}
                    )
            except SMEProfile.DoesNotExist:
                pass
    except Exception as e:
        logger.error(f"Error notifying order cancelled: {e}")