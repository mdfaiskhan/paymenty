import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useBusinesses } from "../context/BusinessContext";

export default function BusinessSelectionPage() {
  const { businesses, loading, error, addBusiness } = useBusinesses();
  const [form, setForm] = useState({ name: "", slug: "", calcType: "tailor_slab_v1" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const sortedBusinesses = useMemo(
    () => [...businesses].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [businesses]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      await addBusiness(form);
      setForm({ name: "", slug: "", calcType: form.calcType });
      setSaveMessage("Business created");
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message || "Could not create business");
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
        {sortedBusinesses.map((business) => (
          <Link className="card business-card dynamic-business" key={business.slug} to={`/business/${business.slug}`}>
            <h2>{business.name}</h2>
            <p>{business.calcType === "butcher_cuts_v1" ? "Cuts per hour model" : "Slab earnings model"}</p>
          </Link>
        ))}
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
