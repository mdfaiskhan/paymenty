import apiClient from "./client";

export async function getBusinessesApi() {
  const { data } = await apiClient.get("/api/businesses");
  return data;
}

export async function createBusinessApi(payload) {
  const { data } = await apiClient.post("/api/businesses", payload);
  return data;
}

export async function getEmployeesApi({ businessType, search = "" }) {
  const { data } = await apiClient.get("/api/employees", {
    params: { businessType, search: search || undefined }
  });
  return data;
}

export async function createEmployeeApi(payload) {
  const { data } = await apiClient.post("/api/employees", payload);
  return data;
}

export async function updateEmployeeApi(id, payload) {
  const { data } = await apiClient.put(`/api/employees/${id}`, payload);
  return data;
}

export async function deleteEmployeeApi(id) {
  const { data } = await apiClient.delete(`/api/employees/${id}`);
  return data;
}

export async function addWorkApi(payload) {
  const { data } = await apiClient.post("/api/work", payload);
  return data;
}

export async function updateWorkApi(id, payload) {
  const { data } = await apiClient.put(`/api/work/${id}`, payload);
  return data;
}

export async function deleteWorkApi(id) {
  const { data } = await apiClient.delete(`/api/work/${id}`);
  return data;
}

export async function getWorkHistoryApi(employeeId, params = {}) {
  const query =
    typeof params === "string"
      ? { month: params }
      : {
          month: params.month || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined
        };

  const { data } = await apiClient.get("/api/work", {
    params: { employeeId, ...query }
  });
  return data;
}

export async function getAnalyticsApi(businessType) {
  const { data } = await apiClient.get(`/api/analytics/${businessType}`, {
    params: {}
  });
  return data;
}

export async function getReconciliationApi(businessType, month) {
  const { data } = await apiClient.get("/api/payments/reconciliation", {
    params: { businessType, month }
  });
  return data;
}
