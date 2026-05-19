import axios from 'axios';

// eslint-disable-next-line no-undef
const API_URL = 'https://izozo.izozo.co.za/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const cartService = {
  /**
   * Get current cart
   * GET /api/cart/
   */
  getCart: async () => {
    try {
      const response = await axiosInstance.get('/cart/');
      return response.data;
    } catch (error) {
      console.error('Error fetching cart:', error);
      return { items: [], item_count: 0, subtotal: 0 };
    }
  },

  /**
   * Get cart items
   * GET /api/cart/items/
   */
  getCartItems: async () => {
    try {
      const response = await axiosInstance.get('/cart/items/');
      return response.data;
    } catch (error) {
      console.error('Error fetching cart items:', error);
      return [];
    }
  },

  /**
   * Add item to cart
   * POST /api/cart/items/
   */
  addToCart: async (productId, quantity = 1, variantId = null) => {
    try {
      const data = {
        product: productId,
        quantity: quantity
      };
      if (variantId) {
        data.variant = variantId;
      }
      
      const response = await axiosInstance.post('/cart/items/', data);
      return response.data;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error.response?.data || { error: 'Failed to add item to cart' };
    }
  },

  /**
   * Update cart item quantity
   * PUT /api/cart/items/{itemId}/
   */
  updateCartItem: async (itemId, quantity) => {
    try {
      const response = await axiosInstance.put(`/cart/items/${itemId}/`, { quantity });
      return response.data;
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error.response?.data || { error: 'Failed to update cart item' };
    }
  },

  /**
   * Remove item from cart
   * DELETE /api/cart/items/{itemId}/
   */
  removeFromCart: async (itemId) => {
    try {
      await axiosInstance.delete(`/cart/items/${itemId}/`);
      return { success: true };
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error.response?.data || { error: 'Failed to remove item from cart' };
    }
  },

  /**
   * Clear cart
   * POST /api/cart/clear/
   */
  clearCart: async () => {
    try {
      const response = await axiosInstance.post('/cart/clear/');
      return response.data;
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error.response?.data || { error: 'Failed to clear cart' };
    }
  },

  /**
   * Validate coupon code
   * GET /api/coupons/validate/?code={code}
   */
  validateCoupon: async (code) => {
    try {
      // This would be a real API endpoint
      // For now, simulate with mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const validCoupons = {
        "IZOZO10": 10,
        "IZOZO20": 20,
        "WELCOME15": 15
      };
      
      const upperCode = code.toUpperCase();
      if (validCoupons[upperCode]) {
        return {
          valid: true,
          discount: validCoupons[upperCode],
          code: upperCode
        };
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Error validating coupon:', error);
      throw error;
    }
  },

  /**
   * Get recommended products based on cart
   * GET /api/products/recommended/
   */
  // eslint-disable-next-line no-unused-vars
  getRecommendedProducts: async (categoryIds = [], excludeProductIds = []) => {
    try {
      // This would be a real API endpoint
      // For now, return empty array
      await new Promise(resolve => setTimeout(resolve, 500));
      return [];
      
      // When API is ready:
      // const params = new URLSearchParams();
      // categoryIds.forEach(id => params.append('categories', id));
      // excludeProductIds.forEach(id => params.append('exclude', id));
      // const response = await axiosInstance.get(`/products/recommended/?${params.toString()}`);
      // return response.data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      return [];
    }
  },

  /**
   * Format price utility
   */
  formatPrice: (price) => {
    if (!price && price !== 0) return 'R0.00';
    return `R${parseFloat(price).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
};

export default cartService;