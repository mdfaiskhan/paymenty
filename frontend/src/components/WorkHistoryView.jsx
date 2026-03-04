import { useState } from "react";
import { calculateDerivedMetric } from "../utils/earnings";
import { formatTwoDecimals, toFiniteNumber } from "../utils/number";
import DurationPicker, { formatHoursAndMinutes } from "./DurationPicker";

export default function WorkHistoryView({ businessType, days, onEditEntry, onDeleteEntry }) {
  const [editing, setEditing] = useState(null);
  const [editDurationHours, setEditDurationHours] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [videoId, setVideoId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function beginEdit(entry, dayDate) {
    setError("");
    setEditing(entry.id);
    setEditDurationHours(Number(entry.hours) || 0);
    setEditDate(String(dayDate).slice(0, 10));
    setVideoId(entry.videoId || "");
    setNote(entry.note || "");
  }

  async function saveEdit(entryId) {
    if (editDurationHours <= 0 || editDurationHours > 24) {
      setError("Total time must be greater than 0 and up to 24 hours");
      return;
    }
    if (!editDate) {
      setError("Date is required");
      return;
    }
    await onEditEntry(entryId, { workDate: editDate, hours: editDurationHours, videoId, note });
    setEditing(null);
  }

  return (
    <div className="history-wrap">
      <table className="responsive-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Entries</th>
            <th>Total Hours</th>
            <th>{businessType === "tailor" ? "Derived Earnings" : "Derived Cuts"}</th>
          </tr>
        </thead>
        <tbody>
          {!days.length ? (
            <tr>
              <td data-label="Status" colSpan={4}>No history found for selected filters.</td>
            </tr>
          ) : null}
          {days.map((day) => (
            <tr key={day.date}>
              <td data-label="Date">{new Date(day.date).toISOString().slice(0, 10)}</td>
              <td data-label="Entries">
                <div className="entry-list">
                  {day.entries.map((entry) => (
                    <div key={entry.id} className="entry-row">
                      {editing === entry.id ? (
                        <>
                          <DurationPicker
                            value={editDurationHours}
                            onChange={setEditDurationHours}
                            label="Edit Time"
                          />
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                          />
                          <input value={videoId} placeholder="Video ID" onChange={(e) => setVideoId(e.target.value)} />
                          <input value={note} onChange={(e) => setNote(e.target.value)} />
                          <button className="button small" onClick={() => saveEdit(entry.id)} type="button">
                            Save
                          </button>
                          <button className="button small ghost" onClick={() => setEditing(null)} type="button">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{formatHoursAndMinutes(entry.hours)}</span>
                          <span>Video: {entry.videoId || "-"}</span>
                          <span>{entry.note || "-"}</span>
                          <button
                            className="button small ghost"
                            onClick={() => beginEdit(entry, day.date)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="button small danger"
                            onClick={() => onDeleteEntry(entry.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </td>
              <td data-label="Total Hours">{formatHoursAndMinutes(day.totalHours)}</td>
              <td data-label={businessType === "tailor" ? "Derived Earnings" : "Derived Cuts"}>
                {businessType === "tailor"
                  ? `INR ${formatTwoDecimals(
                      toFiniteNumber(day.derivedEarnings, calculateDerivedMetric(day.totalHours, "tailor")),
                      0
                    )}`
                  : formatTwoDecimals(
                      toFiniteNumber(day.derivedCuts, calculateDerivedMetric(day.totalHours, "butcher")),
                      0
                    )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
