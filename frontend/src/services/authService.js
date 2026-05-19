// frontend/src/services/authService.js
import axios from 'axios';

const API_URL = 'https://izozo.izozo.co.za/api';

const getAuthHeader = () => {
  const tokens = localStorage.getItem('izozo_tokens');
  if (tokens) {
    try {
      const { access } = JSON.parse(tokens);
      return { Authorization: `Bearer ${access}` };
    } catch (error) {
      console.error('Error parsing tokens:', error);
      localStorage.removeItem('izozo_tokens');
    }
  }
  return {};
};

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const authHeader = getAuthHeader();
    if (authHeader.Authorization) {
      config.headers.Authorization = authHeader.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authService = {
  /**
   * Get current user
   * GET /api/auth/me/
   */
  getCurrentUser: async () => {
    try {
      const response = await axiosInstance.get('/auth/me/');
      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },

  /**
   * Login
   * POST /api/auth/login/
   */
  login: async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login/`, { email, password });
      return response.data;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error.response?.data || { message: 'Login failed' };
    }
  },

  /**
   * Register
   * POST /api/auth/register/
   */
  register: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register/`, userData);
      return response.data;
    } catch (error) {
      console.error('Error registering:', error);
      throw error.response?.data || { message: 'Registration failed' };
    }
  },

  /**
   * Refresh token
   * POST /api/auth/refresh/
   */
  refreshToken: async (refresh) => {
    try {
      const response = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  },

  /**
   * Logout
   * POST /api/auth/logout/
   */
  logout: async () => {
    try {
      const tokens = localStorage.getItem('izozo_tokens');
      if (tokens) {
        const { refresh } = JSON.parse(tokens);
        await axios.post(`${API_URL}/auth/logout/`, { refresh });
      }
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      localStorage.removeItem('izozo_tokens');
    }
  }
};

export default authService;