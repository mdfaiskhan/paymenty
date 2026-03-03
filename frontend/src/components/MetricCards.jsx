import { formatTwoDecimals, toFiniteNumber } from "../utils/number";

function formatMetricNumber(value) {
  return formatTwoDecimals(toFiniteNumber(value, 0), 0);
}

export default function MetricCards({ businessType, analytics }) {
  const label = businessType === "tailor" ? "Earnings" : "Cuts";
  const cards = [
    [
      "Today",
      toFiniteNumber(analytics?.today?.totalEarningsOrCuts, 0),
      toFiniteNumber(analytics?.today?.totalHours, 0)
    ],
    [
      "This Week",
      toFiniteNumber(analytics?.week?.totalEarningsOrCuts, 0),
      toFiniteNumber(analytics?.week?.totalHours, 0)
    ],
    [
      "This Month",
      toFiniteNumber(analytics?.month?.totalEarningsOrCuts, 0),
      toFiniteNumber(analytics?.month?.totalHours, 0)
    ]
  ];

  return (
    <div className="metric-grid">
      {cards.map(([title, value, hours]) => (
        <article className="card metric-card" key={title}>
          <p>{title}</p>
          <h3>{businessType === "tailor" ? `INR ${formatMetricNumber(value)}` : formatMetricNumber(value)}</h3>
          <small>
            {label}: {formatMetricNumber(hours)} hrs
          </small>
        </article>
      ))}
    </div>
  );
}
