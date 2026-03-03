import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAnalyticsApi } from "../api/businessApi";

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshAnalytics(businessArg) {
    const targetBusiness = businessArg || selectedBusiness;
    if (!targetBusiness) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getAnalyticsApi(targetBusiness);
      setAnalyticsData(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedBusiness) {
      refreshAnalytics(selectedBusiness);
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
      refreshAnalytics
    }),
    [selectedBusiness, analyticsData, loading, error]
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
