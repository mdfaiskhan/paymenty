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

export default function PaymentTrendChart({ trend }) {
  const width = 840;
  const height = 260;
  const pad = 28;
  const values = (trend || []).map((d) => toFiniteNumber(d.amountPaid, 0));
  const points = buildPoints(values, width, height, pad);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  return (
    <article className="card section-card">
      <h3>Payments Made (Last 7 Days)</h3>
      <div className="trend-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label="Payments trend chart">
          <polyline fill="none" stroke="#15744c" strokeWidth="3" points={points} />
          {(trend || []).map((d, i) => {
            const x = pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1);
            const paid = toFiniteNumber(d.amountPaid, 0);
            const y = height - pad - ((paid - min) / span) * (height - pad * 2);
            return <circle key={d.date} cx={x} cy={y} r="3.5" fill="#125d3f" />;
          })}
        </svg>
        <div className="trend-labels">
          {(trend || []).map((d) => (
            <div key={d.date} className="trend-label-item">
              <span>{d.date.slice(5)}</span>
              <strong>INR {formatTwoDecimals(d.amountPaid, 0)}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
