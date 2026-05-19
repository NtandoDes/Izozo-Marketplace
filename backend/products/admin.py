from django.contrib import admin
from .models import Product, ProductImage, ProductVariant, ProductAttribute, ProductReview


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0


class ProductAttributeInline(admin.TabularInline):
    model = ProductAttribute
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):

    list_display = [
        'name', 'sme', 'agent', 'base_price', 'selling_price',
        'delivery_size_category_display',  # ✅ correct
        'status', 'is_active', 'created_at',
    ]

    readonly_fields = [
        'created_at', 'updated_at', 'published_at',
        'volume_cm3_display',              # ✅ correct
        'delivery_size_category_display',  # ✅ correct
    ]

    # ✅ IMPORTANT: THESE MUST BE INSIDE THE CLASS
    def volume_cm3_display(self, obj):
        return obj.volume_cm3
    volume_cm3_display.short_description = "Volume (cm³)"

    def delivery_size_category_display(self, obj):
        return obj.delivery_size_category
    delivery_size_category_display.short_description = "Delivery Size"
@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display  = ['product', 'user', 'rating', 'is_approved', 'created_at']
    list_filter   = ['rating', 'is_approved', 'is_verified_purchase']
    search_fields = ['product__name', 'user__email', 'comment']
    list_editable = ['is_approved']