from rest_framework import serializers
from .models import Cart, CartItem
from products.serializers import ProductListSerializer, ProductVariantSerializer

class CartItemSerializer(serializers.ModelSerializer):
    """
    Serializer for CartItem model
    """
    product_details = ProductListSerializer(source='product', read_only=True)
    variant_details = ProductVariantSerializer(source='variant', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    sme_id = serializers.IntegerField(source='product.sme_id', read_only=True)
    sme_name = serializers.CharField(source='product.sme.business_name', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    commission_rate = serializers.DecimalField(max_digits=5, decimal_places=2, source='product.commission_rate', read_only=True)
    
    class Meta:
        model = CartItem
        fields = [
            'id', 'cart', 'product', 'variant', 'quantity', 'price',
            'product_details', 'variant_details', 'product_name', 'product_sku',
            'variant_name', 'sme_id', 'sme_name', 'subtotal', 'commission_rate',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'subtotal']


class CartItemCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating cart items
    """
    class Meta:
        model = CartItem
        fields = ['product', 'variant', 'quantity', 'price']
    
    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1")
        return value
    
    def validate(self, data):
        # Check stock availability
        product = data['product']
        quantity = data['quantity']
        
        if product.stock_quantity < quantity:
            raise serializers.ValidationError({
                'quantity': f'Only {product.stock_quantity} units available in stock'
            })
        
        # Set price from product
        if 'variant' in data and data['variant']:
            data['price'] = (product.selling_price or product.base_price) + data['variant'].price_adjustment
        else:
            data['price'] = product.selling_price or product.base_price
        
        return data


class CartSerializer(serializers.ModelSerializer):
    """
    Serializer for Cart model
    """
    items = CartItemSerializer(many=True, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    unique_product_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Cart
        fields = [
            'id', 'user', 'session_id', 'items', 'item_count',
            'subtotal', 'unique_product_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']