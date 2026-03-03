import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import { downloadCsv } from "../utils/csv";
import { getCurrentMonth, todayDateOnly } from "../utils/date";
import { formatTwoDecimals } from "../utils/number";
import DurationPicker from "../components/DurationPicker";
import {
  addOwnerCommissionRuleApi,
  createOwnerApi,
  deleteOwnerApi,
  getOwnerBreakdownApi,
  getOwnersAnalyticsApi,
  upsertOwnerDailyHoursApi,
  updateOwnerApi
} from "../api/ownerApi";

function formatMoney(v) {
  return formatTwoDecimals(v, 0);
}

function formatHours(v) {
  return formatTwoDecimals(v, 0);
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

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const data = await getOwnersAnalyticsApi();
      setAnalytics(data);
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
    setBreakdownOwner(null);
    setCommissionModal(null);
    setOwnerFormOpen(false);
  }

  const ownerRows = useMemo(() => {
    const rows = [...(analytics.owners || [])];
    rows.sort((a, b) => {
      if (sortBy === "monthAsc") return (a.monthCommission || 0) - (b.monthCommission || 0);
      if (sortBy === "todayDesc") return (b.todayCommission || 0) - (a.todayCommission || 0);
      if (sortBy === "nameAsc") return String(a.name || "").localeCompare(String(b.name || ""));
      return (b.monthCommission || 0) - (a.monthCommission || 0);
    });
    return rows;
  }, [analytics.owners, sortBy]);

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
          <p>Today Commission</p>
          <h3>INR {formatMoney(analytics.cards?.todayCommission)}</h3>
        </article>
        <article className="card metric-card">
          <p>This Week Commission</p>
          <h3>INR {formatMoney(analytics.cards?.weekCommission)}</h3>
        </article>
        <article className="card metric-card">
          <p>This Month Commission</p>
          <h3>INR {formatMoney(analytics.cards?.monthCommission)}</h3>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!ownerRows.length ? (
              <tr>
                <td data-label="Status" colSpan={8}>No owners found.</td>
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
