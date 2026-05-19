from django.contrib import admin
from django.utils.html import format_html
from .models import Payment, PaymentMethod, Transaction

class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    readonly_fields = ['transaction_type', 'amount', 'status', 'gateway_transaction_id', 'created_at']
    can_delete = False

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['payment_id', 'order', 'user_email', 'amount_display', 'payment_method', 'payment_status', 'created_at']
    list_filter = ['payment_status', 'payment_method', 'created_at']
    search_fields = ['payment_id', 'order__order_number', 'user__email', 'transaction_id']
    readonly_fields = ['payment_id', 'created_at', 'updated_at', 'completed_at']
    inlines = [TransactionInline]
    
    fieldsets = (
        ('Payment Information', {
            'fields': ('payment_id', 'order', 'user', 'amount', 'payment_method', 'payment_status')
        }),
        ('Transaction Details', {
            'fields': ('transaction_id', 'gateway_response'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )
    
    def user_email(self, obj):
        return obj.user.email if obj.user else 'Guest'
    user_email.short_description = 'User'
    
    def amount_display(self, obj):
        return format_html('<strong>R{}</strong>', obj.amount)
    amount_display.short_description = 'Amount'

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['user', 'payment_type', 'display_card', 'is_default', 'is_active', 'created_at']
    list_filter = ['payment_type', 'is_default', 'is_active']
    search_fields = ['user__email', 'card_last4', 'bank_name']
    
    def display_card(self, obj):
        if obj.card_last4:
            return f"{obj.card_brand} ****{obj.card_last4} ({obj.card_expiry_month}/{obj.card_expiry_year})"
        return '-'
    display_card.short_description = 'Card Details'

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'payment', 'transaction_type', 'amount_display', 'status', 'gateway_transaction_id', 'created_at']
    list_filter = ['transaction_type', 'status', 'created_at']
    search_fields = ['payment__payment_id', 'gateway_transaction_id']
    readonly_fields = ['created_at']
    
    def amount_display(self, obj):
        return format_html('<strong>R{}</strong>', obj.amount)
    amount_display.short_description = 'Amount'