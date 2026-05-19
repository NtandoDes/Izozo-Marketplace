from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.generics import ListAPIView, RetrieveAPIView
from django.db.models import Count, Q
from .models import Category, CategoryAttribute
from .serializers import CategorySerializer, CategoryCreateUpdateSerializer, CategoryAttributeSerializer

class CategoryListView(ListAPIView):
    """List all active categories"""
    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_active=True)


class CategoryDetailView(RetrieveAPIView):
    """Get single category details"""
    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_active=True)
    lookup_field = 'slug'


class CategoryTreeView(APIView):
    """Get category tree (parent categories only)"""
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        parent_categories = Category.objects.filter(
            parent__isnull=True, 
            is_active=True
        ).order_by('order', 'name')
        
        serializer = CategorySerializer(parent_categories, many=True)
        return Response(serializer.data)


class CategoryAttributesView(APIView):
    """Get attributes for a specific category"""
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request, category_id):
        try:
            category = Category.objects.get(id=category_id, is_active=True)
            attributes = category.attributes.filter(is_active=True).order_by('order')
            serializer = CategoryAttributeSerializer(attributes, many=True)
            return Response(serializer.data)
        except Category.DoesNotExist:
            return Response(
                {'error': 'Category not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


# Admin endpoints (protected)
class AdminCategoryCreateView(APIView):
    """Create new category (admin only)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Check if user is admin
        if request.user.role != 'admin':
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CategoryCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            category = serializer.save()
            return Response(
                CategorySerializer(category).data, 
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminCategoryUpdateView(APIView):
    """Update category (admin only)"""
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Admin access required'}, 
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            category = Category.objects.get(pk=pk)
            serializer = CategoryCreateUpdateSerializer(category, data=request.data, partial=True)
            if serializer.is_valid():
                category = serializer.save()
                return Response(CategorySerializer(category).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Category.DoesNotExist:
            return Response(
                {'error': 'Category not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )