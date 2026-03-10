import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Modal from "../components/Modal";
import MetricCards from "../components/MetricCards";
import EmployeeForm from "../components/EmployeeForm";
import EmployeeTable from "../components/EmployeeTable";
import WorkEntryForm from "../components/WorkEntryForm";
import WorkHistoryView from "../components/WorkHistoryView";
import TrendChart from "../components/TrendChart";
import {
  addWorkApi,
  createEmployeeApi,
  deleteEmployeeApi,
  deleteWorkApi,
  getWorkHistoryApi,
  updateEmployeeApi,
  updateWorkApi
} from "../api/businessApi";
import { getCurrentMonth, monthOptions, todayDateOnly } from "../utils/date";
import { downloadCsv } from "../utils/csv";
import { useAnalytics } from "../context/AnalyticsContext";
import { useBusinesses } from "../context/BusinessContext";
import { toFiniteNumber } from "../utils/number";

export default function BusinessDashboardPage() {
  const { businessType } = useParams();
  const {
    setSelectedBusiness,
    analyticsData,
    loading,
    error,
    refreshAnalytics,
    activeRange
  } = useAnalytics();
  const { businesses } = useBusinesses();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("amountDesc");
  const [sortRange, setSortRange] = useState("total");
  const [addHoursEmployee, setAddHoursEmployee] = useState(null);
  const [historyEmployee, setHistoryEmployee] = useState(null);
  const [editEmployee, setEditEmployee] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyMode, setHistoryMode] = useState("month");
  const [historyMonth, setHistoryMonth] = useState(getCurrentMonth());
  const [historyStartDate, setHistoryStartDate] = useState(todayDateOnly());
  const [historyEndDate, setHistoryEndDate] = useState(todayDateOnly());
  const historyMonthChoices = useMemo(() => monthOptions(12, 0), []);

  useEffect(() => {
    if (businessType) {
      setSelectedBusiness(businessType);
    }
  }, [businessType, setSelectedBusiness]);

  const rows = analyticsData?.employeeBreakdown || [];
  const activeBusiness = businesses.find((b) => b.slug === businessType);
  const pageTitle = analyticsData?.businessName || activeBusiness?.name || businessType;
  const unit = analyticsData?.unit || "earnings";
  const calcType = analyticsData?.calcType || activeBusiness?.calcType || "tailor_slab_v1";
  const filteredRows = useMemo(() => {
    const normalize = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const q = normalize(search);
    if (!q) {
      return rows;
    }

    const tokens = q.split(" ").filter(Boolean);

    return rows.filter(
      (r) => {
        const haystack = [
          normalize(r.name),
          normalize(r.phone),
          normalize(r.email),
          normalize(r.placeId),
          normalize(r.location)
        ].join(" ");

        return tokens.every((token) => haystack.includes(token));
      }
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const num = (v) => Number(v) || 0;
    const metricTotal = (row) => (sortRange === "yesterday" ? num(row.yesterday?.total) : num(row.total?.total));

    copy.sort((a, b) => {
      if (sortBy === "amountAsc") {
        return metricTotal(a) - metricTotal(b);
      }
      if (sortBy === "amountDesc") {
        return metricTotal(b) - metricTotal(a);
      }
      if (sortBy === "nameAsc") {
        return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      }
      if (sortBy === "nameDesc") {
        return String(b.name || "").localeCompare(String(a.name || ""), undefined, { sensitivity: "base" });
      }
      return metricTotal(b) - metricTotal(a);
    });

    return copy;
  }, [filteredRows, sortBy, sortRange]);

  async function addEmployee(payload) {
    await createEmployeeApi(payload);
    await refreshAnalytics({
      businessType,
      startDate: activeRange?.startDate,
      endDate: activeRange?.endDate
    });
  }

  async function saveEmployeeEdit(payload) {
    await updateEmployeeApi(editEmployee.employeeId, payload);
    setEditEmployee(null);
    await refreshAnalytics({
      businessType,
      startDate: activeRange?.startDate,
      endDate: activeRange?.endDate
    });
  }

  async function addHours(payload) {
    await addWorkApi(payload);
    setAddHoursEmployee(null);
    await refreshAnalytics({
      businessType,
      startDate: activeRange?.startDate,
      endDate: activeRange?.endDate
    });
  }

  async function removeEmployee(employee) {
    const ok = window.confirm(`Delete ${employee.name}?`);
    if (!ok) {
      return;
    }
    await deleteEmployeeApi(employee.employeeId);
    await refreshAnalytics({
      businessType,
      startDate: activeRange?.startDate,
      endDate: activeRange?.endDate
    });
  }

  async function openHistory(employee) {
    const month = getCurrentMonth();
    const today = todayDateOnly();
    setHistoryMode("month");
    setHistoryMonth(month);
    setHistoryStartDate(today);
    setHistoryEndDate(today);
    setHistoryEmployee(employee);
    setHistoryOpen(true);
    setHistoryRows([]);
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const result = await getWorkHistoryApi(employee.employeeId, { month });
      setHistoryRows(result.days || []);
    } catch (err) {
      setHistoryError(err.response?.data?.message || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadHistory(employeeId, mode, values) {
    if (mode === "month") {
      return getWorkHistoryApi(employeeId, { month: values.month });
    }
    return getWorkHistoryApi(employeeId, {
      startDate: values.startDate,
      endDate: values.endDate
    });
  }

  async function refreshOpenHistory(nextMode, values) {
    if (!historyEmployee) {
      return;
    }
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const result = await loadHistory(historyEmployee.employeeId, nextMode, values);
      setHistoryRows(result.days || []);
    } catch (err) {
      setHistoryRows([]);
      setHistoryError(err.response?.data?.message || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function changeHistoryMode(mode) {
    setHistoryMode(mode);
    await refreshOpenHistory(mode, {
      month: historyMonth,
      startDate: historyStartDate,
      endDate: historyEndDate
    });
  }

  async function changeHistoryMonth(month) {
    setHistoryMonth(month);
    await refreshOpenHistory("month", {
      month,
      startDate: historyStartDate,
      endDate: historyEndDate
    });
  }

  async function changeHistoryRange(startDate, endDate) {
    setHistoryStartDate(startDate);
    setHistoryEndDate(endDate);
    if (!startDate || !endDate || startDate > endDate) {
      setHistoryRows([]);
      return;
    }
    await refreshOpenHistory("range", {
      month: historyMonth,
      startDate,
      endDate
    });
  }

  async function editHistoryEntry(entryId, payload) {
    await updateWorkApi(entryId, payload);
    if (historyEmployee) {
      const result = await loadHistory(historyEmployee.employeeId, historyMode, {
        month: historyMonth,
        startDate: historyStartDate,
        endDate: historyEndDate
      });
      setHistoryRows(result.days || []);
    }
    await refreshAnalytics({
      businessType,
      startDate: activeRange?.startDate,
      endDate: activeRange?.endDate
    });
  }

  async function deleteHistoryEntry(entryId) {
    await deleteWorkApi(entryId);
    if (historyEmployee) {
      const result = await loadHistory(historyEmployee.employeeId, historyMode, {
        month: historyMonth,
        startDate: historyStartDate,
        endDate: historyEndDate
      });
      setHistoryRows(result.days || []);
    }
    await refreshAnalytics({
      businessType,
      startDate: activeRange?.startDate,
      endDate: activeRange?.endDate
    });
  }

  function exportEmployeesCsv() {
    const csvRows = sortedRows.map((row) => ({
      name: row.name,
      yesterdayHours: row.yesterday?.hours || 0,
      yesterdayTotal: row.yesterday?.total || 0,
      totalHours: row.total?.hours || 0,
      totalCutsOrEarnings: row.total?.total || 0
    }));
    downloadCsv(
      `${businessType}-analytics.csv`,
      ["name", "yesterdayHours", "yesterdayTotal", "totalHours", "totalCutsOrEarnings"],
      csvRows
    );
  }

  function onSortRangeChange(next) {
    setSortRange(next);
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>{pageTitle}</h1>
          <p>Simple earnings activity dashboard</p>
        </div>
        <div className="filters">
          <input
            placeholder="Search employee"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="amountDesc">Amount: High to Low</option>
            <option value="amountAsc">Amount: Low to High</option>
            <option value="nameAsc">Name: A to Z</option>
            <option value="nameDesc">Name: Z to A</option>
          </select>
          <select value={sortRange} onChange={(e) => onSortRangeChange(e.target.value)}>
            <option value="total">Total</option>
            <option value="yesterday">Yesterday</option>
          </select>
          <button className="button ghost" onClick={exportEmployeesCsv} type="button">
            Export CSV
          </button>
        </div>
      </header>

      {error && !analyticsData ? <p className="error-text">{error}</p> : null}
      {error && analyticsData ? <p className="subtext">Showing cached data. Latest refresh failed.</p> : null}
      {loading && !analyticsData ? <p className="card">Loading analytics...</p> : null}

      <EmployeeTable
        unit={unit}
        rows={sortedRows}
        onAddHours={setAddHoursEmployee}
        onHistory={openHistory}
        onEdit={setEditEmployee}
        onDelete={removeEmployee}
      />

      <MetricCards analytics={analyticsData} />
      <TrendChart
        unit={unit}
        dailyTrend={analyticsData?.dailyTrend || []}
        businessName={pageTitle}
        subtitle={`Business: ${pageTitle}`}
      />

      <article className="card section-card">
        <h3>Earnings Activity</h3>
        <div className="table-wrap">
          <table className="responsive-table ledger-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Yesterday</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {!sortedRows.length ? (
                <tr>
                  <td data-label="Status" colSpan={3}>
                    No employee activity found.
                  </td>
                </tr>
              ) : null}
              {sortedRows.map((row) => (
                <tr key={row.employeeId}>
                  <td data-label="Name">
                    <strong>{row.name}</strong>
                  </td>
                  <td data-label="Yesterday">{toFiniteNumber(row.yesterday?.total, 0)}</td>
                  <td data-label="Total">{toFiniteNumber(row.total?.total, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card section-card">
        <h3>Add Employee</h3>
        <EmployeeForm businessType={businessType} onSubmit={addEmployee} />
      </article>

      <Modal
        title={addHoursEmployee ? `Add Hours - ${addHoursEmployee.name}` : "Add Hours"}
        open={Boolean(addHoursEmployee)}
        onClose={() => setAddHoursEmployee(null)}
      >
        {addHoursEmployee ? (
          <WorkEntryForm
            employeeId={addHoursEmployee.employeeId}
            unit={unit}
            calcType={calcType}
            onSubmit={addHours}
          />
        ) : null}
      </Modal>

      <Modal
        title={editEmployee ? `Edit Employee - ${editEmployee.name}` : "Edit Employee"}
        open={Boolean(editEmployee)}
        onClose={() => setEditEmployee(null)}
      >
        {editEmployee ? (
          <EmployeeForm
            businessType={businessType}
            onSubmit={saveEmployeeEdit}
            initial={{
              name: editEmployee.name,
              phone: editEmployee.phone,
              email: editEmployee.email || "",
              placeId: editEmployee.placeId || "",
              location: editEmployee.location
            }}
            submitText="Update"
          />
        ) : null}
      </Modal>

      <Modal
        title={historyEmployee ? `Work History - ${historyEmployee.name}` : "Work History"}
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryEmployee(null);
          setHistoryError("");
          setHistoryLoading(false);
        }}
      >
        <div className="filters">
          <label htmlFor="history-mode">View</label>
          <select id="history-mode" value={historyMode} onChange={(e) => changeHistoryMode(e.target.value)}>
            <option value="month">Monthly</option>
            <option value="range">Range</option>
          </select>

          {historyMode === "month" ? (
            <>
              <label htmlFor="history-month">Month</label>
              <select
                id="history-month"
                value={historyMonth}
                onChange={(e) => changeHistoryMonth(e.target.value)}
              >
                {historyMonthChoices.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {historyMode === "range" ? (
            <>
              <label htmlFor="history-start">From</label>
              <input
                id="history-start"
                type="date"
                value={historyStartDate}
                onChange={(e) => changeHistoryRange(e.target.value, historyEndDate)}
              />
              <label htmlFor="history-end">To</label>
              <input
                id="history-end"
                type="date"
                value={historyEndDate}
                onChange={(e) => changeHistoryRange(historyStartDate, e.target.value)}
              />
            </>
          ) : null}
        </div>
        {historyLoading ? <p className="card">Loading history...</p> : null}
        {historyError ? <p className="error-text">{historyError}</p> : null}
        <WorkHistoryView
          unit={unit}
          calcType={calcType}
          days={historyRows}
          onEditEntry={editHistoryEntry}
          onDeleteEntry={deleteHistoryEntry}
        />
      </Modal>
    </section>
  );
}
