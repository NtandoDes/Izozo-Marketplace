from rest_framework import serializers
from .models import Payment, PaymentMethod, Transaction
from orders.serializers import OrderSerializer
import uuid  # Add this import

class PaymentSerializer(serializers.ModelSerializer):
    """
    Serializer for Payment model
    """
    order_details = OrderSerializer(source='order', read_only=True)
    formatted_amount = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'payment_id', 'order', 'order_details', 'user',
            'amount', 'formatted_amount', 'payment_method', 'payment_status',
            'transaction_id', 'gateway_response', 'created_at', 'updated_at',
            'completed_at', 'formatted_date'
        ]
        read_only_fields = ['id', 'payment_id', 'created_at', 'updated_at', 'completed_at']

    def get_formatted_amount(self, obj):
        return f"R{obj.amount:.2f}"

    def get_formatted_date(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')


class PaymentCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating payments
    """
    saved_method_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Payment
        fields = ['order', 'payment_method', 'amount', 'saved_method_id']

    def validate(self, data):
        # Check if order already has a payment
        if Payment.objects.filter(order=data['order']).exists():
            raise serializers.ValidationError("This order already has a payment")
        
        # Validate amount matches order total
        if data['amount'] != data['order'].total_amount:
            raise serializers.ValidationError("Payment amount must match order total")
        
        return data

    def create(self, validated_data):
        # Remove card_details and saved_method_id from validated_data
        validated_data.pop('card_details', None)
        saved_method_id = validated_data.pop('saved_method_id', None)
        
        # Set user from context
        validated_data['user'] = self.context['request'].user
        validated_data['payment_status'] = 'pending'
        
        # Generate payment_id using uuid
        validated_data['payment_id'] = f"PAY-{uuid.uuid4().hex[:12].upper()}"
        
        # Handle saved payment method
        if saved_method_id:
            try:
                payment_method = PaymentMethod.objects.get(
                    id=saved_method_id,
                    user=validated_data['user'],
                    is_active=True
                )
                # You might want to use the saved method details here
                validated_data['payment_method'] = payment_method.payment_type
            except PaymentMethod.DoesNotExist:
                raise serializers.ValidationError("Invalid saved payment method")
        
        return super().create(validated_data)


class PaymentStatusUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating payment status
    """
    class Meta:
        model = Payment
        fields = ['payment_status', 'transaction_id']

    def update(self, instance, validated_data):
        status = validated_data.get('payment_status')
        
        if status == 'completed':
            instance.mark_as_completed()
        elif status == 'failed':
            instance.mark_as_failed()
        elif status == 'refunded':
            instance.mark_as_refunded()
        
        if 'transaction_id' in validated_data:
            instance.transaction_id = validated_data['transaction_id']
            instance.save()
        
        return instance


class PaymentMethodSerializer(serializers.ModelSerializer):
    """
    Serializer for PaymentMethod model
    """
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'payment_type', 'card_last4', 'card_brand',
            'card_expiry_month', 'card_expiry_year', 'bank_name',
            'account_number', 'account_holder', 'mobile_provider',
            'mobile_number', 'is_default', 'is_active', 'display_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_display_name(self, obj):
        if obj.card_last4:
            return f"{obj.card_brand} •••• {obj.card_last4}"
        elif obj.bank_name:
            return f"{obj.bank_name} - {obj.account_holder}"
        elif obj.mobile_provider:
            return f"{obj.mobile_provider} - {obj.mobile_number}"
        return obj.payment_type


class PaymentMethodCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating payment methods
    """
    class Meta:
        model = PaymentMethod
        fields = [
            'payment_type', 'card_last4', 'card_brand',
            'card_expiry_month', 'card_expiry_year', 'card_token',
            'bank_name', 'account_number', 'account_holder',
            'mobile_provider', 'mobile_number', 'is_default'
        ]

    def create(self, validated_data):
        # If this is set as default, unset other defaults
        if validated_data.get('is_default'):
            PaymentMethod.objects.filter(
                user=self.context['request'].user,
                is_default=True
            ).update(is_default=False)
        
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    """
    Serializer for Transaction model
    """
    formatted_amount = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'payment', 'transaction_type', 'amount',
            'formatted_amount', 'status', 'gateway_transaction_id',
            'gateway_response', 'error_message', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_formatted_amount(self, obj):
        return f"R{obj.amount:.2f}"