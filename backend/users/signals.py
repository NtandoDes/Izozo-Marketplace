# users/signals.py
import logging
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import User

logger = logging.getLogger(__name__)

# Roles that require approval (customers and admins are auto-active)
PARTNER_ROLES = ('sme', 'agent', 'delivery')


@receiver(pre_save, sender=User)
def capture_previous_status(sender, instance, **kwargs):
    """
    Before saving, capture the previous status so post_save can
    compare old vs new and detect the pending → active transition.
    """
    if instance.pk:
        try:
            instance._previous_status = User.objects.get(pk=instance.pk).status
        except User.DoesNotExist:
            instance._previous_status = None
    else:
        # New user — no previous status
        instance._previous_status = None


@receiver(post_save, sender=User)
def on_user_status_change(sender, instance, created, **kwargs):
    """
    After saving, check if status changed from anything → 'active'.
    If so, and the user is a partner role, send the approval email.
    """
    if created:
        return  # Skip on initial registration — no approval yet

    previous_status = getattr(instance, '_previous_status', None)
    current_status = instance.status

    # Only fire when transitioning TO active (not on every save)
    if previous_status != 'active' and current_status == 'active':
        if instance.role in PARTNER_ROLES:
            logger.info(
                f"Partner approved: {instance.email} ({instance.role}) "
                f"— status changed from '{previous_status}' to 'active'"
            )
            from .emails import send_partner_approval_email
            send_partner_approval_email(instance)