from rest_framework import serializers
from django.utils import timezone
from django.utils.text import slugify
from django.db.models import Avg, Count
from .models import (
    Product, ProductImage, ProductVariant,
    ProductAttribute, ProductReview,
    COMMISSION_RATES,
)
from categories.serializers import CategorySerializer, CategoryAttributeSerializer
from categories.models import CategoryAttribute
from smes.serializers import SMEProfileSerializer
from agents.serializers import AgentProfileSerializer
from users.serializers import UserSerializer


# ============= PRODUCT IMAGE SERIALIZERS =============

class ProductImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'image_url', 'alt_text', 'is_featured', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class ProductImageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['image', 'alt_text', 'is_featured', 'order']


# ============= PRODUCT VARIANT SERIALIZERS =============

class ProductVariantSerializer(serializers.ModelSerializer):
    final_price = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'name', 'sku', 'price_adjustment', 'final_price',
            'stock_quantity', 'image', 'image_url', 'attributes', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_final_price(self, obj):
        return float(obj.product.get_final_price()) + float(obj.price_adjustment)

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class ProductVariantCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ['name', 'sku', 'price_adjustment', 'stock_quantity', 'image', 'attributes', 'is_active']

    def validate_attributes(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Attributes must be a JSON object")
        return value


# ============= PRODUCT ATTRIBUTE SERIALIZERS =============

class ProductAttributeSerializer(serializers.ModelSerializer):
    attribute_name    = serializers.CharField(source='attribute.name',           read_only=True)
    attribute_type    = serializers.CharField(source='attribute.attribute_type', read_only=True)
    attribute_unit    = serializers.CharField(source='attribute.unit',           read_only=True)
    attribute_options = serializers.JSONField(source='attribute.options',        read_only=True)
    display_value     = serializers.SerializerMethodField()

    class Meta:
        model = ProductAttribute
        fields = [
            'id', 'attribute', 'attribute_name', 'attribute_type',
            'attribute_unit', 'attribute_options', 'value', 'display_value',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_display_value(self, obj):
        if obj.attribute.attribute_type == 'boolean':
            return 'Yes' if obj.value else 'No'
        elif obj.attribute.attribute_type in ('select', 'multiselect'):
            if isinstance(obj.value, list):
                return ', '.join(obj.value)
            return obj.value
        elif obj.attribute.unit:
            return f"{obj.value} {obj.attribute.unit}"
        return obj.value


class ProductAttributeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttribute
        fields = ['attribute', 'value']

    def validate(self, data):
        attribute = data['attribute']
        value     = data['value']
        if attribute.attribute_type == 'number':
            try:
                float(value)
            except (TypeError, ValueError):
                raise serializers.ValidationError({'value': f'Must be a number for "{attribute.name}"'})
        elif attribute.attribute_type == 'boolean':
            if not isinstance(value, bool):
                raise serializers.ValidationError({'value': f'Must be true/false for "{attribute.name}"'})
        elif attribute.attribute_type in ('select', 'multiselect'):
            if attribute.attribute_type == 'select' and not isinstance(value, str):
                raise serializers.ValidationError({'value': f'Must be a string for "{attribute.name}"'})
            if attribute.attribute_type == 'multiselect' and not isinstance(value, list):
                raise serializers.ValidationError({'value': f'Must be a list for "{attribute.name}"'})
            if attribute.options:
                if attribute.attribute_type == 'select' and value not in attribute.options:
                    raise serializers.ValidationError({'value': f'"{value}" is not a valid option for "{attribute.name}"'})
                if attribute.attribute_type == 'multiselect':
                    invalid = [v for v in value if v not in attribute.options]
                    if invalid:
                        raise serializers.ValidationError({'value': f'Invalid options: {", ".join(invalid)}'})
        return data


# ============= PRODUCT REVIEW SERIALIZERS =============

class ProductReviewSerializer(serializers.ModelSerializer):
    user_name      = serializers.CharField(source='user.full_name', read_only=True)
    user_email     = serializers.EmailField(source='user.email',    read_only=True)
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = [
            'id', 'user', 'user_name', 'user_email', 'rating',
            'title', 'comment', 'is_verified_purchase', 'is_approved',
            'created_at', 'formatted_date',
        ]
        read_only_fields = ['id', 'user', 'is_verified_purchase', 'is_approved', 'created_at']

    def get_formatted_date(self, obj):
        return obj.created_at.strftime('%B %d, %Y')


class ProductReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductReview
        fields = ['rating', 'title', 'comment']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value


# ============= DELIVERY / PAXI SERIALIZER =============

class ProductDeliverySerializer(serializers.ModelSerializer):
    """
    Exposes PAXI delivery sizing fields and computed read-only properties.
    packaging_override has been removed — only is_foldable controls
    soft-item sizing.
    """
    volume_cm3             = serializers.IntegerField(read_only=True)
    delivery_size_category = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = [
            # Physical dimensions
            'length_cm', 'width_cm', 'height_cm', 'weight_kg',
            # Packaging control
            'is_foldable',
            # Computed
            'volume_cm3', 'delivery_size_category',
        ]


# ============= PRODUCT LIST SERIALIZER =============

class ProductListSerializer(serializers.ModelSerializer):
    sme_name               = serializers.CharField(source='sme.business_name',       read_only=True)
    agent_name             = serializers.CharField(source='agent.user.full_name',     read_only=True)
    agent_id               = serializers.IntegerField(source='agent.id',              read_only=True)
    category_names         = serializers.SerializerMethodField()
    category_ids           = serializers.SerializerMethodField()
    featured_image         = serializers.SerializerMethodField()
    final_price            = serializers.SerializerMethodField()
    discount_percentage    = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    is_low_stock           = serializers.SerializerMethodField()
    average_rating         = serializers.SerializerMethodField()
    review_count           = serializers.SerializerMethodField()
    # Computed commission breakdown
    commission_amount      = serializers.SerializerMethodField()
    net_payout             = serializers.SerializerMethodField()
    # Delivery / PAXI
    volume_cm3             = serializers.IntegerField(read_only=True)
    delivery_size_category = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'short_description', 'description',
            'sme', 'sme_name', 'agent', 'agent_name', 'agent_id',
            'categories', 'category_ids', 'category_names',
            'base_price', 'selling_price', 'discount_percentage', 'final_price',
            'featured_image', 'stock_quantity', 'is_low_stock',
            'status', 'is_active', 'is_featured',
            # Commission
            'commission_rate', 'commission_type',
            'commission_amount', 'net_payout',
            'average_rating', 'review_count', 'created_at',
            # Delivery / PAXI
            'length_cm', 'width_cm', 'height_cm', 'weight_kg',
            'is_foldable',
            'volume_cm3', 'delivery_size_category',
        ]
        read_only_fields = ['id', 'slug', 'created_at']

    def get_category_names(self, obj):
        return [cat.name for cat in obj.categories.all()]

    def get_category_ids(self, obj):
        return [cat.id for cat in obj.categories.all()]

    def get_featured_image(self, obj):
        request = self.context.get('request')
        featured = obj.images.filter(is_featured=True).first()
        if featured and featured.image:
            return request.build_absolute_uri(featured.image.url) if request else featured.image.url
        if obj.featured_image:
            return request.build_absolute_uri(obj.featured_image.url) if request else obj.featured_image.url
        first_image = obj.images.first()
        if first_image and first_image.image:
            return request.build_absolute_uri(first_image.image.url) if request else first_image.image.url
        return None

    def get_final_price(self, obj):
        return obj.get_final_price()

    def get_is_low_stock(self, obj):
        return obj.is_low_stock()

    def get_average_rating(self, obj):
        reviews = obj.reviews.filter(is_approved=True)
        if reviews.exists():
            return round(reviews.aggregate(Avg('rating'))['rating__avg'], 1)
        return 0

    def get_review_count(self, obj):
        return obj.reviews.filter(is_approved=True).count()

    def get_commission_amount(self, obj):
        return obj.commission_amount

    def get_net_payout(self, obj):
        return obj.net_payout


# ============= PRODUCT DETAIL SERIALIZER =============

class ProductDetailSerializer(serializers.ModelSerializer):
    images              = ProductImageSerializer(many=True, read_only=True)
    variants            = serializers.SerializerMethodField()
    attributes          = serializers.SerializerMethodField()
    reviews             = serializers.SerializerMethodField()
    categories          = CategorySerializer(many=True, read_only=True)
    sme_details         = serializers.SerializerMethodField()
    agent_details       = serializers.SerializerMethodField()
    created_by_details  = UserSerializer(source='created_by',  read_only=True)
    approved_by_details = UserSerializer(source='approved_by', read_only=True)
    final_price         = serializers.SerializerMethodField()
    discount_amount     = serializers.SerializerMethodField()
    is_low_stock        = serializers.SerializerMethodField()
    average_rating      = serializers.SerializerMethodField()
    review_count        = serializers.SerializerMethodField()
    rating_distribution = serializers.SerializerMethodField()
    # Commission breakdown (read-only, derived from model properties)
    commission_amount   = serializers.SerializerMethodField()
    net_payout          = serializers.SerializerMethodField()
    # Delivery / PAXI
    volume_cm3             = serializers.IntegerField(read_only=True)
    delivery_size_category = serializers.CharField(read_only=True)
    absolute_url        = serializers.SerializerMethodField()
    share_url           = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'description', 'short_description',
            'sme', 'sme_details', 'agent', 'agent_details',
            'categories', 'created_by_details', 'approved_by_details',
            'images', 'featured_image', 'variants', 'attributes',
            'base_price', 'selling_price', 'discount_percentage',
            'discount_amount', 'final_price',
            # Commission — rate is %, amount and payout are derived rand values
            'commission_rate', 'commission_type',
            'commission_amount', 'net_payout',
            'sku', 'barcode', 'stock_quantity', 'low_stock_threshold', 'is_low_stock',
            # Delivery / PAXI
            'length_cm', 'width_cm', 'height_cm', 'weight_kg',
            'is_foldable',
            'volume_cm3', 'delivery_size_category',
            'status', 'is_active', 'is_featured',
            'reviews', 'average_rating', 'review_count', 'rating_distribution',
            'meta_title', 'meta_description', 'meta_keywords',
            'created_at', 'updated_at', 'published_at',
            'absolute_url', 'share_url',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at', 'published_at']

    def get_variants(self, obj):
        return ProductVariantSerializer(
            obj.variants.filter(is_active=True), many=True, context=self.context
        ).data

    def get_attributes(self, obj):
        return ProductAttributeSerializer(obj.attributes.all(), many=True, context=self.context).data

    def get_reviews(self, obj):
        return ProductReviewSerializer(
            obj.reviews.filter(is_approved=True)[:10], many=True, context=self.context
        ).data

    def get_sme_details(self, obj):
        from smes.serializers import SMEProfileSerializer
        return SMEProfileSerializer(obj.sme, context=self.context).data

    def get_agent_details(self, obj):
        if obj.agent:
            from agents.serializers import AgentProfileSerializer
            return AgentProfileSerializer(obj.agent, context=self.context).data
        return None

    def get_final_price(self, obj):
        return float(obj.get_final_price())

    def get_discount_amount(self, obj):
        if obj.discount_percentage > 0:
            return float((obj.discount_percentage / 100) * obj.base_price)
        return 0

    def get_is_low_stock(self, obj):
        return obj.is_low_stock()

    def get_average_rating(self, obj):
        reviews = obj.reviews.filter(is_approved=True)
        if reviews.exists():
            return round(reviews.aggregate(Avg('rating'))['rating__avg'], 1)
        return 0

    def get_review_count(self, obj):
        return obj.reviews.filter(is_approved=True).count()

    def get_rating_distribution(self, obj):
        reviews      = obj.reviews.filter(is_approved=True)
        distribution = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        for review in reviews:
            distribution[review.rating] += 1
        total = reviews.count()
        if total > 0:
            for rating in distribution:
                distribution[rating] = {
                    'count':      distribution[rating],
                    'percentage': round((distribution[rating] / total) * 100, 1),
                }
        return distribution

    def get_commission_amount(self, obj):
        return obj.commission_amount

    def get_net_payout(self, obj):
        return obj.net_payout

    def get_absolute_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f'/products/{obj.slug}/')
        return f'/products/{obj.slug}/'

    def get_share_url(self, obj):
        return self.get_absolute_url(obj)


# ============= PRODUCT CREATE / UPDATE SERIALIZER =============

class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    images          = serializers.ListField(child=serializers.ImageField(), write_only=True, required=False)
    category_ids    = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=True)
    attributes      = serializers.JSONField(write_only=True, required=False)
    variants        = serializers.ListField(child=serializers.JSONField(), write_only=True, required=False)
    existing_images = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False,
        help_text="IDs of images to keep when updating",
    )

    class Meta:
        model = Product
        fields = [
            'name', 'description', 'short_description',
            'sme', 'agent', 'category_ids',
            'base_price', 'selling_price', 'discount_percentage', 'commission_rate',
            'commission_type',
            'sku', 'barcode', 'stock_quantity', 'low_stock_threshold',
            # Delivery / PAXI
            'length_cm', 'width_cm', 'height_cm', 'weight_kg',
            'is_foldable',
            'featured_image', 'images', 'existing_images',
            'attributes', 'variants',
            'meta_title', 'meta_description', 'meta_keywords',
        ]

    # ---- delivery field validators ----------------------------------------

    def validate_length_cm(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Length must be greater than 0")
        return value
 
    def validate_width_cm(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Width must be greater than 0")
        return value
    
    def validate_height_cm(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Height must be greater than 0")
        return value
    
    def validate_weight_kg(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Weight must be greater than 0")
        return value
 

    def validate_commission_type(self, value):
        if value and value not in COMMISSION_RATES:
            raise serializers.ValidationError(
                f"Must be one of: {', '.join(COMMISSION_RATES.keys())}"
            )
        return value

    def validate(self, data):
        is_foldable = data.get('is_foldable', getattr(self.instance, 'is_foldable', False))

        # Dimensions required only when item is not foldable
        if not is_foldable:
            required_fields = ['length_cm', 'width_cm', 'height_cm', 'weight_kg']
            for field in required_fields:
                if data.get(field) is None:
                    raise serializers.ValidationError({field: f'{field} is required'})

        base_price    = data.get('base_price',    getattr(self.instance, 'base_price', 0))
        selling_price = data.get('selling_price')

        if selling_price and selling_price > base_price:
            raise serializers.ValidationError(
                {'selling_price': 'Selling price cannot be higher than base price'}
            )

        discount = data.get('discount_percentage', 0)
        if discount > 0 and not selling_price:
            data['selling_price'] = round(base_price * (1 - discount / 100), 2)

        return data

    # ---- existing validators (unchanged) -----------------------------------

    def validate_category_ids(self, value):
        from categories.models import Category
        if not value:
            raise serializers.ValidationError("At least one category is required")
        categories = Category.objects.filter(id__in=value, is_active=True)
        if len(categories) != len(value):
            invalid_ids = set(value) - set(categories.values_list('id', flat=True))
            raise serializers.ValidationError(f"Invalid or inactive category IDs: {list(invalid_ids)}")
        return value

    def validate_base_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Base price must be greater than 0")
        return value

    def validate_selling_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Selling price must be greater than 0")
        return value

    def validate_discount_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Discount percentage must be between 0 and 100")
        return value

    def validate_commission_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("Commission rate cannot be negative")
        return value

    def validate_sku(self, value):
        if value:
            instance = getattr(self, 'instance', None)
            queryset = Product.objects.filter(sku=value)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Product with this SKU already exists")
        return value

    def validate_attributes(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Attributes must be a JSON object")
        return value

    def validate_variants(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Variants must be a list")
        for variant in value:
            if not isinstance(variant, dict):
                raise serializers.ValidationError("Each variant must be a JSON object")
            if 'name' not in variant:
                raise serializers.ValidationError("Each variant must have a name")
        return value

    def create(self, validated_data):
        request      = self.context.get('request')
        category_ids = validated_data.pop('category_ids', [])
        images_data  = validated_data.pop('images', [])
        attributes_data = validated_data.pop('attributes', {})
        variants_data   = validated_data.pop('variants', [])
        validated_data['status']    = 'draft'
        validated_data['is_active'] = False
        if request and request.user:
            validated_data['created_by'] = request.user
        if 'name' in validated_data:
            base_slug = slugify(validated_data['name'])
            slug, counter = base_slug, 1
            while Product.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        product = Product.objects.create(**validated_data)
        if category_ids:
            product.categories.set(category_ids)
        for index, image in enumerate(images_data):
            ProductImage.objects.create(product=product, image=image, order=index, is_featured=index == 0)
        if attributes_data and product.categories.exists():
            for attr_id, value in attributes_data.items():
                try:
                    attribute = CategoryAttribute.objects.get(id=int(attr_id), category__in=product.categories.all())
                    ProductAttribute.objects.create(product=product, attribute=attribute, value=value)
                except CategoryAttribute.DoesNotExist:
                    pass
        for variant_data in variants_data:
            ProductVariant.objects.create(product=product, **variant_data)
        return product

    def update(self, instance, validated_data):
        category_ids    = validated_data.pop('category_ids', None)
        images_data     = validated_data.pop('images', [])
        existing_images = validated_data.pop('existing_images', [])
        attributes_data = validated_data.pop('attributes', None)
        variants_data   = validated_data.pop('variants', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if 'name' in validated_data and validated_data['name'] != instance.name:
            base_slug = slugify(validated_data['name'])
            slug, counter = base_slug, 1
            while Product.objects.filter(slug=slug).exclude(pk=instance.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            instance.slug = slug
        instance.save()
        if category_ids is not None:
            instance.categories.set(category_ids)
        if existing_images is not None:
            instance.images.exclude(id__in=existing_images).delete()
        for index, image in enumerate(images_data):
            ProductImage.objects.create(product=instance, image=image, order=instance.images.count() + index)
        if attributes_data is not None:
            instance.attributes.all().delete()
            for attr_id, value in attributes_data.items():
                try:
                    attribute = CategoryAttribute.objects.get(id=attr_id)
                    ProductAttribute.objects.create(product=instance, attribute=attribute, value=value)
                except CategoryAttribute.DoesNotExist:
                    pass
        if variants_data is not None:
            instance.variants.all().delete()
            for variant_data in variants_data:
                ProductVariant.objects.create(product=instance, **variant_data)
        return instance


# ============= PRODUCT STATUS UPDATE SERIALIZER =============

class ProductStatusUpdateSerializer(serializers.ModelSerializer):
    rejection_reason = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = ['status', 'is_active', 'rejection_reason']
        extra_kwargs = {'status': {'required': False}, 'is_active': {'required': False}}

    def validate_status(self, value):
        valid_statuses = ['draft', 'pending', 'active', 'inactive', 'rejected']
        if value not in valid_statuses:
            raise serializers.ValidationError(f"Status must be one of: {', '.join(valid_statuses)}")
        return value

    def update(self, instance, validated_data):
        request    = self.context.get('request')
        old_status = instance.status
        new_status = validated_data.get('status', old_status)
        if new_status == 'active' and old_status != 'active':
            validated_data['approved_by']  = request.user if request else None
            validated_data['approved_at']  = timezone.now()
            validated_data['published_at'] = timezone.now()
            validated_data['is_active']    = True
        if new_status in ('rejected', 'inactive'):
            validated_data['is_active'] = False
        if new_status == 'active':
            validated_data['is_active'] = True
        return super().update(instance, validated_data)


# ============= BULK ACTION SERIALIZER =============

class ProductBulkActionSerializer(serializers.Serializer):
    product_ids = serializers.ListField(child=serializers.IntegerField(), required=True)
    action      = serializers.ChoiceField(choices=['activate', 'deactivate', 'delete', 'pending'], required=True)

    def validate_product_ids(self, value):
        if not value:
            raise serializers.ValidationError("No product IDs provided")
        products = Product.objects.filter(id__in=value)
        if len(products) != len(value):
            invalid_ids = set(value) - set(products.values_list('id', flat=True))
            raise serializers.ValidationError(f"Products not found: {list(invalid_ids)}")
        return value


# ============= INVENTORY SERIALIZERS =============

class InventoryUpdateSerializer(serializers.Serializer):
    stock_quantity      = serializers.IntegerField(min_value=0)
    low_stock_threshold = serializers.IntegerField(min_value=1, required=False)

    def validate_stock_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock quantity cannot be negative")
        return value


class StockAdjustmentSerializer(serializers.Serializer):
    ADJUSTMENT_TYPES = (
        ('add',    'Add Stock'),
        ('remove', 'Remove Stock'),
        ('set',    'Set Stock'),
    )
    adjustment_type = serializers.ChoiceField(choices=ADJUSTMENT_TYPES)
    quantity        = serializers.IntegerField()
    reason          = serializers.CharField(max_length=255, required=False)

    def validate(self, data):
        if data['adjustment_type'] in ('add', 'remove') and data['quantity'] <= 0:
            raise serializers.ValidationError(
                f"Quantity must be positive for {data['adjustment_type']} adjustment"
            )
        return data


# ============= EXPORT SERIALIZER =============

class ProductExportSerializer(serializers.ModelSerializer):
    sme_name               = serializers.CharField(source='sme.business_name')
    agent_name             = serializers.CharField(source='agent.user.full_name', default='')
    categories             = serializers.SerializerMethodField()
    final_price            = serializers.SerializerMethodField()
    commission_amount      = serializers.SerializerMethodField()
    net_payout             = serializers.SerializerMethodField()
    image_count            = serializers.SerializerMethodField()
    review_count           = serializers.SerializerMethodField()
    average_rating         = serializers.SerializerMethodField()
    volume_cm3             = serializers.IntegerField(read_only=True)
    delivery_size_category = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'barcode',
            'sme_name', 'agent_name', 'categories',
            'base_price', 'selling_price', 'discount_percentage', 'final_price',
            'commission_rate', 'commission_type', 'commission_amount', 'net_payout',
            'stock_quantity', 'low_stock_threshold',
            # Delivery / PAXI
            'length_cm', 'width_cm', 'height_cm', 'weight_kg',
            'is_foldable',
            'volume_cm3', 'delivery_size_category',
            'status', 'is_active', 'is_featured',
            'image_count', 'review_count', 'average_rating',
            'created_at', 'updated_at', 'published_at',
        ]

    def get_categories(self, obj):
        return ', '.join([cat.name for cat in obj.categories.all()])

    def get_final_price(self, obj):
        return float(obj.get_final_price())

    def get_commission_amount(self, obj):
        return obj.commission_amount

    def get_net_payout(self, obj):
        return obj.net_payout

    def get_image_count(self, obj):
        return obj.images.count()

    def get_review_count(self, obj):
        return obj.reviews.filter(is_approved=True).count()

    def get_average_rating(self, obj):
        reviews = obj.reviews.filter(is_approved=True)
        if reviews.exists():
            return round(reviews.aggregate(Avg('rating'))['rating__avg'], 1)
        return 0


# ============= DASHBOARD STATS SERIALIZERS =============

class ProductStatsSerializer(serializers.Serializer):
    total_products   = serializers.IntegerField()
    active_products  = serializers.IntegerField()
    pending_products = serializers.IntegerField()
    draft_products   = serializers.IntegerField()
    rejected_products = serializers.IntegerField()
    out_of_stock     = serializers.IntegerField()
    low_stock        = serializers.IntegerField()
    total_value      = serializers.DecimalField(max_digits=15, decimal_places=2)
    average_price    = serializers.DecimalField(max_digits=10, decimal_places=2)
    top_categories   = serializers.ListField(child=serializers.DictField())
    recent_products  = ProductListSerializer(many=True)


class AgentProductStatsSerializer(serializers.Serializer):
    total_products  = serializers.IntegerField()
    pending_approval = serializers.IntegerField()
    approved        = serializers.IntegerField()
    rejected        = serializers.IntegerField()
    by_sme          = serializers.ListField(child=serializers.DictField())