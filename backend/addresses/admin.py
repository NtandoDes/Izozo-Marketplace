from django.contrib import admin
from .models import Address, AddressBook

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'full_name', 'address_type', 'city', 'country', 'is_default', 'created_at']
    list_filter = ['address_type', 'is_default', 'country', 'city']
    search_fields = ['user__email', 'full_name', 'address_line1', 'city']
    list_editable = ['is_default']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'address_type', 'is_default')
        }),
        ('Recipient Information', {
            'fields': ('full_name', 'phone')
        }),
        ('Address Details', {
            'fields': ('address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(AddressBook)
class AddressBookAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'address_count', 'created_at']
    search_fields = ['user__email']
    filter_horizontal = ['addresses']
    readonly_fields = ['created_at', 'updated_at']
    
    def address_count(self, obj):
        return obj.addresses.count()
    address_count.short_description = 'Number of Addresses'