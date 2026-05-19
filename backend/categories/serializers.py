from rest_framework import serializers
from django.utils.text import slugify
from .models import Category, CategoryAttribute

# ============= CATEGORY ATTRIBUTE SERIALIZERS =============

class CategoryAttributeSerializer(serializers.ModelSerializer):
    """
    Serializer for CategoryAttribute model
    """
    class Meta:
        model = CategoryAttribute
        fields = [
            'id', 'category', 'name', 'attribute_type', 'required',
            'options', 'unit', 'order', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_options(self, value):
        """Validate options for select/multiselect attribute types"""
        attribute_type = self.initial_data.get('attribute_type')
        if attribute_type in ['select', 'multiselect'] and not value:
            raise serializers.ValidationError(
                "Options are required for select/multiselect attribute types"
            )
        return value


class CategoryAttributeCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating CategoryAttribute
    """
    class Meta:
        model = CategoryAttribute
        fields = [
            'category', 'name', 'attribute_type', 'required',
            'options', 'unit', 'order', 'is_active'
        ]

    def validate(self, data):
        """Validate attribute data based on type"""
        attribute_type = data.get('attribute_type')
        options = data.get('options')

        if attribute_type in ['select', 'multiselect']:
            if not options:
                raise serializers.ValidationError({
                    'options': 'Options are required for select/multiselect attribute types'
                })
            if not isinstance(options, list):
                raise serializers.ValidationError({
                    'options': 'Options must be a list'
                })
        
        if attribute_type in ['text', 'number', 'boolean', 'color', 'size']:
            data['options'] = None
        
        return data


# ============= CATEGORY SERIALIZERS =============

class CategorySerializer(serializers.ModelSerializer):
    """
    Main Category serializer with nested relationships
    """
    subcategories = serializers.SerializerMethodField()
    attributes = CategoryAttributeSerializer(many=True, read_only=True)
    full_path = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()
    has_children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'parent',
            'subcategories', 'attributes', 'icon', 'image',
            'is_active', 'order', 'full_path', 'product_count',
            'has_children', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at']

    def get_subcategories(self, obj):
        """Get active subcategories"""
        subcategories = obj.subcategories.filter(is_active=True).order_by('order', 'name')
        return CategorySerializer(subcategories, many=True).data

    def get_full_path(self, obj):
        """Get full category path (e.g., 'Electronics > Phones > Smartphones')"""
        return obj.get_full_path()

    def get_product_count(self, obj):
        """Get count of active products in this category and subcategories"""
        from products.models import Product
        
        # Get all subcategory IDs
        category_ids = [obj.id]
        for sub in obj.subcategories.filter(is_active=True):
            category_ids.append(sub.id)
            for subsub in sub.subcategories.filter(is_active=True):
                category_ids.append(subsub.id)
        
        return Product.objects.filter(
            categories__id__in=category_ids,
            status='active',
            is_active=True
        ).distinct().count()

    def get_has_children(self, obj):
        """Check if category has active subcategories"""
        return obj.subcategories.filter(is_active=True).exists()


class CategoryCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating categories
    """
    class Meta:
        model = Category
        fields = [
            'name', 'slug', 'description', 'parent',
            'icon', 'image', 'is_active', 'order'
        ]

    def validate_slug(self, value):
        """Validate slug uniqueness"""
        if value:
            # Check if slug exists (excluding current instance)
            instance = getattr(self, 'instance', None)
            queryset = Category.objects.filter(slug=value)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    "Category with this slug already exists"
                )
        return value

    def validate_parent(self, value):
        """Prevent circular parent relationships"""
        if value and self.instance:
            # Check if trying to set self as parent
            if value.pk == self.instance.pk:
                raise serializers.ValidationError(
                    "Category cannot be its own parent"
                )
            
            # Check for circular reference
            parent = value
            while parent:
                if parent.pk == self.instance.pk:
                    raise serializers.ValidationError(
                        "Circular parent reference detected"
                    )
                parent = parent.parent
        
        return value

    def create(self, validated_data):
        """Create category with auto-generated slug if not provided"""
        if 'slug' not in validated_data or not validated_data['slug']:
            validated_data['slug'] = slugify(validated_data['name'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Update category with slug regeneration if name changed"""
        if 'name' in validated_data and validated_data['name'] != instance.name:
            if 'slug' not in validated_data or not validated_data['slug']:
                validated_data['slug'] = slugify(validated_data['name'])
        return super().update(instance, validated_data)


class CategoryListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for category listings
    """
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'parent', 'parent_name',
            'icon', 'is_active', 'order', 'product_count'
        ]

    def get_product_count(self, obj):
        """Get count of active products"""
        from products.models import Product
        return Product.objects.filter(
            categories=obj,
            status='active',
            is_active=True
        ).count()


class CategoryTreeSerializer(serializers.ModelSerializer):
    """
    Serializer for hierarchical category tree
    """
    children = serializers.SerializerMethodField()
    label = serializers.CharField(source='name')
    value = serializers.IntegerField(source='id')

    class Meta:
        model = Category
        fields = ['id', 'value', 'label', 'name', 'slug', 'children', 'icon']

    def get_children(self, obj):
        """Get active subcategories"""
        children = obj.subcategories.filter(is_active=True).order_by('order', 'name')
        return CategoryTreeSerializer(children, many=True).data


# ============= BULK OPERATION SERIALIZERS =============

class CategoryBulkDeleteSerializer(serializers.Serializer):
    """
    Serializer for bulk category deletion
    """
    category_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True
    )

    def validate_category_ids(self, value):
        """Validate that categories exist and can be deleted"""
        if not value:
            raise serializers.ValidationError("No category IDs provided")
        
        categories = Category.objects.filter(id__in=value)
        if len(categories) != len(value):
            raise serializers.ValidationError("One or more categories not found")
        
        # Check if categories have products
        from products.models import Product
        categories_with_products = []
        for category in categories:
            if Product.objects.filter(categories=category).exists():
                categories_with_products.append(category.name)
        
        if categories_with_products:
            raise serializers.ValidationError(
                f"Cannot delete categories with products: {', '.join(categories_with_products)}"
            )
        
        return value


class CategoryBulkUpdateSerializer(serializers.Serializer):
    """
    Serializer for bulk category updates
    """
    category_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True
    )
    is_active = serializers.BooleanField(required=False)
    order = serializers.IntegerField(required=False)

    def validate_category_ids(self, value):
        if not value:
            raise serializers.ValidationError("No category IDs provided")
        return value