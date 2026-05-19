import api from "./api";

// Get user's cart
export const getCart = async () => {
  const response = await api.get("/cart/");
  return response.data;
};

// Add product to cart
export const addToCart = async (productId, quantity) => {
  const response = await api.post("/cart/add/", { product_id: productId, quantity });
  return response.data;
};

// Remove product from cart
export const removeFromCart = async (cartItemId) => {
  const response = await api.delete(`/cart/remove/${cartItemId}/`);
  return response.data;
};
