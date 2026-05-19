from django.urls import path
from .views import (
    AgentProductListView, AgentProductCreateView, AgentProductDetailView,
    CartSMEValidationView, ProductDeliveryDetailView, PublicStatsView,
    SMEProductCreateView, SMEProductDetailView, SMEProductListView,
    ProductStatusUpdateView, ProductReviewCreateView,
    PublicProductListView, PublicProductDetailView
)

urlpatterns = [
    # ── Agent endpoints ──────────────────────────────────────────────────────
    path('agent/products/', AgentProductListView.as_view(),   name='agent-product-list'),
    path('agent/products/create/', AgentProductCreateView.as_view(), name='agent-product-create'),   
    path('agent/products/<int:pk>/', AgentProductDetailView.as_view(), name='agent-product-detail'),

    # ── SME endpoints ────────────────────────────────────────────────────────
    path('sme/products/', SMEProductListView.as_view(),     name='sme-product-list'),
    path('sme/products/create/',  SMEProductCreateView.as_view(),   name='sme-product-create'),    
    path('sme/products/<int:pk>/', SMEProductDetailView.as_view(),   name='sme-product-detail'),
    path('sme/products/<int:pk>/status/',   ProductStatusUpdateView.as_view(),  name='product-status-update'),
    path('sme/products/<int:pk>/delivery/', ProductDeliveryDetailView.as_view(), name='sme-product-delivery'),

    # ── Cart ─────────────────────────────────────────────────────────────────
    path('cart/validate-sme/',CartSMEValidationView.as_view(),  name='cart-validate-sme'),

    # ── Public endpoints (customers) ─────────────────────────────────────────
    path('products/', PublicProductListView.as_view(),  name='public-product-list'),
    path('products/<slug:slug>/',PublicProductDetailView.as_view(), name='public-product-detail'),
    path('products/<int:product_id>/reviews/', ProductReviewCreateView.as_view(), name='product-review-create'),
    path('products/<int:pk>/delivery/', ProductDeliveryDetailView.as_view(), name='public-product-delivery'),

    # ── Stats ────────────────────────────────────────────────────────────────
    path('stats/', PublicStatsView.as_view(), name='public-stats'),
]