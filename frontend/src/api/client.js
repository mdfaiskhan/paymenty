import axios from "axios";

const TOKEN_KEY = "paymenty_token";
const LOCAL_API_URL = "http://localhost:5000";
const RENDER_API_URL = "https://paymenty-backend.onrender.com";

function resolveApiBaseUrl() {
  // Highest priority: explicit environment variable
  const envUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (envUrl) {
    return envUrl;
  }

  // Safe fallback mode:
  // - local frontend => local backend
  // - deployed frontend => Render backend
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    return isLocalhost ? LOCAL_API_URL : RENDER_API_URL;
  }

  return LOCAL_API_URL;
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000
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

export default apiClient;
