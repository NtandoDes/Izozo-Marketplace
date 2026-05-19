from django.contrib import admin
from .models import Category, CategoryAttribute

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'is_active', 'order', 'created_at']
    list_filter = ['is_active', 'parent']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ['order', 'is_active']

@admin.register(CategoryAttribute)
class CategoryAttributeAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'attribute_type', 'required', 'order']
    list_filter = ['category', 'attribute_type', 'required']
    search_fields = ['name']
    list_editable = ['order']