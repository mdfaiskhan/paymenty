function splitDecimalHours(totalHours) {
  const safe = Number(totalHours) || 0;
  const hours = Math.floor(safe);
  const minutes = Math.round((safe - hours) * 60);
  if (minutes === 60) {
    return { hours: hours + 1, minutes: 0 };
  }
  return { hours, minutes };
}

export default function DurationPicker({ value, onChange, label = "Duration" }) {
  const { hours, minutes } = splitDecimalHours(value);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);

  function onHoursChange(nextHoursRaw) {
    const nextHours = Number(nextHoursRaw);
    const nextMinutes = nextHours === 24 ? 0 : minutes;
    onChange(Number((nextHours + nextMinutes / 60).toFixed(6)));
  }

  function onMinutesChange(nextMinutesRaw) {
    const nextMinutes = Number(nextMinutesRaw);
    const nextHours = hours === 24 ? 23 : hours;
    onChange(Number((nextHours + nextMinutes / 60).toFixed(6)));
  }

  return (
    <div className="duration-picker">
      <p className="duration-label">{label}</p>
      <div className="duration-row">
        <label className="duration-control">
          <span>Hours</span>
          <select value={hours} onChange={(e) => onHoursChange(e.target.value)}>
            {Array.from({ length: 25 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="duration-control">
          <span>Minutes</span>
          <select value={minutes} onChange={(e) => onMinutesChange(e.target.value)} disabled={hours === 24}>
            {minuteOptions.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export function formatHoursAndMinutes(totalHours) {
  const { hours, minutes } = splitDecimalHours(totalHours);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
