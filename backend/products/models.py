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
    ('small_items',      'Small Items (Clothing, accessories, jewellery)'),
    ('medium_items',     'Medium Items (Boxed goods, shoes, electronics)'),
    ('large_bulky',      'Large / Bulky Items (Furniture, bulk food, appliances)'),
    ('perishable_food',  'Perishable Food (Fresh produce, dairy, meat, bakery)'),
)

URGENCY_LEVEL_CHOICES = (
    ('standard', 'Standard'),
    ('priority', 'Priority (+R5)'),
    ('express',  'Express (+R15)'),
)

# Base flat-rand commission per category
COMMISSION_BASE = {
    'small_items':     5,
    'medium_items':    10,
    'large_bulky':     20,
    'perishable_food': 10,
}

# Urgency surcharges (only applied to perishable_food)
URGENCY_SURCHARGE = {
    'standard': 0,
    'priority': 5,
    'express':  15,
}


def calculate_commission_rate(commission_type: str, urgency_level: str = 'standard') -> int:
    """
    Return the flat-rand commission amount for a given commission_type
    and (optional) urgency_level.

    This is the canonical calculation used by both the model and the API view,
    so frontend and backend always agree.

    Examples
    --------
    >>> calculate_commission_rate('small_items')
    5
    >>> calculate_commission_rate('perishable_food', 'express')
    25
    """
    base = COMMISSION_BASE.get(commission_type, 0)
    surcharge = 0
    if commission_type == 'perishable_food':
        surcharge = URGENCY_SURCHARGE.get(urgency_level, 0)
    return base + surcharge


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

    PACKAGING_OVERRIDE_CHOICES = (
        ('none',   'None (use dimensional logic)'),
        ('small',  'Always Small'),
        ('medium', 'Always Medium'),
        ('large',  'Always Large'),
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

    # commission_rate stores the FLAT RAND AMOUNT (e.g. 5, 10, 20).
    # Legacy rows created before the commission_type system will have the old
    # percentage value; new rows always have a flat-rand value derived from
    # commission_type + urgency_level via calculate_commission_rate().
    commission_rate = models.DecimalField(max_digits=8, decimal_places=2, default=10)

    # ── NEW: Commission category & urgency ────────────────────────────────────
    # commission_type drives the flat-rand commission amount.
    # urgency_level adds a surcharge for perishable_food products only.
    commission_type = models.CharField(
        max_length=30,
        choices=COMMISSION_TYPE_CHOICES,
        blank=True,
        default='',
        help_text='Category that determines the flat-rand commission fee.',
    )
    urgency_level = models.CharField(
        max_length=20,
        choices=URGENCY_LEVEL_CHOICES,
        default='standard',
        help_text='Delivery urgency — only affects perishable_food commission.',
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

    # Packaging behaviour
    is_foldable = models.BooleanField(
        default=False,
        help_text=(
            'Tick for clothing, fabric, or other soft items that can be '
            'folded/compressed into a small parcel. '
            'Forces delivery_size_category to SMALL unless packaging_override is set.'
        ),
    )
    packaging_override = models.CharField(
        max_length=10,
        choices=PACKAGING_OVERRIDE_CHOICES,
        default='none',
        help_text=(
            'Pin a specific PAXI size category, ignoring both dimensions and '
            'the foldable flag. Leave as "none" to use automatic logic.'
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
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)
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
            models.Index(fields=['commission_type']),  # new
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

        # Derive commission_rate from commission_type when type is set.
        # This keeps the stored number consistent with the category rules.
        if self.commission_type:
            self.commission_rate = calculate_commission_rate(
                self.commission_type, self.urgency_level
            )

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
          1. packaging_override (explicit pin — always wins)
          2. is_foldable flag   (soft items → always SMALL)
          3. Dimensional thresholds
        """
        if self.packaging_override != 'none':
            return self.packaging_override.upper()
        if self.is_foldable:
            return 'SMALL'
        if self.volume_cm3 <= 3_000 and self.weight_kg <= 5:
            return 'SMALL'
        if self.volume_cm3 <= 8_000 and self.weight_kg <= 10:
            return 'MEDIUM'
        return 'LARGE'

    @property
    def commission_amount(self):
        """
        Flat-rand commission on this product's selling price.
        commission_rate IS the flat-rand amount (e.g. R10), not a percentage.
        """
        return self.commission_rate

    @property
    def net_payout(self):
        """Seller payout after commission deduction."""
        price = self.selling_price or self.base_price
        return price - self.commission_rate

    def get_final_price(self):
        return self.selling_price or self.base_price

    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold


# ── Unchanged supporting models ───────────────────────────────────────────────

class ProductImage(models.Model):
    product  = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image    = models.ImageField(upload_to='products/')
    alt_text = models.CharField(max_length=255, blank=True, null=True)
    is_featured = models.BooleanField(default=False)
    order    = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

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
        db_table = 'product_attributes'
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
        db_table       = 'product_reviews'
        ordering       = ['-created_at']
        unique_together = ['product', 'user']

    def __str__(self):
        return f"{self.user.email} - {self.product.name} - {self.rating}★"