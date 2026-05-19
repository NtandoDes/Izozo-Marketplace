// frontend/src/services/customerService.js
import { axiosInstance } from '../contexts/AuthContext';

export const customerService = {
  /**
   * Get customer profile
   * GET /customer/profile/
   */
  getProfile: async () => {
    try {
      const response = await axiosInstance.get('/customer/profile/');
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  },

  /**
   * Update customer profile
   * PUT /customer/profile/
   */
  updateProfile: async (profileData) => {
    try {
      const response = await axiosInstance.put('/customer/profile/', profileData);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  /**
   * Get customer orders
   * GET /orders/  (axiosInstance already has /api)
   */
  getOrders: async (filters = {}) => {
    try {
      console.log('Fetching orders with filters:', filters);
      
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      
      const url = `/orders/?${params.toString()}`;
      console.log('Request URL:', url);
      
      const response = await axiosInstance.get(url);
      console.log('Orders API response:', response.data);
      
      // Handle different response formats
      let ordersData = [];
      
      if (Array.isArray(response.data)) {
        // Response is directly an array
        ordersData = response.data;
      } else if (response.data.results && Array.isArray(response.data.results)) {
        // Response is paginated with results array
        ordersData = response.data.results;
      } else if (response.data.orders && Array.isArray(response.data.orders)) {
        // Response has orders property
        ordersData = response.data.orders;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        // Response has data property
        ordersData = response.data.data;
      } else {
        console.warn('Unexpected response format:', response.data);
        ordersData = [];
      }
      
      // Transform orders to ensure consistent format
      const transformedOrders = ordersData.map(order => ({
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        status: order.status,
        total_amount: order.total_amount,
        item_count: order.item_count || order.items?.length || 0,
        items: (order.items || []).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price || item.price,
          total: item.total,
          image: item.image || item.product_image || null
        })),
        customer_full_name: order.customer_full_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        shipping_address: order.shipping_address_snapshot || order.shipping_address,
        billing_address: order.billing_address_snapshot || order.billing_address,
        payment_status: order.payment_status,
        payment_method: order.payment_method
      }));
      
      console.log('Transformed orders:', transformedOrders);
      return transformedOrders;
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      return [];
    }
  },

  /**
   * Get single order
   * GET /orders/{orderNumber}/
   */
  getOrder: async (orderNumber) => {
    try {
      console.log('Fetching order:', orderNumber);
      const response = await axiosInstance.get(`/orders/${orderNumber}/`);
      console.log('Order API response:', response.data);
      
      const order = response.data;
      
      // Transform single order
      const transformedOrder = {
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        status: order.status,
        total_amount: order.total_amount,
        subtotal: order.subtotal,
        shipping_amount: order.shipping_amount,
        tax_amount: order.tax_amount,
        discount_amount: order.discount_amount,
        item_count: order.item_count || order.items?.length || 0,
        items: (order.items || []).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price || item.price,
          total: item.total,
          image: item.image || item.product_image || null
        })),
        customer_full_name: order.customer_full_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        shipping_address: order.shipping_address_snapshot || order.shipping_address,
        billing_address: order.billing_address_snapshot || order.billing_address,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        tracking_number: order.tracking_number,
        shipping_method: order.shipping_method,
        notes: order.customer_notes,
        status_history: order.status_history || []
      };
      
      console.log('Transformed order:', transformedOrder);
      return transformedOrder;
      
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  },

  /**
   * Get order statistics
   * GET /orders/stats/
   */
  getOrderStats: async () => {
    try {
      console.log('Fetching order stats');
      const response = await axiosInstance.get('/orders/stats/');
      console.log('Order stats API response:', response.data);
      
      // Handle different response formats
      let stats = response.data;
      
      // Ensure stats have all required fields
      const defaultStats = {
        total_orders: 0,
        pending_orders: 0,
        processing_orders: 0,
        paid_orders: 0,
        shipped_orders: 0,
        delivered_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_spent: 0,
        average_order_value: 0
      };
      
      return { ...defaultStats, ...stats };
      
    } catch (error) {
      console.error('Error fetching order stats:', error);
      
      // Calculate from orders as fallback
      try {
        console.log('Calculating order stats from orders as fallback');
        const orders = await customerService.getOrders({ limit: 1000 });
        
        const totalSpent = orders
          .filter(o => ['delivered', 'completed', 'paid'].includes(o.status))
          .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        
        const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status)).length;
        
        const stats = {
          total_orders: orders.length,
          pending_orders: orders.filter(o => o.status === 'pending').length,
          processing_orders: orders.filter(o => o.status === 'processing').length,
          paid_orders: orders.filter(o => o.status === 'paid').length,
          shipped_orders: orders.filter(o => o.status === 'shipped').length,
          delivered_orders: orders.filter(o => o.status === 'delivered').length,
          completed_orders: completedOrders,
          cancelled_orders: orders.filter(o => o.status === 'cancelled').length,
          total_spent: totalSpent,
          average_order_value: completedOrders > 0 ? totalSpent / completedOrders : 0
        };
        
        console.log('Calculated stats:', stats);
        return stats;
        
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return {
          total_orders: 0,
          pending_orders: 0,
          processing_orders: 0,
          paid_orders: 0,
          shipped_orders: 0,
          delivered_orders: 0,
          completed_orders: 0,
          cancelled_orders: 0,
          total_spent: 0,
          average_order_value: 0
        };
      }
    }
  },

  /**
   * Cancel order
   * DELETE /orders/{orderNumber}/
   */
  cancelOrder: async (orderNumber) => {
    try {
      console.log('Cancelling order:', orderNumber);
      const response = await axiosInstance.delete(`/orders/${orderNumber}/`);
      console.log('Cancel order response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  },

  /**
   * Get wishlist
   * GET /wishlist/
   */
  getWishlist: async () => {
    try {
      const response = await axiosInstance.get('/wishlist/');
      return response.data;
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      return [];
    }
  },

  /**
   * Add to wishlist
   * POST /wishlist/
   */
  addToWishlist: async (productId) => {
    try {
      const response = await axiosInstance.post('/wishlist/', { product_id: productId });
      return response.data;
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      throw error;
    }
  },

  /**
   * Remove from wishlist
   * DELETE /wishlist/{productId}/
   */
  removeFromWishlist: async (productId) => {
    try {
      const response = await axiosInstance.delete(`/wishlist/${productId}/`);
      return response.data;
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      throw error;
    }
  },

  /**
   * Get recently viewed products
   * GET /recently-viewed/
   */
  getRecentlyViewed: async () => {
    try {
      const response = await axiosInstance.get('/recently-viewed/');
      return response.data;
    } catch (error) {
      console.error('Error fetching recently viewed:', error);
      return [];
    }
  },

  /**
   * Get addresses
   * GET /addresses/
   */
  getAddresses: async () => {
    try {
      const response = await axiosInstance.get('/addresses/');
      return response.data;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      return [];
    }
  },

  /**
   * Add address
   * POST /addresses/
   */
  addAddress: async (addressData) => {
    try {
      const response = await axiosInstance.post('/addresses/', addressData);
      return response.data;
    } catch (error) {
      console.error('Error adding address:', error);
      throw error;
    }
  },

  /**
   * Update address
   * PUT /addresses/{id}/
   */
  updateAddress: async (id, addressData) => {
    try {
      const response = await axiosInstance.put(`/addresses/${id}/`, addressData);
      return response.data;
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  },

  /**
   * Delete address
   * DELETE /addresses/{id}/
   */
  deleteAddress: async (id) => {
    try {
      const response = await axiosInstance.delete(`/addresses/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  },

  /**
   * Set default address
   * POST /addresses/{id}/set-default/
   */
  setDefaultAddress: async (id) => {
    try {
      const response = await axiosInstance.post(`/addresses/${id}/set-default/`);
      return response.data;
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  }
};

export default customerService;