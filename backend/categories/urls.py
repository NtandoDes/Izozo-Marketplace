from django.urls import path
from .views import (
    CategoryListView, CategoryDetailView, CategoryTreeView,
    CategoryAttributesView, AdminCategoryCreateView, AdminCategoryUpdateView
)

urlpatterns = [
    # Public endpoints
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('categories/tree/', CategoryTreeView.as_view(), name='category-tree'),
    path('categories/<slug:slug>/', CategoryDetailView.as_view(), name='category-detail'),
    path('categories/<int:category_id>/attributes/', CategoryAttributesView.as_view(), name='category-attributes'),
    
    # Admin endpoints
    path('admin/categories/create/', AdminCategoryCreateView.as_view(), name='admin-category-create'),
    path('admin/categories/<int:pk>/update/', AdminCategoryUpdateView.as_view(), name='admin-category-update'),
]