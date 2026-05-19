from datetime import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .models import DeliveryProfile
from .serializers import DeliveryRegisterSerializer, DeliveryProfileSerializer, DeliveryProfileUpdateSerializer
from users.models import User
from users.serializers import UserSerializer

class DeliveryRegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = DeliveryRegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            delivery_profile = serializer.save()
            user = delivery_profile.user
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'Delivery partner registered successfully',
                'user': UserSerializer(user).data,
                'delivery_profile': DeliveryProfileSerializer(delivery_profile).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# delivery/views.py - Update DeliveryProfileView

class DeliveryProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            delivery_profile = DeliveryProfile.objects.get(user=request.user)
            serializer = DeliveryProfileSerializer(delivery_profile)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DeliveryProfile.DoesNotExist:
            return Response(
                {'error': 'Delivery profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def put(self, request):
        try:
            delivery_profile = DeliveryProfile.objects.get(user=request.user)
            user = request.user
            
            # Update user fields (full_name, phone)
            user_updated = False
            if 'full_name' in request.data and request.data['full_name'] != user.full_name:
                user.full_name = request.data['full_name']
                user_updated = True
            if 'phone' in request.data and request.data['phone'] != user.phone:
                user.phone = request.data['phone']
                user_updated = True
            
            if user_updated:
                user.save()
                logger.info(f"Updated user {user.id} fields: full_name={user.full_name}, phone={user.phone}")
            
            # Update delivery profile fields
            profile_serializer = DeliveryProfileUpdateSerializer(delivery_profile, data=request.data, partial=True)
            if profile_serializer.is_valid():
                profile_serializer.save()
                logger.info(f"Updated delivery profile {delivery_profile.id}")
                
                # Return combined data
                response_data = {
                    'id': delivery_profile.id,
                    'user': UserSerializer(user).data,
                    'home_address': delivery_profile.home_address,
                    'vehicle_type': delivery_profile.vehicle_type,
                    'has_internet': delivery_profile.has_internet,
                    'has_smartphone': delivery_profile.has_smartphone,
                    'created_at': delivery_profile.created_at,
                    'updated_at': timezone.now()
                }
                
                return Response(response_data, status=status.HTTP_200_OK)
            
            return Response(profile_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except DeliveryProfile.DoesNotExist:
            return Response(
                {'error': 'Delivery profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

class DeliveryListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        delivery_profiles = DeliveryProfile.objects.all()
        serializer = DeliveryProfileSerializer(delivery_profiles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)