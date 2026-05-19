// frontend/src/services/api.js
import axios from 'axios';

// eslint-disable-next-line no-undef
const API_URL = 'https://izozo.izozo.co.za/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Flag to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const tokens = localStorage.getItem('izozo_tokens');
    if (tokens) {
      try {
        const { access } = JSON.parse(tokens);
        if (access) {
          config.headers.Authorization = `Bearer ${access}`;
        }
      } catch (error) {
        console.error('Error parsing tokens:', error);
        localStorage.removeItem('izozo_tokens');
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't retry for notifications endpoints if not authenticated
    if (originalRequest.url.includes('/notifications/') && 
        error.response?.status === 401) {
      console.log('Skipping notification request - not authenticated');
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Wait for token refresh
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch(err => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const tokens = localStorage.getItem('izozo_tokens');
      if (!tokens) {
        throw new Error('No refresh token available');
      }

      const { refresh } = JSON.parse(tokens);
      if (!refresh) {
        throw new Error('Invalid refresh token');
      }

      const response = await axios.post(`${API_URL}/auth/refresh/`, {
        refresh: refresh
      });

      const { access } = response.data;
      
      // Update tokens in storage
      const newTokens = { ...JSON.parse(tokens), access };
      localStorage.setItem('izozo_tokens', JSON.stringify(newTokens));
      
      // Update default header
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      
      // Process queue
      processQueue(null, access);
      
      // Retry original request
      originalRequest.headers.Authorization = `Bearer ${access}`;
      return api(originalRequest);
      
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      
      // Process queue with error
      processQueue(refreshError, null);
      
      // Clear tokens and redirect to login
      localStorage.removeItem('izozo_tokens');
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;