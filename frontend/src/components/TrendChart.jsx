import { formatTwoDecimals, toFiniteNumber } from "../utils/number";

function buildPoints(values, width, height, pad) {
  if (!values.length) {
    return "";
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  return values
    .map((v, i) => {
      const x = pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1);
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

export default function TrendChart({ unit = "earnings", dailyTrend }) {
  const width = 840;
  const height = 260;
  const pad = 28;
  const values = (dailyTrend || []).map((d) => toFiniteNumber(d.total, 0));
  const points = buildPoints(values, width, height, pad);

  return (
    <article className="card section-card">
      <h3>Last 7 Days Trend ({unit === "cuts" ? "Cuts" : "Earnings"})</h3>
      <div className="trend-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label="Daily trend chart">
          <polyline fill="none" stroke="#155eef" strokeWidth="3" points={points} />
          {(dailyTrend || []).map((d, i) => {
            const x = pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1);
            const max = Math.max(...values, 1);
            const min = Math.min(...values, 0);
            const span = max - min || 1;
            const total = toFiniteNumber(d.total, 0);
            const y = height - pad - ((total - min) / span) * (height - pad * 2);
            return <circle key={d.date} cx={x} cy={y} r="3.5" fill="#0a2f8c" />;
          })}
        </svg>
        <div className="trend-labels">
          {(dailyTrend || []).map((d) => (
            <div key={d.date} className="trend-label-item">
              <span>{d.date.slice(5)}</span>
              <strong>
                {unit === "cuts"
                  ? formatTwoDecimals(d.total, 0)
                  : `INR ${formatTwoDecimals(d.total, 0)}`}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
