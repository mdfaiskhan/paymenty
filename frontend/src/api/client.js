import axios from "axios";

const TOKEN_KEY = "paymenty_token";
const LOCAL_API_URL = "http://localhost:5000";
const RENDER_API_URL = "https://paymenty-backend.onrender.com";

function resolveApiBaseUrl() {
  const isLocalRuntime = typeof window !== "undefined"
    ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    : true;

  // Highest priority: explicit environment variable
  const envUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (envUrl) {
    // Guard against accidental production misconfiguration like localhost on Render.
    if (!isLocalRuntime && /localhost|127\.0\.0\.1/i.test(envUrl)) {
      return RENDER_API_URL;
    }
    return envUrl;
  }

  // Safe fallback mode:
  // Default to Render backend unless explicitly configured via VITE_API_BASE_URL.
  // This avoids localhost:5000 404 errors when frontend is run without local API.
  if (typeof window !== "undefined") {
    return RENDER_API_URL;
  }

  return RENDER_API_URL;
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000
});

export function attachToken(token) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

apiClient.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error?.config;
    const hasResponse = Boolean(error?.response);
    const status = Number(error?.response?.status || 0);
    const requestUrl = String(originalConfig?.url || "");
    const currentBaseUrl = String(originalConfig?.baseURL || apiClient.defaults.baseURL || "");
    const isApiPath = requestUrl.startsWith("/api/");
    const isAnalyticsPath = /^\/api\/analytics\//.test(requestUrl);

    // Retry once on local backend failures by switching from local API to Render API.
    // Handles both network failure and accidental 404 from wrong local service.
    if (originalConfig && !originalConfig.__fallbackRetried) {
      const isLocalBase = /localhost|127\.0\.0\.1/i.test(currentBaseUrl);
      const shouldFallback =
        !hasResponse ||
        (status === 404 && isApiPath) ||
        (status === 400 && isAnalyticsPath);
      if (isLocalBase && shouldFallback) {
        originalConfig.__fallbackRetried = true;
        if (status === 400 && isAnalyticsPath && originalConfig.params) {
          // Strip potentially invalid custom range and retry using default analytics window.
          const nextParams = { ...originalConfig.params };
          delete nextParams.startDate;
          delete nextParams.endDate;
          originalConfig.params = nextParams;
        }
        originalConfig.baseURL = RENDER_API_URL;
        return apiClient.request(originalConfig);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
