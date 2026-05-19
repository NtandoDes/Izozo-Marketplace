# notifications/urls.py
from django.urls import path
from .views import (
    NotificationListView, NotificationDetailView,
    MarkNotificationsReadView, UnreadCountView,
    NotificationPreferencesView
)

urlpatterns = [
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/unread-count/', UnreadCountView.as_view(), name='notification-unread'),
    path('notifications/mark-read/', MarkNotificationsReadView.as_view(), name='notification-mark-read'),
    path('notifications/<int:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/preferences/', NotificationPreferencesView.as_view(), name='notification-preferences'),
]