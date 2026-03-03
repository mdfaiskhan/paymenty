function parseYyyyMmDd(input) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return null;
  }

  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function monthBounds(yyyyMm) {
  const [year, month] = yyyyMm.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function currentMonthString() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

module.exports = {
  parseYyyyMmDd,
  monthBounds,
  currentMonthString
};
