from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, Count, Avg
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Product, ProductImage, ProductVariant, ProductAttribute, ProductReview, COMMISSION_RATES
from .serializers import (
    ProductListSerializer, ProductDetailSerializer,
    ProductCreateUpdateSerializer, ProductStatusUpdateSerializer,
    ProductReviewSerializer, ProductDeliverySerializer,
)
from agents.models import AgentProfile, AgentSMEAssignment
from smes.models import SMEProfile
from categories.models import Category, CategoryAttribute
import json
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DELIVERY_FIELDS = ('length_cm', 'width_cm', 'height_cm', 'weight_kg')


def _parse_delivery_fields(request_data, errors: dict) -> dict:
    """
    Extract and validate the four PAXI sizing fields from request.data.
    Appends to *errors* dict on failure.
    """
    result = {}

    for field in ('length_cm', 'width_cm', 'height_cm'):
        raw = request_data.get(field)
        if raw is None:
            errors[field] = f'{field} is required'
            continue
        try:
            val = int(raw)
            if val <= 0:
                raise ValueError
            result[field] = val
        except (ValueError, TypeError):
            errors[field] = f'{field} must be a positive integer'

    raw = request_data.get('weight_kg')
    if raw is None:
        errors['weight_kg'] = 'weight_kg is required'
    else:
        try:
            val = Decimal(str(raw))
            if val <= 0:
                raise ValueError
            result['weight_kg'] = val
        except (ValueError, TypeError, Exception):
            errors['weight_kg'] = 'weight_kg must be a positive number'

    return result


def _parse_product_fields(request_data):
    """
    Parse and validate common product fields for both SME and Agent creation views.
    Returns (data_dict, errors_dict).
    """
    errors = {}
    data   = {}

    # --- Required text fields ---
    for field in ('name', 'description'):
        val = request_data.get(field)
        if not val:
            errors[field] = f'{field.replace("_", " ").capitalize()} is required'
        else:
            data[field] = val

    data['short_description'] = request_data.get('short_description', '')

    # --- base_price ---
    raw_price = request_data.get('base_price')
    if not raw_price:
        errors['base_price'] = 'Base price is required'
    else:
        try:
            bp = Decimal(str(raw_price))
            if bp <= 0:
                raise ValueError
            data['base_price'] = bp
        except (ValueError, TypeError, Exception):
            errors['base_price'] = 'Base price must be a positive number'

    # --- Optional price fields ---
    for field, default in (
        ('selling_price',       None),
        ('discount_percentage', Decimal('0')),
    ):
        raw = request_data.get(field)
        if raw is not None and raw != '':
            try:
                data[field] = Decimal(str(raw))
            except (ValueError, TypeError, Exception):
                errors[field] = f'Invalid {field.replace("_", " ")} format'
        elif default is not None:
            data[field] = default

    # --- Commission type (drives the percentage rate) ---
    commission_type = request_data.get('commission_type', '')
    if commission_type:
        if commission_type not in COMMISSION_RATES:
            errors['commission_type'] = f'Must be one of: {", ".join(COMMISSION_RATES.keys())}'
        else:
            data['commission_type'] = commission_type
            data['commission_rate'] = Decimal(str(COMMISSION_RATES[commission_type]))
    else:
        raw_rate = request_data.get('commission_rate')
        if raw_rate is not None and raw_rate != '':
            try:
                data['commission_rate'] = Decimal(str(raw_rate))
            except (ValueError, TypeError, Exception):
                errors['commission_rate'] = 'Invalid commission_rate format'
        else:
            data['commission_rate'] = Decimal('0')

    # --- Inventory ---
    for field, default in (('stock_quantity', 0), ('low_stock_threshold', 5)):
        raw = request_data.get(field)
        if raw is not None and raw != '':
            try:
                data[field] = int(raw)
            except (ValueError, TypeError):
                errors[field] = f'Invalid {field.replace("_", " ")} format'
        else:
            data[field] = default

    data['sku']     = request_data.get('sku', '')
    data['barcode'] = request_data.get('barcode', '')

    # --- Foldable flag ---
    raw_foldable = request_data.get('is_foldable', 'false')
    if isinstance(raw_foldable, bool):
        data['is_foldable'] = raw_foldable
    else:
        data['is_foldable'] = str(raw_foldable).lower() in ('true', '1', 'yes')

    # --- Dimensions: required only when not foldable ---
    if not data['is_foldable']:
        delivery_errors = {}
        delivery_data   = _parse_delivery_fields(request_data, delivery_errors)
        errors.update(delivery_errors)
        data.update(delivery_data)
    else:
        data['length_cm'] = None
        data['width_cm']  = None
        data['height_cm'] = None
        raw_weight = request_data.get('weight_kg')
        if raw_weight is not None and raw_weight != '':
            try:
                w = Decimal(str(raw_weight))
                data['weight_kg'] = w if w > 0 else None
            except Exception:
                data['weight_kg'] = None
        else:
            data['weight_kg'] = None

    return data, errors


def _parse_category_ids(request_data):
    """
    Extract category_ids from multipart or JSON request data.
    Returns (list_of_ints, error_string_or_None).
    """
    category_ids = []

    if request_data.getlist('category_ids'):
        try:
            category_ids = [
                int(cid) for cid in request_data.getlist('category_ids') if str(cid).strip()
            ]
        except (ValueError, TypeError) as e:
            return [], f'category_ids must be integers: {e}'
    elif request_data.get('category_ids'):
        cat_ids_str = request_data.get('category_ids')
        try:
            if isinstance(cat_ids_str, str):
                if ',' in cat_ids_str:
                    category_ids = [int(c.strip()) for c in cat_ids_str.split(',') if c.strip()]
                else:
                    category_ids = [int(cat_ids_str)]
            else:
                category_ids = [int(cat_ids_str)]
        except (ValueError, TypeError) as e:
            return [], f'category_ids must be integers: {e}'

    if not category_ids:
        return [], 'At least one category is required'

    return category_ids, None


def _validate_categories(category_ids):
    """
    Confirm every id in category_ids maps to an active Category.
    Returns (queryset, error_string_or_None).
    """
    categories = Category.objects.filter(id__in=category_ids, is_active=True)
    if len(categories) != len(category_ids):
        found_ids = set(categories.values_list('id', flat=True))
        invalid   = set(category_ids) - found_ids
        return None, f'Invalid or inactive category IDs: {list(invalid)}'
    return categories, None


def _attach_images_and_related(product, request, attributes_data, variants_data, category_ids):
    """Shared post-create step: attach images, attributes, variants."""
    if 'featured_image' in request.FILES:
        product.featured_image = request.FILES['featured_image']
        product.save()

    if 'images' in request.FILES:
        for index, image in enumerate(request.FILES.getlist('images')):
            ProductImage.objects.create(
                product=product,
                image=image,
                order=index,
                alt_text=f"{product.name} - Image {index + 1}",
                is_featured=(index == 0 and not product.featured_image),
            )

    if attributes_data and category_ids:
        for attr_id, value in attributes_data.items():
            try:
                attr_id_int = int(attr_id)
                attribute   = CategoryAttribute.objects.filter(
                    id=attr_id_int, category_id__in=category_ids, is_active=True,
                ).first()
                if attribute:
                    if attribute.attribute_type == 'number':
                        try:
                            value = float(value)
                        except (ValueError, TypeError):
                            value = 0
                    elif attribute.attribute_type == 'boolean':
                        if isinstance(value, str):
                            value = value.lower() in ('true', '1', 'yes', 'on')
                    ProductAttribute.objects.create(product=product, attribute=attribute, value=value)
            except (ValueError, TypeError) as e:
                logger.error(f"Error creating attribute {attr_id}: {e}")

    for variant_data in variants_data:
        try:
            variant_name = variant_data.get('name', '')
            if variant_name:
                price_adj = Decimal('0')
                if variant_data.get('price_adjustment'):
                    try:
                        price_adj = Decimal(str(variant_data['price_adjustment']))
                    except (ValueError, Exception):
                        pass
                variant_stock = 0
                if variant_data.get('stock_quantity'):
                    try:
                        variant_stock = int(variant_data['stock_quantity'])
                    except ValueError:
                        pass
                ProductVariant.objects.create(
                    product=product,
                    name=variant_name,
                    sku=variant_data.get('sku', ''),
                    price_adjustment=price_adj,
                    stock_quantity=variant_stock,
                    attributes=variant_data.get('attributes', {}),
                    is_active=variant_data.get('is_active', True),
                )
        except Exception as e:
            logger.error(f"Error creating variant: {e}")


# ---------------------------------------------------------------------------
# Cart / order validation helper
# ---------------------------------------------------------------------------

def validate_single_sme_cart(product_ids: list) -> dict:
    """
    Verify that all products in a cart belong to the same SME.
    """
    if not product_ids:
        return {'valid': False, 'sme_id': None, 'conflicting_smes': [], 'message': 'Cart is empty.'}

    sme_ids = list(
        Product.objects.filter(id__in=product_ids, is_active=True)
        .values_list('sme_id', flat=True)
        .distinct()
    )

    if len(sme_ids) == 0:
        return {'valid': False, 'sme_id': None, 'conflicting_smes': [], 'message': 'No active products found for the given IDs.'}

    if len(sme_ids) > 1:
        return {
            'valid': False,
            'sme_id': None,
            'conflicting_smes': sme_ids,
            'message': (
                'Your cart contains products from multiple suppliers. '
                'Each order must contain items from a single supplier only. '
                'Please split your cart and place separate orders.'
            ),
        }

    return {'valid': True, 'sme_id': sme_ids[0], 'conflicting_smes': [], 'message': 'OK'}


# ---------------------------------------------------------------------------
# Agent views
# ---------------------------------------------------------------------------

class AgentProductListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            agent       = AgentProfile.objects.get(user=request.user)
            assignments = AgentSMEAssignment.objects.filter(agent=agent, active=True).values_list('sme_id', flat=True)
            products    = Product.objects.filter(sme_id__in=assignments).order_by('-created_at')

            if status_filter := request.query_params.get('status'):
                products = products.filter(status=status_filter)
            if sme_id := request.query_params.get('sme_id'):
                if int(sme_id) in assignments:
                    products = products.filter(sme_id=sme_id)
            if search := request.query_params.get('search'):
                products = products.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(sku__icontains=search))
            if is_active := request.query_params.get('is_active'):
                products = products.filter(is_active=is_active.lower() == 'true')
            if category_id := request.query_params.get('category_id'):
                products = products.filter(categories__id=category_id)
            if size_category := request.query_params.get('delivery_size_category'):
                products = _filter_by_size_category(products, size_category.upper())
            if limit := request.query_params.get('limit'):
                try:
                    products = products[:int(limit)]
                except ValueError:
                    pass

            return Response(ProductListSerializer(products, many=True, context={'request': request}).data)
        except AgentProfile.DoesNotExist:
            return Response({'error': 'Agent profile not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error in AgentProductListView: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AgentProductCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        try:
            logger.info(f"Agent product creation: data={request.data}, files={request.FILES}")

            try:
                agent = AgentProfile.objects.get(user=request.user)
            except AgentProfile.DoesNotExist:
                return Response({'error': 'Agent profile not found. Please complete your agent profile first.'}, status=status.HTTP_404_NOT_FOUND)

            sme_id = request.data.get('sme_id')
            if not sme_id:
                return Response({'error': 'sme_id is required', 'field': 'sme_id'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                sme_id = int(sme_id)
            except (ValueError, TypeError):
                return Response({'error': 'sme_id must be an integer', 'field': 'sme_id'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                sme = SMEProfile.objects.get(id=sme_id)
            except SMEProfile.DoesNotExist:
                return Response({'error': 'SME not found'}, status=status.HTTP_404_NOT_FOUND)

            if not AgentSMEAssignment.objects.filter(agent=agent, sme_id=sme_id, active=True).exists():
                return Response({'error': 'You are not assigned to this SME'}, status=status.HTTP_403_FORBIDDEN)

            data, errors = _parse_product_fields(request.data)
            if errors:
                return Response(errors, status=status.HTTP_400_BAD_REQUEST)

            category_ids, cat_error = _parse_category_ids(request.data)
            if cat_error:
                return Response({'error': cat_error, 'field': 'category_ids'}, status=status.HTTP_400_BAD_REQUEST)
            _, val_error = _validate_categories(category_ids)
            if val_error:
                return Response({'error': val_error, 'field': 'category_ids'}, status=status.HTTP_400_BAD_REQUEST)

            attributes_data = {}
            if request.data.get('attributes'):
                try:
                    attributes_data = json.loads(request.data.get('attributes', '{}'))
                except json.JSONDecodeError as e:
                    return Response({'error': f'Invalid attributes JSON: {e}', 'field': 'attributes'}, status=status.HTTP_400_BAD_REQUEST)

            variants_data = []
            if request.data.get('variants'):
                try:
                    variants_data = json.loads(request.data.get('variants', '[]'))
                except json.JSONDecodeError as e:
                    return Response({'error': f'Invalid variants JSON: {e}', 'field': 'variants'}, status=status.HTTP_400_BAD_REQUEST)

            is_agent_approved = request.user.status == 'active'

            product = Product.objects.create(
                sme=sme, agent=agent, created_by=request.user,
                status='active' if is_agent_approved else 'pending',
                is_active=is_agent_approved,
                published_at=timezone.now() if is_agent_approved else None,
                approved_by=request.user if is_agent_approved else None,
                approved_at=timezone.now() if is_agent_approved else None,
                **data,
            )
            product.categories.set(category_ids)
            _attach_images_and_related(product, request, attributes_data, variants_data, category_ids)

            logger.info(
                f"Agent product created: id={product.id} name={product.name} "
                f"status={product.status} size={product.delivery_size_category} "
                f"foldable={product.is_foldable} commission_type={product.commission_type} "
                f"commission_rate={product.commission_rate}%"
            )

            serializer = ProductDetailSerializer(product, context={'request': request})
            message = 'Product created and is now active!' if is_agent_approved else 'Product created and pending approval.'
            return Response(
                {'message': message, 'product': serializer.data, 'status': product.status,
                 'is_active': product.is_active, 'delivery_size_category': product.delivery_size_category},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(f"Unexpected error creating agent product: {e}", exc_info=True)
            return Response({'error': f'Failed to create product: {e}'}, status=status.HTTP_400_BAD_REQUEST)


class AgentProductDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, pk, user):
        try:
            product = Product.objects.get(pk=pk)
            if user.role == 'agent':
                agent = AgentProfile.objects.get(user=user)
                if product.agent == agent or AgentSMEAssignment.objects.filter(agent=agent, sme=product.sme, active=True).exists():
                    return product
            elif user.role == 'sme':
                sme = SMEProfile.objects.get(user=user)
                if product.sme == sme:
                    return product
            elif user.role == 'admin':
                return product
            return None
        except (Product.DoesNotExist, AgentProfile.DoesNotExist, SMEProfile.DoesNotExist):
            return None

    def get(self, request, pk):
        product = self.get_object(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or access denied'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProductDetailSerializer(product, context={'request': request}).data)

    def put(self, request, pk):
        product = self.get_object(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or access denied'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'agent' and product.status not in ('draft', 'pending', 'rejected'):
            return Response({'error': 'Cannot edit approved products'}, status=status.HTTP_403_FORBIDDEN)

        for field in ('name', 'description', 'short_description', 'sku', 'barcode'):
            if request.data.get(field) is not None:
                setattr(product, field, request.data.get(field))

        for field in ('base_price', 'selling_price', 'discount_percentage', 'commission_rate'):
            raw = request.data.get(field)
            if raw is not None:
                try:
                    setattr(product, field, Decimal(str(raw)) if raw != '' else None)
                except (ValueError, Exception):
                    pass

        # Update commission_type — rate is re-derived automatically in model.save()
        commission_type = request.data.get('commission_type')
        if commission_type and commission_type in COMMISSION_RATES:
            product.commission_type = commission_type

        for field in ('stock_quantity', 'low_stock_threshold'):
            raw = request.data.get(field)
            if raw is not None:
                try:
                    setattr(product, field, int(raw))
                except (ValueError, TypeError):
                    pass

        # Foldable flag
        raw_foldable = request.data.get('is_foldable')
        if raw_foldable is not None:
            product.is_foldable = raw_foldable if isinstance(raw_foldable, bool) else str(raw_foldable).lower() in ('true', '1', 'yes')

        # Delivery dimensions (only if supplied and item is not foldable)
        if not product.is_foldable and any(request.data.get(f) is not None for f in DELIVERY_FIELDS):
            delivery_errors = {}
            delivery_data   = _parse_delivery_fields(request.data, delivery_errors)
            if delivery_errors:
                return Response(delivery_errors, status=status.HTTP_400_BAD_REQUEST)
            for field, value in delivery_data.items():
                setattr(product, field, value)

        product.save()

        if 'featured_image' in request.FILES:
            product.featured_image = request.FILES['featured_image']
            product.save()

        if request.user.role == 'agent':
            is_approved    = request.user.status == 'active'
            product.status = 'active' if is_approved else 'pending'
            product.is_active = is_approved
            if is_approved:
                product.published_at = timezone.now()
                product.approved_by  = request.user
                product.approved_at  = timezone.now()
            product.save()

        return Response(ProductDetailSerializer(product, context={'request': request}).data)

    def delete(self, request, pk):
        product = self.get_object(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or access denied'}, status=status.HTTP_404_NOT_FOUND)
        product.delete()
        return Response({'message': 'Product deleted successfully'}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# SME views
# ---------------------------------------------------------------------------

class SMEProductListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sme      = SMEProfile.objects.get(user=request.user)
            products = Product.objects.filter(sme=sme).order_by('-created_at')

            if status_filter := request.query_params.get('status'):
                products = products.filter(status=status_filter)
            if agent_id := request.query_params.get('agent_id'):
                products = products.filter(agent_id=agent_id)
            if search := request.query_params.get('search'):
                products = products.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(sku__icontains=search))
            if is_active := request.query_params.get('is_active'):
                products = products.filter(is_active=is_active.lower() == 'true')
            if size_category := request.query_params.get('delivery_size_category'):
                products = _filter_by_size_category(products, size_category.upper())
            if limit := request.query_params.get('limit'):
                try:
                    products = products[:int(limit)]
                except ValueError:
                    pass

            return Response(ProductListSerializer(products, many=True, context={'request': request}).data)
        except SMEProfile.DoesNotExist:
            return Response({'error': 'SME profile not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error in SMEProductListView: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SMEProductCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        try:
            logger.info(f"SME product creation: data={request.data}, files={request.FILES}")

            try:
                sme = SMEProfile.objects.get(user=request.user)
            except SMEProfile.DoesNotExist:
                return Response({'error': 'SME profile not found. Please complete your SME profile first.'}, status=status.HTTP_404_NOT_FOUND)

            data, errors = _parse_product_fields(request.data)
            if errors:
                return Response(errors, status=status.HTTP_400_BAD_REQUEST)

            category_ids, cat_error = _parse_category_ids(request.data)
            if cat_error:
                return Response({'error': cat_error, 'field': 'category_ids'}, status=status.HTTP_400_BAD_REQUEST)
            _, val_error = _validate_categories(category_ids)
            if val_error:
                return Response({'error': val_error, 'field': 'category_ids'}, status=status.HTTP_400_BAD_REQUEST)

            attributes_data = {}
            if request.data.get('attributes'):
                try:
                    attributes_data = json.loads(request.data.get('attributes', '{}'))
                except json.JSONDecodeError as e:
                    return Response({'error': f'Invalid attributes JSON: {e}', 'field': 'attributes'}, status=status.HTTP_400_BAD_REQUEST)

            variants_data = []
            if request.data.get('variants'):
                try:
                    variants_data = json.loads(request.data.get('variants', '[]'))
                except json.JSONDecodeError as e:
                    return Response({'error': f'Invalid variants JSON: {e}', 'field': 'variants'}, status=status.HTTP_400_BAD_REQUEST)

            is_sme_active = request.user.status == 'active'

            product = Product.objects.create(
                sme=sme, agent=None, created_by=request.user,
                status='active' if is_sme_active else 'pending',
                is_active=is_sme_active,
                published_at=timezone.now() if is_sme_active else None,
                approved_by=request.user if is_sme_active else None,
                approved_at=timezone.now() if is_sme_active else None,
                **data,
            )
            product.categories.set(category_ids)
            _attach_images_and_related(product, request, attributes_data, variants_data, category_ids)

            logger.info(
                f"SME product created: id={product.id} name={product.name} "
                f"status={product.status} size={product.delivery_size_category} "
                f"foldable={product.is_foldable} commission_type={product.commission_type} "
                f"commission_rate={product.commission_rate}%"
            )

            serializer = ProductDetailSerializer(product, context={'request': request})
            message = (
                'Product created successfully and is now live!'
                if is_sme_active else
                'Product created and pending admin approval. You will be notified once it goes live.'
            )
            return Response(
                {'message': message, 'product': serializer.data, 'status': product.status,
                 'is_active': product.is_active, 'delivery_size_category': product.delivery_size_category},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(f"Unexpected error creating SME product: {e}", exc_info=True)
            return Response({'error': f'Failed to create product: {e}'}, status=status.HTTP_400_BAD_REQUEST)


class SMEProductDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def _get_sme_product(self, pk, user):
        try:
            product = Product.objects.get(pk=pk)
            if user.role == 'admin':
                return product
            sme = SMEProfile.objects.get(user=user)
            if product.sme == sme:
                return product
            return None
        except (Product.DoesNotExist, SMEProfile.DoesNotExist):
            return None

    def get(self, request, pk):
        product = self._get_sme_product(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or access denied'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProductDetailSerializer(product, context={'request': request}).data)

    def put(self, request, pk):
        product = self._get_sme_product(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or access denied'}, status=status.HTTP_404_NOT_FOUND)

        for field in ('name', 'description', 'short_description', 'sku', 'barcode'):
            if request.data.get(field) is not None:
                setattr(product, field, request.data.get(field))

        for field in ('base_price', 'selling_price', 'discount_percentage', 'commission_rate'):
            raw = request.data.get(field)
            if raw is not None:
                try:
                    setattr(product, field, Decimal(str(raw)) if raw != '' else None)
                except (ValueError, Exception):
                    pass

        # Update commission_type — rate is re-derived automatically in model.save()
        commission_type = request.data.get('commission_type')
        if commission_type and commission_type in COMMISSION_RATES:
            product.commission_type = commission_type

        for field in ('stock_quantity', 'low_stock_threshold'):
            raw = request.data.get(field)
            if raw is not None:
                try:
                    setattr(product, field, int(raw))
                except (ValueError, TypeError):
                    pass

        raw_foldable = request.data.get('is_foldable')
        if raw_foldable is not None:
            product.is_foldable = raw_foldable if isinstance(raw_foldable, bool) else str(raw_foldable).lower() in ('true', '1', 'yes')

        if not product.is_foldable and any(request.data.get(f) is not None for f in DELIVERY_FIELDS):
            delivery_errors = {}
            delivery_data   = _parse_delivery_fields(request.data, delivery_errors)
            if delivery_errors:
                return Response(delivery_errors, status=status.HTTP_400_BAD_REQUEST)
            for field, value in delivery_data.items():
                setattr(product, field, value)

        product.save()

        if 'featured_image' in request.FILES:
            product.featured_image = request.FILES['featured_image']
            product.save()

        return Response(ProductDetailSerializer(product, context={'request': request}).data)

    def delete(self, request, pk):
        product = self._get_sme_product(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or access denied'}, status=status.HTTP_404_NOT_FOUND)
        product.delete()
        return Response({'message': 'Product deleted successfully'}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Shared / public views
# ---------------------------------------------------------------------------

class ProductDeliveryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        user    = request.user
        allowed = False
        if user.role == 'admin':
            allowed = True
        elif user.role == 'sme':
            try:
                allowed = product.sme == SMEProfile.objects.get(user=user)
            except SMEProfile.DoesNotExist:
                pass
        elif user.role == 'agent':
            try:
                agent   = AgentProfile.objects.get(user=user)
                allowed = product.agent == agent or AgentSMEAssignment.objects.filter(agent=agent, sme=product.sme, active=True).exists()
            except AgentProfile.DoesNotExist:
                pass

        if not allowed:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        return Response(ProductDeliverySerializer(product).data)


class ProductStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)

            if request.user.role == 'sme':
                sme = SMEProfile.objects.get(user=request.user)
                if product.sme != sme:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            elif request.user.role != 'admin':
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

            serializer = ProductStatusUpdateSerializer(product, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                updated_product = serializer.save()
                return Response(ProductDetailSerializer(updated_product, context={'request': request}).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        except SMEProfile.DoesNotExist:
            return Response({'error': 'SME profile not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error in ProductStatusUpdateView: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CartSMEValidationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_ids = request.data.get('product_ids', [])
        if not isinstance(product_ids, list):
            return Response({'error': 'product_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        result      = validate_single_sme_cart(product_ids)
        http_status = status.HTTP_200_OK if result['valid'] else status.HTTP_400_BAD_REQUEST
        return Response(result, status=http_status)


class ProductReviewCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        try:
            product = Product.objects.get(pk=product_id, status='active', is_active=True)
            if ProductReview.objects.filter(product=product, user=request.user).exists():
                return Response({'error': 'You have already reviewed this product'}, status=status.HTTP_400_BAD_REQUEST)
            serializer = ProductReviewSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(product=product, user=request.user, is_verified_purchase=False)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)


class PublicProductListView(APIView):
    permission_classes = []

    def get(self, request):
        try:
            queryset = Product.objects.filter(status='active', is_active=True).select_related('sme').prefetch_related('categories')

            if category_id := request.query_params.get('category'):
                queryset = queryset.filter(categories__id=category_id)
            if search := request.query_params.get('search'):
                queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search))
            if min_price := request.query_params.get('min_price'):
                try:
                    queryset = queryset.filter(selling_price__gte=float(min_price))
                except ValueError:
                    pass
            if max_price := request.query_params.get('max_price'):
                try:
                    queryset = queryset.filter(selling_price__lte=float(max_price))
                except ValueError:
                    pass
            if size_category := request.query_params.get('delivery_size_category'):
                queryset = _filter_by_size_category(queryset, size_category.upper())

            sort = request.query_params.get('sort', '-created_at')
            if sort in ('price', '-price', 'created_at', '-created_at', 'name', '-name'):
                if sort == 'price':
                    queryset = queryset.order_by('selling_price')
                elif sort == '-price':
                    queryset = queryset.order_by('-selling_price')
                else:
                    queryset = queryset.order_by(sort)

            try:
                limit  = int(request.query_params.get('limit',  20))
                offset = int(request.query_params.get('offset', 0))
                queryset = queryset[offset:offset + limit]
            except ValueError:
                pass

            return Response(ProductListSerializer(queryset, many=True, context={'request': request}).data)
        except Exception as e:
            logger.error(f"Error in PublicProductListView: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PublicProductDetailView(APIView):
    permission_classes = []

    def get(self, request, slug=None, pk=None):
        try:
            if pk:
                product = Product.objects.get(pk=pk, status='active', is_active=True)
            else:
                product = Product.objects.get(slug=slug, status='active', is_active=True)
            return Response(ProductDetailSerializer(product, context={'request': request}).data)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error in PublicProductDetailView: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PublicStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'activeSMEs':      SMEProfile.objects.filter(user__status='active').count(),
            'verifiedAgents':  AgentProfile.objects.filter(user__status='active').count(),
            'totalProducts':   Product.objects.filter(status='active', is_active=True).count(),
        })


# ---------------------------------------------------------------------------
# Internal ORM helper — filter queryset by PAXI size category
# ---------------------------------------------------------------------------

def _filter_by_size_category(queryset, size_category: str):
    """
    Filter a Product queryset by effective delivery_size_category.
    packaging_override has been removed; only is_foldable and dimensions matter.
    """
    from django.db.models import ExpressionWrapper, IntegerField, F

    valid = ('SMALL', 'LARGE')
    if size_category not in valid:
        return queryset

    # Foldable products are always SMALL
    if size_category == 'SMALL':
        foldable_match = queryset.filter(is_foldable=True)
    else:
        foldable_match = queryset.none()

    # Dimensional logic for non-foldable products
    vol           = F('length_cm') * F('width_cm') * F('height_cm')
    dimensional_qs = queryset.filter(is_foldable=False).annotate(
        _vol=ExpressionWrapper(vol, output_field=IntegerField())
    )

    if size_category == 'SMALL':
        dimensional_match = dimensional_qs.filter(_vol__lte=3000, weight_kg__lte=5)
    else:  # LARGE
        dimensional_match = dimensional_qs.exclude(_vol__lte=3000, weight_kg__lte=5)

    matched_pks = (
        set(foldable_match.values_list('pk', flat=True)) |
        set(dimensional_match.values_list('pk', flat=True))
    )
    return queryset.filter(pk__in=matched_pks)