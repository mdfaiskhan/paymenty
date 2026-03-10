import axios from "axios";

const TOKEN_KEY = "paymenty_token";
const FORCE_RENDER_API_KEY = "paymenty_force_render_api";
const LOCAL_API_URL = "http://localhost:5000";
const RENDER_API_URL = "https://paymenty-backend.onrender.com";
const DEFAULT_TIMEOUT_MS = 30000;
const LOCAL_FALLBACK_TIMEOUT_MS = 4000;

function canUseSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function shouldForceRenderApi() {
  return canUseSessionStorage() && window.sessionStorage.getItem(FORCE_RENDER_API_KEY) === "true";
}

function markRenderApiForced() {
  if (canUseSessionStorage()) {
    window.sessionStorage.setItem(FORCE_RENDER_API_KEY, "true");
  }
}

function isLocalApiUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ""));
}

function resolveApiBaseUrl() {
  const isLocalRuntime = typeof window !== "undefined"
    ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    : true;
  const useLocalApi = String(import.meta.env.VITE_USE_LOCAL_API || "").trim().toLowerCase() === "true";

  if (shouldForceRenderApi()) {
    return RENDER_API_URL;
  }

  // Highest priority: explicit environment variable
  const envUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (envUrl) {
    const isEnvLocalUrl = isLocalApiUrl(envUrl);
    // Guard against accidental misconfiguration:
    // - deployed frontend should never use localhost
    // - local frontend uses localhost only when explicitly allowed
    if ((!isLocalRuntime && isEnvLocalUrl) || (isLocalRuntime && isEnvLocalUrl && !useLocalApi)) {
      return RENDER_API_URL;
    }
    return envUrl;
  }

  // Safe fallback:
  // default Render, optional local only when explicitly requested.
  if (isLocalRuntime && useLocalApi) {
    return LOCAL_API_URL;
  }
  return RENDER_API_URL;
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: DEFAULT_TIMEOUT_MS
});

let keepAliveTimer = null;

function switchToRenderApi() {
  apiClient.defaults.baseURL = RENDER_API_URL;
  markRenderApiForced();
  startRenderKeepAlive();
}

function startRenderKeepAlive() {
  if (keepAliveTimer || typeof window === "undefined") {
    return;
  }
  const base = String(apiClient.defaults.baseURL || "");
  if (!/onrender\.com/i.test(base)) {
    return;
  }

  const ping = () => {
    apiClient.get("/health", { timeout: 8000 }).catch(() => {
      // Ignore keep-alive ping failures.
    });
  };

  // Wake backend quickly after frontend load, then keep warm.
  ping();
  keepAliveTimer = window.setInterval(ping, 4 * 60 * 1000);
}

export function attachToken(token) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

startRenderKeepAlive();

apiClient.interceptors.request.use((config) => {
  const baseUrl = String(config.baseURL || apiClient.defaults.baseURL || "");
  if (isLocalApiUrl(baseUrl)) {
    const configuredTimeout = Number(config.timeout || DEFAULT_TIMEOUT_MS);
    config.timeout = Math.min(configuredTimeout, LOCAL_FALLBACK_TIMEOUT_MS);
  }

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
    const responseMessage = String(error?.response?.data?.message || "");
    const isOldEnumValidation =
      status === 400 &&
      /Expected 'tailor' \| 'butcher'|Invalid enum value/i.test(responseMessage);

    // Retry once on local backend failures by switching from local API to Render API.
    // Handles network failure, wrong local service 404, and old-schema 400 errors.
    if (originalConfig && !originalConfig.__fallbackRetried) {
      const isLocalBase = isLocalApiUrl(currentBaseUrl);
      const shouldFallback =
        !hasResponse ||
        (status === 404 && isApiPath) ||
        (status === 400 && isAnalyticsPath) ||
        isOldEnumValidation;
      if (isLocalBase && shouldFallback) {
        originalConfig.__fallbackRetried = true;
        if (status === 400 && isAnalyticsPath && originalConfig.params) {
          // Strip potentially invalid custom range and retry using default analytics window.
          const nextParams = { ...originalConfig.params };
          delete nextParams.startDate;
          delete nextParams.endDate;
          originalConfig.params = nextParams;
        }
        switchToRenderApi();
        originalConfig.baseURL = RENDER_API_URL;
        return apiClient.request(originalConfig);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
