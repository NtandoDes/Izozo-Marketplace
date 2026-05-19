import api from "./api";

export const checkout = async (data) => {
  // data includes cart items, address, payment info
  const response = await api.post("/checkout/", data);
  return response.data;
};
