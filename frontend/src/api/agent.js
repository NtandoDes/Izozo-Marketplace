import axios from "axios";

// Base Axios instance for all API calls
const api = axios.create({
  baseURL: "https://izozo.izozo.co.za/api", // replace with your backend URL
  headers: {
    "Content-Type": "application/json",
  },
});

// Add Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

/* ===========================
   PRODUCT ENDPOINTS
=========================== */

// Fetch all products created by the agent
export const fetchAllProducts = async () => {
  const response = await api.get("products/");
  return response.data;
};

// Create a new product
export const createProduct = async (productData) => {
  const response = await api.post("products/", productData);
  return response.data;
};

// Update an existing product
export const updateProduct = async (id, productData) => {
  const response = await api.put(`products/${id}/`, productData);
  return response.data;
};

// Delete a product
export const deleteProduct = async (id) => {
  const response = await api.delete(`products/${id}/`);
  return response.data;
};

/* ===========================
   ORDER ENDPOINTS (AGENT PLACING ORDERS)
=========================== */

// Fetch all orders (agent view)
export const fetchOrders = async () => {
  const response = await api.get("orders/");
  return response.data;
};

// Create a new order on behalf of a customer
export const createOrder = async (orderData) => {
  const response = await api.post("orders/checkout/", orderData);
  return response.data;
};

// Update order status (e.g., processing, shipped)
export const updateOrderStatus = async (orderId, statusData) => {
  const response = await api.patch(`orders/${orderId}/`, statusData);
  return response.data;
};

export default api;
