import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createBusinessApi,
  updateBusinessApi,
  deleteBusinessApi,
  getBusinessesApi,
  getEmployeesApi
} from "../api/businessApi";

const BusinessContext = createContext(null);

const DEFAULT_BUSINESSES = [
  {
    name: "Tailor",
    slug: "tailor",
    calcType: "tailor_slab_v1",
    ownerName: "",
    ownerPhone: "",
    ownerCommissionPerHour: 0,
    ownerWorkerCount: 0,
    isActive: true
  },
  {
    name: "Butcher",
    slug: "butcher",
    calcType: "butcher_cuts_v1",
    ownerName: "",
    ownerPhone: "",
    ownerCommissionPerHour: 0,
    ownerWorkerCount: 0,
    isActive: true
  }
];

function prettifyName(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueBySlug(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row?.slug) {
      map.set(row.slug, row);
    }
  });
  return Array.from(map.values());
}

export function BusinessProvider({ children }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshBusinesses() {
    setLoading(true);
    setError("");
    try {
      const rows = await getBusinessesApi();
      const safeRows = Array.isArray(rows) ? rows : [];
      if (safeRows.length > 0) {
        setBusinesses(uniqueBySlug(safeRows));
        return;
      }

      const employees = await getEmployeesApi({});
      const fromEmployees = uniqueBySlug(
        (employees || [])
          .map((emp) => String(emp?.businessType || "").trim().toLowerCase())
          .filter(Boolean)
            .map((slug) => ({
              name: prettifyName(slug),
              slug,
              calcType: "tailor_slab_v1",
              ownerName: "",
              ownerPhone: "",
              ownerCommissionPerHour: 0,
              ownerWorkerCount: 0,
              isActive: true
            }))
      );
      setBusinesses(fromEmployees.length ? fromEmployees : DEFAULT_BUSINESSES);
    } catch (err) {
      try {
        const employees = await getEmployeesApi({});
        const fromEmployees = uniqueBySlug(
          (employees || [])
            .map((emp) => String(emp?.businessType || "").trim().toLowerCase())
            .filter(Boolean)
            .map((slug) => ({
              name: prettifyName(slug),
              slug,
              calcType: "tailor_slab_v1",
              ownerName: "",
              ownerPhone: "",
              ownerCommissionPerHour: 0,
              ownerWorkerCount: 0,
              isActive: true
            }))
        );
        setBusinesses(fromEmployees.length ? fromEmployees : DEFAULT_BUSINESSES);
      } catch {
        setBusinesses(DEFAULT_BUSINESSES);
        setError(err.response?.data?.message || "Failed to load businesses");
      }
    } finally {
      setLoading(false);
    }
  }

  async function addBusiness(payload) {
    const normalizedPayload = {
      name: String(payload?.name || "").trim(),
      ownerName: String(payload?.ownerName || "").trim(),
      ownerPhone: String(payload?.ownerPhone || "").trim(),
      ownerCommissionPerHour: Number(payload?.ownerCommissionPerHour) || 0,
      ownerWorkerCount: Number(payload?.ownerWorkerCount) || 0,
      calcType: payload?.calcType || "tailor_slab_v1",
      ...(String(payload?.slug || "").trim() ? { slug: String(payload.slug).trim() } : {})
    };
    const created = await createBusinessApi(normalizedPayload);
    await refreshBusinesses();
    return created;
  }

  async function editBusiness(id, payload) {
    const normalizedPayload = {
      ...(payload?.name ? { name: String(payload.name).trim() } : {}),
      ...(typeof payload?.ownerName !== "undefined" ? { ownerName: String(payload.ownerName).trim() } : {}),
      ...(typeof payload?.ownerPhone !== "undefined" ? { ownerPhone: String(payload.ownerPhone).trim() } : {}),
      ...(typeof payload?.ownerCommissionPerHour !== "undefined"
        ? { ownerCommissionPerHour: Number(payload.ownerCommissionPerHour) || 0 }
        : {}),
      ...(typeof payload?.ownerWorkerCount !== "undefined"
        ? { ownerWorkerCount: Number(payload.ownerWorkerCount) || 0 }
        : {}),
      ...(payload?.calcType ? { calcType: payload.calcType } : {})
    };
    const updated = await updateBusinessApi(id, normalizedPayload);
    await refreshBusinesses();
    return updated;
  }

  async function removeBusiness(id) {
    const removed = await deleteBusinessApi(id);
    await refreshBusinesses();
    return removed;
  }

  useEffect(() => {
    refreshBusinesses();
  }, []);

  const value = useMemo(
    () => ({
      businesses,
      loading,
      error,
      refreshBusinesses,
      addBusiness,
      editBusiness,
      removeBusiness
    }),
    [businesses, loading, error]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinesses() {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error("useBusinesses must be used inside BusinessProvider");
  }
  return ctx;
}
