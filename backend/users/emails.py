import logging
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings

logger = logging.getLogger(__name__)


def send_partner_approval_email(user):
    """
    Send an approval notification email to a newly approved partner.
    Called from the post_save signal when user.status changes to 'active'.
    """
    role_labels = {
        'sme': 'Business Owner',
        'agent': 'Sales Agent',
        'delivery': 'Delivery Partner',
    }

    dashboard_urls = {
        'sme': f"{settings.FRONTEND_URL}/sme-dashboard",
        'agent': f"{settings.FRONTEND_URL}/agent-dashboard",
        'delivery': f"{settings.FRONTEND_URL}/delivery-dashboard",
    }

    context = {
        'full_name': user.full_name,
        'role_label': role_labels.get(user.role, user.role.title()),
        'dashboard_url': dashboard_urls.get(user.role, settings.FRONTEND_URL),
        'login_url': f"{settings.FRONTEND_URL}/login",
        'frontend_url': settings.FRONTEND_URL,
        'support_email': settings.DEFAULT_FROM_EMAIL,
    }

    subject = f"🎉 You're approved! Welcome to Izozo, {user.full_name.split()[0]}"

    # Render HTML template
    html_content = render_to_string('emails/partner_approved.html', context)

    # Plain text fallback
    text_content = (
        f"Hi {user.full_name},\n\n"
        f"Great news! Your Izozo {context['role_label']} account has been approved.\n\n"
        f"You can now log in and access your dashboard:\n"
        f"{context['login_url']}\n\n"
        f"If you have any questions, reply to this email or contact us at {settings.DEFAULT_FROM_EMAIL}.\n\n"
        f"Welcome aboard!\n"
        f"The Izozo Team"
    )

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Approval email sent to {user.email} ({user.role})")
        return True
    except Exception as e:
        logger.error(f"Failed to send approval email to {user.email}: {e}")
        return False