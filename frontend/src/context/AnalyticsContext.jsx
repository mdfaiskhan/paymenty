import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAnalyticsApi } from "../api/businessApi";

const AnalyticsContext = createContext(null);
const analyticsMemoryCache = new Map();
const ANALYTICS_CACHE_SCHEMA_VERSION = "v4";
const MAX_ANALYTICS_CACHE_ENTRIES = 40;
const ANALYTICS_CACHE_INDEX_KEY = `paymenty_analytics_index_${ANALYTICS_CACHE_SCHEMA_VERSION}`;

function analyticsCacheKey(businessType, range) {
  return [
    ANALYTICS_CACHE_SCHEMA_VERSION,
    String(businessType || ""),
    String(range?.startDate || ""),
    String(range?.endDate || "")
  ].join("|");
}

function isValidAnalyticsPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.total || typeof payload.total !== "object") return false;
  if (!Array.isArray(payload.employeeBreakdown)) return false;
  return true;
}

function normalizeAnalyticsPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const rows = Array.isArray(payload.employeeBreakdown) ? payload.employeeBreakdown : [];
  const normalizedRows = rows.map((row) => {
    const hasTotal = row?.total && typeof row.total === "object";
    const fallbackTotal = { hours: 0, total: 0 };
    return {
      ...row,
      total: hasTotal ? row.total : fallbackTotal
    };
  });

  const aggregate = normalizedRows.reduce(
    (acc, row) => {
      acc.hours += Number(row?.total?.hours) || 0;
      acc.total += Number(row?.total?.total) || 0;
      return acc;
    },
    { hours: 0, total: 0 }
  );

  const hasSummaryTotal = payload.total && typeof payload.total === "object";
  const summaryTotal = hasSummaryTotal
    ? payload.total
    : { totalHours: aggregate.hours, totalEarningsOrCuts: aggregate.total };

  return {
    ...payload,
    employeeBreakdown: normalizedRows,
    total: summaryTotal
  };
}

function normalizeRange(range) {
  const startDate = String(range?.startDate || "").trim();
  const endDate = String(range?.endDate || "").trim();
  if (!startDate || !endDate || startDate > endDate) {
    return { startDate: "", endDate: "" };
  }
  return { startDate, endDate };
}

function readSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(`paymenty_analytics_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidAnalyticsPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pruneMemoryCache() {
  while (analyticsMemoryCache.size > MAX_ANALYTICS_CACHE_ENTRIES) {
    const oldestKey = analyticsMemoryCache.keys().next().value;
    if (!oldestKey) break;
    analyticsMemoryCache.delete(oldestKey);
  }
}

function touchMemoryCache(key, value) {
  if (analyticsMemoryCache.has(key)) {
    analyticsMemoryCache.delete(key);
  }
  analyticsMemoryCache.set(key, value);
  pruneMemoryCache();
}

function readSessionCacheIndex() {
  try {
    const raw = sessionStorage.getItem(ANALYTICS_CACHE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessionCacheIndex(index) {
  try {
    sessionStorage.setItem(ANALYTICS_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignore storage failures.
  }
}

function writeSessionCache(key, value) {
  try {
    const cacheStorageKey = `paymenty_analytics_${key}`;
    const prevIndex = readSessionCacheIndex().filter((k) => k !== key);
    const nextIndex = [...prevIndex, key];
    while (nextIndex.length > MAX_ANALYTICS_CACHE_ENTRIES) {
      const oldestKey = nextIndex.shift();
      if (oldestKey) {
        sessionStorage.removeItem(`paymenty_analytics_${oldestKey}`);
      }
    }
    writeSessionCacheIndex(nextIndex);
    sessionStorage.setItem(cacheStorageKey, JSON.stringify(value));
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
    const nextRange = normalizeRange(
      isObjectArg
        ? {
            startDate: arg.startDate || "",
            endDate: arg.endDate || ""
          }
        : activeRange
    );
    if (!targetBusiness) {
      return;
    }
    const cacheKey = analyticsCacheKey(targetBusiness, nextRange);
    const memoryCached = analyticsMemoryCache.get(cacheKey);
    const cached = memoryCached && isValidAnalyticsPayload(memoryCached) ? memoryCached : readSessionCache(cacheKey);
    if (cached) {
      const normalizedCached = normalizeAnalyticsPayload(cached);
      touchMemoryCache(cacheKey, normalizedCached);
      setAnalyticsData(normalizedCached);
    }

    setLoading(!cached);
    setError("");
    try {
      const data = await getAnalyticsApi(targetBusiness, nextRange);
      const normalizedData = normalizeAnalyticsPayload(data);
      setAnalyticsData(normalizedData);
      if (isValidAnalyticsPayload(normalizedData)) {
        touchMemoryCache(cacheKey, normalizedData);
        writeSessionCache(cacheKey, normalizedData);
      }
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
