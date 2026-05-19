// frontend/src/services/passwordResetService.js
import axios from 'axios';

const API_URL = 'https://izozo.izozo.co.za/api';

const passwordResetService = {
  /**
   * Request password reset email
   * POST /api/users/forgot-password/
   */
  requestReset: async (email) => {
    try {
      const response = await axios.post(`${API_URL}/users/forgot-password/`, { email });
      return response.data;
    } catch (error) {
      console.error('Error requesting password reset:', error);
      
      // Handle different error response formats
      if (error.response?.data) {
        // Check if it's a field-specific error (like email)
        if (error.response.data.email) {
          const emailError = Array.isArray(error.response.data.email) 
            ? error.response.data.email[0] 
            : error.response.data.email;
          throw { message: emailError };
        }
        
        // Check if it's a general error message
        if (error.response.data.message) {
          throw { message: error.response.data.message };
        }
        
        // Check if it's a non_field_errors
        if (error.response.data.non_field_errors) {
          const nonFieldError = Array.isArray(error.response.data.non_field_errors) 
            ? error.response.data.non_field_errors[0] 
            : error.response.data.non_field_errors;
          throw { message: nonFieldError };
        }
        
        // If it's a string error
        if (typeof error.response.data === 'string') {
          throw { message: error.response.data };
        }
        
        // If it's our custom success: false format
        if (error.response.data.success === false && error.response.data.message) {
          throw { message: error.response.data.message };
        }
      }
      
      // Default error message
      throw { message: 'Failed to request password reset. Please try again.' };
    }
  },

  /**
   * Validate reset token
   * POST /api/users/validate-reset-token/
   */
  validateToken: async (token) => {
    try {
      const response = await axios.post(`${API_URL}/users/validate-reset-token/`, { token });
      return response.data;
    } catch (error) {
      console.error('Error validating token:', error);
      
      if (error.response?.data) {
        // Handle token validation errors
        if (error.response.data.token) {
          const tokenError = Array.isArray(error.response.data.token) 
            ? error.response.data.token[0] 
            : error.response.data.token;
          throw { message: tokenError };
        }
        
        if (error.response.data.message) {
          throw { message: error.response.data.message };
        }
        
        if (typeof error.response.data === 'string') {
          throw { message: error.response.data };
        }
      }
      
      throw { message: 'Invalid or expired token' };
    }
  },

  /**
   * Reset password
   * POST /api/users/reset-password/
   */
  resetPassword: async (token, newPassword, confirmPassword) => {
    try {
      const response = await axios.post(`${API_URL}/users/reset-password/`, {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      return response.data;
    } catch (error) {
      console.error('Error resetting password:', error);
      
      if (error.response?.data) {
        // Handle password validation errors
        if (error.response.data.new_password) {
          const passwordError = Array.isArray(error.response.data.new_password) 
            ? error.response.data.new_password[0] 
            : error.response.data.new_password;
          throw { message: passwordError };
        }
        
        if (error.response.data.confirm_password) {
          const confirmError = Array.isArray(error.response.data.confirm_password) 
            ? error.response.data.confirm_password[0] 
            : error.response.data.confirm_password;
          throw { message: confirmError };
        }
        
        if (error.response.data.token) {
          const tokenError = Array.isArray(error.response.data.token) 
            ? error.response.data.token[0] 
            : error.response.data.token;
          throw { message: tokenError };
        }
        
        if (error.response.data.message) {
          throw { message: error.response.data.message };
        }
        
        if (typeof error.response.data === 'string') {
          throw { message: error.response.data };
        }
      }
      
      throw { message: 'Failed to reset password. Please try again.' };
    }
  }
};

export default passwordResetService;