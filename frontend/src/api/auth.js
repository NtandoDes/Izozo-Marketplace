import api from "./api";

export const registerCustomer = (payload) =>
  api.post("/users/register/", payload);

export const registerAgent = (payload) =>
  api.post("/agents/register/", payload);

export const registerSME = (payload) =>
  api.post("/smes/register/", payload);

export const login = (payload) =>
  api.post("/auth/login/", payload); // <-- update if your login URL differs


