from rest_framework import serializers
from django.utils import timezone
from .models import Order, OrderItem, OrderStatusHistory
from addresses.serializers import AddressSerializer
from products.serializers import ProductListSerializer, ProductVariantSerializer
from users.serializers import UserSerializer
from agents.serializers import AgentProfileSerializer
from decimal import Decimal

class OrderItemSerializer(serializers.ModelSerializer):
    """
    Serializer for OrderItem model
    """
    product_details = ProductListSerializer(source='product', read_only=True)
    variant_details = ProductVariantSerializer(source='variant', read_only=True)
    total_formatted = serializers.SerializerMethodField()
    unit_price_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'order', 'product', 'product_details', 'variant',
            'variant_details', 'product_name', 'product_sku',
            'variant_name', 'variant_attributes', 'unit_price',
            'unit_price_formatted', 'discount_amount', 'tax_amount',
            'quantity', 'subtotal', 'total', 'total_formatted',
            'commission_rate', 'commission_amount', 'sme', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'subtotal', 'total']
    
    def get_total_formatted(self, obj):
        return f"R{obj.total:.2f}"
    
    def get_unit_price_formatted(self, obj):
        return f"R{obj.unit_price:.2f}"


class OrderItemCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating order items
    """
    product_id = serializers.IntegerField(write_only=True)
    sme_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = OrderItem
        fields = [
            'product_id', 'product_name', 'product_sku',
            'variant_id', 'variant_name', 'unit_price',
            'discount_amount', 'tax_amount', 'quantity',
            'commission_rate', 'sme_id'
        ]
    
    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value
    
    def validate_unit_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Unit price must be greater than 0")
        return value
    
    def create(self, validated_data):
        product_id = validated_data.pop('product_id')
        sme_id = validated_data.pop('sme_id', None)
        
        # Get product
        from products.models import Product
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            raise serializers.ValidationError(f"Product with id {product_id} does not exist")
        
        # Set product and related fields
        validated_data['product'] = product
        
        # Set SME from product if not provided
        if not sme_id and product.sme:
            validated_data['sme'] = product.sme
        elif sme_id:
            from smes.models import SMEProfile
            try:
                validated_data['sme'] = SMEProfile.objects.get(id=sme_id)
            except SMEProfile.DoesNotExist:
                pass
        
        return super().create(validated_data)


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for OrderStatusHistory model
    """
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)
    formatted_date = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderStatusHistory
        fields = [
            'id', 'order', 'status', 'notes', 'changed_by',
            'changed_by_name', 'created_at', 'formatted_date'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_formatted_date(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')


class OrderSerializer(serializers.ModelSerializer):
    """
    Serializer for Order model
    """
    items = OrderItemSerializer(many=True, read_only=True)
    customer_details = UserSerializer(source='customer', read_only=True)
    agent_details = AgentProfileSerializer(source='agent', read_only=True)
    shipping_address_details = AddressSerializer(source='shipping_address', read_only=True)
    billing_address_details = AddressSerializer(source='billing_address', read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    
    # Computed fields
    item_count = serializers.IntegerField(read_only=True)
    unique_product_count = serializers.IntegerField(read_only=True)
    total_formatted = serializers.SerializerMethodField()
    subtotal_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_details',
            'agent', 'agent_details', 'order_type', 'status', 'payment_status',
            'customer_email', 'customer_phone', 'customer_full_name',
            'shipping_address', 'shipping_address_details', 'shipping_address_snapshot',
            'billing_address', 'billing_address_details', 'billing_address_snapshot',
            'subtotal', 'subtotal_formatted', 'discount_amount', 'shipping_amount',
            'tax_amount', 'total_amount', 'total_formatted',
            'payment_method', 'payment_reference', 'paid_at',
            'shipping_method', 'tracking_number', 'shipped_at', 'delivered_at',
            'customer_notes', 'admin_notes', 'cancellation_reason',
            'items', 'item_count', 'unique_product_count',
            'status_history', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'order_number', 'created_at', 'updated_at',
            'subtotal', 'total_amount'
        ]
    
    def get_total_formatted(self, obj):
        return f"R{obj.total_amount:.2f}"
    
    def get_subtotal_formatted(self, obj):
        return f"R{obj.subtotal:.2f}"


class OrderCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating orders
    """
    items = OrderItemCreateSerializer(many=True)
    shipping_address_id = serializers.IntegerField(write_only=True, required=False)
    billing_address_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = Order
        fields = [
            'customer', 'agent', 'order_type', 'customer_email',
            'customer_phone', 'customer_full_name',
            'shipping_address_id', 'billing_address_id',
            'shipping_method', 'customer_notes',
            'shipping_amount', 'discount_amount', 'tax_amount',
            'items'
        ]
        extra_kwargs = {
            'customer': {'read_only': True}
        }
    
    def validate(self, data):
        # Validate customer email
        if not data.get('customer_email'):
            raise serializers.ValidationError({
                'customer_email': 'Customer email is required'
            })
        
        # Validate items
        if not data.get('items'):
            raise serializers.ValidationError({
                'items': 'At least one item is required'
            })
        
        # Calculate subtotal
        subtotal = sum(
            float(item['unit_price']) * item['quantity'] 
            for item in data['items']
        )
        data['subtotal'] = Decimal(str(subtotal))
        
        # Calculate total
        total = Decimal(str(subtotal))
        total -= Decimal(str(data.get('discount_amount', 0)))
        total += Decimal(str(data.get('shipping_amount', 0)))
        total += Decimal(str(data.get('tax_amount', 0)))
        data['total_amount'] = total
        
        return data
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        shipping_address_id = validated_data.pop('shipping_address_id', None)
        billing_address_id = validated_data.pop('billing_address_id', None)
        
        # Get the authenticated user from the request context
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        
        # Create order with the authenticated user
        order = Order.objects.create(
            customer=user,
            **validated_data
        )
        
        # Set addresses
        if shipping_address_id and user:
            from addresses.models import Address
            try:
                shipping_address = Address.objects.get(
                    id=shipping_address_id,
                    user=user
                )
                order.shipping_address = shipping_address
                order.shipping_address_snapshot = {
                    'full_name': shipping_address.full_name,
                    'phone': shipping_address.phone,
                    'address_line1': shipping_address.address_line1,
                    'address_line2': shipping_address.address_line2,
                    'city': shipping_address.city,
                    'state': shipping_address.state,
                    'postal_code': shipping_address.postal_code,
                    'country': shipping_address.country
                }
            except Address.DoesNotExist:
                pass
        
        if billing_address_id and user:
            from addresses.models import Address
            try:
                billing_address = Address.objects.get(
                    id=billing_address_id,
                    user=user
                )
                order.billing_address = billing_address
                order.billing_address_snapshot = {
                    'full_name': billing_address.full_name,
                    'phone': billing_address.phone,
                    'address_line1': billing_address.address_line1,
                    'address_line2': billing_address.address_line2,
                    'city': billing_address.city,
                    'state': billing_address.state,
                    'postal_code': billing_address.postal_code,
                    'country': billing_address.country
                }
            except Address.DoesNotExist:
                pass
        
        order.save()
        
        # Create order items
        for item_data in items_data:
            order_item = OrderItem.objects.create(order=order, **item_data)
            
            # Ensure SME is set (the create method in OrderItemCreateSerializer should handle this)
            if not order_item.sme and order_item.product and order_item.product.sme:
                order_item.sme = order_item.product.sme
                order_item.save()
        
        # Create status history entry
        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            notes='Order created',
            changed_by=user
        )
        
        return order


class OrderStatusUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating order status
    """
    notes = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Order
        fields = ['status', 'payment_status', 'tracking_number', 'notes']
    
    def update(self, instance, validated_data):
        notes = validated_data.pop('notes', '')
        old_status = instance.status
        
        # Update order
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Set timestamps based on status
        if instance.status == 'paid' and old_status != 'paid':
            instance.paid_at = timezone.now()
            instance.payment_status = 'paid'
        elif instance.status == 'shipped' and old_status != 'shipped':
            instance.shipped_at = timezone.now()
        elif instance.status == 'delivered' and old_status != 'delivered':
            instance.delivered_at = timezone.now()
        elif instance.status == 'cancelled' and old_status != 'cancelled':
            instance.cancellation_reason = notes
        
        instance.save()
        
        # Create status history entry
        OrderStatusHistory.objects.create(
            order=instance,
            status=instance.status,
            notes=notes or f'Status updated to {instance.get_status_display()}',
            changed_by=self.context['request'].user
        )
        
        return instance


class OrderStatsSerializer(serializers.Serializer):
    """
    Serializer for order statistics
    """
    total_orders = serializers.IntegerField()
    pending_orders = serializers.IntegerField()
    processing_orders = serializers.IntegerField()
    paid_orders = serializers.IntegerField()
    shipped_orders = serializers.IntegerField()
    delivered_orders = serializers.IntegerField()
    cancelled_orders = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    average_order_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    
    # Agent specific stats
    agent_commission_total = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    agent_pending_commission = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    
    # SME specific stats
    sme_total_revenue = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    sme_orders_by_product = serializers.ListField(child=serializers.DictField(), required=False)