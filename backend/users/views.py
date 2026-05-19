# users/views.py
from django.contrib.auth import authenticate, logout
from django.utils import timezone
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from addresses import serializers
from .models import User, RegistrationLog, PasswordReset
from .serializers import (
    UserSerializer, CustomerRegisterSerializer, LoginSerializer,
    LandingPageRegistrationSerializer, SMELandingPageSerializer,
    AgentLandingPageSerializer, DeliveryLandingPageSerializer,
    AdminRegisterSerializer, CustomerProfileSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer, ValidateTokenSerializer
)
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# REGISTRATION VIEWS
# ============================================================================

class CustomerRegisterView(APIView):
    """Register a new customer - Auto-approved, no admin verification needed"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = CustomerRegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            
            # Log customer registration (optional)
            RegistrationLog.objects.create(
                user=user,
                email=user.email,
                role=user.role,
                source='customer_registration',
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT'),
                status='Customer registered and auto-approved'
            )
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'Customer registered successfully',
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SMELandingPageRegistrationView(APIView):
    """Register a new SME via landing page - Requires admin approval"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = SMELandingPageSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # Create user
                user = User.objects.create_user(
                    email=serializer.validated_data['email'],
                    password=serializer.validated_data['password'],
                    full_name=serializer.validated_data['name'],
                    phone=serializer.validated_data['phone'],
                    role='sme',
                    status='pending',  # Requires admin approval
                    source=serializer.validated_data.get('source', '')
                )
                
                # Create SME profile
                from smes.models import SMEProfile
                SMEProfile.objects.create(
                    user=user,
                    business_name=serializer.validated_data['businessName'],
                    owner_name=serializer.validated_data['name'],
                    business_type=', '.join(serializer.validated_data.get('products', [])) + 
                                (f" - {serializer.validated_data.get('otherProduct', '')}" 
                                 if serializer.validated_data.get('otherProduct') else ''),
                    business_address=serializer.validated_data['businessAddress'],
                )
                
                # Log registration
                RegistrationLog.objects.create(
                    user=user,
                    email=user.email,
                    role=user.role,
                    source=serializer.validated_data.get('source', ''),
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT'),
                    status='SME registered via landing page - pending approval'
                )
                
                return Response({
                    'success': True,
                    'message': 'SME registration successful! Your account is pending admin approval. We\'ll notify you when approved.',
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'full_name': user.full_name,
                        'role': user.role,
                        'status': user.status
                    }
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                logger.error(f"SME registration error: {e}")
                return Response({
                    'success': False,
                    'message': f'Registration failed: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': False,
            'message': 'Registration failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AgentLandingPageRegistrationView(APIView):
    """Register a new agent via landing page - Requires admin approval"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = AgentLandingPageSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # Create user
                user = User.objects.create_user(
                    email=serializer.validated_data['email'],
                    password=serializer.validated_data['password'],
                    full_name=serializer.validated_data['name'],
                    phone=serializer.validated_data['phone'],
                    role='agent',
                    status='pending',  # Requires admin approval
                    source=serializer.validated_data.get('source', '')
                )
                
                # Create agent profile
                from agents.models import AgentProfile
                AgentProfile.objects.create(
                    user=user,
                    home_address=serializer.validated_data['homeAddress'],
                    has_internet=serializer.validated_data['hasInternetData'],
                    has_smartphone=serializer.validated_data['hasSmartphone']
                )
                
                # Log registration
                RegistrationLog.objects.create(
                    user=user,
                    email=user.email,
                    role=user.role,
                    source=serializer.validated_data.get('source', ''),
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT'),
                    status='Agent registered via landing page - pending approval'
                )
                
                return Response({
                    'success': True,
                    'message': 'Agent registration successful! Your account is pending admin approval. We\'ll notify you when approved.',
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'full_name': user.full_name,
                        'role': user.role,
                        'status': user.status
                    }
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                logger.error(f"Agent registration error: {e}")
                return Response({
                    'success': False,
                    'message': f'Registration failed: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': False,
            'message': 'Registration failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class DeliveryLandingPageRegistrationView(APIView):
    """Register a new delivery partner via landing page - Requires admin approval"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = DeliveryLandingPageSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # Create user
                user = User.objects.create_user(
                    email=serializer.validated_data['email'],
                    password=serializer.validated_data['password'],
                    full_name=serializer.validated_data['name'],
                    phone=serializer.validated_data['phone'],
                    role='delivery',
                    status='pending',  # Requires admin approval
                    source=serializer.validated_data.get('source', '')
                )
                
                # Determine vehicle type
                vehicle_types = []
                if serializer.validated_data.get('hasMotorbike'):
                    vehicle_types.append('Motorbike')
                if serializer.validated_data.get('hasVehicle'):
                    vehicle_types.append('Vehicle')
                if serializer.validated_data.get('hasFleet'):
                    vehicle_types.append('Fleet')
                
                # Create delivery profile
                from delivery.models import DeliveryProfile
                DeliveryProfile.objects.create(
                    user=user,
                    home_address=serializer.validated_data['homeAddress'],
                    vehicle_type=', '.join(vehicle_types) if vehicle_types else 'Not specified',
                    has_internet=serializer.validated_data['hasInternetData'],
                    has_smartphone=serializer.validated_data['hasSmartphone']
                )
                
                # Log registration
                RegistrationLog.objects.create(
                    user=user,
                    email=user.email,
                    role=user.role,
                    source=serializer.validated_data.get('source', ''),
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT'),
                    status='Delivery registered via landing page - pending approval'
                )
                
                return Response({
                    'success': True,
                    'message': 'Delivery partner registration successful! Your account is pending admin approval. We\'ll notify you when approved.',
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'full_name': user.full_name,
                        'role': user.role,
                        'status': user.status
                    }
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                logger.error(f"Delivery registration error: {e}")
                return Response({
                    'success': False,
                    'message': f'Registration failed: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': False,
            'message': 'Registration failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AdminRegisterView(APIView):
    """Register a new admin"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = AdminRegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'Admin registered successfully',
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# AUTHENTICATION VIEWS
# ============================================================================

class LoginView(APIView):
    """User login"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Log the login
            RegistrationLog.objects.create(
                user=user,
                email=user.email,
                role=user.role,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT'),
                status='User logged in successfully'
            )
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            # Get profile type and data
            profile_type = user.role
            profile_data = None
            
            if hasattr(user, 'smeprofile'):
                from smes.serializers import SMEProfileSerializer
                profile_data = SMEProfileSerializer(user.smeprofile).data
            elif hasattr(user, 'agentprofile'):
                from agents.serializers import AgentProfileSerializer
                profile_data = AgentProfileSerializer(user.agentprofile).data
            elif hasattr(user, 'deliveryprofile'):
                from delivery.serializers import DeliveryProfileSerializer
                profile_data = DeliveryProfileSerializer(user.deliveryprofile).data
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(user).data,
                'profile': profile_data,
                'profile_type': profile_type,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    """User logout"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            logout(request)
            return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Logout error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """Get current user details"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ============================================================================
# PROFILE VIEWS
# ============================================================================

class CustomerProfileView(APIView):
    """
    Get or update customer profile
    GET /api/customer/profile/
    PUT /api/customer/profile/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # For customers, just return the user data
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        user = request.user
        
        # Update user fields
        if 'full_name' in request.data:
            user.full_name = request.data['full_name']
        if 'phone' in request.data:
            user.phone = request.data['phone']
        
        user.save()
        
        serializer = UserSerializer(user)
        return Response(serializer.data)


# ============================================================================
# PASSWORD RESET VIEWS
# ============================================================================

class ForgotPasswordView(APIView):
    """
    Request password reset email
    POST /api/users/forgot-password/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            try:
                reset = serializer.save()
                return Response({
                    'success': True,
                    'message': 'Password reset email sent successfully.',
                    'email': serializer.validated_data['email']
                }, status=status.HTTP_200_OK)
            except serializers.ValidationError as e:
                # This catches validation errors from the serializer (like email not found)
                return Response({
                    'success': False,
                    'message': str(e.detail[0]) if isinstance(e.detail, list) else str(e.detail)
                }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                logger.error(f"Error sending password reset email: {e}")
                return Response({
                    'success': False,
                    'message': 'Failed to send reset email. Please try again.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Return serializer errors (validation errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    """
    Reset password with token
    POST /api/users/reset-password/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'success': True,
                'message': 'Password reset successfully. You can now login with your new password.'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ValidateResetTokenView(APIView):
    """
    Validate reset token
    POST /api/users/validate-reset-token/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ValidateTokenSerializer(data=request.data)
        if serializer.is_valid():
            return Response({
                'success': True,
                'message': 'Token is valid'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)