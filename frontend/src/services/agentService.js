// frontend/src/services/agentService.js
import axios from "axios";

// eslint-disable-next-line no-undef
const API_URL = "https://izozo.izozo.co.za/api";

// Create axios instance with auth header
const getAuthHeader = () => {
  const tokens = localStorage.getItem("izozo_tokens");
  if (tokens) {
    try {
      const { access } = JSON.parse(tokens);
      return { Authorization: `Bearer ${access}` };
    } catch (error) {
      console.error("Error parsing tokens:", error);
      localStorage.removeItem("izozo_tokens");
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

// Add request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const authHeader = getAuthHeader();
    if (authHeader.Authorization) {
      config.headers.Authorization = authHeader.Authorization;
    }
    console.log(
      `🚀 ${config.method.toUpperCase()} ${config.baseURL}${config.url}`,
      config.data || config.params || "",
    );
    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  },
);

// Add response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(
      `✅ ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status}`,
    );
    return response;
  },
  async (error) => {
    console.error(
      "❌ Response error:",
      error.config?.url,
      error.response?.status,
      error.response?.data,
    );

    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokens = localStorage.getItem("izozo_tokens");
        if (tokens) {
          const { refresh } = JSON.parse(tokens);
          const response = await axios.post(`${API_URL}/auth/refresh/`, {
            refresh: refresh,
          });

          if (response.data.access) {
            const newTokens = {
              ...JSON.parse(tokens),
              access: response.data.access,
            };
            localStorage.setItem("izozo_tokens", JSON.stringify(newTokens));

            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
            return axiosInstance(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        localStorage.removeItem("izozo_tokens");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * PAXI / courier delivery field names that must always be sent as numbers.
 * These are mandatory when creating a product and optional (all-or-nothing)
 * when updating one.
 */
const DELIVERY_FIELDS = ["length_cm", "width_cm", "height_cm", "weight_kg"];

/**
 * Fields that should always be coerced to float before appending to FormData.
 */
const PRICE_FIELDS = [
  "base_price",
  "selling_price",
  "discount_percentage",
  "commission_rate",
];

/**
 * Append the four PAXI delivery fields to a FormData object.
 * Throws a plain-object error if any required field is missing or non-positive.
 *
 * @param {FormData} formData  – target FormData instance
 * @param {object}   data      – source product data object
 * @param {boolean}  required  – when true, all four fields must be present
 */
function appendDeliveryFields(formData, data, required = true) {
  const errors = {};

  for (const field of DELIVERY_FIELDS) {
    const raw = data[field];

    if (raw === undefined || raw === null || raw === "") {
      if (required) {
        errors[field] = `${field} is required`;
      }
      // If not required (update path) just skip missing fields
      continue;
    }

    const num = Number(raw);
    if (isNaN(num) || num <= 0) {
      errors[field] = `${field} must be a positive number`;
      continue;
    }

    // weight_kg stays as decimal; the others are integers
    formData.append(
      field,
      field === "weight_kg" ? parseFloat(num.toFixed(2)) : parseInt(num, 10),
    );
  }

  if (Object.keys(errors).length > 0) {
    throw { field_errors: errors, message: "Invalid delivery dimensions" };
  }
}

// ============================================================================
// AGENT DASHBOARD SERVICES
// ============================================================================

export const agentService = {
  // ============= PROFILE MANAGEMENT =============

  /**
   * Get agent profile
   * GET /api/agent/profile/
   */
  getProfile: async () => {
    try {
      const response = await axiosInstance.get("/agent/profile/");
      return response.data;
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Update agent profile
   * PUT /api/agent/profile/
   */
  updateProfile: async (profileData) => {
    try {
      const response = await axiosInstance.put("/agent/profile/", profileData);
      return response.data;
    } catch (error) {
      console.error("Error updating agent profile:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Register new agent (for registration page)
   * POST /api/auth/register/agent/
   */
  registerAgent: async (registrationData) => {
    try {
      const response = await axiosInstance.post(
        "/auth/register/agent/",
        registrationData,
      );
      if (response.data.tokens) {
        localStorage.setItem(
          "izozo_tokens",
          JSON.stringify(response.data.tokens),
        );
      }
      return response.data;
    } catch (error) {
      console.error("Error registering agent:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= SME ASSIGNMENT MANAGEMENT =============

  /**
   * Get assigned SMEs for the current agent
   * GET /api/agent-assignments/?agent_id={agentId}&active=true
   */
  getAssignedSMEs: async () => {
    try {
      const profile = await agentService.getProfile();
      const agentId = profile.id;

      const response = await axiosInstance.get(
        `/agent-assignments/?agent_id=${agentId}&active=true`,
      );

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

  /**
   * Get all assignments (admin only)
   * GET /api/agent-assignments/
   */
  getAllAssignments: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.agent_id) params.append("agent_id", filters.agent_id);
      if (filters.sme_id) params.append("sme_id", filters.sme_id);
      if (filters.active !== undefined) params.append("active", filters.active);

      const response = await axiosInstance.get(
        `/agent-assignments/?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching assignments:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= CATEGORY MANAGEMENT =============

  /**
   * Get all categories (tree structure)
   * GET /api/categories/tree/
   */
  getCategories: async () => {
    try {
      const response = await axiosInstance.get("/categories/tree/");
      console.log("✅ Categories fetched:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching categories tree:", error);

      try {
        console.log("🔄 Trying flat categories list...");
        const flatResponse = await axiosInstance.get("/categories/");
        console.log("✅ Flat categories fetched:", flatResponse.data);
        return flatResponse.data;
      } catch (flatError) {
        console.error("❌ Error fetching flat categories:", flatError);
        return [];
      }
    }
  },

  /**
   * Get all categories (flat list)
   * GET /api/categories/
   */
  getAllCategories: async () => {
    try {
      const response = await axiosInstance.get("/categories/");
      return response.data;
    } catch (error) {
      console.error("Error fetching all categories:", error);
      return [];
    }
  },

  /**
   * Get category by slug
   * GET /api/categories/{slug}/
   */
  getCategoryBySlug: async (slug) => {
    try {
      const response = await axiosInstance.get(`/categories/${slug}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching category by slug:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Get category attributes
   * GET /api/categories/{categoryId}/attributes/
   */
  getCategoryAttributes: async (categoryId) => {
    try {
      console.log(`🔍 Fetching attributes for category ${categoryId}...`);
      const response = await axiosInstance.get(
        `/categories/${categoryId}/attributes/`,
      );
      console.log(`✅ Attributes for category ${categoryId}:`, response.data);
      return response.data;
    } catch (error) {
      console.error(
        `❌ Error fetching category attributes for ${categoryId}:`,
        error,
      );
      return [];
    }
  },

  // ============= PRODUCT MANAGEMENT =============

  /**
   * Get products for assigned SMEs
   * GET /api/agent/products/
   */
  getAssignedProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.sme_id) params.append("sme_id", filters.sme_id);
      if (filters.search) params.append("search", filters.search);
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.delivery_size_category)
        params.append("delivery_size_category", filters.delivery_size_category);

      const response = await axiosInstance.get(
        `/agent/products/?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  },

  /**
   * Get single product by ID
   * GET /api/agent/products/{productId}/
   */
  getProduct: async (productId) => {
    try {
      const response = await axiosInstance.get(`/agent/products/${productId}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching product:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Create product for assigned SME.
   * POST /api/agent/products/create/
   *
   * Required delivery fields (in productData):
   *   length_cm  {number}  – package length in centimetres  (positive integer)
   *   width_cm   {number}  – package width  in centimetres  (positive integer)
   *   height_cm  {number}  – package height in centimetres  (positive integer)
   *   weight_kg  {number}  – package weight in kilograms    (positive decimal)
   *
   * The backend derives `volume_cm3` and `delivery_size_category` from these
   * values automatically — do not send those fields from the frontend.
   */
  createProduct: async (productData) => {
    try {
      const formData = new FormData();

      // ---- scalar / text / price fields -----------------------------------
      // Exclude fields handled separately below.
      const skipKeys = new Set([
        "images",
        "featured_image",
        "attributes",
        "variants",
        "category_ids",
        ...DELIVERY_FIELDS,
      ]);

      Object.keys(productData).forEach((key) => {
        if (skipKeys.has(key)) return;
        const val = productData[key];
        if (val === undefined || val === null || val === "") return;

        if (PRICE_FIELDS.includes(key)) {
          formData.append(key, parseFloat(val));
        } else {
          formData.append(key, val);
        }
      });

      // ---- category IDs ---------------------------------------------------
      if (Array.isArray(productData.category_ids) && productData.category_ids.length > 0) {
        productData.category_ids.forEach((id) => {
          formData.append("category_ids", id);
        });
      }

      // ---- PAXI delivery dimensions (all four required on create) ----------
      appendDeliveryFields(formData, productData, /* required= */ true);

      // ---- media ----------------------------------------------------------
      if (productData.featured_image) {
        formData.append("featured_image", productData.featured_image);
      }

      if (Array.isArray(productData.images) && productData.images.length > 0) {
        productData.images.forEach((image) => {
          formData.append("images", image);
        });
      }

      // ---- attributes & variants ------------------------------------------
      if (
        productData.attributes &&
        Object.keys(productData.attributes).length > 0
      ) {
        formData.append("attributes", JSON.stringify(productData.attributes));
      }

      if (
        Array.isArray(productData.variants) &&
        productData.variants.length > 0
      ) {
        formData.append("variants", JSON.stringify(productData.variants));
      }

      console.log(
        "📦 Creating product with form data:",
        Object.fromEntries(formData),
      );

      const response = await axiosInstance.post(
        "/agent/products/create/",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      console.log("✅ Product created:", response.data);
      return response.data;
    } catch (error) {
      // Surface field-level delivery validation errors from the helper
      if (error.field_errors) {
        console.error("❌ Delivery field errors:", error.field_errors);
        throw error;
      }
      console.error("❌ Error creating product:", error);
      throw (
        error.response?.data || {
          error: "Failed to create product",
          details: error.message,
        }
      );
    }
  },

  /**
   * Update product.
   * PUT /api/agent/products/{productId}/
   *
   * Delivery fields are optional on update.  If any one of the four is
   * supplied, all four must be provided so the backend can recompute the
   * size category correctly.
   */
  updateProduct: async (productId, productData) => {
    try {
      const formData = new FormData();

      // ---- scalar / text / price fields -----------------------------------
      const skipKeys = new Set([
        "images",
        "featured_image",
        "attributes",
        "variants",
        "category_ids",
        "existing_images",
        ...DELIVERY_FIELDS,
      ]);

      Object.keys(productData).forEach((key) => {
        if (skipKeys.has(key)) return;
        const val = productData[key];
        if (val === undefined || val === null || val === "") return;

        if (PRICE_FIELDS.includes(key)) {
          formData.append(key, parseFloat(val));
        } else {
          formData.append(key, val);
        }
      });

      // ---- category IDs ---------------------------------------------------
      if (
        Array.isArray(productData.category_ids) &&
        productData.category_ids.length > 0
      ) {
        productData.category_ids.forEach((id) => {
          formData.append("category_ids", id);
        });
      }

      // ---- existing images to keep ----------------------------------------
      if (Array.isArray(productData.existing_images)) {
        productData.existing_images.forEach((id) => {
          formData.append("existing_images", id);
        });
      }

      // ---- PAXI delivery dimensions (optional — all-or-nothing) -----------
      const hasAnyDeliveryField = DELIVERY_FIELDS.some(
        (f) =>
          productData[f] !== undefined &&
          productData[f] !== null &&
          productData[f] !== "",
      );

      if (hasAnyDeliveryField) {
        // All four must be present; appendDeliveryFields will throw if not.
        appendDeliveryFields(formData, productData, /* required= */ true);
        console.log("📐 Delivery dimensions included in update");
      }

      // ---- media ----------------------------------------------------------
      if (productData.featured_image) {
        formData.append("featured_image", productData.featured_image);
      }

      if (
        Array.isArray(productData.images) &&
        productData.images.length > 0
      ) {
        productData.images.forEach((image) => {
          formData.append("images", image);
        });
      }

      // ---- attributes & variants ------------------------------------------
      if (
        productData.attributes &&
        Object.keys(productData.attributes).length > 0
      ) {
        formData.append("attributes", JSON.stringify(productData.attributes));
      }

      if (
        Array.isArray(productData.variants) &&
        productData.variants.length > 0
      ) {
        formData.append("variants", JSON.stringify(productData.variants));
      }

      const response = await axiosInstance.put(
        `/agent/products/${productId}/`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      return response.data;
    } catch (error) {
      if (error.field_errors) {
        console.error("❌ Delivery field errors:", error.field_errors);
        throw error;
      }
      console.error("Error updating product:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Delete product
   * DELETE /api/agent/products/{productId}/
   */
  deleteProduct: async (productId) => {
    try {
      await axiosInstance.delete(`/agent/products/${productId}/`);
      return { success: true, message: "Product deleted successfully" };
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error.response?.data || error.message;
    }
  },

  // ============= ORDER MANAGEMENT =============

  /**
   * Get orders for assigned SMEs
   * GET /api/agent/orders/
   */
  getAssignedOrders: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.sme_id) params.append("sme_id", filters.sme_id);
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);

      const response = await axiosInstance.get(
        `/agent/orders/?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching orders:", error);
      return [];
    }
  },

  /**
   * Get single order by ID
   * GET /api/agent/orders/{orderId}/
   */
  getOrder: async (orderId) => {
    try {
      const response = await axiosInstance.get(`/agent/orders/${orderId}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Create assisted order
   * POST /api/agent/orders/create/
   */
  createAssistedOrder: async (orderData) => {
    try {
      const response = await axiosInstance.post(
        "/agent/orders/create/",
        orderData,
      );
      return response.data;
    } catch (error) {
      console.error("Error creating assisted order:", error);
      throw error.response?.data || error.message;
    }
  },

  /**
   * Update order status
   * PATCH /agent/orders/{orderNumber}/status/
   */
  updateOrderStatus: async (orderNumber, payload) => {
    try {
      console.log(`📝 Updating order ${orderNumber} with payload:`, payload);
      const response = await axiosInstance.patch(
        `/agent/orders/${orderNumber}/status/`,
        payload,
      );
      console.log("✅ Status updated:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Error updating order status:", error);

      if (error.response) {
        console.error("❌ Response data:", error.response.data);
        console.error("❌ Response status:", error.response.status);

        throw {
          message:
            error.response.data.error ||
            error.response.data.message ||
            "Failed to update order status",
          details: error.response.data,
          status: error.response.status,
        };
      } else if (error.request) {
        throw {
          message: "No response from server. Please check your connection.",
        };
      } else {
        throw { message: error.message || "Failed to update order status" };
      }
    }
  },

  /**
   * Get order statistics
   * GET /api/agent/orders/stats/
   */
  getOrderStats: async () => {
    try {
      const response = await axiosInstance.get("/agent/orders/stats/");
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

  // ============= DASHBOARD STATISTICS =============

  /**
   * Get dashboard statistics - COMBINES MULTIPLE ENDPOINTS
   */
  getDashboardStats: async () => {
    try {
      const [assignedSMEs, products, orders, orderStats] =
        await Promise.allSettled([
          agentService.getAssignedSMEs(),
          agentService.getAssignedProducts({ limit: 100 }),
          agentService.getAssignedOrders({ limit: 100 }),
          agentService.getOrderStats(),
        ]);

      const assignedSMEsValue =
        assignedSMEs.status === "fulfilled" ? assignedSMEs.value : [];
      const productsValue =
        products.status === "fulfilled" ? products.value : [];
      const ordersValue = orders.status === "fulfilled" ? orders.value : [];
      const orderStatsValue =
        orderStats.status === "fulfilled" ? orderStats.value : {};

      const activeProducts = productsValue.filter(
        (p) => p.status === "active" && p.is_active,
      ).length;
      const pendingProducts = productsValue.filter(
        (p) => p.status === "pending",
      ).length;

      const pendingOrders = ordersValue.filter(
        (o) => o.status === "pending" || o.status === "processing",
      ).length;
      const deliveredOrders = ordersValue.filter(
        (o) => o.status === "delivered",
      ).length;

      const totalRevenue = ordersValue
        .filter((o) => o.status === "delivered" || o.status === "paid")
        .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

      const commission = {
        total_commission: orderStatsValue.total_commission || 0,
        pending_commission: orderStatsValue.pending_commission || 0,
        paid_commission: orderStatsValue.paid_commission || 0,
        this_month: orderStatsValue.this_month || 0,
      };

      console.log("📊 Commission data from stats:", commission);

      return {
        assignedSMEs: assignedSMEsValue,
        products: productsValue.slice(0, 5),
        orders: ordersValue.slice(0, 5),
        orderStats: orderStatsValue,
        totalSMEs: assignedSMEsValue.length,
        totalProducts: productsValue.length,
        activeProducts,
        pendingProducts,
        totalOrders: ordersValue.length,
        pendingOrders,
        deliveredOrders,
        totalRevenue,
        commission,
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return {
        assignedSMEs: [],
        products: [],
        orders: [],
        orderStats: {},
        totalSMEs: 0,
        totalProducts: 0,
        activeProducts: 0,
        pendingProducts: 0,
        totalOrders: 0,
        pendingOrders: 0,
        deliveredOrders: 0,
        totalRevenue: 0,
        commission: {
          total_commission: 0,
          pending_commission: 0,
          paid_commission: 0,
          this_month: 0,
        },
      };
    }
  },

  /**
   * Get complete dashboard data for the AgentDashboard component
   */
  getDashboardData: async () => {
    try {
      console.log("📊 Fetching complete dashboard data...");

      const profile = await agentService.getProfile();

      if (!profile) {
        throw new Error("No profile found");
      }

      const stats = await agentService.getDashboardStats();

      return {
        profile,
        assignedSMEs: stats.assignedSMEs,
        products: stats.products,
        orders: stats.orders,
        orderStats: stats.orderStats,
        commission: stats.commission,
        stats: {
          totalSMEs: stats.totalSMEs,
          totalProducts: stats.totalProducts,
          activeProducts: stats.activeProducts,
          pendingProducts: stats.pendingProducts,
          totalOrders: stats.totalOrders,
          pendingOrders: stats.pendingOrders,
          deliveredOrders: stats.deliveredOrders,
          totalRevenue: stats.totalRevenue,
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
        commission: {
          total_commission: 0,
          pending_commission: 0,
          paid_commission: 0,
          this_month: 0,
        },
        stats: {
          totalSMEs: 0,
          totalProducts: 0,
          activeProducts: 0,
          pendingProducts: 0,
          totalOrders: 0,
          pendingOrders: 0,
          deliveredOrders: 0,
          totalRevenue: 0,
        },
      };
    }
  },

  /**
   * Get orders ready for pickup
   * GET /api/agent/orders/ready-for-pickup/
   *
   * Response items include an `items_delivery` array with per-product PAXI
   * sizing so the agent can see parcel dimensions before collecting.
   */
  getReadyForPickupOrders: async () => {
    try {
      console.log("🔍 Calling API: /agent/orders/ready-for-pickup/");
      const response = await axiosInstance.get(
        "/agent/orders/ready-for-pickup/",
      );
      console.log("📦 Ready for pickup orders response:", response.data);

      let orders = [];

      if (Array.isArray(response.data)) {
        orders = response.data;
      } else if (
        response.data.results &&
        Array.isArray(response.data.results)
      ) {
        orders = response.data.results;
      } else if (response.data.orders && Array.isArray(response.data.orders)) {
        orders = response.data.orders;
      } else {
        console.warn("Unexpected response format:", response.data);
        orders = [];
      }

      if (orders.length > 0) {
        orders.forEach((order, index) => {
          console.log(`📦 Order ${index + 1}:`, {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            sme_name: order.sme_name,
            items_delivery: order.items_delivery,
          });
        });
      }

      console.log("✅ Processed pickup orders:", orders.length);
      return orders;
    } catch (error) {
      console.error("❌ Error fetching ready for pickup orders:", error);
      console.error("Error details:", error.response?.data || error.message);
      return [];
    }
  },

  // ============= COLLECTION MANAGEMENT =============

  /**
   * Mark order as collected (agent picks up from SME)
   * POST /api/agent/orders/{orderId}/collect/
   */
  markOrderAsCollected: async (orderId, collectionData = {}) => {
    try {
      const response = await axiosInstance.post(
        `/agent/orders/${orderId}/collect/`,
        collectionData,
      );
      return response.data;
    } catch (error) {
      console.error("Error marking order as collected:", error);
      throw (
        error.response?.data || { message: "Failed to mark order as collected" }
      );
    }
  },

  /**
   * Mark order as shipped (agent ships to customer)
   * POST /api/agent/orders/{orderId}/ship/
   */
  markOrderAsShipped: async (orderId, shippingData = {}) => {
    try {
      const response = await axiosInstance.post(
        `/agent/orders/${orderId}/ship/`,
        shippingData,
      );
      return response.data;
    } catch (error) {
      console.error("Error marking order as shipped:", error);
      throw (
        error.response?.data || { message: "Failed to mark order as shipped" }
      );
    }
  },

  /**
   * Mark order as delivered (customer receives order)
   * POST /api/agent/orders/{orderId}/deliver/
   */
  markOrderAsDelivered: async (orderId, deliveryData = {}) => {
    try {
      const response = await axiosInstance.post(
        `/agent/orders/${orderId}/deliver/`,
        deliveryData,
      );
      return response.data;
    } catch (error) {
      console.error("Error marking order as delivered:", error);
      throw (
        error.response?.data || { message: "Failed to mark order as delivered" }
      );
    }
  },

  // ============= COMMISSION MANAGEMENT =============

  /**
   * Get agent commission history
   * GET /api/agent/commission/history/
   */
  getCommissionHistory: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);

      const response = await axiosInstance.get(
        `/agent/commission/history/?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching commission history:", error);
      return [];
    }
  },

  /**
   * Get agent commission summary
   * GET /api/agent/commission/summary/
   */
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

  // ============= UTILITY FUNCTIONS =============

  /**
   * Format price to currency
   */
  formatPrice: (price, currency = "ZAR") => {
    if (!price) return "R0.00";
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price);
  },

  /**
   * Format date to local string
   */
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

  /**
   * Get status color for UI
   */
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
    };
    return colors[status.toLowerCase()] || "#9e9e9e";
  },

  /**
   * Derive PAXI size category label from raw dimensions (client-side preview).
   * Mirrors the model's delivery_size_category property.
   *
   * @param {object} p  – { length_cm, width_cm, height_cm, weight_kg }
   * @returns {"SMALL"|"MEDIUM"|"LARGE"|"UNKNOWN"}
   */
  getDeliverySizeCategory: ({ length_cm, width_cm, height_cm, weight_kg }) => {
    const vol = Number(length_cm) * Number(width_cm) * Number(height_cm);
    const kg = Number(weight_kg);
    if (isNaN(vol) || isNaN(kg) || vol <= 0 || kg <= 0) return "UNKNOWN";
    if (vol <= 3000 && kg <= 5) return "SMALL";
    if (vol <= 8000 && kg <= 10) return "MEDIUM";
    return "LARGE";
  },

  /**
   * Clear all agent data (logout)
   */
  clearAgentData: () => {
    localStorage.removeItem("izozo_tokens");
    sessionStorage.clear();
  },
};

export default agentService;