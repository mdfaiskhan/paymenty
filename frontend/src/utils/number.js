export function toFiniteNumber(value, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  if (value && typeof value === "object") {
    if (typeof value.$numberDecimal === "string") {
      const n = Number(value.$numberDecimal);
      return Number.isFinite(n) ? n : fallback;
    }
  }

  return fallback;
}

export function formatTwoDecimals(value, fallback = 0) {
  return toFiniteNumber(value, fallback).toFixed(2);
}
