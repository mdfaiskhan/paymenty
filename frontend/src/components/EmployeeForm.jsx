import { useState } from "react";

const initialState = { name: "", phone: "", email: "", placeId: "", location: "" };

export default function EmployeeForm({ businessType, onSubmit, initial, submitText = "Save" }) {
  const [form, setForm] = useState(initial || initialState);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function validationMessage(details) {
    const fieldErrors = details?.fieldErrors || {};
    const entries = Object.entries(fieldErrors).find(([, msgs]) => Array.isArray(msgs) && msgs.length);
    if (!entries) {
      return "";
    }
    const [field, msgs] = entries;
    return `${field}: ${msgs[0]}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      setSubmitting(true);
      await onSubmit({
        ...form,
        ...(initial ? {} : { businessType })
      });
      if (!initial) {
        setForm(initialState);
      }
    } catch (submitError) {
      const detailError = validationMessage(submitError?.response?.data?.details);
      setError(detailError || submitError?.response?.data?.message || "Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
        required
      />
      <input
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
        required
      />
      <input
        placeholder="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
        required
      />
      <input
        placeholder="Place ID"
        value={form.placeId}
        onChange={(e) => setForm((s) => ({ ...s, placeId: e.target.value }))}
        required
      />
      <input
        placeholder="Location"
        value={form.location}
        onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
        required
      />
      <button className="button" type="submit" disabled={submitting}>
        {submitText}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </form>
  );
}
