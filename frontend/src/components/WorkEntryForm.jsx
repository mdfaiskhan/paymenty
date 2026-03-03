import { useState } from "react";
import { todayDateOnly } from "../utils/date";
import { calculateDerivedMetric } from "../utils/earnings";
import { formatTwoDecimals } from "../utils/number";
import DurationPicker from "./DurationPicker";

export default function WorkEntryForm({ employeeId, businessType, onSubmit }) {
  const [workDate, setWorkDate] = useState(todayDateOnly());
  const [durationHours, setDurationHours] = useState(1);
  const [videoId, setVideoId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const estimated = calculateDerivedMetric(durationHours, businessType);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (durationHours <= 0 || durationHours > 24) {
      setError("Total time must be greater than 0 and up to 24 hours");
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        employeeId,
        workDate,
        hours: durationHours,
        videoId: videoId.trim(),
        note: note.trim()
      });
      setDurationHours(1);
      setVideoId("");
      setNote("");
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to add work details");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required />
      <DurationPicker value={durationHours} onChange={setDurationHours} label="Work Time" />
      <p className="subtext">
        {businessType === "tailor"
          ? `Estimated earnings: INR ${formatTwoDecimals(estimated, 0)}`
          : `Estimated cuts: ${formatTwoDecimals(estimated, 0)}`}
      </p>
      <input value={videoId} placeholder="Video ID" onChange={(e) => setVideoId(e.target.value)} />
      <input value={note} placeholder="Note" onChange={(e) => setNote(e.target.value)} />
      <button className="button" type="submit" disabled={submitting}>
        Add Hours
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </form>
  );
}
