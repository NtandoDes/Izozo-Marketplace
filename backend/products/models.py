from django.db import models
from django.conf import settings
from django.utils import timezone
from categories.models import Category
import uuid
from django.utils.text import slugify


# ---------------------------------------------------------------------------
# Commission lookup — single source of truth shared by model + view logic
# ---------------------------------------------------------------------------

COMMISSION_TYPE_CHOICES = (
    ('hair_cosmetics',        'Hair, Hair Products and Cosmetics'),
    ('clothing',              'Clothing'),
    ('shoes',                 'Shoes'),
    ('fragrances',            'Fragrances'),
    ('local_handmade',        'Local Handmade Products'),
    ('cleaning_products',     'Cleaning Products (SABS)'),
)

# Commission as a PERCENTAGE of selling price
COMMISSION_RATES = {
    'hair_cosmetics':     12,
    'clothing':            5,
    'shoes':              10,
    'fragrances':         12,
    'local_handmade':     15,
    'cleaning_products':   8,
}

# Categories where items are foldable/soft by nature (auto-tick foldable)
FOLDABLE_CATEGORIES = {'clothing', 'hair_cosmetics'}


def calculate_commission_rate(commission_type: str) -> int:
    """
    Return the percentage commission rate for a given commission_type.

    Examples
    --------
    >>> calculate_commission_rate('clothing')
    5
    >>> calculate_commission_rate('local_handmade')
    15
    """
    return COMMISSION_RATES.get(commission_type, 0)


# ---------------------------------------------------------------------------
# Product model
# ---------------------------------------------------------------------------

class Product(models.Model):
    STATUS_CHOICES = (
        ('draft',    'Draft'),
        ('pending',  'Pending Approval'),
        ('active',   'Active'),
        ('inactive', 'Inactive'),
        ('rejected', 'Rejected'),
    )

    # ── Core ─────────────────────────────────────────────────────────────────
    name              = models.CharField(max_length=255)
    slug              = models.SlugField(max_length=255, blank=True)
    description       = models.TextField()
    short_description = models.CharField(max_length=500, blank=True, null=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    sme = models.ForeignKey(
        'smes.SMEProfile', on_delete=models.CASCADE, related_name='products'
    )
    agent = models.ForeignKey(
        'agents.AgentProfile', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_products'
    )
    categories = models.ManyToManyField(Category, related_name='products')

    # ── Pricing ───────────────────────────────────────────────────────────────
    base_price          = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price       = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # commission_rate stores the PERCENTAGE (e.g. 5 means 5%).
    # The rand amount is derived at runtime via the commission_amount property.
    commission_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # commission_type drives the percentage commission rate.
    commission_type = models.CharField(
        max_length=30,
        choices=COMMISSION_TYPE_CHOICES,
        blank=True,
        default='',
        help_text='Category that determines the commission percentage.',
    )

    # ── Inventory ────────────────────────────────────────────────────────────
    sku                 = models.CharField(max_length=100, unique=True, blank=True, null=True)
    barcode             = models.CharField(max_length=100, blank=True, null=True)
    stock_quantity      = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)

    # ── Delivery sizing (PAXI / courier) ──────────────────────────────────────
    length_cm = models.PositiveIntegerField()
    width_cm  = models.PositiveIntegerField()
    height_cm = models.PositiveIntegerField()
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2)

    # Foldable flag — for clothing, hair products, and other soft/compressible
    # items that always ship as a SMALL parcel regardless of unfolded dimensions.
    is_foldable = models.BooleanField(
        default=False,
        help_text=(
            'Tick for clothing, fabric, hair products, or other soft items '
            'that can be folded/compressed into a small parcel. '
            'Forces delivery_size_category to SMALL.'
        ),
    )

    # ── Media ────────────────────────────────────────────────────────────────
    featured_image = models.ImageField(upload_to='products/featured/', blank=True, null=True)

    # ── Status ───────────────────────────────────────────────────────────────
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_featured = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=False)

    # ── SEO ──────────────────────────────────────────────────────────────────
    meta_title       = models.CharField(max_length=255, blank=True, null=True)
    meta_description = models.TextField(blank=True, null=True)
    meta_keywords    = models.CharField(max_length=255, blank=True, null=True)

    # ── Timestamps ───────────────────────────────────────────────────────────
    created_at   = models.DateTimeField(default=timezone.now)
    updated_at   = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(blank=True, null=True)

    # ── Tracking ─────────────────────────────────────────────────────────────
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='products_created',
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='products_approved',
    )
    approved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'products'
        ordering  = ['-created_at']
        indexes   = [
            models.Index(fields=['sme', 'status']),
            models.Index(fields=['agent', 'created_at']),
            models.Index(fields=['slug']),
            models.Index(fields=['commission_type']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Auto slug
        if not self.slug:
            base_slug = slugify(self.name)
            slug, counter = base_slug, 1
            while Product.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug

        # Auto SKU
        if not self.sku:
            while True:
                candidate = f"SKU-{uuid.uuid4().hex[:8].upper()}"
                if not Product.objects.filter(sku=candidate).exists():
                    self.sku = candidate
                    break

        # Derive commission_rate (percentage) from commission_type.
        if self.commission_type:
            self.commission_rate = calculate_commission_rate(self.commission_type)

        # Auto-tick foldable for naturally soft categories.
        if self.commission_type in FOLDABLE_CATEGORIES:
            self.is_foldable = True

        # Selling price auto-calculation
        if not self.selling_price and self.discount_percentage > 0:
            self.selling_price = self.base_price - (self.discount_percentage / 100) * self.base_price
        elif not self.selling_price:
            self.selling_price = self.base_price

        super().save(*args, **kwargs)

    # ── Properties ───────────────────────────────────────────────────────────

    @property
    def volume_cm3(self):
        return self.length_cm * self.width_cm * self.height_cm

    @property
    def delivery_size_category(self):
        """
        PAXI size category. Priority order:
          1. is_foldable flag  → always SMALL
          2. Dimensional thresholds
        """
        if self.is_foldable:
            return 'SMALL'
        if self.volume_cm3 <= 3_000 and self.weight_kg <= 5:
            return 'SMALL'
        if self.volume_cm3 <= 8_000 and self.weight_kg <= 10:
            return 'LARGE'
        return 'LARGE'

    @property
    def commission_amount(self):
        """
        Commission charged on this product's selling price.
        commission_rate is a PERCENTAGE, so we derive the rand amount here.
        """
        price = float(self.selling_price or self.base_price)
        return round(price * float(self.commission_rate) / 100, 2)

    @property
    def net_payout(self):
        """Seller payout after commission deduction."""
        price = float(self.selling_price or self.base_price)
        return round(price - self.commission_amount, 2)

    def get_final_price(self):
        return self.selling_price or self.base_price

    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold


# ── Unchanged supporting models ───────────────────────────────────────────────

class ProductImage(models.Model):
    product     = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image       = models.ImageField(upload_to='products/')
    alt_text    = models.CharField(max_length=255, blank=True, null=True)
    is_featured = models.BooleanField(default=False)
    order       = models.PositiveIntegerField(default=0)
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'product_images'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Image for {self.product.name}"


class ProductVariant(models.Model):
    product          = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    name             = models.CharField(max_length=100)
    sku              = models.CharField(max_length=100, blank=True, null=True)
    price_adjustment = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_quantity   = models.PositiveIntegerField(default=0)
    image            = models.ImageField(upload_to='products/variants/', blank=True, null=True)
    attributes       = models.JSONField(default=dict)
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'product_variants'
        ordering = ['name']

    def __str__(self):
        return f"{self.product.name} - {self.name}"


class ProductAttribute(models.Model):
    product    = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='attributes')
    attribute  = models.ForeignKey('categories.CategoryAttribute', on_delete=models.CASCADE)
    value      = models.JSONField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'product_attributes'
        unique_together = ['product', 'attribute']

    def __str__(self):
        return f"{self.product.name} - {self.attribute.name}: {self.value}"


class ProductReview(models.Model):
    RATING_CHOICES = ((1,'1 Star'),(2,'2 Stars'),(3,'3 Stars'),(4,'4 Stars'),(5,'5 Stars'))

    product              = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user                 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating               = models.PositiveSmallIntegerField(choices=RATING_CHOICES)
    title                = models.CharField(max_length=255, blank=True, null=True)
    comment              = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    is_approved          = models.BooleanField(default=False)
    created_at           = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table        = 'product_reviews'
        ordering        = ['-created_at']
        unique_together = ['product', 'user']

    def __str__(self):
        return f"{self.user.email} - {self.product.name} - {self.rating}★"