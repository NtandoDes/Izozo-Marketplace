# agents/urls.py
from django.urls import path
from .views import (
    AgentRegisterView, AgentProfileView, AgentListView,
    AgentSMEAssignmentListCreateView, AgentSMEAssignmentDetailView,
    AgentProductDetailView,
    AgentOrderListView, AgentOrderDetailView, AgentOrderStatusUpdateView,
    AgentPickupOrdersView, AgentCollectedOrdersView, AgentShippedOrdersView,
    AgentMarkOrderCollectedView, AgentMarkOrderShippedView, AgentMarkOrderDeliveredView,
    AgentCommissionSummaryView, AgentCommissionHistoryView,
    DebugAgentPermissionsView, DebugPickupOrdersView, TestPickupOrdersView
)

urlpatterns = [
    # Registration and Profile
    path('auth/register/agent/', AgentRegisterView.as_view(), name='agent-register'),
    path('agent/profile/', AgentProfileView.as_view(), name='agent-profile'),
    path('agents/', AgentListView.as_view(), name='agent-list'),
    path('agent/test-pickup/', TestPickupOrdersView.as_view(), name='agent-test-pickup'),
    
    # Agent-SME Assignment endpoints
    path('agent-assignments/', AgentSMEAssignmentListCreateView.as_view(), name='agent-assignment-list'),
    path('agent-assignments/<int:pk>/', AgentSMEAssignmentDetailView.as_view(), name='agent-assignment-detail'),
    
    # Product Management
    path('agent/products/<int:pk>/', AgentProductDetailView.as_view(), name='agent-product-detail'),
    
    # Order Management - IMPORTANT: More specific paths first
    path('agent/orders/ready-for-pickup/', AgentPickupOrdersView.as_view(), name='agent-ready-pickup'),
    path('agent/orders/collected/', AgentCollectedOrdersView.as_view(), name='agent-collected-orders'),
    path('agent/orders/shipped/', AgentShippedOrdersView.as_view(), name='agent-shipped-orders'),
    path('agent/orders/<str:order_number>/status/', AgentOrderStatusUpdateView.as_view(), name='agent-order-status'),
    path('agent/orders/<str:order_number>/', AgentOrderDetailView.as_view(), name='agent-order-detail'),
    path('agent/orders/', AgentOrderListView.as_view(), name='agent-order-list'),
    
    # Order Actions
    path('agent/orders/<int:order_id>/collect/', AgentMarkOrderCollectedView.as_view(), name='agent-order-collect'),
    path('agent/orders/<int:order_id>/ship/', AgentMarkOrderShippedView.as_view(), name='agent-order-ship'),
    path('agent/orders/<int:order_id>/deliver/', AgentMarkOrderDeliveredView.as_view(), name='agent-order-deliver'),
    
    # Debug
    path('agent/debug/permissions/<int:product_id>/', DebugAgentPermissionsView.as_view(), name='agent-debug-permissions'),
    path('agent/debug/pickup-orders/', DebugPickupOrdersView.as_view(), name='debug-pickup-orders'),
    
    # Commission
    path('agent/commission/summary/', AgentCommissionSummaryView.as_view(), name='agent-commission-summary'),
    path('agent/commission/history/', AgentCommissionHistoryView.as_view(), name='agent-commission-history'),
]