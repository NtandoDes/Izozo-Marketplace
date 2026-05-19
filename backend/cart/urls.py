from django.urls import path
from .views import (
    CartView, CartItemListView, CartItemDetailView,
    CartClearView, CartMergeView
)

urlpatterns = [
    path('cart/', CartView.as_view(), name='cart'),
    path('cart/items/', CartItemListView.as_view(), name='cart-items'),
    path('cart/items/<int:pk>/', CartItemDetailView.as_view(), name='cart-item-detail'),
    path('cart/clear/', CartClearView.as_view(), name='cart-clear'),
    path('cart/merge/', CartMergeView.as_view(), name='cart-merge'),
]