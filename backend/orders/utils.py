from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings


def send_order_receipt_email(order):
    customer_email = order.user.email

    subject = f"Izozo Order Confirmation - {order.order_number}"

    html_message = render_to_string(
        'emails/order_receipt.html',
        {
            'order': order,
            'items': order.items.all(),
        }
    )

    plain_message = strip_tags(html_message)

    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [customer_email],
        html_message=html_message,
        fail_silently=False,
    )