import api from "./api";

// Fetch all products
export const fetchProducts = async () => {
  const response = await api.get("/products/");
  return response.data;
};

// Fetch single product by ID
export const fetchProduct = async (id) => {
  const response = await api.get(`/products/${id}/`);
  return response.data;
};
