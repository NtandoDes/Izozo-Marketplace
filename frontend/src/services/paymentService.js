/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// frontend/src/services/paymentService.js
import { axiosInstance } from '../contexts/AuthContext';

export const paymentService = {
  /**
   * Get all payments for the current user
   * GET /payments/
   */
  getPayments: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);
      
      const response = await axiosInstance.get(`/payments/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  },

  /**
   * Get payment by ID
   * GET /payments/{paymentId}/
   */
  getPayment: async (paymentId) => {
    try {
      const response = await axiosInstance.get(`/payments/${paymentId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  },

  /**
   * Process payment
   * POST /payments/create/
   */
  processPayment: async (paymentData) => {
    try {
      const response = await axiosInstance.post('/payments/create/', paymentData);
      return response.data;
    } catch (error) {
      console.error('❌ Payment error response:', error.response?.data);  // add this
    console.error('❌ Payment request data was:', paymentData);
      console.error('Error processing payment:', error);
      throw error.response?.data || { message: 'Payment processing failed' };
    }
  },

  /**
   * Confirm payment
   * POST /payments/{paymentId}/confirm/
   */
  confirmPayment: async (paymentId) => {
    try {
      const response = await axiosInstance.post(`/payments/${paymentId}/confirm/`);
      console.log('Payment confirmation response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error confirming payment:', error);
      if (error.response?.status === 400) {
        console.log('Payment might already be confirmed');
        return { message: 'Payment already processed' };
      }
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get saved payment methods
   * GET /payment-methods/
   */
  getPaymentMethods: async () => {
    try {
      const response = await axiosInstance.get('/payment-methods/');
      return response.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
  },

  /**
   * Add payment method
   * POST /payment-methods/
   */
  addPaymentMethod: async (methodData) => {
    try {
      const response = await axiosInstance.post('/payment-methods/', methodData);
      return response.data;
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error.response?.data || { message: 'Failed to add payment method' };
    }
  },

  /**
   * Delete payment method
   * DELETE /payment-methods/{id}/
   */
  deletePaymentMethod: async (methodId) => {
    try {
      await axiosInstance.delete(`/payment-methods/${methodId}/`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting payment method:', error);
      throw error;
    }
  },

  /**
   * Set default payment method
   * POST /payment-methods/{id}/set-default/
   */
  setDefaultPaymentMethod: async (methodId) => {
    try {
      const response = await axiosInstance.post(`/payment-methods/${methodId}/set-default/`);
      return response.data;
    } catch (error) {
      console.error('Error setting default payment method:', error);
      throw error;
    }
  },

  /**
   * Get payment statistics
   * GET /payments/stats/
   */
  getPaymentStats: async () => {
    try {
      const response = await axiosInstance.get('/payments/stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      return {
        total_spent: 0,
        completed_payments: 0,
        pending_payments: 0,
        failed_payments: 0,
        by_method: []
      };
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
  },

  // Add to frontend/src/services/paymentService.js

  /**
   * Initiate a Paystack card payment
   * POST /payments/create/
   * Returns { authorization_url, reference, payment }
   */
  initiateCardPayment: async (orderId, amount) => {
    try {
      const response = await axiosInstance.post('/payments/create/', {
        order: orderId,
        payment_method: 'card',
        amount,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to initiate payment' };
    }
  },

  /**
   * Open Paystack inline popup
   * Loads the Paystack script on demand then opens the modal
   */
  openPaystackPopup: ({ email, amount, reference, onSuccess, onClose }) => {
    const load = () =>
      new Promise((resolve) => {
        if (window.PaystackPop) return resolve();
        const s = document.createElement('script');
        s.src = 'https://js.paystack.co/v1/inline.js';
        s.onload = resolve;
        document.body.appendChild(s);
      });

    load().then(() => {
      const handler = window.PaystackPop.setup({
        key: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
        email,
        amount: Math.round(parseFloat(amount) * 100), // kobo
        ref: reference,
        currency: 'ZAR',
        callback: (res) => onSuccess(res.reference),
        onClose,
      });
      handler.openIframe();
    });
  },

  /**
   * Request a refund
   * POST /payments/{paymentId}/refund/
   */
  requestRefund: async (paymentId, amount = null) => {
    try {
      const response = await axiosInstance.post(
        `/payments/${paymentId}/refund/`,
        amount ? { amount } : {}
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Refund failed' };
    }
  },

  /**
   * Get South African banks for seller onboarding
   * GET /sellers/banks/
   */
  getBanks: async () => {
    try {
      const response = await axiosInstance.get('/sellers/banks/');
      return response.data.banks || [];
    } catch (error) {
      return [];
    }
  },

  /**
   * Onboard a seller with their bank details
   * POST /sellers/onboard/
   */
  onboardSeller: async ({ businessName, bankCode, accountNumber, percentageCharge = 90 }) => {
    try {
      const response = await axiosInstance.post('/sellers/onboard/', {
        business_name: businessName,
        bank_code: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Seller onboarding failed' };
    }
  },

};

export default paymentService;