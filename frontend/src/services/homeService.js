/* eslint-disable no-unused-vars */
import axios from 'axios';

// eslint-disable-next-line no-undef
const API_URL = 'https://izozo.izozo.co.za/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const homeService = {
  /**
   * Get all categories - Public endpoint
   * GET /api/categories/
   */
  getCategories: async () => {
    try {
      const response = await axiosInstance.get('/categories/');
      console.log('Raw categories response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  /**
   * Get categories with product counts - Public endpoint
   * GET /api/categories/ with product counts
   */
  getCategoriesWithCounts: async () => {
    try {
      // First, get all categories
      const categoriesResponse = await axiosInstance.get('/categories/');
      const categories = categoriesResponse.data;
      console.log('Categories data:', categories);
      
      // Then get all active products
      const productsResponse = await axiosInstance.get('/products/?limit=1000');
      const products = productsResponse.data;
      console.log('Products data (first product):', products[0]);
      
      // Log product category relationships
      if (products.length > 0) {
        console.log('Sample product category data:');
        products.slice(0, 3).forEach(product => {
          console.log(`Product "${product.name}" categories:`, {
            categories_array: product.categories,
            category_id: product.category_id,
            category_field: product.category,
            category_ids: product.category_ids
          });
        });
      }
      
      // For each category, count products that belong to it
      const categoriesWithCounts = categories.map(category => {
        // Try multiple ways to match products to categories
        const productsInCategory = products.filter(product => {
          // Method 1: Check if categories array exists and contains this category
          if (product.categories && Array.isArray(product.categories)) {
            return product.categories.some(cat => {
              if (typeof cat === 'object') {
                return cat.id === category.id || cat.name === category.name;
              }
              return cat === category.id || cat === category.name;
            });
          }
          
          // Method 2: Check category_ids array
          if (product.category_ids && Array.isArray(product.category_ids)) {
            return product.category_ids.includes(category.id);
          }
          
          // Method 3: Check category_id field
          if (product.category_id) {
            return product.category_id === category.id;
          }
          
          // Method 4: Check category field (could be object or id)
          if (product.category) {
            if (typeof product.category === 'object') {
              return product.category.id === category.id;
            }
            return product.category === category.id;
          }
          
          return false;
        });
        
        const productCount = productsInCategory.length;
        
        return {
          ...category,
          product_count: productCount,
          products: productsInCategory.slice(0, 4), // Include up to 4 sample products
          count: productCount > 0 ? `${productCount} products` : '0 products'
        };
      });
      
      console.log('Categories with counts:', categoriesWithCounts);
      return categoriesWithCounts;
      
    } catch (error) {
      console.error('Error fetching categories with counts:', error);
      
      // Fallback: return categories with zero counts
      try {
        const fallbackCategories = await axiosInstance.get('/categories/');
        return fallbackCategories.data.map(cat => ({
          ...cat,
          product_count: 0,
          products: [],
          count: '0 products'
        }));
      } catch (fallbackError) {
        return [];
      }
    }
  },

  /**
   * Get category by slug or ID - Public endpoint
   * GET /api/categories/{identifier}/
   */
  getCategory: async (identifier) => {
    try {
      const response = await axiosInstance.get(`/categories/${identifier}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching category:', error);
      throw error;
    }
  },

  /**
   * Get featured products - Public endpoint
   * GET /api/products/?featured=true&limit=8
   */
  getFeaturedProducts: async () => {
    try {
      const response = await axiosInstance.get('/products/?featured=true&limit=8');
      console.log('Featured products response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching featured products:', error);
      
      // Fallback: get any products
      try {
        const fallbackResponse = await axiosInstance.get('/products/?limit=8');
        return fallbackResponse.data;
      } catch (fallbackError) {
        return [];
      }
    }
  },

  /**
   * Get products by category - Public endpoint
   * GET /api/products/?category={categoryId}
   */
  getProductsByCategory: async (categoryId, limit = 10) => {
    try {
      const response = await axiosInstance.get(`/products/?category=${categoryId}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching products by category:', error);
      return [];
    }
  },

  /**
   * Get site statistics - Public endpoint
   * GET /api/stats/
   */
  getStats: async () => {
    try {
      const response = await axiosInstance.get('/stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      
      // Fallback: count products
      try {
        const productsResponse = await axiosInstance.get('/products/?limit=1');
        const totalProducts = productsResponse.headers['x-total-count'] || 
                              (Array.isArray(productsResponse.data) ? productsResponse.data.length : 3000);
        
        return {
          activeSMEs: 150,
          verifiedAgents: 50,
          totalProducts: totalProducts,
        };
      } catch (fallbackError) {
        return {
          activeSMEs: 150,
          verifiedAgents: 50,
          totalProducts: 3000,
        };
      }
    }
  },

  /**
   * Search products - Public endpoint
   * GET /api/products/?search={query}
   */
  searchProducts: async (query) => {
    try {
      const response = await axiosInstance.get(`/products/?search=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },

  /**
   * Get all products (with optional filters) - Public endpoint
   * GET /api/products/
   */
  getAllProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      
      const url = `/products/?${params.toString()}`;
      console.log('Fetching products from:', url);
      
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching all products:', error);
      return [];
    }
  },

  /**
   * Get product by ID or slug - Public endpoint
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
  }
};

export default homeService;