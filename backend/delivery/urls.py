from django.urls import path
from .views import DeliveryRegisterView, DeliveryProfileView, DeliveryListView

urlpatterns = [
    path('auth/register/delivery/', DeliveryRegisterView.as_view(), name='delivery-register'),
    path('delivery/profile/', DeliveryProfileView.as_view(), name='delivery-profile'),
    path('delivery/', DeliveryListView.as_view(), name='delivery-list'),
]