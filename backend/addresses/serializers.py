from rest_framework import serializers
from .models import Address, AddressBook
from users.serializers import UserSerializer

class AddressSerializer(serializers.ModelSerializer):
    """
    Serializer for Address model
    """
    full_address = serializers.ReadOnlyField()
    
    class Meta:
        model = Address
        fields = [
            'id', 'user', 'address_type', 'full_name', 'phone',
            'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country', 'is_default', 'full_address',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AddressCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating addresses
    """
    class Meta:
        model = Address
        fields = [
            'address_type', 'full_name', 'phone',
            'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country', 'is_default'
        ]
    
    def validate(self, data):
        # Validate phone number format (basic)
        phone = data.get('phone')
        if phone and not phone.replace('+', '').replace(' ', '').isdigit():
            raise serializers.ValidationError({
                'phone': 'Invalid phone number format'
            })
        return data


class AddressBookSerializer(serializers.ModelSerializer):
    """
    Serializer for AddressBook model
    """
    addresses = AddressSerializer(many=True, read_only=True)
    user_details = UserSerializer(source='user', read_only=True)
    address_count = serializers.SerializerMethodField()
    
    class Meta:
        model = AddressBook
        fields = [
            'id', 'user', 'user_details', 'addresses',
            'address_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_address_count(self, obj):
        return obj.addresses.count()