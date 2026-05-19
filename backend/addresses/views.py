from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Address, AddressBook
from .serializers import (
    AddressSerializer, 
    AddressCreateUpdateSerializer,
    AddressBookSerializer
)
import logging

logger = logging.getLogger(__name__)

class AddressListView(APIView):
    """
    List all addresses for the authenticated user
    GET /api/addresses/
    POST /api/addresses/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        addresses = Address.objects.filter(user=request.user)
        
        # Filter by address type
        address_type = request.query_params.get('type')
        if address_type:
            addresses = addresses.filter(address_type=address_type)
        
        # Filter by default
        is_default = request.query_params.get('is_default')
        if is_default is not None:
            is_default_bool = is_default.lower() == 'true'
            addresses = addresses.filter(is_default=is_default_bool)
        
        serializer = AddressSerializer(addresses, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AddressCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            address = serializer.save(user=request.user)
            
            # Create address book if it doesn't exist
            AddressBook.objects.get_or_create(user=request.user)
            
            return Response(
                AddressSerializer(address).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AddressDetailView(APIView):
    """
    Retrieve, update or delete an address
    GET /api/addresses/{id}/
    PUT /api/addresses/{id}/
    DELETE /api/addresses/{id}/
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        return get_object_or_404(Address, pk=pk, user=user)

    def get(self, request, pk):
        address = self.get_object(pk, request.user)
        serializer = AddressSerializer(address)
        return Response(serializer.data)

    def put(self, request, pk):
        address = self.get_object(pk, request.user)
        serializer = AddressCreateUpdateSerializer(
            address, 
            data=request.data, 
            partial=True
        )
        if serializer.is_valid():
            updated_address = serializer.save()
            return Response(AddressSerializer(updated_address).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        address = self.get_object(pk, request.user)
        address.delete()
        return Response(
            {'message': 'Address deleted successfully'},
            status=status.HTTP_200_OK
        )


class AddressDefaultView(APIView):
    """
    Set an address as default for its type
    POST /api/addresses/{id}/set-default/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        address = get_object_or_404(Address, pk=pk, user=request.user)
        address.is_default = True
        address.save()
        return Response(
            {'message': f'Address set as default {address.address_type} address'},
            status=status.HTTP_200_OK
        )


class AddressBookView(APIView):
    """
    Get user's address book
    GET /api/address-book/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        address_book, created = AddressBook.objects.get_or_create(
            user=request.user
        )
        serializer = AddressBookSerializer(address_book)
        return Response(serializer.data)