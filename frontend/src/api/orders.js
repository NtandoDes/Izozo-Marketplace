import api from "./api";

// Get order history for logged-in user
export const fetchOrders = async () => {
  const response = await api.get("/orders/");
  return response.data;
};

// Get single order details
export const fetchOrder = async (id) => {
  const response = await api.get(`/orders/${id}/`);
  return response.data;
};
