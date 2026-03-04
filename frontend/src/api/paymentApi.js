import apiClient from "./client";

export async function getPaymentsSummaryApi(params) {
  const { data } = await apiClient.get("/api/payments/summary", { params });
  return data;
}

export async function getPaymentsApi(params) {
  const { data } = await apiClient.get("/api/payments", { params });
  return data;
}

export async function createPaymentApi(payload) {
  const { data } = await apiClient.post("/api/payments", payload);
  return data;
}

export async function updatePaymentApi(id, payload) {
  const { data } = await apiClient.put(`/api/payments/${id}`, payload);
  return data;
}

export async function deletePaymentApi(id) {
  const { data } = await apiClient.delete(`/api/payments/${id}`);
  return data;
}
