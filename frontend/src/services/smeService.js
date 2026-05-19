// frontend/src/services/smeService.js
import axios from "axios";

// eslint-disable-next-line no-undef
const API_URL = "https://izozo.izozo.co.za/api";

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

export const smeService = {
  // ============= PROFILE MANAGEMENT =============
  getProfile: async () => {
    try {
      const response = await axiosInstance.get("/sme/profile/");
      return response.data;
    } catch (error) {
      console.error("Error fetching SME profile:", error);
      throw error.response?.data || error.message;
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await axiosInstance.put("/sme/profile/", profileData);
      return response.data;
    } catch (error) {
      console.error("Error updating SME profile:", error);
      throw error.response?.data || error.message;
    }
  },

  registerSME: async (registrationData) => {
    try {
      const response = await axiosInstance.post("/auth/register/sme/", registrationData);
      if (response.data.tokens) {
        localStorage.setItem("izozo_tokens", JSON.stringify(response.data.tokens));
      }
      return response.data;
    } catch (error) {
      console.error("Error registering SME:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= CATEGORIES (shared/public data) =============

  /**
   * Fetch hierarchical category tree.
   * Falls back gracefully — same endpoint agents use.
   */
  getCategories: async () => {
    try {
      const response = await axiosInstance.get("/categories/");
      return response.data;
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  },

  /**
   * Fetch flat category list (some backends expose this separately).
   */
  getAllCategories: async () => {
    try {
      // Try the flat endpoint first
      const response = await axiosInstance.get("/categories/all/");
      return response.data;
    } catch {
      // Fall back to the same tree endpoint — the component flattens it anyway
      try {
        const response = await axiosInstance.get("/categories/");
        return response.data;
      } catch (error) {
        console.error("Error fetching all categories:", error);
        return [];
      }
    }
  },

  /**
   * Fetch attributes for a specific category.
   */
  getCategoryAttributes: async (categoryId) => {
    try {
      const response = await axiosInstance.get(`/categories/${categoryId}/attributes/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching attributes for category ${categoryId}:`, error);
      return [];
    }
  },

  // ============= AGENT MANAGEMENT - VIEW ONLY =============
  getAssignedAgents: async () => {
    try {
      const response = await axiosInstance.get("/sme/assigned-agents/");
      return response.data.map((agent) => ({
        id: agent.id,
        assignment_id: agent.assignment_id,
        name: agent.name || "Unknown Agent",
        email: agent.email || "",
        phone: agent.phone || "",
        home_address: agent.home_address,
        has_internet: agent.has_internet,
        has_smartphone: agent.has_smartphone,
        assigned_at: agent.assigned_at,
        notes: agent.notes,
        active: agent.active,
      }));
    } catch (error) {
      console.error("Error fetching assigned agents:", error);
      return [];
    }
  },

  // ============= PRODUCT MANAGEMENT =============
  getProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.limit)  params.append("limit",  filters.limit);
      if (filters.search) params.append("search", filters.search);
      if (filters.agent_id) params.append("agent_id", filters.agent_id);
      if (filters.is_active !== undefined) params.append("is_active", filters.is_active);
      if (filters.delivery_size_category) params.append("delivery_size_category", filters.delivery_size_category);

      const response = await axiosInstance.get(`/sme/products/?${params.toString()}`);
      console.log("📦 Products fetched:", response.data.length);
      return response.data;
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  },

  getProductStats: async () => {
    try {
      const response = await axiosInstance.get("/sme/products/stats/");
      console.log("📊 Product stats fetched:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching product stats:", error);
      try {
        const products = await smeService.getProducts({ limit: 1000 });
        const stats = {
          total_products:    products.length,
          active_products:   products.filter((p) => p.status === "active" && p.is_active).length,
          pending_products:  products.filter((p) => p.status === "pending").length,
          draft_products:    products.filter((p) => p.status === "draft").length,
          rejected_products: products.filter((p) => p.status === "rejected").length,
          out_of_stock:      products.filter((p) => p.stock_quantity === 0).length,
          low_stock:         products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5)).length,
          total_value:       products.reduce((sum, p) => sum + parseFloat(p.base_price || 0) * (p.stock_quantity || 0), 0),
          products_by_agent: [],
        };
        const agentMap = {};
        products.forEach((p) => {
          if (p.agent_name) {
            if (!agentMap[p.agent_name]) agentMap[p.agent_name] = { count: 0, active_count: 0 };
            agentMap[p.agent_name].count++;
            if (p.status === "active" && p.is_active) agentMap[p.agent_name].active_count++;
          }
        });
        stats.products_by_agent = Object.entries(agentMap).map(([name, data]) => ({
          agent__user__full_name: name,
          count: data.count,
          active_count: data.active_count,
        }));
        return stats;
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        return {
          total_products: 0, active_products: 0, pending_products: 0,
          draft_products: 0, rejected_products: 0, out_of_stock: 0,
          low_stock: 0, total_value: 0, products_by_agent: [],
        };
      }
    }
  },

  getProduct: async (productId) => {
    try {
      const response = await axiosInstance.get(`/sme/products/${productId}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching product from /sme/products/:id:", error);
      try {
        const response = await axiosInstance.get(`/agent/products/${productId}/`);
        return response.data;
      } catch (agentError) {
        console.error("Error fetching product from /agent/products/:id:", agentError);
        throw error.response?.data || { message: "Failed to load product details" };
      }
    }
  },

  /**
   * Create a new product for this SME.
   * Sends multipart/form-data so images can be included.
   * POST /api/sme/products/create/
   */
  createProduct: async (productData) => {
    try {
      const formData = new FormData();

      // ── Scalar fields ───────────────────────────────────────────────────
      const scalarFields = [
        "name", "description", "short_description",
        "base_price", "selling_price", "discount_percentage", "commission_rate",
        "sku", "barcode", "stock_quantity", "low_stock_threshold",
        "length_cm", "width_cm", "height_cm", "weight_kg",
        "packaging_override",
      ];
      scalarFields.forEach((field) => {
        if (productData[field] !== null && productData[field] !== undefined && productData[field] !== "") {
          formData.append(field, productData[field]);
        }
      });

      // ── Boolean: is_foldable ────────────────────────────────────────────
      formData.append("is_foldable", productData.is_foldable ? "true" : "false");

      // ── category_ids (append each id separately for multipart) ──────────
      if (Array.isArray(productData.category_ids)) {
        productData.category_ids.forEach((id) => formData.append("category_ids", id));
      }

      // ── JSON sub-fields ─────────────────────────────────────────────────
      if (productData.attributes && Object.keys(productData.attributes).length > 0) {
        formData.append("attributes", JSON.stringify(productData.attributes));
      }
      if (productData.variants && productData.variants.length > 0) {
        formData.append("variants", JSON.stringify(productData.variants));
      }

      // ── Images ──────────────────────────────────────────────────────────
      if (productData.featured_image instanceof File) {
        formData.append("featured_image", productData.featured_image);
      }
      if (Array.isArray(productData.images)) {
        productData.images.forEach((img) => {
          if (img instanceof File) formData.append("images", img);
        });
      }

      const response = await axiosInstance.post("/sme/products/create/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("✅ SME product created:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error creating SME product:", error);
      // Surface field-level errors from DRF so the form can display them
      const errData = error.response?.data;
      if (errData && typeof errData === "object" && !errData.message) {
        const enhanced = new Error(errData.error || errData.detail || "Failed to create product");
        enhanced.field_errors = errData;
        throw enhanced;
      }
      throw errData || error.message;
    }
  },

  /**
   * Update an existing SME product.
   * PUT /api/sme/products/{id}/
   */
  updateProduct: async (productId, productData) => {
    try {
      const formData = new FormData();

      // Scalar fields
      const scalarFields = [
        "name", "description", "short_description",
        "base_price", "selling_price", "discount_percentage", "commission_rate",
        "sku", "barcode", "stock_quantity", "low_stock_threshold",
        "length_cm", "width_cm", "height_cm", "weight_kg",
        "packaging_override",
      ];
      scalarFields.forEach((field) => {
        if (productData[field] !== null && productData[field] !== undefined && productData[field] !== "") {
          formData.append(field, productData[field]);
        }
      });

      // Boolean field
      if (productData.is_foldable !== undefined) {
        formData.append("is_foldable", productData.is_foldable ? "true" : "false");
      }

      // Category IDs (if provided)
      if (Array.isArray(productData.category_ids) && productData.category_ids.length > 0) {
        productData.category_ids.forEach((id) => formData.append("category_ids", id));
      }

      // JSON sub-fields (if provided)
      if (productData.attributes && Object.keys(productData.attributes).length > 0) {
        formData.append("attributes", JSON.stringify(productData.attributes));
      }
      if (productData.variants && productData.variants.length > 0) {
        formData.append("variants", JSON.stringify(productData.variants));
      }

      // Images
      if (productData.featured_image instanceof File) {
        formData.append("featured_image", productData.featured_image);
      }
      if (Array.isArray(productData.images)) {
        productData.images.forEach((img) => {
          if (img instanceof File) formData.append("images", img);
        });
      }

      // Existing images to keep (IDs)
      if (Array.isArray(productData.existing_images)) {
        productData.existing_images.forEach((id) => formData.append("existing_images", id));
      }

      const response = await axiosInstance.put(`/sme/products/${productId}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      console.log("✅ Product updated:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error updating product:", error);
      const errData = error.response?.data;
      if (errData && typeof errData === "object") {
        const enhanced = new Error(errData.error || errData.detail || "Failed to update product");
        enhanced.field_errors = errData;
        throw enhanced;
      }
      throw errData || error.message;
    }
  },

  /**
   * Update product status.
   * PATCH /api/sme/products/{id}/status/
   */
  updateProductStatus: async (productId, status, rejectionReason = null) => {
    try {
      const data = { status };
      if (rejectionReason && status === 'rejected') {
        data.rejection_reason = rejectionReason;
      }
      const response = await axiosInstance.patch(`/sme/products/${productId}/status/`, data);
      console.log("✅ Product status updated:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error updating product status:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Delete a product.
   * DELETE /api/sme/products/{id}/
   */
  deleteProduct: async (productId) => {
    try {
      const response = await axiosInstance.delete(`/sme/products/${productId}/`);
      console.log("✅ Product deleted:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get product delivery details (PAXI sizing)
   * GET /api/sme/products/{id}/delivery/
   */
  getProductDeliveryDetails: async (productId) => {
    try {
      const response = await axiosInstance.get(`/sme/products/${productId}/delivery/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching product delivery details:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Update product delivery details
   * PUT /api/sme/products/{id}/delivery/
   */
  updateProductDeliveryDetails: async (productId, deliveryData) => {
    try {
      const response = await axiosInstance.put(`/sme/products/${productId}/delivery/`, deliveryData);
      return response.data;
    } catch (error) {
      console.error("Error updating product delivery details:", error);
      throw error.response?.data || error.message;
    }
  },

  debugProducts: async () => {
    try {
      const results = {};
      try { const r = await axiosInstance.get("/sme/products/?limit=5");   results.smeProducts    = r.data; } catch (e) { results.smeProductsError    = e.message; }
      try { const r = await axiosInstance.get("/agent/products/?limit=5"); results.agentProducts  = r.data; } catch (e) { results.agentProductsError  = e.message; }
      try { const r = await axiosInstance.get("/products/?limit=5");       results.publicProducts = r.data; } catch (e) { results.publicProductsError = e.message; }
      console.log("🔍 Debug Products:", results);
      return results;
    } catch (error) {
      console.error("Debug error:", error);
      return { error: error.message };
    }
  },

  // ============= ORDER MANAGEMENT =============
  getOrders: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status)     params.append("status",     filters.status);
      if (filters.limit)      params.append("limit",      filters.limit);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date)   params.append("end_date",   filters.end_date);
      if (filters.agent_id)   params.append("agent_id",   filters.agent_id);

      const response = await axiosInstance.get(`/sme/orders/?${params.toString()}`);
      console.log("📦 Orders fetched:", response.data.length);
      return response.data;
    } catch (error) {
      console.error("Error fetching orders:", error);
      return [];
    }
  },

  getOrderStats: async () => {
    try {
      const response = await axiosInstance.get("/sme/orders/stats/");
      console.log("📊 Order stats fetched:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching order stats:", error);
      try {
        const orders = await smeService.getOrders({ limit: 1000 });
        const stats = {
          total_orders:        orders.length,
          pending_orders:      orders.filter((o) => o.status === "pending").length,
          processing_orders:   orders.filter((o) => o.status === "processing").length,
          paid_orders:         orders.filter((o) => o.status === "paid").length,
          shipped_orders:      orders.filter((o) => o.status === "shipped").length,
          delivered_orders:    orders.filter((o) => o.status === "delivered").length,
          cancelled_orders:    orders.filter((o) => o.status === "cancelled").length,
          completed_orders:    orders.filter((o) => o.status === "completed").length,
          total_revenue: 0, delivered_revenue: 0, paid_revenue: 0, completed_revenue: 0,
          average_order_value: 0, products_sold: [], by_agent: [],
        };
        orders.forEach((order) => {
          const amount = parseFloat(order.total_amount || 0);
          if (order.status === "delivered")  { stats.delivered_revenue  += amount; stats.total_revenue += amount; }
          else if (order.status === "paid")  { stats.paid_revenue       += amount; stats.total_revenue += amount; }
          else if (order.status === "completed") { stats.completed_revenue += amount; stats.total_revenue += amount; }
        });
        stats.average_order_value = orders.length > 0 ? stats.total_revenue / orders.length : 0;
        const productMap = {};
        orders.forEach((order) => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item) => {
              const name = item.product_name || "Unknown Product";
              if (!productMap[name]) productMap[name] = { product_name: name, total_quantity: 0, total_revenue: 0 };
              productMap[name].total_quantity += item.quantity || 0;
              productMap[name].total_revenue  += parseFloat(item.total || 0);
            });
          }
        });
        stats.products_sold = Object.values(productMap).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10);
        const agentMap = {};
        orders.forEach((order) => {
          if (order.agent_name) {
            if (!agentMap[order.agent_name]) agentMap[order.agent_name] = 0;
            agentMap[order.agent_name] += parseFloat(order.total_amount || 0);
          }
        });
        stats.by_agent = Object.entries(agentMap).map(([name, revenue]) => ({ agent_name: name, revenue }));
        return stats;
      } catch (fallbackError) {
        console.error("Fallback order stats failed:", fallbackError);
        return {
          total_orders: 0, pending_orders: 0, processing_orders: 0, paid_orders: 0,
          shipped_orders: 0, delivered_orders: 0, cancelled_orders: 0, completed_orders: 0,
          total_revenue: 0, delivered_revenue: 0, paid_revenue: 0, completed_revenue: 0,
          average_order_value: 0, products_sold: [], by_agent: [],
        };
      }
    }
  },

  getOrder: async (orderNumber) => {
    try {
      const response = await axiosInstance.get(`/sme/orders/${orderNumber}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error.response?.data || error.message;
    }
  },

  getOrderByNumber: async (orderNumber) => {
    try {
      const response = await axiosInstance.get(`/sme/orders/${orderNumber}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching order by number:", error);
      throw error.response?.data || error.message;
    }
  },

  markOrderReadyForPickup: async (orderNumber, packageData = {}) => {
    try {
      console.log(`📦 Marking order ${orderNumber} as ready for pickup...`);
      const response = await axiosInstance.post(`/sme/orders/${orderNumber}/ready-for-pickup/`, packageData);
      console.log("✅ Order marked as ready for pickup:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Error marking order as ready for pickup:", error);
      throw error.response?.data || { message: "Failed to mark order as ready for pickup" };
    }
  },

  updateOrderStatus: async (orderNumber, status) => {
    try {
      const response = await axiosInstance.patch(`/sme/orders/${orderNumber}/status/`, { status });
      return response.data;
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error.response?.data || error.message;
    }
  },

  cancelOrder: async (orderNumber) => {
    try {
      const response = await axiosInstance.post(`/sme/orders/${orderNumber}/cancel/`);
      return response.data;
    } catch (error) {
      console.error("Error cancelling order:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= DASHBOARD STATS =============
  getDashboardStats: async () => {
    try {
      const [productStats, orderStats, agents, recentProducts, recentOrders] = await Promise.all([
        smeService.getProductStats(),
        smeService.getOrderStats(),
        smeService.getAssignedAgents(),
        smeService.getProducts({ limit: 5 }),
        smeService.getOrders({ limit: 5 }),
      ]);
      return { productStats, orderStats, agents, recentProducts, recentOrders, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  },

  // ============= BULK OPERATIONS =============
  
  /**
   * Bulk update product status
   * POST /api/sme/products/bulk-action/
   */
  bulkUpdateProducts: async (productIds, action) => {
    try {
      const response = await axiosInstance.post("/sme/products/bulk-action/", {
        product_ids: productIds,
        action: action
      });
      return response.data;
    } catch (error) {
      console.error("Error performing bulk action:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Bulk delete products
   */
  bulkDeleteProducts: async (productIds) => {
    return smeService.bulkUpdateProducts(productIds, 'delete');
  },

  /**
   * Bulk activate products
   */
  bulkActivateProducts: async (productIds) => {
    return smeService.bulkUpdateProducts(productIds, 'activate');
  },

  /**
   * Bulk deactivate products
   */
  bulkDeactivateProducts: async (productIds) => {
    return smeService.bulkUpdateProducts(productIds, 'deactivate');
  },

  // ============= EXPORT FUNCTIONS =============
  
  /**
   * Export products to CSV
   * GET /api/sme/products/export/
   */
  exportProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.format) params.append("format", filters.format);
      
      const response = await axiosInstance.get(`/sme/products/export/?${params.toString()}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error("Error exporting products:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= REVIEW MANAGEMENT =============
  
  /**
   * Get product reviews
   * GET /api/sme/products/{id}/reviews/
   */
  getProductReviews: async (productId, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.rating) params.append("rating", filters.rating);
      
      const response = await axiosInstance.get(`/sme/products/${productId}/reviews/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching product reviews:", error);
      return [];
    }
  },

  /**
   * Reply to a product review
   * POST /api/sme/products/reviews/{reviewId}/reply/
   */
  replyToReview: async (reviewId, replyText) => {
    try {
      const response = await axiosInstance.post(`/sme/products/reviews/${reviewId}/reply/`, {
        reply: replyText
      });
      return response.data;
    } catch (error) {
      console.error("Error replying to review:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= INVENTORY MANAGEMENT =============
  
  /**
   * Update inventory for multiple products
   * POST /api/sme/products/inventory/batch-update/
   */
  batchUpdateInventory: async (updates) => {
    try {
      const response = await axiosInstance.post("/sme/products/inventory/batch-update/", {
        updates: updates
      });
      return response.data;
    } catch (error) {
      console.error("Error batch updating inventory:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get low stock products
   */
  getLowStockProducts: async () => {
    try {
      const products = await smeService.getProducts({ limit: 1000 });
      return products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5));
    } catch (error) {
      console.error("Error fetching low stock products:", error);
      return [];
    }
  },

  /**
   * Get out of stock products
   */
  getOutOfStockProducts: async () => {
    try {
      const products = await smeService.getProducts({ limit: 1000 });
      return products.filter(p => p.stock_quantity === 0);
    } catch (error) {
      console.error("Error fetching out of stock products:", error);
      return [];
    }
  },

  // ============= HELPER FUNCTIONS =============
  
  /**
   * Format product data for API submission
   */
  formatProductForSubmission: (formData) => {
    const formatted = {
      name: formData.name,
      description: formData.description,
      short_description: formData.short_description || "",
      base_price: parseFloat(formData.base_price),
      discount_percentage: parseFloat(formData.discount_percentage) || 0,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      low_stock_threshold: parseInt(formData.low_stock_threshold) || 5,
      sku: formData.sku || "",
      barcode: formData.barcode || "",
      length_cm: parseInt(formData.length_cm) || 1,
      width_cm: parseInt(formData.width_cm) || 1,
      height_cm: parseInt(formData.height_cm) || 1,
      weight_kg: parseFloat(formData.weight_kg) || 0.1,
      is_foldable: formData.is_foldable === true,
      packaging_override: formData.packaging_override || "none",
      category_ids: formData.category_ids || [],
    };
    
    if (formData.selling_price) {
      formatted.selling_price = parseFloat(formData.selling_price);
    }
    
    if (formData.commission_rate) {
      formatted.commission_rate = parseFloat(formData.commission_rate);
    }
    
    return formatted;
  },
};

export default smeService;