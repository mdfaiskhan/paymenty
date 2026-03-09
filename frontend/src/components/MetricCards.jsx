import { formatTwoDecimals, toFiniteNumber } from "../utils/number";

function formatMetricNumber(value) {
  const raw = formatTwoDecimals(toFiniteNumber(value, 0), 0);
  return raw.replace(/\.00$/, "");
}

export default function MetricCards({ analytics, rangeLabel = "Selected Range" }) {
  const isEarnings = analytics?.unit !== "cuts";
  const cards = [
    [
      "Yesterday",
      toFiniteNumber(analytics?.yesterday?.totalEarningsOrCuts, 0),
      toFiniteNumber(analytics?.yesterday?.totalHours, 0)
    ],
    [
      "This Month",
      toFiniteNumber(analytics?.month?.totalEarningsOrCuts, 0),
      toFiniteNumber(analytics?.month?.totalHours, 0)
    ],
    [
      rangeLabel,
      toFiniteNumber(analytics?.range?.totalEarningsOrCuts, 0),
      toFiniteNumber(analytics?.range?.totalHours, 0)
    ]
  ];

  return (
    <div className="metric-grid">
      {cards.map(([title, value, hours]) => (
        <article className="card metric-card" key={title}>
          <p>{title}</p>
          <h3>{isEarnings ? `INR ${formatMetricNumber(value)}` : formatMetricNumber(value)}</h3>
          <small>Hours: {formatMetricNumber(hours)}</small>
        </article>
      ))}
    </div>
  );
}
