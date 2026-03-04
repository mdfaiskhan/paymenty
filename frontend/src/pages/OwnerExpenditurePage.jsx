import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import { downloadCsv } from "../utils/csv";
import { getCurrentMonth, todayDateOnly } from "../utils/date";
import { formatTwoDecimals } from "../utils/number";
import DurationPicker from "../components/DurationPicker";
import { getPaymentsSummaryApi } from "../api/paymentApi";
import {
  addOwnerCommissionRuleApi,
  createOwnerPaymentApi,
  createOwnerApi,
  deleteOwnerPaymentApi,
  deleteOwnerApi,
  getOwnerBreakdownApi,
  getOwnerPaymentsApi,
  getOwnerPaymentsSummaryApi,
  getOwnersAnalyticsApi,
  updateOwnerPaymentApi,
  upsertOwnerDailyHoursApi,
  updateOwnerApi
} from "../api/ownerApi";

function formatMoney(v) {
  return formatTwoDecimals(v, 0);
}

function formatHours(v) {
  return formatTwoDecimals(v, 0);
}

function humanDate(input) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

function getMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function buildStatus(computedAmount, paidAmount) {
  const computed = Number(computedAmount) || 0;
  const paid = Number(paidAmount) || 0;
  if (paid <= 0) return "pending";
  if (paid >= computed) return "paid";
  return "partial";
}

export default function OwnerExpenditurePage() {
  const [gatePassword, setGatePassword] = useState("");
  const [unlocked, setUnlocked] = useState(
    typeof window !== "undefined" && Boolean(window.sessionStorage.getItem("owner_expenditure_password"))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState({ cards: {}, owners: [] });
  const [sortBy, setSortBy] = useState("monthDesc");

  const [ownerFormOpen, setOwnerFormOpen] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    name: "",
    phone: "",
    businessType: "tailor",
    workerCount: 0,
    commissionPerHour: 0
  });
  const [commissionModal, setCommissionModal] = useState(null);
  const [commissionForm, setCommissionForm] = useState({
    commissionPerHour: "",
    effectiveFrom: todayDateOnly()
  });

  const [breakdownOwner, setBreakdownOwner] = useState(null);
  const [breakdownMode, setBreakdownMode] = useState("month");
  const [breakdownMonth, setBreakdownMonth] = useState(getCurrentMonth());
  const [breakdownStartDate, setBreakdownStartDate] = useState(todayDateOnly());
  const [breakdownEndDate, setBreakdownEndDate] = useState(todayDateOnly());
  const [breakdownData, setBreakdownData] = useState({ totals: {}, rows: [] });
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [hoursModal, setHoursModal] = useState(null);
  const [hoursForm, setHoursForm] = useState({
    workDate: todayDateOnly(),
    hours: 1,
    note: ""
  });
  const [ownerSettlement, setOwnerSettlement] = useState({
    totalEarned: 0,
    totalPaid: 0,
    pendingBalance: 0,
    paymentHistory: []
  });
  const [ownerSettlementRows, setOwnerSettlementRows] = useState([]);
  const [businessSettlement, setBusinessSettlement] = useState({
    tailorEarned: 0,
    butcherEarned: 0,
    totalEarned: 0
  });
  const [recordOwnerPayment, setRecordOwnerPayment] = useState(null);
  const [recordOwnerPaymentForm, setRecordOwnerPaymentForm] = useState({
    periodStart: getMonthBounds().start,
    periodEnd: getMonthBounds().end,
    paidAmount: 0,
    method: "bank",
    referenceId: "",
    notes: ""
  });
  const [historyOwner, setHistoryOwner] = useState(null);
  const [editOwnerPayment, setEditOwnerPayment] = useState(null);
  const [editOwnerPaymentForm, setEditOwnerPaymentForm] = useState({
    paidAmount: 0,
    status: "pending",
    method: "bank",
    referenceId: "",
    notes: ""
  });

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const [data, settlementSummary, settlementRows, tailorSummary, butcherSummary] = await Promise.all([
        getOwnersAnalyticsApi(),
        getOwnerPaymentsSummaryApi({ rangeType: "month" }),
        getOwnerPaymentsApi({ rangeType: "month" }),
        getPaymentsSummaryApi({ businessType: "tailor", rangeType: "month" }),
        getPaymentsSummaryApi({ businessType: "butcher", rangeType: "month" })
      ]);
      setAnalytics(data);
      setOwnerSettlement(settlementSummary);
      setOwnerSettlementRows(settlementRows.rows || []);
      const tailorEarned = Number(tailorSummary?.totalEarned) || 0;
      const butcherEarned = Number(butcherSummary?.totalEarned) || 0;
      setBusinessSettlement({
        tailorEarned,
        butcherEarned,
        totalEarned: tailorEarned + butcherEarned
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load owner analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) {
      loadAnalytics();
    }
  }, [unlocked]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("owner_expenditure_password");
      }
    };
  }, []);

  async function unlockOwnerModule(e) {
    e.preventDefault();
    if (!gatePassword.trim()) {
      setError("Password is required");
      return;
    }
    setError("");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("owner_expenditure_password", gatePassword.trim());
    }
    try {
      await getOwnersAnalyticsApi();
      setUnlocked(true);
      setGatePassword("");
    } catch (err) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("owner_expenditure_password");
      }
      setUnlocked(false);
      setError(err.response?.data?.message || "Invalid owner module password");
    }
  }

  function lockOwnerModule() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("owner_expenditure_password");
    }
    setUnlocked(false);
    setAnalytics({ cards: {}, owners: [] });
    setOwnerSettlement({ totalEarned: 0, totalPaid: 0, pendingBalance: 0, paymentHistory: [] });
    setOwnerSettlementRows([]);
    setBusinessSettlement({ tailorEarned: 0, butcherEarned: 0, totalEarned: 0 });
    setBreakdownOwner(null);
    setCommissionModal(null);
    setOwnerFormOpen(false);
  }

  const ownerRows = useMemo(() => {
    const rows = [...(analytics.owners || [])];
    const settlementByOwner = new Map(
      (ownerSettlementRows || []).map((row) => [String(row.ownerId), row])
    );
    const merged = rows.map((row) => {
      const financial = settlementByOwner.get(String(row.ownerId));
      return {
        ...row,
        earnedMoney: financial?.totalEarned || 0,
        paidMoney: financial?.totalPaid || 0,
        toBePaidMoney: financial?.pendingBalance || 0,
        lastPaymentDate: financial?.lastPaymentDate || null
      };
    });
    merged.sort((a, b) => {
      if (sortBy === "monthAsc") return (a.monthCommission || 0) - (b.monthCommission || 0);
      if (sortBy === "todayDesc") return (b.todayCommission || 0) - (a.todayCommission || 0);
      if (sortBy === "nameAsc") return String(a.name || "").localeCompare(String(b.name || ""));
      return (b.monthCommission || 0) - (a.monthCommission || 0);
    });
    return merged;
  }, [analytics.owners, ownerSettlementRows, sortBy]);

  async function submitOwner(e) {
    e.preventDefault();
    setError("");
    try {
      await createOwnerApi(ownerForm);
      setOwnerFormOpen(false);
      setOwnerForm({
        name: "",
        phone: "",
        businessType: "tailor",
        workerCount: 0,
        commissionPerHour: 0
      });
      await loadAnalytics();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create owner");
    }
  }

  async function saveCommission(e) {
    e.preventDefault();
    if (!commissionModal) return;
    setError("");
    try {
      await addOwnerCommissionRuleApi(commissionModal.ownerId, commissionForm);
      setCommissionModal(null);
      await loadAnalytics();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update commission");
    }
  }

  async function removeOwner(owner) {
    const ok = window.confirm(`Delete owner ${owner.name}?`);
    if (!ok) return;
    await deleteOwnerApi(owner.ownerId);
    await loadAnalytics();
  }

  async function openBreakdown(owner) {
    setBreakdownOwner(owner);
    await loadBreakdown(owner.ownerId, "month", {
      month: breakdownMonth,
      startDate: breakdownStartDate,
      endDate: breakdownEndDate
    });
  }

  async function loadBreakdown(ownerId, mode, values) {
    setBreakdownLoading(true);
    setError("");
    try {
      const params =
        mode === "month"
          ? { month: values.month }
          : { startDate: values.startDate, endDate: values.endDate };
      const data = await getOwnerBreakdownApi(ownerId, params);
      setBreakdownData(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load breakdown");
      setBreakdownData({ totals: {}, rows: [] });
    } finally {
      setBreakdownLoading(false);
    }
  }

  async function updateBreakdownMode(mode) {
    setBreakdownMode(mode);
    if (!breakdownOwner) return;
    await loadBreakdown(breakdownOwner.ownerId, mode, {
      month: breakdownMonth,
      startDate: breakdownStartDate,
      endDate: breakdownEndDate
    });
  }

  async function updateBreakdownMonth(month) {
    setBreakdownMonth(month);
    if (!breakdownOwner) return;
    await loadBreakdown(breakdownOwner.ownerId, "month", {
      month,
      startDate: breakdownStartDate,
      endDate: breakdownEndDate
    });
  }

  async function updateBreakdownRange(startDate, endDate) {
    setBreakdownStartDate(startDate);
    setBreakdownEndDate(endDate);
    if (!breakdownOwner || !startDate || !endDate || startDate > endDate) return;
    await loadBreakdown(breakdownOwner.ownerId, "range", {
      month: breakdownMonth,
      startDate,
      endDate
    });
  }

  function exportBreakdownCsv() {
    const rows = (breakdownData.rows || []).map((r) => ({
      date: r.date,
      totalWorkerHours: formatHours(r.totalWorkerHours),
      commissionRate: formatMoney(r.commissionRate),
      earned: formatMoney(r.earned)
    }));
    downloadCsv(
      `${breakdownOwner?.name || "owner"}-breakdown.csv`,
      ["date", "totalWorkerHours", "commissionRate", "earned"],
      rows
    );
  }

  async function quickEditOwner(owner) {
    const workerCount = window.prompt("Update worker count", String(owner.workerCount ?? 0));
    if (workerCount == null) return;
    await updateOwnerApi(owner.ownerId, { workerCount: Number(workerCount) || 0 });
    await loadAnalytics();
  }

  async function saveDailyHours(e) {
    e.preventDefault();
    if (!hoursModal) return;
    setError("");
    try {
      await upsertOwnerDailyHoursApi(hoursModal.ownerId, hoursForm);
      setHoursModal(null);
      await loadAnalytics();
      if (breakdownOwner && String(breakdownOwner.ownerId) === String(hoursModal.ownerId)) {
        await loadBreakdown(breakdownOwner.ownerId, breakdownMode, {
          month: breakdownMonth,
          startDate: breakdownStartDate,
          endDate: breakdownEndDate
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save owner daily hours");
    }
  }

  function openRecordOwnerPayment(owner) {
    const month = getMonthBounds();
    setRecordOwnerPayment(owner);
    setRecordOwnerPaymentForm({
      periodStart: month.start,
      periodEnd: month.end,
      paidAmount: Math.max(0, Number(owner.toBePaidMoney) || 0),
      method: "bank",
      referenceId: "",
      notes: ""
    });
  }

  async function saveOwnerPayment(e) {
    e.preventDefault();
    if (!recordOwnerPayment) return;
    await createOwnerPaymentApi({
      ownerId: recordOwnerPayment.ownerId,
      periodStart: recordOwnerPaymentForm.periodStart,
      periodEnd: recordOwnerPaymentForm.periodEnd,
      paidAmount: Number(recordOwnerPaymentForm.paidAmount) || 0,
      method: recordOwnerPaymentForm.method,
      referenceId: recordOwnerPaymentForm.referenceId,
      notes: recordOwnerPaymentForm.notes,
      status: buildStatus(recordOwnerPayment.earnedMoney, recordOwnerPaymentForm.paidAmount)
    });
    setRecordOwnerPayment(null);
    await loadAnalytics();
  }

  function openOwnerPaymentHistory(owner) {
    setHistoryOwner(owner);
  }

  const ownerPaymentHistoryRows = useMemo(() => {
    if (!historyOwner) return [];
    return (ownerSettlement.paymentHistory || []).filter(
      (row) => String(row.ownerId || "") === String(historyOwner.ownerId || "")
    );
  }, [historyOwner, ownerSettlement.paymentHistory]);

  function openEditOwnerPayment(row) {
    setEditOwnerPayment(row);
    setEditOwnerPaymentForm({
      paidAmount: Number(row.paidAmount) || 0,
      status: row.status || "pending",
      method: row.method || "bank",
      referenceId: row.referenceId || "",
      notes: row.notes || ""
    });
  }

  async function saveEditedOwnerPayment(e) {
    e.preventDefault();
    if (!editOwnerPayment) return;
    await updateOwnerPaymentApi(editOwnerPayment.id, {
      paidAmount: Number(editOwnerPaymentForm.paidAmount) || 0,
      status: editOwnerPaymentForm.status,
      method: editOwnerPaymentForm.method,
      referenceId: editOwnerPaymentForm.referenceId,
      notes: editOwnerPaymentForm.notes
    });
    setEditOwnerPayment(null);
    await loadAnalytics();
  }

  async function removeOwnerPayment(row) {
    const ok = window.confirm("Delete this owner payment record?");
    if (!ok) return;
    await deleteOwnerPaymentApi(row.id);
    await loadAnalytics();
  }

  return (
    <section>
      {!unlocked ? (
        <article className="card section-card">
          <h3>Owner Expenditure Access</h3>
          <form className="inline-form" onSubmit={unlockOwnerModule}>
            <input
              type="password"
              placeholder="Enter owner module password"
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              required
            />
            <button className="button" type="submit">
              Unlock
            </button>
          </form>
          {error ? <p className="error-text">{error}</p> : null}
        </article>
      ) : (
        <>
      <header className="page-head">
        <div>
          <h1>Owner Expenditure</h1>
          <p>Owner commission and payout control panel</p>
        </div>
        <div className="filters">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="monthDesc">Month Commission: High to Low</option>
            <option value="monthAsc">Month Commission: Low to High</option>
            <option value="todayDesc">Today Commission: High to Low</option>
            <option value="nameAsc">Name: A to Z</option>
          </select>
          <button className="button ghost" type="button" onClick={lockOwnerModule}>
            Lock
          </button>
          <button className="button" type="button" onClick={() => setOwnerFormOpen(true)}>
            Add Owner
          </button>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="card">Loading owner analytics...</p> : null}

      <div className="metric-grid">
        <article className="card metric-card">
          <p>Tailor Earned (Month)</p>
          <h3>INR {formatMoney(businessSettlement.tailorEarned)}</h3>
        </article>
        <article className="card metric-card">
          <p>Butcher Earned (Month)</p>
          <h3>INR {formatMoney(businessSettlement.butcherEarned)}</h3>
        </article>
        <article className="card metric-card">
          <p>Total Business Earned (Month)</p>
          <h3>INR {formatMoney(businessSettlement.totalEarned)}</h3>
        </article>
        <article className="card metric-card">
          <p>Owner Earned Money (Month)</p>
          <h3>INR {formatMoney(ownerSettlement.totalEarned)}</h3>
        </article>
        <article className="card metric-card">
          <p>Owner Paid</p>
          <h3>INR {formatMoney(ownerSettlement.totalPaid)}</h3>
        </article>
        <article className="card metric-card">
          <p>Owner To Be Paid</p>
          <h3>INR {formatMoney(ownerSettlement.pendingBalance)}</h3>
        </article>
      </div>

      <div className="card table-wrap">
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Owner Name</th>
              <th>Business Type</th>
              <th>Commission / Hour</th>
              <th>Today Hours</th>
              <th>Today Commission</th>
              <th>Month Hours</th>
              <th>Month Commission</th>
              <th>Earned Money</th>
              <th>Paid</th>
              <th>To Be Paid</th>
              <th>Last Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!ownerRows.length ? (
              <tr>
                <td data-label="Status" colSpan={12}>No owners found.</td>
              </tr>
            ) : null}
            {ownerRows.map((owner) => (
              <tr key={owner.ownerId}>
                <td data-label="Owner Name">
                  <strong>{owner.name}</strong>
                  <div className="subtext">{owner.phone}</div>
                  <div className="subtext">Workers: {owner.workerCount}</div>
                </td>
                <td data-label="Business Type">{owner.businessType}</td>
                <td data-label="Commission / Hour">INR {formatMoney(owner.commissionPerHour)}</td>
                <td data-label="Today Hours">{formatHours(owner.todayHours)}</td>
                <td data-label="Today Commission">INR {formatMoney(owner.todayCommission)}</td>
                <td data-label="Month Hours">{formatHours(owner.monthHours)}</td>
                <td data-label="Month Commission">INR {formatMoney(owner.monthCommission)}</td>
                <td data-label="Earned Money">INR {formatMoney(owner.earnedMoney)}</td>
                <td data-label="Paid">INR {formatMoney(owner.paidMoney)}</td>
                <td data-label="To Be Paid">INR {formatMoney(owner.toBePaidMoney)}</td>
                <td data-label="Last Payment">{humanDate(owner.lastPaymentDate)}</td>
                <td data-label="Actions">
                  <div className="action-row">
                    <button
                      className="button small ghost"
                      type="button"
                      onClick={() => {
                        setCommissionModal(owner);
                        setCommissionForm({
                          commissionPerHour: owner.commissionPerHour || 0,
                          effectiveFrom: todayDateOnly()
                        });
                      }}
                    >
                      Edit Commission
                    </button>
                    <button className="button small ghost" type="button" onClick={() => openBreakdown(owner)}>
                      View Breakdown
                    </button>
                    <button className="button small ghost" type="button" onClick={() => quickEditOwner(owner)}>
                      Edit Owner
                    </button>
                    <button
                      className="button small ghost"
                      type="button"
                      onClick={() => {
                        setHoursModal(owner);
                        setHoursForm({ workDate: todayDateOnly(), hours: 1, note: "" });
                      }}
                    >
                      Edit Daily Hours
                    </button>
                    <button className="button small ghost" type="button" onClick={() => openOwnerPaymentHistory(owner)}>
                      View Payments
                    </button>
                    <button className="button small" type="button" onClick={() => openRecordOwnerPayment(owner)}>
                      Record Payment
                    </button>
                    <button className="button small danger" type="button" onClick={() => removeOwner(owner)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Add Owner" open={ownerFormOpen} onClose={() => setOwnerFormOpen(false)}>
        <form className="inline-form" onSubmit={submitOwner}>
          <input
            placeholder="Owner Name"
            value={ownerForm.name}
            onChange={(e) => setOwnerForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            placeholder="Phone Number"
            value={ownerForm.phone}
            onChange={(e) => setOwnerForm((p) => ({ ...p, phone: e.target.value }))}
            required
          />
          <select
            value={ownerForm.businessType}
            onChange={(e) => setOwnerForm((p) => ({ ...p, businessType: e.target.value }))}
          >
            <option value="tailor">tailor</option>
            <option value="butcher">butcher</option>
          </select>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Workers Under Owner"
            value={ownerForm.workerCount}
            onChange={(e) => setOwnerForm((p) => ({ ...p, workerCount: e.target.value }))}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Commission Per Hour"
            value={ownerForm.commissionPerHour}
            onChange={(e) => setOwnerForm((p) => ({ ...p, commissionPerHour: e.target.value }))}
            required
          />
          <button className="button" type="submit">
            Create Owner
          </button>
        </form>
      </Modal>

      <Modal
        title={commissionModal ? `Edit Commission - ${commissionModal.name}` : "Edit Commission"}
        open={Boolean(commissionModal)}
        onClose={() => setCommissionModal(null)}
      >
        <form className="inline-form" onSubmit={saveCommission}>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Commission Per Hour"
            value={commissionForm.commissionPerHour}
            onChange={(e) => setCommissionForm((p) => ({ ...p, commissionPerHour: e.target.value }))}
            required
          />
          <input
            type="date"
            value={commissionForm.effectiveFrom}
            onChange={(e) => setCommissionForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
            required
          />
          <button className="button" type="submit">
            Save Rule
          </button>
        </form>
      </Modal>

      <Modal
        title={hoursModal ? `Owner Daily Hours - ${hoursModal.name}` : "Owner Daily Hours"}
        open={Boolean(hoursModal)}
        onClose={() => setHoursModal(null)}
      >
        <form className="inline-form" onSubmit={saveDailyHours}>
          <input
            type="date"
            value={hoursForm.workDate}
            onChange={(e) => setHoursForm((p) => ({ ...p, workDate: e.target.value }))}
            required
          />
          <DurationPicker
            label="Daily Total Hours"
            value={hoursForm.hours}
            onChange={(nextHours) => setHoursForm((p) => ({ ...p, hours: nextHours }))}
          />
          <input
            placeholder="Note"
            value={hoursForm.note}
            onChange={(e) => setHoursForm((p) => ({ ...p, note: e.target.value }))}
          />
          <button className="button" type="submit">
            Save Daily Hours
          </button>
        </form>
      </Modal>

      <Modal
        title={recordOwnerPayment ? `Record Payment - ${recordOwnerPayment.name}` : "Record Owner Payment"}
        open={Boolean(recordOwnerPayment)}
        onClose={() => setRecordOwnerPayment(null)}
      >
        {recordOwnerPayment ? (
          <form className="inline-form payment-form-grid" onSubmit={saveOwnerPayment}>
            <input value={recordOwnerPayment.name} disabled />
            <input value={recordOwnerPayment.businessType} disabled />
            <input
              type="date"
              value={recordOwnerPaymentForm.periodStart}
              onChange={(e) => setRecordOwnerPaymentForm((p) => ({ ...p, periodStart: e.target.value }))}
              required
            />
            <input
              type="date"
              value={recordOwnerPaymentForm.periodEnd}
              onChange={(e) => setRecordOwnerPaymentForm((p) => ({ ...p, periodEnd: e.target.value }))}
              required
            />
            <input value={`Computed Earned: INR ${formatMoney(recordOwnerPayment.earnedMoney)}`} disabled />
            <input
              type="number"
              min="0"
              step="0.01"
              value={recordOwnerPaymentForm.paidAmount}
              onChange={(e) => setRecordOwnerPaymentForm((p) => ({ ...p, paidAmount: e.target.value }))}
              required
            />
            <select
              value={recordOwnerPaymentForm.method}
              onChange={(e) => setRecordOwnerPaymentForm((p) => ({ ...p, method: e.target.value }))}
            >
              <option value="cash">cash</option>
              <option value="bank">bank</option>
              <option value="upi">upi</option>
            </select>
            <input
              placeholder="Reference ID"
              value={recordOwnerPaymentForm.referenceId}
              onChange={(e) => setRecordOwnerPaymentForm((p) => ({ ...p, referenceId: e.target.value }))}
            />
            <input
              placeholder="Notes"
              value={recordOwnerPaymentForm.notes}
              onChange={(e) => setRecordOwnerPaymentForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <button className="button" type="submit">
              Confirm Payment
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal
        title={historyOwner ? `Owner Payments - ${historyOwner.name}` : "Owner Payments"}
        open={Boolean(historyOwner)}
        onClose={() => setHistoryOwner(null)}
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
              {!ownerPaymentHistoryRows.length ? (
                <tr>
                  <td data-label="Status" colSpan={8}>No owner payment history.</td>
                </tr>
              ) : null}
              {ownerPaymentHistoryRows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Date">{humanDate(row.paidAt || row.createdAt)}</td>
                  <td data-label="Period Covered">
                    {humanDate(row.periodStart)} - {humanDate(row.periodEnd)}
                  </td>
                  <td data-label="Amount Paid">INR {formatMoney(row.paidAmount)}</td>
                  <td data-label="Method">{row.method || "-"}</td>
                  <td data-label="Reference">{row.referenceId || "-"}</td>
                  <td data-label="Status">{row.status}</td>
                  <td data-label="Notes">{row.notes || "-"}</td>
                  <td data-label="Actions">
                    <div className="action-row">
                      <button className="button small ghost" type="button" onClick={() => openEditOwnerPayment(row)}>
                        Edit
                      </button>
                      <button className="button small danger" type="button" onClick={() => removeOwnerPayment(row)}>
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

      <Modal
        title="Edit Owner Payment"
        open={Boolean(editOwnerPayment)}
        onClose={() => setEditOwnerPayment(null)}
      >
        {editOwnerPayment ? (
          <form className="inline-form payment-form-grid" onSubmit={saveEditedOwnerPayment}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editOwnerPaymentForm.paidAmount}
              onChange={(e) => setEditOwnerPaymentForm((p) => ({ ...p, paidAmount: e.target.value }))}
              required
            />
            <select
              value={editOwnerPaymentForm.status}
              onChange={(e) => setEditOwnerPaymentForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="paid">paid</option>
            </select>
            <select
              value={editOwnerPaymentForm.method}
              onChange={(e) => setEditOwnerPaymentForm((p) => ({ ...p, method: e.target.value }))}
            >
              <option value="cash">cash</option>
              <option value="bank">bank</option>
              <option value="upi">upi</option>
            </select>
            <input
              placeholder="Reference ID"
              value={editOwnerPaymentForm.referenceId}
              onChange={(e) => setEditOwnerPaymentForm((p) => ({ ...p, referenceId: e.target.value }))}
            />
            <input
              placeholder="Notes"
              value={editOwnerPaymentForm.notes}
              onChange={(e) => setEditOwnerPaymentForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <button className="button" type="submit">
              Save Payment
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal
        title={breakdownOwner ? `Owner Breakdown - ${breakdownOwner.name}` : "Owner Breakdown"}
        open={Boolean(breakdownOwner)}
        onClose={() => setBreakdownOwner(null)}
      >
        <div className="filters">
          <label htmlFor="owner-breakdown-mode">View</label>
          <select
            id="owner-breakdown-mode"
            value={breakdownMode}
            onChange={(e) => updateBreakdownMode(e.target.value)}
          >
            <option value="month">Monthly</option>
            <option value="range">Date Range</option>
          </select>
          {breakdownMode === "month" ? (
            <input type="month" value={breakdownMonth} onChange={(e) => updateBreakdownMonth(e.target.value)} />
          ) : (
            <>
              <input
                type="date"
                value={breakdownStartDate}
                onChange={(e) => updateBreakdownRange(e.target.value, breakdownEndDate)}
              />
              <input
                type="date"
                value={breakdownEndDate}
                onChange={(e) => updateBreakdownRange(breakdownStartDate, e.target.value)}
              />
            </>
          )}
          <button className="button ghost" type="button" onClick={exportBreakdownCsv}>
            Export CSV
          </button>
        </div>

        {breakdownLoading ? <p className="card">Loading breakdown...</p> : null}

        <div className="metric-grid">
          <article className="card metric-card">
            <p>Total Worker Hours</p>
            <h3>{formatHours(breakdownData.totals?.totalWorkerHours)}</h3>
          </article>
          <article className="card metric-card">
            <p>Total Earned</p>
            <h3>INR {formatMoney(breakdownData.totals?.totalEarned)}</h3>
          </article>
        </div>

        <div className="card table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Total Worker Hours</th>
                <th>Commission Rate</th>
                <th>Earned</th>
              </tr>
            </thead>
            <tbody>
              {!(breakdownData.rows || []).length ? (
                <tr>
                  <td data-label="Status" colSpan={4}>No breakdown rows for selected filter.</td>
                </tr>
              ) : null}
              {(breakdownData.rows || []).map((row) => (
                <tr key={row.date}>
                  <td data-label="Date">{row.date}</td>
                  <td data-label="Total Worker Hours">{formatHours(row.totalWorkerHours)}</td>
                  <td data-label="Commission Rate">INR {formatMoney(row.commissionRate)}</td>
                  <td data-label="Earned">INR {formatMoney(row.earned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
        </>
      )}
    </section>
  );
}
