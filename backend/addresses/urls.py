from django.urls import path
from .views import (
    AddressListView, AddressDetailView,
    AddressDefaultView, AddressBookView
)

urlpatterns = [
    # Address endpoints
    path('addresses/', AddressListView.as_view(), name='address-list'),
    path('addresses/<int:pk>/', AddressDetailView.as_view(), name='address-detail'),
    path('addresses/<int:pk>/set-default/', AddressDefaultView.as_view(), name='address-set-default'),
    
    # Address book endpoint
    path('address-book/', AddressBookView.as_view(), name='address-book'),
]