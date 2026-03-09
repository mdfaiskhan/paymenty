function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function calculateTailorEarnings(hours) {
  const h = toNumber(hours, 0);
  if (h < 4) return h * 100;
  if (h < 5) return h * 150;
  return h * 200;
}

export function calculateButcherCuts(hours) {
  return toNumber(hours, 0) * 200;
}

export function calculateDerivedMetric(hours, calcType = "tailor_slab_v1") {
  return calcType === "butcher_cuts_v1" ? calculateButcherCuts(hours) : calculateTailorEarnings(hours);
}
