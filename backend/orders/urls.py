from django.urls import path
from .views import (
    # Customer endpoints
    CustomerOrderListView, CustomerOrderDetailView, CustomerOrderStatsView,
    
    # Agent endpoints
    AgentOrderListView, AgentOrderDetailView, AgentOrderStatsView,
    AgentOrderStatusUpdateView,
    
    # SME endpoints
    SMEOrderListView, SMEOrderDetailView, SMEOrderStatsView, SMEOrderReadyForPickupView,
    
    # Admin endpoints
    AdminOrderListView, AdminOrderDetailView,
    
    # Debug endpoints
    DebugSMEOrdersView,
)

urlpatterns = [
    # ============= CUSTOMER ENDPOINTS =============
    # Static paths BEFORE dynamic <str:order_number> paths
    path('orders/stats/', CustomerOrderStatsView.as_view(), name='customer-order-stats'),
    path('orders/', CustomerOrderListView.as_view(), name='customer-order-list'),
    path('orders/<str:order_number>/', CustomerOrderDetailView.as_view(), name='customer-order-detail'),

    # ============= AGENT ENDPOINTS =============
    path('agent/orders/stats/', AgentOrderStatsView.as_view(), name='agent-order-stats'),
    path('agent/orders/', AgentOrderListView.as_view(), name='agent-order-list'),
    path('agent/orders/<str:order_number>/', AgentOrderDetailView.as_view(), name='agent-order-detail'),
    path('agent/orders/<str:order_number>/status/', AgentOrderStatusUpdateView.as_view(), name='agent-order-status-update'),

    # ============= SME ENDPOINTS =============
    path('sme/orders/stats/', SMEOrderStatsView.as_view(), name='sme-order-stats'),
    path('sme/debug-orders/', DebugSMEOrdersView.as_view(), name='debug-sme-orders'),
    path('sme/orders/', SMEOrderListView.as_view(), name='sme-order-list'),
    path('sme/orders/<str:order_number>/', SMEOrderDetailView.as_view(), name='sme-order-detail'),
    path('sme/orders/<str:order_number>/ready-for-pickup/', SMEOrderReadyForPickupView.as_view(), name='sme-order-ready-pickup'),

    # ============= ADMIN ENDPOINTS =============
    path('admin/orders/', AdminOrderListView.as_view(), name='admin-order-list'),
    path('admin/orders/<str:order_number>/', AdminOrderDetailView.as_view(), name='admin-order-detail'),
]