import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useBusinesses } from "../context/BusinessContext";

export default function BusinessSelectionPage() {
  const { businesses, loading, error, addBusiness, editBusiness, removeBusiness } = useBusinesses();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    ownerName: "",
    ownerPhone: "",
    ownerCommissionPerHour: 200,
    ownerWorkerCount: 0,
    calcType: "tailor_slab_v1"
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    ownerName: "",
    ownerPhone: "",
    ownerCommissionPerHour: 200,
    ownerWorkerCount: 0,
    calcType: "tailor_slab_v1"
  });

  const sortedBusinesses = useMemo(
    () => [...businesses].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [businesses]
  );

  function businessIdentifier(row) {
    return String(row?._id || row?.slug || "").trim();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      await addBusiness(form);
      setForm((prev) => ({
        ...prev,
        name: "",
        slug: "",
        ownerName: "",
        ownerPhone: "",
        ownerWorkerCount: 0
      }));
      setSaveMessage("Business created");
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message || "Could not create business");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(row) {
    setEditingId(businessIdentifier(row));
    setEditForm({
      name: row.name || "",
      ownerName: row.ownerName || "",
      ownerPhone: row.ownerPhone || "",
      ownerCommissionPerHour: row.ownerCommissionPerHour || 0,
      ownerWorkerCount: row.ownerWorkerCount || 0,
      calcType: row.calcType || "tailor_slab_v1"
    });
    setSaveError("");
    setSaveMessage("");
  }

  async function saveEdit(row) {
    const id = businessIdentifier(row);
    if (!id) {
      setSaveError("Cannot edit this business record");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      await editBusiness(id, editForm);
      setEditingId("");
      setSaveMessage("Business updated");
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message || "Could not update business");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row) {
    const id = businessIdentifier(row);
    if (!id) {
      setSaveError("Cannot delete this business record");
      return;
    }
    const ok = window.confirm(`Delete business ${row.name}?`);
    if (!ok) return;

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      await removeBusiness(id);
      if (editingId === id) {
        setEditingId("");
      }
      setSaveMessage("Business deleted");
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message || "Could not delete business");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Earnings Hub</h1>
      <p className="subtext">Choose a business or create a new one. Each business has its own employees, work logs, analytics, and payments.</p>
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="card">Loading businesses...</p> : null}
      <div className="business-grid">
        {sortedBusinesses.map((business) => {
          const isEditing = editingId && editingId === businessIdentifier(business);
          return (
            <article className="card business-card dynamic-business" key={business.slug}>
              {!isEditing ? (
                <>
                  <Link to={`/business/${business.slug}`}>
                    <h2>{business.name}</h2>
                    <p>{business.calcType === "butcher_cuts_v1" ? "Cuts per hour model" : "Slab earnings model"}</p>
                    <p className="subtext">
                      Owner: {business.ownerName || "Not set"} | Rate: INR {business.ownerCommissionPerHour || 0}/hr
                    </p>
                  </Link>
                  <div className="action-row">
                    <button className="button small ghost" type="button" onClick={() => beginEdit(business)}>
                      Edit
                    </button>
                    <button className="button small danger" type="button" onClick={() => onDelete(business)}>
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Business Name"
                  />
                  <input
                    value={editForm.ownerName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="Owner Name"
                  />
                  <input
                    value={editForm.ownerPhone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ownerPhone: e.target.value }))}
                    placeholder="Owner Phone"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.ownerCommissionPerHour}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, ownerCommissionPerHour: e.target.value }))
                    }
                    placeholder="Owner Rate Per Hour"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.ownerWorkerCount}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ownerWorkerCount: e.target.value }))}
                    placeholder="Worker Count"
                  />
                  <select
                    value={editForm.calcType}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, calcType: e.target.value }))}
                  >
                    <option value="tailor_slab_v1">Earnings (slab based)</option>
                    <option value="butcher_cuts_v1">Cuts (per-hour)</option>
                  </select>
                  <div className="action-row">
                    <button className="button small" type="button" disabled={saving} onClick={() => saveEdit(business)}>
                      Save
                    </button>
                    <button className="button small ghost" type="button" onClick={() => setEditingId("")}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <article className="card section-card">
        <h3>Add New Business</h3>
        <form className="inline-form" onSubmit={onSubmit}>
          <input
            placeholder="Business Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            placeholder="Slug (optional, e.g. salon-team)"
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
          />
          <input
            placeholder="Owner Name"
            value={form.ownerName}
            onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
            required
          />
          <input
            placeholder="Owner Phone"
            value={form.ownerPhone}
            onChange={(e) => setForm((p) => ({ ...p, ownerPhone: e.target.value }))}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Owner Rate Per Hour"
            value={form.ownerCommissionPerHour}
            onChange={(e) => setForm((p) => ({ ...p, ownerCommissionPerHour: e.target.value }))}
            required
          />
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Worker Count"
            value={form.ownerWorkerCount}
            onChange={(e) => setForm((p) => ({ ...p, ownerWorkerCount: e.target.value }))}
          />
          <select
            value={form.calcType}
            onChange={(e) => setForm((p) => ({ ...p, calcType: e.target.value }))}
          >
            <option value="tailor_slab_v1">Earnings (slab based)</option>
            <option value="butcher_cuts_v1">Cuts (per-hour)</option>
          </select>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create Business"}
          </button>
        </form>
        {saveError ? <p className="error-text">{saveError}</p> : null}
        {saveMessage ? <p>{saveMessage}</p> : null}
      </article>
    </section>
  );
}
