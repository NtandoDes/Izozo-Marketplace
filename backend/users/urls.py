# users/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomerRegisterView, LoginView, LogoutView, CurrentUserView,
    SMELandingPageRegistrationView, AgentLandingPageRegistrationView, 
    DeliveryLandingPageRegistrationView, AdminRegisterView,
    CustomerProfileView,
    ForgotPasswordView, ResetPasswordView, ValidateResetTokenView
)

urlpatterns = [
    # Landing page registration
    path('register/sme/', SMELandingPageRegistrationView.as_view(), name='sme-landing-register'),
    path('register/agent/', AgentLandingPageRegistrationView.as_view(), name='agent-landing-register'),
    path('register/delivery/', DeliveryLandingPageRegistrationView.as_view(), name='delivery-landing-register'),
    
    # Auth endpoints
    path('auth/register/customer/', CustomerRegisterView.as_view(), name='customer-register'),
    path('auth/register/admin/', AdminRegisterView.as_view(), name='admin-register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    
    # Customer profile endpoint
    path('customer/profile/', CustomerProfileView.as_view(), name='customer-profile'),
    
    # Password reset endpoints
    path('users/forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('users/reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('users/validate-reset-token/', ValidateResetTokenView.as_view(), name='validate-reset-token'),
]