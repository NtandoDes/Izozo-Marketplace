from django.db import models
from django.utils import timezone
from django.utils.text import slugify

class Category(models.Model):
    """
    Product categories with hierarchical structure
    """
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='subcategories'
    )
    icon = models.CharField(max_length=50, blank=True, null=True, help_text="Font Awesome icon class")
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'categories'
        ordering = ['order', 'name']
        verbose_name_plural = 'Categories'

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} > {self.name}"
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def get_full_path(self):
        """Get full category path"""
        if self.parent:
            return f"{self.parent.get_full_path()} > {self.name}"
        return self.name


class CategoryAttribute(models.Model):
    """
    Attributes/fields that products in this category should have
    """
    ATTRIBUTE_TYPES = (
        ('text', 'Text'),
        ('number', 'Number'),
        ('boolean', 'Yes/No'),
        ('select', 'Dropdown'),
        ('multiselect', 'Multi Select'),
        ('color', 'Color'),
        ('size', 'Size'),
    )

    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='attributes')
    name = models.CharField(max_length=100)
    attribute_type = models.CharField(max_length=20, choices=ATTRIBUTE_TYPES, default='text')
    required = models.BooleanField(default=False)
    options = models.JSONField(blank=True, null=True, help_text="JSON array of options for select/multiselect types")
    unit = models.CharField(max_length=50, blank=True, null=True, help_text="e.g., kg, cm, ml")
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'category_attributes'
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.category.name} - {self.name}"