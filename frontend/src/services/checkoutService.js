// frontend/src/services/checkoutService.js
import { axiosInstance } from '../contexts/AuthContext';

// ============================================================================
// PAXI CONSTANTS
// ============================================================================

export const PAXI_TIERS = {
  SMALL: {
    id: 'paxi_small',
    label: 'PAXI Small Parcel',
    description: 'Suitable for compact/foldable items',
    maxWeightKg: 5,
    price: 59,
    estimatedDays: '3–5 business days',
    icon: '📦',
  },

  LARGE: {
    id: 'paxi_large',
    label: 'PAXI Large Parcel',
    description: 'Suitable for bulkier or heavier orders',
    maxWeightKg: Infinity,
    price: 109,
    estimatedDays: '3–5 business days',
    icon: '🚚',
  },
};

// ============================================================================
// DISPLAY TIER MAPPING
// ============================================================================

// Internally we support:
// SMALL → MEDIUM → LARGE
//
// Publicly customers only see:
// SMALL → LARGE
//
// MEDIUM maps upward to LARGE for display + pricing.
export const DISPLAY_TIER_MAP = {
  SMALL: 'SMALL',
  MEDIUM: 'LARGE',
  LARGE: 'LARGE',
};

// ============================================================================
// PAXI TIER HELPERS
// ============================================================================

/**
 * Resolve category using combined order totals.
 */
function categoryFromVolumeAndWeight(totalVolumeCm3, totalWeightKg) {
  const hasVol = Number.isFinite(totalVolumeCm3) && totalVolumeCm3 > 0;
  const hasWeight = Number.isFinite(totalWeightKg) && totalWeightKg > 0;

  if (!hasVol && !hasWeight) return null;

  const qualifiesSmallByWeight = hasWeight && totalWeightKg <= 5;
  const qualifiesSmallByVolume = hasVol && totalVolumeCm3 <= 8000;

  if (qualifiesSmallByWeight && qualifiesSmallByVolume) {
    return 'SMALL';
  }

  return 'LARGE';
}

/**
 * Determine SINGLE PRODUCT category.
 */
export function getPaxiCategory(dims) {
  const {
    length_cm,
    width_cm,
    height_cm,
    weight_kg,
    is_foldable = false,
    packaging_override = 'none',
  } = dims || {};

  // Explicit override always wins
  if (packaging_override && packaging_override !== 'none') {
    return packaging_override.toUpperCase();
  }

  // Foldables default to SMALL
  if (is_foldable) {
    return 'SMALL';
  }

  const vol =
    Number(length_cm) *
    Number(width_cm) *
    Number(height_cm);

  const kg = Number(weight_kg);

  return categoryFromVolumeAndWeight(vol, kg);
}

/**
 * Determine ORDER-LEVEL category.
 *
 * Aggregates:
 * - quantity
 * - total volume
 * - total weight
 * - foldables
 * - overrides
 */
export function computeOrderPaxiTier(items) {
  const RANK = { SMALL: 0, LARGE: 1 };

  let totalVolumeCm3 = 0;
  let totalWeightKg = 0;

  let forcedCategory = null;

  const itemBreakdown = (items || []).map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);

    const p = item.product || {};

    const length_cm = Number(
      item.length_cm ?? p.length_cm ?? 0
    );

    const width_cm = Number(
      item.width_cm ?? p.width_cm ?? 0
    );

    const height_cm = Number(
      item.height_cm ?? p.height_cm ?? 0
    );

    const weight_kg = Number(
      item.weight_kg ?? p.weight_kg ?? 0
    );

    const is_foldable =
      item.is_foldable ??
      p.is_foldable ??
      false;

    const packaging_override =
      item.packaging_override ??
      p.packaging_override ??
      'none';

    const unitCategory = getPaxiCategory({
      length_cm,
      width_cm,
      height_cm,
      weight_kg,
      is_foldable,
      packaging_override,
    });

    const unitVol =
      length_cm *
      width_cm *
      height_cm;

    totalVolumeCm3 += unitVol * qty;
    totalWeightKg += weight_kg * qty;

    // Track strongest override
    if (
      packaging_override &&
      packaging_override !== 'none'
    ) {
      const overrideCat =
        packaging_override.toUpperCase();

      if (
        forcedCategory === null ||
        RANK[overrideCat] > RANK[forcedCategory]
      ) {
        forcedCategory = overrideCat;
      }
    }

    return {
      product_id:
        item.product_id ?? item.id,

      product_name:
        item.product_name ??
        item.name ??
        'Unknown',

      quantity: qty,

      unit_vol: unitVol,

      unit_weight: weight_kg,

      total_vol: unitVol * qty,

      total_weight: weight_kg * qty,

      is_foldable,

      packaging_override,

      unit_category: unitCategory,
    };
  });

  // --------------------------------------------------------------------------
  // Resolve dimensional category
  // --------------------------------------------------------------------------

  let dimensionalCategory =
    categoryFromVolumeAndWeight(
      totalVolumeCm3,
      totalWeightKg
    );

  // Fallbacks when all dimensions are missing
  if (dimensionalCategory === null) {
    const anyFoldable = itemBreakdown.some(
      (i) => i.is_foldable
    );

    dimensionalCategory = anyFoldable
      ? 'SMALL'
      : 'LARGE';
  }

  // --------------------------------------------------------------------------
  // Apply override floor
  // --------------------------------------------------------------------------

  let resolvedCategory = dimensionalCategory;

  if (
    forcedCategory !== null &&
    RANK[forcedCategory] > RANK[resolvedCategory]
  ) {
    resolvedCategory = forcedCategory;
  }

  return {
    category: resolvedCategory,

    tier: {
      ...PAXI_TIERS[resolvedCategory],
      _key: resolvedCategory,
    },

    totalVolume: totalVolumeCm3,

    totalWeight: totalWeightKg,

    itemBreakdown,
  };
}

// ============================================================================
// CHECKOUT SERVICE
// ============================================================================

export const checkoutService = {
  /**
   * Get delivery options from cart totals.
   */
  getDeliveryOptions: async (cartItems = []) => {
    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 150)
      );

      const {
        category,
        totalVolume,
        totalWeight,
        itemBreakdown,
      } = computeOrderPaxiTier(cartItems);

      // Public-facing category
      const displayCategory =
        DISPLAY_TIER_MAP[category];

      const TIER_ORDER = [
        'SMALL',
        'LARGE',
      ];

      // Hide MEDIUM from customers
      const all = Object.entries(PAXI_TIERS)
        .filter(([key]) => key !== 'MEDIUM')
        .map(([key, t]) => ({
          ...t,

          _key: key,

          isRecommended:
            key === displayCategory,

          isDisabled:
            TIER_ORDER.indexOf(key) <
            TIER_ORDER.indexOf(displayCategory),
        }));

      return {
        recommended: {
          ...PAXI_TIERS[displayCategory],
          _key: displayCategory,
        },

        all,

        breakdown: itemBreakdown,

        totalVolume,

        totalWeight,
      };
    } catch (error) {
      console.error(
        'Error computing delivery options:',
        error
      );

      return {
        recommended: {
          ...PAXI_TIERS.LARGE,
          _key: 'LARGE',
        },

        all: Object.entries(PAXI_TIERS)
          .filter(([key]) => key !== 'MEDIUM')
          .map(([key, t]) => ({
            ...t,

            _key: key,

            isRecommended: key === 'LARGE',

            isDisabled: false,
          })),

        breakdown: [],

        totalVolume: 0,

        totalWeight: 0,
      };
    }
  },

  /** POST /orders/ */
  createOrder: async (orderData) => {
    try {
      console.log(
        'Sending order data:',
        JSON.stringify(orderData, null, 2)
      );

      const formattedOrderData = {
        ...orderData,

        items: orderData.items.map((item) => ({
          product_id: item.product_id,

          quantity: item.quantity,

          unit_price: parseFloat(
            item.unit_price
          ),

          product_name: item.product_name,

          product_sku: item.sku || '',

          variant_id:
            item.variant_id || null,

          variant_name:
            item.variant_name || null,

          commission_rate: parseFloat(
            item.commission_rate || 10
          ),

          sme_id: item.sme_id,
        })),

        delivery_size_category:
          orderData.delivery_size_category ||
          null,

        paxi_tier_id:
          orderData.paxi_tier_id || null,
      };

      const response = await axiosInstance.post(
        '/orders/',
        formattedOrderData
      );

      console.log(
        'Order created response:',
        response.data
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error creating order:',
        error
      );

      if (error.response?.data) {
        console.error(
          'Server error response:',
          error.response.data
        );

        throw {
          message: 'Failed to create order',
          details: error.response.data,
        };
      }

      throw {
        message: 'Failed to create order',
      };
    }
  },

  /** PATCH /orders/{orderNumber}/ */
  markOrderAsPaid: async (orderNumber) => {
    try {
      const response =
        await axiosInstance.patch(
          `/orders/${orderNumber}/`,
          {
            status: 'paid',
            payment_status: 'paid',
          }
        );

      return response.data;
    } catch (error) {
      console.error(
        'Error marking order as paid:',
        error
      );

      if (error.response?.status === 404) {
        return {
          message: 'Order paid status skipped',
        };
      }

      throw (
        error.response?.data ||
        error.message
      );
    }
  },

  /** PATCH /orders/{orderNumber}/ */
  markOrderAsCompleted: async (orderNumber) => {
    try {
      const response =
        await axiosInstance.patch(
          `/orders/${orderNumber}/`,
          {
            status: 'completed',
            payment_status: 'paid',
          }
        );

      return response.data;
    } catch (error) {
      console.error(
        'Error marking order as completed:',
        error
      );

      if (error.response?.status === 404) {
        return {
          message:
            'Order completion skipped',
        };
      }

      throw (
        error.response?.data ||
        error.message
      );
    }
  },

  /** GET /orders/{orderId}/ */
  getOrder: async (orderId) => {
    try {
      const response =
        await axiosInstance.get(
          `/orders/${orderId}/`
        );

      return response.data;
    } catch (error) {
      console.error(
        'Error fetching order:',
        error
      );

      throw error;
    }
  },

  /** GET /orders/{orderNumber}/ */
  getOrderByNumber: async (orderNumber) => {
    try {
      const response =
        await axiosInstance.get(
          `/orders/${orderNumber}/`
        );

      return response.data;
    } catch (error) {
      console.error(
        'Error fetching order by number:',
        error
      );

      throw error;
    }
  },

  /** GET /orders/ */
  getUserOrders: async (filters = {}) => {
    try {
      const params = new URLSearchParams();

      if (filters.status) {
        params.append(
          'status',
          filters.status
        );
      }

      if (filters.limit) {
        params.append(
          'limit',
          filters.limit
        );
      }

      if (filters.start_date) {
        params.append(
          'start_date',
          filters.start_date
        );
      }

      if (filters.end_date) {
        params.append(
          'end_date',
          filters.end_date
        );
      }

      const response =
        await axiosInstance.get(
          `/orders/?${params.toString()}`
        );

      return response.data;
    } catch (error) {
      console.error(
        'Error fetching user orders:',
        error
      );

      throw error;
    }
  },

  /** DELETE /orders/{orderNumber}/ */
  cancelOrder: async (orderNumber) => {
    try {
      const response =
        await axiosInstance.delete(
          `/orders/${orderNumber}/`
        );

      return response.data;
    } catch (error) {
      console.error(
        'Error cancelling order:',
        error
      );

      throw error;
    }
  },

  /** PATCH /orders/{orderNumber}/ */
  updateOrderStatus: async (
    orderNumber,
    statusData
  ) => {
    try {
      const response =
        await axiosInstance.patch(
          `/orders/${orderNumber}/`,
          statusData
        );

      return response.data;
    } catch (error) {
      console.error(
        'Error updating order status:',
        error
      );

      throw error;
    }
  },
};

export default checkoutService;