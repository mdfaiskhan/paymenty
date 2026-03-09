import { formatTwoDecimals, toFiniteNumber } from "../utils/number";
import { useState } from "react";

export default function EmployeeTable({
  unit = "earnings",
  rows,
  onAddHours,
  onHistory,
  onEdit,
  onDelete
}) {
  const [moreFor, setMoreFor] = useState(null);
  const metricHeader = unit === "cuts" ? "Cuts" : "Earnings";
  const formatHours = (value) => formatTwoDecimals(toFiniteNumber(value, 0), 0).replace(/\.00$/, "");
  const metricValue = (period) => {
    const total = toFiniteNumber(period?.total, 0);
    const formatted = formatTwoDecimals(total, 0).replace(/\.00$/, "");
    return unit === "cuts" ? formatted : `INR ${formatted}`;
  };

  async function copyText(value) {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      // Ignore clipboard write failures silently.
    }
  }

  return (
    <div className="card table-wrap">
      <table className="responsive-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Yesterday Hours</th>
            <th>Yesterday {metricHeader}</th>
            <th>Month Hours</th>
            <th>Month {metricHeader}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId}>
              <td data-label="Name">
                <strong>{row.name}</strong>
                <div className="subtext">{row.phone}</div>
                <div className="subtext">{row.email}</div>
                <div className="subtext">Place: {row.placeId || "-"}</div>
              </td>
              <td data-label="Yesterday Hours">{formatHours(row.yesterday?.hours)}</td>
              <td data-label={`Yesterday ${metricHeader}`}>{metricValue(row.yesterday)}</td>
              <td data-label="Month Hours">{formatHours(row.month?.hours)}</td>
              <td data-label={`Month ${metricHeader}`}>{metricValue(row.month)}</td>
              <td data-label="Actions">
                <div className="action-row">
                  <button className="button small" onClick={() => onAddHours(row)} type="button">
                    Add Hours
                  </button>
                  <button className="button small ghost" onClick={() => onHistory(row)} type="button">
                    History
                  </button>
                  <button className="button small ghost" onClick={() => onEdit(row)} type="button">
                    Edit
                  </button>
                  <button
                    className="button small ghost"
                    onClick={() => setMoreFor((prev) => (prev === row.employeeId ? null : row.employeeId))}
                    type="button"
                  >
                    More
                  </button>
                  <button className="button small danger" onClick={() => onDelete(row)} type="button">
                    Delete
                  </button>
                </div>
                {moreFor === row.employeeId ? (
                  <div className="action-row more-row">
                    <button className="button small ghost" onClick={() => copyText(row.phone)} type="button">
                      Copy Phone
                    </button>
                    <button className="button small ghost" onClick={() => copyText(row.email)} type="button">
                      Copy Email
                    </button>
                    <button className="button small ghost" onClick={() => copyText(row.placeId)} type="button">
                      Copy Place ID
                    </button>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
