from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import Sum

from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer, CartItemCreateSerializer
from products.models import Product, ProductVariant

import logging

logger = logging.getLogger(__name__)


# =========================================================
# HELPERS
# =========================================================

class CartClearView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            cart = Cart.objects.get(user=request.user)
            CartItem.objects.filter(cart=cart).delete()

            return Response(
                {"message": "Cart cleared successfully"},
                status=status.HTTP_200_OK
            )
        except Cart.DoesNotExist:
            return Response(
                {"message": "Cart not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
class CartMergeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Merge guest cart into authenticated user's cart.
        Expected payload:
        {
            "items": [
                {"product": 1, "quantity": 2},
                {"product": 3, "quantity": 1}
            ]
        }
        """
        items = request.data.get("items", [])

        cart, _ = Cart.objects.get_or_create(user=request.user)

        for item in items:
            product_id = item.get("product")
            quantity = item.get("quantity", 1)

            existing_item = CartItem.objects.filter(
                cart=cart,
                product_id=product_id
            ).first()

            if existing_item:
                existing_item.quantity += quantity
                existing_item.save()
            else:
                CartItem.objects.create(
                    cart=cart,
                    product_id=product_id,
                    quantity=quantity
                )

        return Response(
            {"message": "Cart merged successfully"},
            status=status.HTTP_200_OK
        )

def get_or_create_cart(request):
    session_id = request.session.session_key

    if not session_id:
        request.session.save()
        session_id = request.session.session_key

    if request.user.is_authenticated:
        cart, created = Cart.objects.get_or_create(
            user=request.user,
            defaults={'session_id': session_id}
        )

        if not created and cart.session_id != session_id:
            cart.session_id = session_id
            cart.save()
    else:
        cart, _ = Cart.objects.get_or_create(
            session_id=session_id,
            defaults={'user': None}
        )

    return cart


def validate_single_sme(cart, product):
    """
    Ensure all products belong to the same SME
    """
    existing_sme_ids = cart.items.values_list('product__sme_id', flat=True).distinct()

    if existing_sme_ids and product.sme_id not in existing_sme_ids:
        raise ValueError("You can only add products from one SME per order.")


def calculate_cart_delivery(cart):
    """
    CART PACKAGING ENGINE 🔥
    """
    items = cart.items.select_related('product')

    if not items.exists():
        return "NONE"

    total_volume = 0
    total_weight = 0
    max_size_rank = 0

    SIZE_RANK = {
        "SMALL": 1,
        "MEDIUM": 2,
        "LARGE": 3
    }

    for item in items:
        product = item.product
        qty = item.quantity

        # Sum volume & weight
        total_volume += product.volume_cm3 * qty
        total_weight += float(product.weight_kg) * qty

        # Track dominant size
        size = product.delivery_size_category
        max_size_rank = max(max_size_rank, SIZE_RANK.get(size, 1))

    # If any LARGE → whole cart is LARGE
    if max_size_rank == 3:
        return "LARGE"

    # Volume logic
    if total_volume <= 3000 and total_weight <= 5:
        return "SMALL"
    elif total_volume <= 8000 and total_weight <= 10:
        return "MEDIUM"

    return "LARGE"


# =========================================================
# CART
# =========================================================

class CartView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cart = get_or_create_cart(request)
        serializer = CartSerializer(cart)

        delivery_size = calculate_cart_delivery(cart)

        return Response({
            **serializer.data,
            "delivery_size": delivery_size
        })


# =========================================================
# CART ITEMS
# =========================================================

class CartItemListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cart = get_or_create_cart(request)
        items = cart.items.all()
        serializer = CartItemSerializer(items, many=True)

        return Response(serializer.data)

    def post(self, request):
        cart = get_or_create_cart(request)

        serializer = CartItemCreateSerializer(data=request.data)
        if serializer.is_valid():
            product = serializer.validated_data['product']
            variant = serializer.validated_data.get('variant')
            quantity = serializer.validated_data['quantity']

            try:
                # 🔥 SINGLE SME CHECK
                validate_single_sme(cart, product)
            except ValueError as e:
                return Response({"error": str(e)}, status=400)

            existing_item = CartItem.objects.filter(
                cart=cart,
                product=product,
                variant=variant
            ).first()

            if existing_item:
                new_quantity = existing_item.quantity + quantity

                if product.stock_quantity < new_quantity:
                    return Response(
                        {'error': f'Only {product.stock_quantity} units available'},
                        status=400
                    )

                existing_item.quantity = new_quantity
                existing_item.save()
                item = existing_item
            else:
                item = serializer.save(cart=cart)

            cart.save()

            return Response(
                CartItemSerializer(item).data,
                status=201
            )

        return Response(serializer.errors, status=400)


# =========================================================
# ITEM DETAIL
# =========================================================

class CartItemDetailView(APIView):
    permission_classes = [AllowAny]

    def get_object(self, pk, request):
        cart = get_or_create_cart(request)
        return get_object_or_404(CartItem, pk=pk, cart=cart)

    def put(self, request, pk):
        item = self.get_object(pk, request)
        quantity = request.data.get('quantity')

        try:
            quantity = int(quantity)

            if quantity < 1:
                return Response({'error': 'Quantity must be >= 1'}, status=400)

            if item.product.stock_quantity < quantity:
                return Response(
                    {'error': f'Only {item.product.stock_quantity} available'},
                    status=400
                )

            item.quantity = quantity
            item.save()
            item.cart.save()

            return Response(CartItemSerializer(item).data)

        except:
            return Response({'error': 'Invalid quantity'}, status=400)

    def delete(self, request, pk):
        item = self.get_object(pk, request)
        item.delete()
        item.cart.save()

        return Response({'message': 'Removed'}, status=200)


# =========================================================
# CHECKOUT VALIDATION 🔥🔥🔥
# =========================================================

class CartCheckoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        cart = get_or_create_cart(request)
        items = cart.items.select_related('product')

        if not items.exists():
            return Response({"error": "Cart is empty"}, status=400)

        # 1. SINGLE SME CHECK
        sme_ids = items.values_list('product__sme_id', flat=True).distinct()
        if len(sme_ids) > 1:
            return Response(
                {"error": "Cart contains multiple SMEs. Split your order."},
                status=400
            )

        # 2. STOCK VALIDATION
        for item in items:
            if item.product.stock_quantity < item.quantity:
                return Response(
                    {"error": f"{item.product.name} is out of stock"},
                    status=400
                )

        # 3. DELIVERY CALCULATION
        delivery_size = calculate_cart_delivery(cart)

        DELIVERY_PRICING = {
            "SMALL": 60,
            "MEDIUM": 100,
            "LARGE": 150
        }

        delivery_fee = DELIVERY_PRICING.get(delivery_size, 0)

        subtotal = cart.subtotal
        total = subtotal + delivery_fee

        return Response({
            "message": "Checkout validated",
            "subtotal": subtotal,
            "delivery_size": delivery_size,
            "delivery_fee": delivery_fee,
            "total": total
        }, status=200)