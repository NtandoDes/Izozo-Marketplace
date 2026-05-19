from django.urls import path
from .views import (
    PaymentListView, PaymentDetailView, PaymentCreateView,
    PaymentConfirmView, PaymentMethodListView, PaymentMethodDetailView,
    PaymentMethodDefaultView, TransactionListView, PaymentStatsView,
    PaystackWebhookView, PaymentRefundView, BankListView, SellerOnboardingView,
)

urlpatterns = [
    # Payments
    path('payments/', PaymentListView.as_view(), name='payment-list'),
    path('payments/stats/', PaymentStatsView.as_view(), name='payment-stats'),
    path('payments/create/', PaymentCreateView.as_view(), name='payment-create'),
    path('payments/webhook/', PaystackWebhookView.as_view(), name='paystack-webhook'),
    path('payments/<str:payment_id>/', PaymentDetailView.as_view(), name='payment-detail'),
    path('payments/<str:payment_id>/confirm/', PaymentConfirmView.as_view(), name='payment-confirm'),
    path('payments/<str:payment_id>/refund/', PaymentRefundView.as_view(), name='payment-refund'),
    path('payments/<str:payment_id>/transactions/', TransactionListView.as_view(), name='payment-transactions'),

    # Payment methods
    path('payment-methods/', PaymentMethodListView.as_view(), name='payment-method-list'),
    path('payment-methods/<int:pk>/', PaymentMethodDetailView.as_view(), name='payment-method-detail'),
    path('payment-methods/<int:pk>/set-default/', PaymentMethodDefaultView.as_view(), name='payment-method-default'),

    # Seller
    path('sellers/onboard/', SellerOnboardingView.as_view(), name='seller-onboard'),
    path('sellers/banks/', BankListView.as_view(), name='bank-list'),
]