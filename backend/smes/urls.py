# smes/urls.py
from django.urls import path
from .views import (
    SMERegisterView, SMEProfileView, SMEListView,
    SMEAssignedAgentsView, SMEProductStatsView, SMEOrderStatsView,
    SMEMarkOrderReadyForPickupView
)

urlpatterns = [
    path('auth/register/sme/', SMERegisterView.as_view(), name='sme-register'),
    path('sme/profile/', SMEProfileView.as_view(), name='sme-profile'),
    path('sme/assigned-agents/', SMEAssignedAgentsView.as_view(), name='sme-assigned-agents'),
    path('smes/', SMEListView.as_view(), name='sme-list'),
    path('sme/products/stats/', SMEProductStatsView.as_view(), name='sme-product-stats'),
    path('sme/orders/stats/', SMEOrderStatsView.as_view(), name='sme-order-stats'),
    path('sme/orders/<str:order_number>/ready-for-pickup/', SMEMarkOrderReadyForPickupView.as_view(), name='sme-order-ready-pickup'),
]