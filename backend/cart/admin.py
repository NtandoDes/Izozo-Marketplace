from django.contrib import admin
from django.utils.html import format_html
from .models import Cart, CartItem
from .services import CartEngine


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = ['product', 'variant', 'quantity', 'price', 'subtotal']
    can_delete = True

    def subtotal(self, obj):
        return format_html('<strong>R{}</strong>', obj.subtotal)


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'user_email',
        'item_count',
        'subtotal_display',
        'shipping_tier',
        'shipping_cost',
        'total_display',
        'created_at'
    ]

    readonly_fields = [
        'created_at',
        'updated_at',
        'shipping_tier',
        'shipping_cost',
        'total_display'
    ]

    inlines = [CartItemInline]

    def user_email(self, obj):
        return obj.user.email if obj.user else "Guest"

    def subtotal_display(self, obj):
        return format_html('<strong>R{}</strong>', obj.subtotal)

    def shipping_tier(self, obj):
        engine = CartEngine(obj)
        return engine.compute_totals().get("shipping_tier")

    def shipping_cost(self, obj):
        engine = CartEngine(obj)
        cost = engine.compute_totals().get("shipping_cost", 0)
        return format_html('<strong>R{}</strong>', cost)

    def total_display(self, obj):
        engine = CartEngine(obj)
        total = engine.compute_totals().get("total", 0)
        return format_html('<strong>R{}</strong>', total)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'cart_id', 'product_name', 'quantity', 'price', 'subtotal_display']

    def cart_id(self, obj):
        return obj.cart.id

    def product_name(self, obj):
        return obj.product.name

    def subtotal_display(self, obj):
        return format_html('<strong>R{}</strong>', obj.subtotal)