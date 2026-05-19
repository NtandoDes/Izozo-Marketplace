# notifications/signals.py
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from orders.models import Order, OrderItem
from products.models import Product
from agents.models import AgentSMEAssignment
from users.models import User
from .services import NotificationService
import logging

logger = logging.getLogger(__name__)


# Store original status before save
@receiver(pre_save, sender=Order)
def order_pre_save(sender, instance, **kwargs):
    """Store original status before save"""
    if instance.pk:
        try:
            instance._original_status = Order.objects.get(pk=instance.pk).status
        except Order.DoesNotExist:
            instance._original_status = None


@receiver(post_save, sender=Order)
def order_post_save(sender, instance, created, **kwargs):
    """Handle order notifications"""
    try:
        if created:
            logger.info(f"New order created: {instance.order_number}")
            # New order placed
            NotificationService.notify_order_placed(instance)
        else:
            # Check if status changed
            if hasattr(instance, '_original_status'):
                old_status = instance._original_status
                new_status = instance.status
                
                logger.info(f"Order {instance.order_number} status changed from {old_status} to {new_status}")
                
                # Order paid
                if new_status == 'paid' and old_status != 'paid':
                    NotificationService.notify_order_paid(instance)
                
                # Order shipped
                elif new_status == 'shipped' and old_status != 'shipped':
                    NotificationService.notify_order_shipped(instance)
                
                # Order delivered
                elif new_status == 'delivered' and old_status != 'delivered':
                    NotificationService.notify_order_delivered(instance)
    except Exception as e:
        logger.error(f"Error in order signal: {e}", exc_info=True)


@receiver(post_save, sender=OrderItem)
def order_item_post_save(sender, instance, created, **kwargs):
    """Ensure SME is set on order item"""
    try:
        if created and not instance.sme and instance.product and instance.product.sme:
            instance.sme = instance.product.sme
            instance.save(update_fields=['sme'])
            logger.info(f"Set SME {instance.sme.id} on order item {instance.id}")
    except Exception as e:
        logger.error(f"Error in order item signal: {e}", exc_info=True)


# Product signals
@receiver(pre_save, sender=Product)
def product_pre_save(sender, instance, **kwargs):
    """Store original status before save"""
    if instance.pk:
        try:
            instance._original_status = Product.objects.get(pk=instance.pk).status
        except Product.DoesNotExist:
            instance._original_status = None


@receiver(post_save, sender=Product)
def product_post_save(sender, instance, created, **kwargs):
    """Handle product notifications"""
    try:
        if created:
            NotificationService.notify_product_created(instance)
        else:
            # Check if status changed
            if hasattr(instance, '_original_status'):
                old_status = instance._original_status
                
                if instance.status == 'active' and old_status != 'active':
                    NotificationService.notify_product_approved(instance)
                elif instance.status == 'rejected' and old_status != 'rejected':
                    NotificationService.notify_product_rejected(instance)
    except Exception as e:
        logger.error(f"Error in product signal: {e}", exc_info=True)


# Agent assignment signals
@receiver(post_save, sender=AgentSMEAssignment)
def agent_assignment_post_save(sender, instance, created, **kwargs):
    """Handle agent assignment notifications"""
    try:
        if created:
            NotificationService.notify_agent_assigned(instance)
    except Exception as e:
        logger.error(f"Error in agent assignment signal: {e}", exc_info=True)


# User status signals
@receiver(pre_save, sender=User)
def user_pre_save(sender, instance, **kwargs):
    """Store original status before save"""
    if instance.pk:
        try:
            instance._original_status = User.objects.get(pk=instance.pk).status
        except User.DoesNotExist:
            instance._original_status = None


@receiver(post_save, sender=User)
def user_post_save(sender, instance, created, **kwargs):
    """Handle user status notifications"""
    try:
        if not created and hasattr(instance, '_original_status'):
            old_status = instance._original_status
            
            # Account approved
            if instance.status == 'active' and old_status != 'active':
                NotificationService.notify_account_approved(instance)
            
            # Account suspended
            elif instance.status == 'suspended' and old_status != 'suspended':
                NotificationService.notify_account_suspended(instance)
    except Exception as e:
        logger.error(f"Error in user signal: {e}", exc_info=True)