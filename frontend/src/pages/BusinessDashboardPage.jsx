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

export default function BusinessDashboardPage() {
  const { businessType } = useParams();
  const {
    setSelectedBusiness,
    analyticsData,
    loading,
    error,
    refreshAnalytics
  } = useAnalytics();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("monthTotalDesc");
  const [addHoursEmployee, setAddHoursEmployee] = useState(null);
  const [historyEmployee, setHistoryEmployee] = useState(null);
  const [editEmployee, setEditEmployee] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyMode, setHistoryMode] = useState("day");
  const [historyMonth, setHistoryMonth] = useState(getCurrentMonth());
  const [historyDay, setHistoryDay] = useState(todayDateOnly());
  const [historyStartDate, setHistoryStartDate] = useState(todayDateOnly());
  const [historyEndDate, setHistoryEndDate] = useState(todayDateOnly());
  const historyMonthChoices = useMemo(() => monthOptions(12, 0), []);

  useEffect(() => {
    if (businessType) {
      setSelectedBusiness(businessType);
    }
  }, [businessType, setSelectedBusiness]);

  const rows = analyticsData?.employeeBreakdown || [];
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

    copy.sort((a, b) => {
      if (sortBy === "monthTotalAsc") {
        return num(a.month?.total) - num(b.month?.total);
      }
      if (sortBy === "todayTotalDesc") {
        return num(b.today?.total) - num(a.today?.total);
      }
      if (sortBy === "nameAsc") {
        return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      }
      if (sortBy === "nameDesc") {
        return String(b.name || "").localeCompare(String(a.name || ""), undefined, { sensitivity: "base" });
      }
      return num(b.month?.total) - num(a.month?.total);
    });

    return copy;
  }, [filteredRows, sortBy]);

  async function addEmployee(payload) {
    await createEmployeeApi(payload);
    await refreshAnalytics(businessType);
  }

  async function saveEmployeeEdit(payload) {
    await updateEmployeeApi(editEmployee.employeeId, payload);
    setEditEmployee(null);
    await refreshAnalytics(businessType);
  }

  async function addHours(payload) {
    await addWorkApi(payload);
    setAddHoursEmployee(null);
    await refreshAnalytics(businessType);
  }

  async function removeEmployee(employee) {
    const ok = window.confirm(`Delete ${employee.name}?`);
    if (!ok) {
      return;
    }
    await deleteEmployeeApi(employee.employeeId);
    await refreshAnalytics(businessType);
  }

  async function openHistory(employee) {
    const month = getCurrentMonth();
    const today = todayDateOnly();
    setHistoryMode("day");
    setHistoryMonth(month);
    setHistoryDay(today);
    setHistoryStartDate(today);
    setHistoryEndDate(today);
    setHistoryEmployee(employee);
    const result = await getWorkHistoryApi(employee.employeeId, {
      startDate: today,
      endDate: today
    });
    setHistoryRows(result.days || []);
    setHistoryOpen(true);
  }

  async function loadHistory(employeeId, mode, values) {
    if (mode === "month") {
      return getWorkHistoryApi(employeeId, { month: values.month });
    }
    if (mode === "range") {
      return getWorkHistoryApi(employeeId, {
        startDate: values.startDate,
        endDate: values.endDate
      });
    }
    return getWorkHistoryApi(employeeId, {
      startDate: values.day,
      endDate: values.day
    });
  }

  async function refreshOpenHistory(nextMode, values) {
    if (!historyEmployee) {
      return;
    }
    const result = await loadHistory(historyEmployee.employeeId, nextMode, values);
    setHistoryRows(result.days || []);
  }

  async function changeHistoryMode(mode) {
    setHistoryMode(mode);
    await refreshOpenHistory(mode, {
      month: historyMonth,
      day: historyDay,
      startDate: historyStartDate,
      endDate: historyEndDate
    });
  }

  async function changeHistoryMonth(month) {
    setHistoryMonth(month);
    await refreshOpenHistory("month", {
      month,
      day: historyDay,
      startDate: historyStartDate,
      endDate: historyEndDate
    });
  }

  async function changeHistoryDay(day) {
    setHistoryDay(day);
    await refreshOpenHistory("day", {
      month: historyMonth,
      day,
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
      day: historyDay,
      startDate,
      endDate
    });
  }

  async function editHistoryEntry(entryId, payload) {
    await updateWorkApi(entryId, payload);
    if (historyEmployee) {
      const result = await loadHistory(historyEmployee.employeeId, historyMode, {
        month: historyMonth,
        day: historyDay,
        startDate: historyStartDate,
        endDate: historyEndDate
      });
      setHistoryRows(result.days || []);
    }
    await refreshAnalytics(businessType);
  }

  async function deleteHistoryEntry(entryId) {
    await deleteWorkApi(entryId);
    if (historyEmployee) {
      const result = await loadHistory(historyEmployee.employeeId, historyMode, {
        month: historyMonth,
        day: historyDay,
        startDate: historyStartDate,
        endDate: historyEndDate
      });
      setHistoryRows(result.days || []);
    }
    await refreshAnalytics(businessType);
  }

  function exportEmployeesCsv() {
    const csvRows = sortedRows.map((row) => ({
      name: row.name,
      todayHours: row.today.hours,
      todayTotal: row.today.total,
      weekHours: row.week.hours,
      weekTotal: row.week.total,
      monthHours: row.month.hours,
      monthTotal: row.month.total
    }));
    downloadCsv(
      `${businessType}-analytics.csv`,
      ["name", "todayHours", "todayTotal", "weekHours", "weekTotal", "monthHours", "monthTotal"],
      csvRows
    );
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>{businessType === "tailor" ? "Tailor Shop" : "Butcher Shop"}</h1>
          <p>Operational intelligence dashboard</p>
        </div>
        <div className="filters">
          <input
            placeholder="Search employee"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="monthTotalDesc">Monthly Earnings: High to Low</option>
            <option value="monthTotalAsc">Monthly Earnings: Low to High</option>
            <option value="todayTotalDesc">Today Earnings: High to Low</option>
            <option value="nameAsc">Name: A to Z</option>
            <option value="nameDesc">Name: Z to A</option>
          </select>
          <button className="button ghost" onClick={exportEmployeesCsv} type="button">
            Export CSV
          </button>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="card">Loading analytics...</p> : null}

      <EmployeeTable
        businessType={businessType}
        rows={sortedRows}
        onAddHours={setAddHoursEmployee}
        onHistory={openHistory}
        onEdit={setEditEmployee}
        onDelete={removeEmployee}
      />

      <TrendChart businessType={businessType} dailyTrend={analyticsData?.dailyTrend || []} />
      <MetricCards businessType={businessType} analytics={analyticsData} />

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
            businessType={businessType}
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
        }}
      >
        <div className="filters">
          <label htmlFor="history-mode">View</label>
          <select id="history-mode" value={historyMode} onChange={(e) => changeHistoryMode(e.target.value)}>
            <option value="day">Daily</option>
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

          {historyMode === "day" ? (
            <>
              <label htmlFor="history-day">Date</label>
              <input
                id="history-day"
                type="date"
                value={historyDay}
                onChange={(e) => changeHistoryDay(e.target.value)}
              />
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
        <WorkHistoryView
          businessType={businessType}
          days={historyRows}
          onEditEntry={editHistoryEntry}
          onDeleteEntry={deleteHistoryEntry}
        />
      </Modal>
    </section>
  );
}
