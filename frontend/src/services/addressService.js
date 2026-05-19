// frontend/src/services/addressService.js
import { axiosInstance } from '../contexts/AuthContext';

export const addressService = {
  /**
   * Get all addresses for the current user
   * GET /api/addresses/  -> Use '/addresses/' (axiosInstance already has /api)
   */
  getAddresses: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.is_default) params.append('is_default', filters.is_default);
      
      const response = await axiosInstance.get(`/addresses/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      return [];
    }
  },

  /**
   * Get address by ID
   * GET /api/addresses/{id}/
   */
  getAddress: async (id) => {
    try {
      const response = await axiosInstance.get(`/addresses/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching address:', error);
      throw error;
    }
  },

  /**
   * Create a new address
   * POST /api/addresses/
   */
  createAddress: async (addressData) => {
    try {
      console.log('Creating address with data:', addressData);
      const response = await axiosInstance.post('/addresses/', addressData);
      console.log('Address created:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating address:', error);
      throw error.response?.data || { message: 'Failed to create address' };
    }
  },

  /**
   * Update an address
   * PUT /api/addresses/{id}/
   */
  updateAddress: async (id, addressData) => {
    try {
      const response = await axiosInstance.put(`/addresses/${id}/`, addressData);
      return response.data;
    } catch (error) {
      console.error('Error updating address:', error);
      throw error.response?.data || { message: 'Failed to update address' };
    }
  },

  /**
   * Delete an address
   * DELETE /api/addresses/{id}/
   */
  deleteAddress: async (id) => {
    try {
      await axiosInstance.delete(`/addresses/${id}/`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  },

  /**
   * Set address as default
   * POST /api/addresses/{id}/set-default/
   */
  setDefaultAddress: async (id) => {
    try {
      const response = await axiosInstance.post(`/addresses/${id}/set-default/`);
      return response.data;
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  },

  /**
   * Get user's address book
   * GET /api/address-book/
   */
  getAddressBook: async () => {
    try {
      const response = await axiosInstance.get('/address-book/');
      return response.data;
    } catch (error) {
      console.error('Error fetching address book:', error);
      return null;
    }
  }
};

export default addressService;