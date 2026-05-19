from django.contrib import admin
from django.utils.html import format_html
from .models import Order, OrderItem, OrderStatusHistory

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['product_name', 'product_sku', 'unit_price', 'quantity', 'total']
    fields = ['product_name', 'product_sku', 'unit_price', 'quantity', 'total']

class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ['status', 'notes', 'changed_by', 'created_at']
    fields = ['status', 'notes', 'changed_by', 'created_at']
    can_delete = False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'customer_full_name', 'customer_email', 'total_amount_display', 'status', 'payment_status', 'order_type', 'created_at']
    list_filter = ['status', 'payment_status', 'order_type', 'created_at']
    search_fields = ['order_number', 'customer_email', 'customer_full_name', 'tracking_number']
    readonly_fields = ['order_number', 'subtotal', 'total_amount', 'created_at', 'updated_at']
    inlines = [OrderItemInline, OrderStatusHistoryInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order_number', 'customer', 'agent', 'order_type', 'status', 'payment_status')
        }),
        ('Customer Information', {
            'fields': ('customer_email', 'customer_phone', 'customer_full_name')
        }),
        ('Addresses', {
            'fields': ('shipping_address', 'billing_address'),
            'classes': ('collapse',)
        }),
        ('Financials', {
            'fields': ('subtotal', 'discount_amount', 'shipping_amount', 'tax_amount', 'total_amount')
        }),
        ('Payment', {
            'fields': ('payment_method', 'payment_reference', 'paid_at'),
            'classes': ('collapse',)
        }),
        ('Shipping', {
            'fields': ('shipping_method', 'tracking_number', 'shipped_at', 'delivered_at'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('customer_notes', 'admin_notes', 'cancellation_reason'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def total_amount_display(self, obj):
        return format_html('<strong>R{}</strong>', obj.total_amount)
    total_amount_display.short_description = 'Total'
    
    def customer_full_name(self, obj):
        return obj.customer_full_name or obj.customer.full_name if obj.customer else 'N/A'
    customer_full_name.short_description = 'Customer'

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'order_link', 'product_name', 'quantity', 'unit_price', 'total', 'sme']
    list_filter = ['created_at']
    search_fields = ['order__order_number', 'product_name', 'product_sku']
    readonly_fields = ['product_name', 'product_sku', 'unit_price', 'quantity', 'subtotal', 'total', 'commission_amount']
    
    def order_link(self, obj):
        return format_html('<a href="/admin/orders/order/{}/change/">{}</a>', 
                          obj.order.id, obj.order.order_number)
    order_link.short_description = 'Order'

@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['order', 'status', 'changed_by', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['order__order_number']
    readonly_fields = ['order', 'status', 'notes', 'changed_by', 'created_at']