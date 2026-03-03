import { useState } from "react";

const initialState = { name: "", phone: "", email: "", placeId: "", location: "" };

export default function EmployeeForm({ businessType, onSubmit, initial, submitText = "Save" }) {
  const [form, setForm] = useState(initial || initialState);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      ...form,
      ...(initial ? {} : { businessType })
    });
    if (!initial) {
      setForm(initialState);
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
      <button className="button" type="submit">
        {submitText}
      </button>
    </form>
  );
}
