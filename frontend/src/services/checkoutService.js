// frontend/src/services/checkoutService.js
import { axiosInstance } from '../contexts/AuthContext';

// ============================================================================
// PAXI CONSTANTS
// ============================================================================

export const PAXI_TIERS = {
  SMALL: {
    id: 'paxi_small',
    label: 'PAXI Small Parcel',
    description: 'Compact/foldable items up to 3 000 cm³ and 5 kg',
    maxVolumeCm3: 3000,
    maxWeightKg: 5,
    price: 59,
    estimatedDays: '3–5 business days',
    icon: '📦',
  },
  LARGE: {
    id: 'paxi_large',
    label: 'PAXI Large Parcel',
    description: 'Bulkier or heavier orders up to 8 000 cm³ and 10 kg',
    maxVolumeCm3: 8000,
    maxWeightKg: 10,
    price: 109,
    estimatedDays: '3–5 business days',
    icon: '🚚',
  },
};

// ============================================================================
// REALISTIC COMPRESSED VOLUME LOOKUP
// ============================================================================
//
// Foldable items still occupy space when compressed.
// These are conservative real-world estimates per unit (cm³).
// Used when is_foldable=true (physical dims are null/zero).

const FOLDABLE_COMPRESSED_VOLUME_CM3 = {
  hoodie:      1500,
  jacket:      1800,
  coat:        2000,
  jersey:      1500,
  dress:       1200,
  trouser:     1200,
  jean:        1200,
  pant:        1000,
  skirt:       800,
  shirt:       800,
  blouse:      800,
  top:         600,
  tshirt:      500,
  't-shirt':   500,
  vest:        600,
  underwear:   300,
  legging:     600,
  activewear:  800,
  uniform:     1000,
  weave:       2000,
  wig:         2000,
  hair:        500,
  clothing:    800,   // generic fallback
};

const DEFAULT_FOLDABLE_VOLUME_CM3 = 800;

export function estimateFoldableVolume(item) {
  const name = (item.product_name || item.name || '').toLowerCase();
  for (const [keyword, vol] of Object.entries(FOLDABLE_COMPRESSED_VOLUME_CM3)) {
    if (name.includes(keyword)) return vol;
  }
  // fallback to commission_type
  const ct = (item.commission_type || '').toLowerCase();
  if (ct === 'clothing')       return FOLDABLE_COMPRESSED_VOLUME_CM3.clothing;
  if (ct === 'hair_cosmetics') return 500;
  return DEFAULT_FOLDABLE_VOLUME_CM3;
}

// ============================================================================
// ORDER-LEVEL AGGREGATION
// ============================================================================

/**
 * Compute the PAXI tier for an entire cart.
 *
 * Rules:
 *   Foldable items  → estimateFoldableVolume() × qty  +  weight × qty
 *   Rigid items     → L×W×H × qty                    +  weight × qty
 *
 *   totalVolume ≤ 3 000 cm³  AND  totalWeight ≤ 5 kg  → SMALL
 *   Otherwise                                          → LARGE
 *
 * Examples:
 *   1 hoodie  (1 500 cm³, 0.6 kg) × 1  = 1 500 cm³, 0.6 kg  → SMALL ✓
 *   1 hoodie  (1 500 cm³, 0.6 kg) × 3  = 4 500 cm³, 1.8 kg  → LARGE ✓
 *   10 vests  (  600 cm³, 0.3 kg) × 10 = 6 000 cm³, 3.0 kg  → LARGE ✓
 */
export function computeOrderPaxiTier(items = []) {
  // DEBUG — remove after fix confirmed
  console.log('[PAXI] raw items:', items.map(i => ({
    name:        i.product_name ?? i.name,
    qty:         i.quantity,
    is_foldable: i.is_foldable,
    weight_kg:   i.weight_kg,
    length_cm:   i.length_cm,
    commission_type: i.commission_type,
  })));

  let totalVolumeCm3 = 0;
  let totalWeightKg  = 0;

  const itemBreakdown = items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const p   = item.product || {};

    const length_cm   = Number(item.length_cm   ?? p.length_cm   ?? 0);
    const width_cm    = Number(item.width_cm    ?? p.width_cm    ?? 0);
    const height_cm   = Number(item.height_cm   ?? p.height_cm   ?? 0);
    const weight_kg   = Number(item.weight_kg   ?? p.weight_kg   ?? 0);
    const is_foldable = item.is_foldable ?? p.is_foldable ?? false;

    // Use realistic compressed volume for foldable items,
    // actual L×W×H for rigid items.
    const unitVol = is_foldable
      ? estimateFoldableVolume(item)
      : length_cm * width_cm * height_cm;

    totalVolumeCm3 += unitVol   * qty;
    totalWeightKg  += weight_kg * qty;

    const unitCategory =
      unitVol <= PAXI_TIERS.SMALL.maxVolumeCm3 &&
      weight_kg <= PAXI_TIERS.SMALL.maxWeightKg
        ? 'SMALL' : 'LARGE';

    return {
      product_id:    item.product_id ?? item.id,
      product_name:  item.product_name ?? item.name ?? 'Unknown',
      quantity:      qty,
      unit_vol:      unitVol,
      unit_weight:   weight_kg,
      total_vol:     unitVol   * qty,
      total_weight:  weight_kg * qty,
      is_foldable,
      category:      unitCategory,
      unit_category: unitCategory,
    };
  });

  // Final tier — always check BOTH volume AND weight
  const resolvedCategory =
    totalVolumeCm3 <= PAXI_TIERS.SMALL.maxVolumeCm3 &&
    totalWeightKg  <= PAXI_TIERS.SMALL.maxWeightKg
      ? 'SMALL'
      : 'LARGE';

  console.log(
    '[PAXI] vol:', Math.round(totalVolumeCm3), 'cm³ |',
    'weight:', totalWeightKg.toFixed(2), 'kg |',
    '→', resolvedCategory
  );

  return {
    category: resolvedCategory,
    tier: { ...PAXI_TIERS[resolvedCategory], _key: resolvedCategory },
    totalVolume:  totalVolumeCm3,
    totalWeight:  totalWeightKg,
    itemBreakdown,
  };
}

// ============================================================================
// CHECKOUT SERVICE
// ============================================================================

export const checkoutService = {
  getDeliveryOptions: async (cartItems = []) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const { category, totalVolume, totalWeight, itemBreakdown } =
        computeOrderPaxiTier(cartItems);
      const TIER_ORDER = ['SMALL', 'LARGE'];
      const all = Object.entries(PAXI_TIERS).map(([key, t]) => ({
        ...t, _key: key,
        isRecommended: key === category,
        isDisabled: TIER_ORDER.indexOf(key) < TIER_ORDER.indexOf(category),
      }));
      return {
        recommended: { ...PAXI_TIERS[category], _key: category },
        all, breakdown: itemBreakdown, totalVolume, totalWeight,
      };
    } catch (error) {
      console.error('Error computing delivery options:', error);
      return {
        recommended: { ...PAXI_TIERS.LARGE, _key: 'LARGE' },
        all: Object.entries(PAXI_TIERS).map(([key, t]) => ({
          ...t, _key: key, isRecommended: key === 'LARGE', isDisabled: false,
        })),
        breakdown: [], totalVolume: 0, totalWeight: 0,
      };
    }
  },

  createOrder: async (orderData) => {
    try {
      console.log('Sending order data:', JSON.stringify(orderData, null, 2));
      const formattedOrderData = {
        ...orderData,
        items: orderData.items.map((item) => ({
          product_id:      item.product_id,
          quantity:        item.quantity,
          unit_price:      parseFloat(item.unit_price),
          product_name:    item.product_name,
          product_sku:     item.sku || '',
          variant_id:      item.variant_id   || null,
          variant_name:    item.variant_name || null,
          commission_rate: parseFloat(item.commission_rate || 0),
          sme_id:          item.sme_id,
        })),
        delivery_size_category: orderData.delivery_size_category || null,
        paxi_tier_id:           orderData.paxi_tier_id           || null,
      };
      const response = await axiosInstance.post('/orders/', formattedOrderData);
      console.log('Order created response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating order:', error);
      if (error.response?.data) {
        console.error('Server error response:', error.response.data);
        throw { message: 'Failed to create order', details: error.response.data };
      }
      throw { message: 'Failed to create order' };
    }
  },

  markOrderAsPaid: async (orderNumber) => {
    try {
      const response = await axiosInstance.patch(`/orders/${orderNumber}/`, {
        status: 'paid', payment_status: 'paid',
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) return { message: 'Order paid status skipped' };
      throw error.response?.data || error.message;
    }
  },

  markOrderAsCompleted: async (orderNumber) => {
    try {
      const response = await axiosInstance.patch(`/orders/${orderNumber}/`, {
        status: 'completed', payment_status: 'paid',
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) return { message: 'Order completion skipped' };
      throw error.response?.data || error.message;
    }
  },

  getOrder: async (orderId) => {
    try { return (await axiosInstance.get(`/orders/${orderId}/`)).data; }
    catch (error) { throw error; }
  },

  getOrderByNumber: async (orderNumber) => {
    try { return (await axiosInstance.get(`/orders/${orderNumber}/`)).data; }
    catch (error) { throw error; }
  },

  getUserOrders: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status)     params.append('status',     filters.status);
      if (filters.limit)      params.append('limit',      filters.limit);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date)   params.append('end_date',   filters.end_date);
      return (await axiosInstance.get(`/orders/?${params.toString()}`)).data;
    } catch (error) { throw error; }
  },

  cancelOrder: async (orderNumber) => {
    try { return (await axiosInstance.delete(`/orders/${orderNumber}/`)).data; }
    catch (error) { throw error; }
  },

  updateOrderStatus: async (orderNumber, statusData) => {
    try { return (await axiosInstance.patch(`/orders/${orderNumber}/`, statusData)).data; }
    catch (error) { throw error; }
  },
};

export default checkoutService;