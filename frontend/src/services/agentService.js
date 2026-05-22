// frontend/src/services/agentService.js
import axios from "axios";

// eslint-disable-next-line no-undef
const API_URL = "http://localhost:8000/api";

const getAuthHeader = () => {
  const tokens = localStorage.getItem("izozo_tokens");
  if (tokens) {
    try {
      const { access } = JSON.parse(tokens);
      return { Authorization: `Bearer ${access}` };
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      return {};
    }
  }
  return {};
};

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const authHeader = getAuthHeader();
    if (authHeader.Authorization) {
      config.headers.Authorization = authHeader.Authorization;
    }
    console.log(`🚀 ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error("❌ API Error:", error.config?.url, error.response?.status, error.response?.data);
    return Promise.reject(error);
  },
);

export const agentService = {
  // ============= PROFILE MANAGEMENT =============
  getProfile: async () => {
    try {
      const response = await axiosInstance.get("/agent/profile/");
      return response.data;
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      throw error.response?.data || error.message;
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await axiosInstance.put("/agent/profile/", profileData);
      return response.data;
    } catch (error) {
      console.error("Error updating agent profile:", error);
      throw error.response?.data || error.message;
    }
  },

  registerAgent: async (registrationData) => {
    try {
      const response = await axiosInstance.post("/auth/register/agent/", registrationData);
      if (response.data.tokens) {
        localStorage.setItem("izozo_tokens", JSON.stringify(response.data.tokens));
      }
      return response.data;
    } catch (error) {
      console.error("Error registering agent:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= SME ASSIGNMENT MANAGEMENT =============
  getAssignedSMEs: async () => {
    try {
      const profile = await agentService.getProfile();
      const agentId = profile.id;
      const response = await axiosInstance.get(`/agent-assignments/?agent_id=${agentId}&active=true`);
      const assignments = response.data;
      return assignments.map((assignment) => ({
        id: assignment.sme,
        assignment_id: assignment.id,
        business_name: assignment.sme_info?.business_name || "Unknown Business",
        owner_name: assignment.sme_info?.owner_name || "Unknown Owner",
        business_type: assignment.sme_info?.business_type || "Not specified",
        business_address: assignment.sme_info?.business_address || "",
        assigned_at: assignment.assigned_at,
        active: assignment.active,
        notes: assignment.notes,
        productsCount: 0,
        ordersCount: 0,
        totalRevenue: 0,
      }));
    } catch (error) {
      console.error("Error fetching assigned SMEs:", error);
      return [];
    }
  },

  getAllAssignments: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.agent_id) params.append("agent_id", filters.agent_id);
      if (filters.sme_id) params.append("sme_id", filters.sme_id);
      if (filters.active !== undefined) params.append("active", filters.active);
      const response = await axiosInstance.get(`/agent-assignments/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching assignments:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= CATEGORIES (shared/public data) =============
  getCategories: async () => {
    try {
      const response = await axiosInstance.get("/categories/");
      return response.data;
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  },

  getAllCategories: async () => {
    try {
      const response = await axiosInstance.get("/categories/all/");
      return response.data;
    } catch {
      try {
        const response = await axiosInstance.get("/categories/");
        return response.data;
      } catch (error) {
        console.error("Error fetching all categories:", error);
        return [];
      }
    }
  },

  getCategoryAttributes: async (categoryId) => {
    try {
      const response = await axiosInstance.get(`/categories/${categoryId}/attributes/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching attributes for category ${categoryId}:`, error);
      return [];
    }
  },

  // ============= PRODUCT MANAGEMENT =============
  getAssignedProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.sme_id) params.append("sme_id", filters.sme_id);
      if (filters.search) params.append("search", filters.search);
      if (filters.limit) params.append("limit", filters.limit);
      const response = await axiosInstance.get(`/agent/products/?${params.toString()}`);
      console.log("📦 Products fetched:", response.data.length);
      return response.data;
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  },

  getProduct: async (productId) => {
    try {
      const response = await axiosInstance.get(`/agent/products/${productId}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching product:", error);
      throw error.response?.data || error.message;
    }
  },

  createProduct: async (productData) => {
  try {
    const formData = new FormData();

    console.log("📦 Creating product with data:", productData);

    // ── Ensure is_foldable is explicitly set (default to false) ──
    const isFoldable = productData.is_foldable === true;
    
    // ── Required fields validation before sending ──
    if (!isFoldable) {
      const requiredDeliveryFields = ['length_cm', 'width_cm', 'height_cm', 'weight_kg'];
      const missingFields = requiredDeliveryFields.filter(field => 
        !productData[field] || productData[field] === '' || productData[field] === undefined
      );
      
      if (missingFields.length > 0) {
        const error = new Error(`Missing required delivery dimensions: ${missingFields.join(', ')}`);
        error.field_errors = {
          message: "For non-foldable items, all delivery dimensions are required",
          missing_fields: missingFields
        };
        throw error;
      }
    }

    // ── Scalar fields ───────────────────────────────────────────────────
    const scalarFields = [
      "name", "description", "short_description",
      "base_price", "selling_price", "discount_percentage", "commission_rate",
      "sku", "barcode", "stock_quantity", "low_stock_threshold",
      "length_cm", "width_cm", "height_cm", "weight_kg",
      "packaging_override", "sme_id", "commission_type",
      "meta_title", "meta_description", "meta_keywords"
    ];
    
    scalarFields.forEach((field) => {
      if (productData[field] !== null && productData[field] !== undefined && productData[field] !== "") {
        // Convert numbers to appropriate types
        let value = productData[field];
        const numericFields = ["base_price", "selling_price", "discount_percentage", "commission_rate", "weight_kg"];
        const intFields = ["stock_quantity", "low_stock_threshold", "length_cm", "width_cm", "height_cm", "sme_id"];
        
        if (numericFields.includes(field)) {
          value = parseFloat(value);
          if (isNaN(value)) return;
        } else if (intFields.includes(field)) {
          value = parseInt(value, 10);
          if (isNaN(value)) return;
        }
        
        formData.append(field, value);
        console.log(`Adding field ${field}:`, value);
      }
    });

    // ── Boolean field: is_foldable ────────────────────────────────────
    // IMPORTANT: Send as boolean, not string
    formData.append("is_foldable", isFoldable);
    console.log("Adding is_foldable:", isFoldable);

    // ── category_ids (MANDATORY - at least one) ────────────────────────
    if (!productData.category_ids || productData.category_ids.length === 0) {
      const error = new Error("At least one category is required");
      error.field_errors = { category_ids: ["At least one category is required"] };
      throw error;
    }
    
    productData.category_ids.forEach((id) => {
      formData.append("category_ids", id);
      console.log(`Adding category_id:`, id);
    });

    // ── JSON sub-fields ─────────────────────────────────────────────────
    if (productData.attributes && Object.keys(productData.attributes).length > 0) {
      const attributesJson = JSON.stringify(productData.attributes);
      formData.append('attributes', attributesJson);
      console.log("Adding attributes:", attributesJson);
    }
    
    if (productData.variants && productData.variants.length > 0) {
      const variantsJson = JSON.stringify(productData.variants);
      formData.append('variants', variantsJson);
      console.log("Adding variants:", variantsJson);
    }

    // ── Images ──────────────────────────────────────────────────────────
    if (productData.featured_image && productData.featured_image instanceof File) {
      formData.append("featured_image", productData.featured_image);
      console.log("Adding featured_image:", productData.featured_image.name);
    }
    
    if (Array.isArray(productData.images) && productData.images.length > 0) {
      productData.images.forEach((img, index) => {
        if (img instanceof File) {
          formData.append("images", img);
          console.log(`Adding image ${index + 1}:`, img.name);
        }
      });
    }

    // Log all form data for debugging
    console.log("📦 Final FormData entries:");
    for (let pair of formData.entries()) {
      const value = pair[1] instanceof File ? `[File: ${pair[1].name}]` : pair[1];
      console.log(`  ${pair[0]}: ${value}`);
    }

    const response = await axiosInstance.post("/agent/products/create/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    console.log("✅ Agent product created:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error creating agent product:", error);
    
    // Handle field-level errors from the backend
    if (error.response?.data) {
      console.error("Backend validation errors:", error.response.data);
      
      // Create a structured error object
      const enhancedError = new Error("Failed to create product");
      enhancedError.field_errors = error.response.data;
      enhancedError.status = error.response.status;
      
      // If there are specific field errors, log them clearly
      if (typeof error.response.data === 'object') {
        Object.entries(error.response.data).forEach(([field, messages]) => {
          console.error(`  - ${field}:`, messages);
        });
      }
      
      throw enhancedError;
    }
    
    if (error.field_errors) {
      throw error;
    }
    
    throw new Error(error.message || "Failed to create product");
  }
},

  updateProduct: async (productId, productData) => {
    try {
      const formData = new FormData();

      const scalarFields = [
        "name", "description", "short_description",
        "base_price", "selling_price", "discount_percentage", "commission_rate",
        "sku", "barcode", "stock_quantity", "low_stock_threshold",
        "length_cm", "width_cm", "height_cm", "weight_kg",
        "packaging_override", "sme_id",
      ];
      scalarFields.forEach((field) => {
        if (productData[field] !== null && productData[field] !== undefined) {
          formData.append(field, productData[field]);
        }
      });

      if (productData.featured_image instanceof File) {
        formData.append("featured_image", productData.featured_image);
      }

      const response = await axiosInstance.put(`/agent/products/${productId}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      console.error("Error updating agent product:", error);
      throw error.response?.data || error.message;
    }
  },

  deleteProduct: async (productId) => {
    try {
      const response = await axiosInstance.delete(`/agent/products/${productId}/`);
      return response.data;
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= ORDER MANAGEMENT =============
  getAssignedOrders: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.sme_id) params.append("sme_id", filters.sme_id);
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);

      const response = await axiosInstance.get(`/agent/orders/?${params.toString()}`);
      console.log("📦 Orders fetched:", response.data.length);
      return response.data;
    } catch (error) {
      console.error("Error fetching orders:", error);
      return [];
    }
  },

  getOrder: async (orderId) => {
    try {
      const response = await axiosInstance.get(`/agent/orders/${orderId}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error.response?.data || error.message;
    }
  },

  createAssistedOrder: async (orderData) => {
    try {
      const response = await axiosInstance.post("/agent/orders/create/", orderData);
      return response.data;
    } catch (error) {
      console.error("Error creating assisted order:", error);
      throw error.response?.data || error.message;
    }
  },

  updateOrderStatus: async (orderNumber, status) => {
    try {
      const response = await axiosInstance.patch(`/agent/orders/${orderNumber}/status/`, { status });
      return response.data;
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error.response?.data || error.message;
    }
  },

  getOrderStats: async () => {
    try {
      const response = await axiosInstance.get("/agent/orders/stats/");
      console.log("📊 Order stats fetched:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching order stats:", error);
      return {
        total_orders: 0,
        pending_orders: 0,
        processing_orders: 0,
        delivered_orders: 0,
        cancelled_orders: 0,
        total_revenue: 0,
        total_commission: 0,
        pending_commission: 0,
        paid_commission: 0,
        by_sme: [],
      };
    }
  },

  getReadyForPickupOrders: async () => {
    try {
      console.log("🔍 Calling API: /agent/orders/ready-for-pickup/");
      const response = await axiosInstance.get("/agent/orders/ready-for-pickup/");
      console.log("📦 Ready for pickup orders response:", response.data);
      
      let orders = [];
      if (Array.isArray(response.data)) {
        orders = response.data;
      } else if (response.data.results && Array.isArray(response.data.results)) {
        orders = response.data.results;
      } else if (response.data.orders && Array.isArray(response.data.orders)) {
        orders = response.data.orders;
      }
      
      console.log("✅ Processed pickup orders:", orders.length);
      return orders;
    } catch (error) {
      console.error("❌ Error fetching ready for pickup orders:", error);
      return [];
    }
  },

  markOrderAsCollected: async (orderId, collectionData = {}) => {
    try {
      const response = await axiosInstance.post(`/agent/orders/${orderId}/collect/`, collectionData);
      return response.data;
    } catch (error) {
      console.error("Error marking order as collected:", error);
      throw error.response?.data || { message: "Failed to mark order as collected" };
    }
  },

  markOrderAsShipped: async (orderId, shippingData = {}) => {
    try {
      const response = await axiosInstance.post(`/agent/orders/${orderId}/ship/`, shippingData);
      return response.data;
    } catch (error) {
      console.error("Error marking order as shipped:", error);
      throw error.response?.data || { message: "Failed to mark order as shipped" };
    }
  },

  markOrderAsDelivered: async (orderId, deliveryData = {}) => {
    try {
      const response = await axiosInstance.post(`/agent/orders/${orderId}/deliver/`, deliveryData);
      return response.data;
    } catch (error) {
      console.error("Error marking order as delivered:", error);
      throw error.response?.data || { message: "Failed to mark order as delivered" };
    }
  },

  // ============= COMMISSION MANAGEMENT =============
  getCommissionHistory: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);
      const response = await axiosInstance.get(`/agent/commission/history/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching commission history:", error);
      return [];
    }
  },

  getCommissionSummary: async () => {
    try {
      const response = await axiosInstance.get("/agent/commission/summary/");
      return response.data;
    } catch (error) {
      console.error("Error fetching commission summary:", error);
      return {
        total_commission: 0,
        pending_commission: 0,
        paid_commission: 0,
        this_month: 0,
        last_month: 0,
        by_sme: [],
      };
    }
  },

  // ============= DASHBOARD STATS =============
  getDashboardStats: async () => {
    try {
      const [assignedSMEs, products, orders, orderStats] = await Promise.all([
        agentService.getAssignedSMEs(),
        agentService.getAssignedProducts({ limit: 100 }),
        agentService.getAssignedOrders({ limit: 100 }),
        agentService.getOrderStats(),
      ]);
      
      return { assignedSMEs, products, orders, orderStats, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  },

  getDashboardData: async () => {
    try {
      console.log("📊 Fetching complete dashboard data...");
      const profile = await agentService.getProfile();
      if (!profile) throw new Error("No profile found");
      
      const stats = await agentService.getDashboardStats();
      
      return {
        profile,
        assignedSMEs: stats.assignedSMEs,
        products: stats.products,
        orders: stats.orders,
        orderStats: stats.orderStats,
        commission: {
          total_commission: stats.orderStats.total_commission || 0,
          pending_commission: stats.orderStats.pending_commission || 0,
          paid_commission: stats.orderStats.paid_commission || 0,
          this_month: stats.orderStats.this_month || 0,
        },
        stats: {
          totalSMEs: stats.assignedSMEs.length,
          totalProducts: stats.products.length,
          activeProducts: stats.products.filter(p => p.status === "active" && p.is_active).length,
          pendingProducts: stats.products.filter(p => p.status === "pending").length,
          totalOrders: stats.orders.length,
          pendingOrders: stats.orders.filter(o => o.status === "pending" || o.status === "processing").length,
          deliveredOrders: stats.orders.filter(o => o.status === "delivered").length,
          totalRevenue: stats.orders
            .filter(o => o.status === "delivered" || o.status === "paid")
            .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
        },
      };
    } catch (error) {
      console.error("❌ Error fetching dashboard data:", error);
      return {
        profile: null,
        assignedSMEs: [],
        products: [],
        orders: [],
        orderStats: {},
        commission: { total_commission: 0, pending_commission: 0, paid_commission: 0, this_month: 0 },
        stats: { totalSMEs: 0, totalProducts: 0, activeProducts: 0, pendingProducts: 0, totalOrders: 0, pendingOrders: 0, deliveredOrders: 0, totalRevenue: 0 },
      };
    }
  },

  // ============= UTILITY FUNCTIONS =============
  formatPrice: (price, currency = "ZAR") => {
    if (!price) return "R0.00";
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price);
  },

  formatDate: (dateString, format = "short") => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (format === "short") {
        return date.toLocaleDateString("en-ZA");
      } else if (format === "long") {
        return date.toLocaleDateString("en-ZA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } else if (format === "datetime") {
        return date.toLocaleString("en-ZA");
      }
      return date.toLocaleDateString("en-ZA");
    } catch {
      return "N/A";
    }
  },

  getStatusColor: (status) => {
    const colors = {
      active: "#00c853",
      pending: "#ff9800",
      draft: "#9e9e9e",
      rejected: "#f44336",
      inactive: "#9e9e9e",
      processing: "#2196f3",
      paid: "#4caf50",
      delivered: "#00c853",
      cancelled: "#f44336",
      shipped: "#2196f3",
      completed: "#4caf50",
    };
    return colors[status?.toLowerCase()] || "#9e9e9e";
  },

  clearAgentData: () => {
    localStorage.removeItem("izozo_tokens");
    sessionStorage.clear();
  },
};

export default agentService;