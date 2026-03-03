import apiClient from "./client";

function ownerHeaders() {
  if (typeof window === "undefined") {
    return {};
  }
  const password = window.sessionStorage.getItem("owner_expenditure_password");
  return password ? { "x-owner-password": password } : {};
}

export async function getOwnersAnalyticsApi(params = {}) {
  const { data } = await apiClient.get("/api/owners/analytics", { params, headers: ownerHeaders() });
  return data;
}

export async function createOwnerApi(payload) {
  const { data } = await apiClient.post("/api/owners", payload, { headers: ownerHeaders() });
  return data;
}

export async function updateOwnerApi(id, payload) {
  const { data } = await apiClient.put(`/api/owners/${id}`, payload, { headers: ownerHeaders() });
  return data;
}

export async function deleteOwnerApi(id) {
  const { data } = await apiClient.delete(`/api/owners/${id}`, { headers: ownerHeaders() });
  return data;
}

export async function addOwnerCommissionRuleApi(id, payload) {
  const { data } = await apiClient.post(`/api/owners/${id}/commission-rules`, payload, {
    headers: ownerHeaders()
  });
  return data;
}

export async function getOwnerBreakdownApi(id, params) {
  const { data } = await apiClient.get(`/api/owners/${id}/breakdown`, { params, headers: ownerHeaders() });
  return data;
}

export async function upsertOwnerDailyHoursApi(id, payload) {
  const { data } = await apiClient.post(`/api/owners/${id}/daily-hours`, payload, { headers: ownerHeaders() });
  return data;
}
