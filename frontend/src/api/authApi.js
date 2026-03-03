import apiClient from "./client";

export async function signupApi(payload) {
  const { data } = await apiClient.post("/api/auth/signup", payload);
  return data;
}

export async function loginApi(payload) {
  const { data } = await apiClient.post("/api/auth/login", payload);
  return data;
}
