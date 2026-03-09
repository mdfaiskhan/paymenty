import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAnalyticsApi } from "../api/businessApi";

const AnalyticsContext = createContext(null);
const analyticsMemoryCache = new Map();

function analyticsCacheKey(businessType, range) {
  return [
    String(businessType || ""),
    String(range?.startDate || ""),
    String(range?.endDate || "")
  ].join("|");
}

function readSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(`paymenty_analytics_${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSessionCache(key, value) {
  try {
    sessionStorage.setItem(`paymenty_analytics_${key}`, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export function AnalyticsProvider({ children }) {
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeRange, setActiveRange] = useState({ startDate: "", endDate: "" });

  async function refreshAnalytics(arg) {
    const isObjectArg = arg && typeof arg === "object";
    const targetBusiness = isObjectArg ? arg.businessType || selectedBusiness : arg || selectedBusiness;
    const nextRange = isObjectArg
      ? {
          startDate: arg.startDate || "",
          endDate: arg.endDate || ""
        }
      : activeRange;
    if (!targetBusiness) {
      return;
    }
    const cacheKey = analyticsCacheKey(targetBusiness, nextRange);
    const cached = analyticsMemoryCache.get(cacheKey) || readSessionCache(cacheKey);
    if (cached) {
      setAnalyticsData(cached);
    }

    setLoading(!cached);
    setError("");
    try {
      const data = await getAnalyticsApi(targetBusiness, nextRange);
      setAnalyticsData(data);
      analyticsMemoryCache.set(cacheKey, data);
      writeSessionCache(cacheKey, data);
      setActiveRange(nextRange);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedBusiness) {
      refreshAnalytics({
        businessType: selectedBusiness,
        startDate: activeRange.startDate,
        endDate: activeRange.endDate
      });
    } else {
      setAnalyticsData(null);
    }
  }, [selectedBusiness]);

  const value = useMemo(
    () => ({
      selectedBusiness,
      setSelectedBusiness,
      analyticsData,
      loading,
      error,
      refreshAnalytics,
      activeRange
    }),
    [selectedBusiness, analyticsData, loading, error, activeRange]
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    throw new Error("useAnalytics must be used inside AnalyticsProvider");
  }
  return ctx;
}
