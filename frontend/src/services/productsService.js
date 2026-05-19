import axios from 'axios';

// eslint-disable-next-line no-undef
const API_URL = 'https://izozo.izozo.co.za/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const productsService = {
  /**
   * Get all products with optional filters - Public endpoint
   * GET /api/products/
   */
  getProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.min_price) params.append('min_price', filters.min_price);
      if (filters.max_price) params.append('max_price', filters.max_price);
      if (filters.sort) params.append('sort', filters.sort);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      if (filters.featured) params.append('featured', filters.featured);
      
      const response = await axiosInstance.get(`/products/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  },

  /**
   * Get single product by ID or slug - Public endpoint
   * GET /api/products/{identifier}/
   */
  getProduct: async (identifier) => {
    try {
      const response = await axiosInstance.get(`/products/${identifier}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  /**
   * Get all categories - Public endpoint
   * GET /api/categories/
   */
  getCategories: async () => {
    try {
      const response = await axiosInstance.get('/categories/');
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  /**
   * Get products by category - Public endpoint
   * GET /api/products/?category={categoryId}
   */
  getProductsByCategory: async (categoryId, limit = 20) => {
    try {
      const response = await axiosInstance.get(`/products/?category=${categoryId}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching products by category:', error);
      return [];
    }
  },

  /**
   * Search products - Public endpoint
   * GET /api/products/?search={query}
   */
  searchProducts: async (query, limit = 20) => {
    try {
      const response = await axiosInstance.get(`/products/?search=${encodeURIComponent(query)}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },

  /**
   * Get featured products - Public endpoint
   * GET /api/products/?featured=true
   */
  getFeaturedProducts: async (limit = 8) => {
    try {
      const response = await axiosInstance.get(`/products/?featured=true&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching featured products:', error);
      return [];
    }
  },

  /**
   * Get product by slug - Public endpoint
   * GET /api/products/{slug}/
   */
  getProductBySlug: async (slug) => {
    try {
      const response = await axiosInstance.get(`/products/${slug}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product by slug:', error);
      throw error;
    }
  }
};

export default productsService;