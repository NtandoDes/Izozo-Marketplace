from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'assignments', views.AdminAssignmentViewSet, basename='admin-assignments')
router.register(r'notifications', views.AdminNotificationViewSet, basename='admin-notifications')

urlpatterns = [
    # User management
    path('users/', views.AdminUserListView.as_view(), name='admin-users'),
    path('users/<int:pk>/', views.AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('users/bulk-action/', views.AdminUserBulkActionView.as_view(), name='admin-user-bulk'),
    
    # Profile management
    path('profiles/<str:role>/', views.AdminProfileListView.as_view(), name='admin-profiles'),
    
    # Dashboard
    path('dashboard/stats/', views.AdminDashboardStatsView.as_view(), name='admin-dashboard-stats'),
    
    # Logs
    path('logs/registrations/', views.AdminRegistrationLogView.as_view(), name='admin-registration-logs'),
    path('logs/actions/', views.AdminActionLogView.as_view(), name='admin-action-logs'),
    
    # System settings
    path('settings/', views.SystemSettingsView.as_view(), name='admin-settings'),
    path('settings/<str:key>/', views.SystemSettingsView.as_view(), name='admin-setting-detail'),
]

urlpatterns += router.urls