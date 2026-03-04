import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import PaymentTrendChart from "../components/PaymentTrendChart";
import {
  createPaymentApi,
  deletePaymentApi,
  getPaymentsApi,
  getPaymentsSummaryApi,
  updatePaymentApi
} from "../api/paymentApi";
import { formatTwoDecimals, toFiniteNumber } from "../utils/number";
import { getCurrentMonth, todayDateOnly } from "../utils/date";

function money(v) {
  return formatTwoDecimals(v, 0);
}

function humanDate(input) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

function dateToLocalYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: dateToLocalYmd(monday),
    end: dateToLocalYmd(sunday)
  };
}

function getMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: dateToLocalYmd(start),
    end: dateToLocalYmd(end)
  };
}

function monthBoundsFromValue(monthValue) {
  const [year, mm] = String(monthValue || "").split("-").map(Number);
  if (!year || !mm) {
    return getMonthBounds();
  }
  const start = new Date(year, mm - 1, 1);
  const end = new Date(year, mm, 0);
  return {
    start: dateToLocalYmd(start),
    end: dateToLocalYmd(end)
  };
}

function rangeDates(rangeType, customStart, customEnd) {
  if (rangeType === "today") {
    const today = todayDateOnly();
    return { start: today, end: today };
  }
  if (rangeType === "week") {
    return getWeekBounds();
  }
  if (rangeType === "month") {
    return getMonthBounds();
  }
  return { start: customStart, end: customEnd };
}

function buildStatus(computedAmount, paidAmount) {
  const computed = toFiniteNumber(computedAmount, 0);
  const paid = toFiniteNumber(paidAmount, 0);
  if (paid <= 0) return "pending";
  if (paid >= computed) return "paid";
  return "partial";
}

export default function PaymentsPage() {
  const [businessType, setBusinessType] = useState("all");
  const [rangeType, setRangeType] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [customStartDate, setCustomStartDate] = useState(todayDateOnly());
  const [customEndDate, setCustomEndDate] = useState(todayDateOnly());
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    totalEarned: 0,
    totalPaid: 0,
    pendingBalance: 0,
    trend: [],
    earnedTrend: []
  });
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);

  const [recordRow, setRecordRow] = useState(null);
  const [recordForm, setRecordForm] = useState({
    periodStart: todayDateOnly(),
    periodEnd: todayDateOnly(),
    paidAmount: 0,
    method: "bank",
    referenceId: "",
    notes: ""
  });

  const [historyEntity, setHistoryEntity] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [editForm, setEditForm] = useState({
    paidAmount: 0,
    status: "pending",
    method: "bank",
    referenceId: "",
    notes: ""
  });

  const activeRange = useMemo(() => {
    if (rangeType === "month") {
      return monthBoundsFromValue(selectedMonth);
    }
    return rangeDates(rangeType, customStartDate, customEndDate);
  }, [rangeType, selectedMonth, customStartDate, customEndDate]);

  const summaryLabel = useMemo(() => {
    if (rangeType === "today") return "Earned Money (Today)";
    if (rangeType === "week") return "Earned Money (This Week)";
    if (rangeType === "month") return "Earned Money (This Month)";
    return "Earned Money (Custom Range)";
  }, [rangeType]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const params = {
        businessType,
        rangeType: rangeType === "month" || rangeType === "custom" ? "custom" : rangeType,
        startDate:
          rangeType === "month" || rangeType === "custom" ? activeRange.start : undefined,
        endDate:
          rangeType === "month" || rangeType === "custom" ? activeRange.end : undefined
      };

      const [summaryRes, listRes] = await Promise.all([
        getPaymentsSummaryApi(params),
        getPaymentsApi({ ...params, search })
      ]);
      setSummary(summaryRes);
      setRows(listRes.rows || []);
      setHistory(summaryRes.paymentHistory || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payment dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (rangeType === "custom" && (!customStartDate || !customEndDate || customStartDate > customEndDate)) {
      return;
    }
    loadData();
  }, [businessType, rangeType, selectedMonth, customStartDate, customEndDate, search]);

  function openRecord(row) {
    setRecordRow(row);
    setRecordForm({
      periodStart: activeRange.start,
      periodEnd: activeRange.end,
      paidAmount: Math.max(0, toFiniteNumber(row.pendingBalance, 0)),
      method: "bank",
      referenceId: "",
      notes: ""
    });
  }

  async function submitPayment(e) {
    e.preventDefault();
    if (!recordRow) return;
    const paidAmount = toFiniteNumber(recordForm.paidAmount, 0);
    const computedAmount = toFiniteNumber(recordRow.totalEarned, 0);
    const payload = {
      employeeId: recordRow.employeeId || undefined,
      ownerId: recordRow.ownerId || undefined,
      businessType: recordRow.businessType,
      periodStart: recordForm.periodStart,
      periodEnd: recordForm.periodEnd,
      paidAmount,
      method: recordForm.method,
      referenceId: recordForm.referenceId,
      notes: recordForm.notes,
      status: buildStatus(computedAmount, paidAmount)
    };
    await createPaymentApi(payload);
    setRecordRow(null);
    await loadData();
  }

  function openHistory(row) {
    setHistoryEntity(row);
  }

  const filteredHistory = useMemo(() => {
    if (!historyEntity) return [];
    return history.filter((h) => {
      if (historyEntity.entityType === "owner") {
        return String(h.ownerId || "") === String(historyEntity.ownerId || "");
      }
      return String(h.employeeId || "") === String(historyEntity.employeeId || "");
    });
  }, [historyEntity, history]);

  function openEditPayment(row) {
    setEditPayment(row);
    setEditForm({
      paidAmount: toFiniteNumber(row.paidAmount, 0),
      status: row.status || "pending",
      method: row.method || "bank",
      referenceId: row.referenceId || "",
      notes: row.notes || ""
    });
  }

  async function savePaymentEdit(e) {
    e.preventDefault();
    if (!editPayment) return;
    await updatePaymentApi(editPayment.id, {
      paidAmount: toFiniteNumber(editForm.paidAmount, 0),
      status: editForm.status,
      method: editForm.method,
      referenceId: editForm.referenceId,
      notes: editForm.notes
    });
    setEditPayment(null);
    await loadData();
  }

  async function removePayment(row) {
    const ok = window.confirm("Delete this payment record?");
    if (!ok) return;
    await deletePaymentApi(row.id);
    await loadData();
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Payments</h1>
          <p>Settlement tracking dashboard for Tailor + Butcher earnings, payouts, and pending balances</p>
        </div>
        <div className="filters">
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            <option value="all">All</option>
            <option value="tailor">Tailor</option>
            <option value="butcher">Butcher</option>
          </select>
          <select value={rangeType} onChange={(e) => setRangeType(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setRangeType("month");
            }}
          />
          {rangeType === "custom" ? (
            <>
              <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
              <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
            </>
          ) : null}
          <input placeholder="Search name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="card">Loading payment dashboard...</p> : null}

      <div className="metric-grid payment-metric-grid">
        <article className="card metric-card payment-metric-card">
          <p>{summaryLabel}</p>
          <h3>INR {money(summary.totalEarned)}</h3>
        </article>
        <article className="card metric-card payment-metric-card">
          <p>Paid</p>
          <h3>INR {money(summary.totalPaid)}</h3>
        </article>
        <article className="card metric-card payment-metric-card pending">
          <p>To Be Paid</p>
          <h3>INR {money(summary.pendingBalance)}</h3>
        </article>
      </div>

      <PaymentTrendChart trend={summary.trend || []} />

      <div className="card table-wrap">
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Business Type</th>
              <th>Earned Money</th>
              <th>Paid</th>
              <th>To Be Paid</th>
              <th>Last Payment Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td data-label="Status" colSpan={7}>No payment rows found.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Name">
                  <strong>{row.name}</strong>
                </td>
                <td data-label="Business Type">{row.businessType}</td>
                <td data-label="Earned Money">INR {money(row.totalEarned)}</td>
                <td data-label="Paid">INR {money(row.totalPaid)}</td>
                <td data-label="To Be Paid">INR {money(row.pendingBalance)}</td>
                <td data-label="Last Payment Date">{humanDate(row.lastPaymentDate)}</td>
                <td data-label="Actions">
                  <div className="action-row">
                    <button className="button small ghost" type="button" onClick={() => openHistory(row)}>
                      View Payment History
                    </button>
                    <button className="button small" type="button" onClick={() => openRecord(row)}>
                      Record Payment
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={recordRow ? `Record Payment - ${recordRow.name}` : "Record Payment"} open={Boolean(recordRow)} onClose={() => setRecordRow(null)}>
        {recordRow ? (
          <form className="inline-form payment-form-grid" onSubmit={submitPayment}>
            <input value={recordRow.name} disabled />
            <input value={recordRow.businessType} disabled />
            <input
              type="date"
              value={recordForm.periodStart}
              onChange={(e) => setRecordForm((p) => ({ ...p, periodStart: e.target.value }))}
              required
            />
            <input
              type="date"
              value={recordForm.periodEnd}
              onChange={(e) => setRecordForm((p) => ({ ...p, periodEnd: e.target.value }))}
              required
            />
            <input value={`Computed Earnings: INR ${money(recordRow.totalEarned)}`} disabled />
            <input value={`Hours Worked: ${money(recordRow.hoursWorked)}`} disabled />
            <input
              type="number"
              min="0"
              step="0.01"
              value={recordForm.paidAmount}
              onChange={(e) => setRecordForm((p) => ({ ...p, paidAmount: e.target.value }))}
              placeholder="Paid Amount"
              required
            />
            <select value={recordForm.method} onChange={(e) => setRecordForm((p) => ({ ...p, method: e.target.value }))}>
              <option value="cash">cash</option>
              <option value="bank">bank</option>
              <option value="upi">upi</option>
            </select>
            <input
              placeholder="Reference ID"
              value={recordForm.referenceId}
              onChange={(e) => setRecordForm((p) => ({ ...p, referenceId: e.target.value }))}
            />
            <input
              placeholder="Notes"
              value={recordForm.notes}
              onChange={(e) => setRecordForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <button className="button" type="submit">
              Confirm Payment
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal
        title={historyEntity ? `Payment History - ${historyEntity.name}` : "Payment History"}
        open={Boolean(historyEntity)}
        onClose={() => setHistoryEntity(null)}
      >
        <div className="card table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Period Covered</th>
                <th>Amount Paid</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!filteredHistory.length ? (
                <tr>
                  <td data-label="Status" colSpan={8}>No payment history for selected filters.</td>
                </tr>
              ) : null}
              {filteredHistory.map((row) => (
                <tr key={row.id}>
                  <td data-label="Date">{humanDate(row.paidAt || row.createdAt)}</td>
                  <td data-label="Period Covered">
                    {humanDate(row.periodStart)} - {humanDate(row.periodEnd)}
                  </td>
                  <td data-label="Amount Paid">INR {money(row.paidAmount)}</td>
                  <td data-label="Method">{row.method || "-"}</td>
                  <td data-label="Reference">{row.referenceId || "-"}</td>
                  <td data-label="Status">{row.status}</td>
                  <td data-label="Notes">{row.notes || "-"}</td>
                  <td data-label="Actions">
                    <div className="action-row">
                      <button className="button small ghost" type="button" onClick={() => openEditPayment(row)}>
                        Edit
                      </button>
                      <button className="button small danger" type="button" onClick={() => removePayment(row)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal title={editPayment ? "Edit Payment" : "Edit Payment"} open={Boolean(editPayment)} onClose={() => setEditPayment(null)}>
        {editPayment ? (
          <form className="inline-form payment-form-grid" onSubmit={savePaymentEdit}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editForm.paidAmount}
              onChange={(e) => setEditForm((p) => ({ ...p, paidAmount: e.target.value }))}
              required
            />
            <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="paid">paid</option>
            </select>
            <select value={editForm.method} onChange={(e) => setEditForm((p) => ({ ...p, method: e.target.value }))}>
              <option value="cash">cash</option>
              <option value="bank">bank</option>
              <option value="upi">upi</option>
            </select>
            <input
              placeholder="Reference ID"
              value={editForm.referenceId}
              onChange={(e) => setEditForm((p) => ({ ...p, referenceId: e.target.value }))}
            />
            <input
              placeholder="Notes"
              value={editForm.notes}
              onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <button className="button" type="submit">
              Save Payment
            </button>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}
