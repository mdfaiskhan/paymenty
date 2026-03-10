const mongoose = require("mongoose");
const WorkEntry = require("../models/WorkEntry.model");
const Employee = require("../models/Employee.model");
const Business = require("../models/Business.model");
const ApiError = require("../utils/ApiError");
const {
  tailorEarningsExpressionWithRule,
  butcherCutsExpressionWithRule,
  metricExpressionForCalcTypeWithRule
} = require("./payout.service");

const ANALYTICS_CACHE_TTL_MS = Number(process.env.ANALYTICS_CACHE_TTL_MS || 15000);
const MAX_ANALYTICS_CACHE_ENTRIES = Number(process.env.MAX_ANALYTICS_CACHE_ENTRIES || 300);
const ANALYTICS_CACHE_SCHEMA_VERSION = "v4";
const analyticsCache = new Map();

function setAnalyticsCache(key, value) {
  if (analyticsCache.has(key)) {
    analyticsCache.delete(key);
  }
  analyticsCache.set(key, value);
  while (analyticsCache.size > MAX_ANALYTICS_CACHE_ENTRIES) {
    const oldestKey = analyticsCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    analyticsCache.delete(oldestKey);
  }
}

function getAnalyticsCache(key) {
  const value = analyticsCache.get(key);
  if (!value) {
    return null;
  }
  // Touch key for LRU behavior.
  analyticsCache.delete(key);
  analyticsCache.set(key, value);
  return value;
}

function utcStartOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcEndOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function normalizeIdentityValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLooseName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function currentPeriodBounds() {
  const nowUtc = new Date();

  const todayStart = utcStartOfDay(nowUtc);
  const todayEnd = utcEndOfDay(nowUtc);
  const yesterdayStart = utcStartOfDay(addDays(todayStart, -1));
  const yesterdayEnd = utcEndOfDay(addDays(todayStart, -1));

  const utcDay = nowUtc.getUTCDay(); // 0=Sun ... 6=Sat
  const diffToMonday = (utcDay + 6) % 7;
  const weekStart = new Date(
    Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - diffToMonday)
  );
  const weekEnd = utcEndOfDay(addDays(weekStart, 6));

  const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const trendStart = new Date(
    Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - 6)
  );
  const trendEnd = todayEnd;

  return {
    todayStart,
    todayEnd,
    yesterdayStart,
    yesterdayEnd,
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    trendStart,
    trendEnd
  };
}

function clampTrendRange(start, end, maxDays = 31) {
  const safeStart = utcStartOfDay(start);
  const safeEnd = utcEndOfDay(end);
  const diffDays = Math.floor((safeEnd.getTime() - safeStart.getTime()) / 86400000) + 1;
  if (diffDays <= maxDays) {
    return { start: safeStart, end: safeEnd };
  }
  const clampedStart = utcStartOfDay(addDays(safeEnd, -(maxDays - 1)));
  return { start: clampedStart, end: safeEnd };
}

function ruleLookupStages(businessTypeExpr) {
  return [
    {
      $lookup: {
        from: "incentiverules",
        let: {
          employeeId: "$_id.employeeId",
          workDate: "$_id.workDate",
          businessType: businessTypeExpr
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$businessType", "$$businessType"] },
                  { $eq: ["$isActive", true] },
                  { $lte: ["$effectiveFrom", "$$workDate"] },
                  {
                    $or: [{ $eq: ["$effectiveTo", null] }, { $gte: ["$effectiveTo", "$$workDate"] }]
                  },
                  {
                    $or: [
                      { $and: [{ $eq: ["$scope", "employee"] }, { $eq: ["$employeeId", "$$employeeId"] }] },
                      { $and: [{ $eq: ["$scope", "business"] }, { $eq: ["$employeeId", null] }] }
                    ]
                  }
                ]
              }
            }
          },
          {
            $addFields: {
              priority: { $cond: [{ $eq: ["$scope", "employee"] }, 1, 2] }
            }
          },
          { $sort: { priority: 1, effectiveFrom: -1 } },
          { $limit: 1 }
        ],
        as: "rule"
      }
    },
    {
      $addFields: {
        chosenRule: { $arrayElemAt: ["$rule", 0] }
      }
    }
  ];
}

function metricStage(calcType) {
  return {
    $addFields: {
      dayTotal: metricExpressionForCalcTypeWithRule(calcType, "$dayHours", "$chosenRule")
    }
  };
}

async function aggregateEmployeeDaily(businessType, start, end, calcType) {
  return WorkEntry.aggregate([
    {
      $match: {
        businessType,
        isDeleted: { $ne: true },
        workDate: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: { employeeId: "$employeeId", workDate: "$workDate" },
        dayHours: { $sum: "$hours" }
      }
    },
    ...ruleLookupStages(businessType),
    metricStage(calcType),
    {
      $project: {
        _id: 0,
        employeeId: "$_id.employeeId",
        workDate: "$_id.workDate",
        dayHours: 1,
        dayTotal: 1
      }
    }
  ]);
}

async function aggregateEmployeeDailyByEmployees(employeeIds, businessType, start, end, calcType) {
  if (!employeeIds.length) {
    return [];
  }

  return WorkEntry.aggregate([
    {
      $match: {
        employeeId: { $in: employeeIds },
        isDeleted: { $ne: true },
        workDate: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: { employeeId: "$employeeId", workDate: "$workDate" },
        dayHours: { $sum: "$hours" }
      }
    },
    // Use current business rules/calcType for legacy rows that may have missing/wrong businessType.
    ...ruleLookupStages(businessType),
    metricStage(calcType),
    {
      $project: {
        _id: 0,
        employeeId: "$_id.employeeId",
        workDate: "$_id.workDate",
        dayHours: 1,
        dayTotal: 1
      }
    }
  ]);
}

function emptyWindow() {
  return { hours: 0, total: 0 };
}

function buildDateSeries(start, end) {
  const dates = [];
  for (let d = utcStartOfDay(start); d <= end; d = addDays(d, 1)) {
    dates.push(dateKey(d));
  }
  return dates;
}

async function getBusinessAnalytics(businessType, options = {}) {
  const normalizedStartDate = options.startDate ? String(options.startDate) : "";
  const normalizedEndDate = options.endDate ? String(options.endDate) : "";
  const cacheKey = `${ANALYTICS_CACHE_SCHEMA_VERSION}:${String(businessType)}:${normalizedStartDate}:${normalizedEndDate}`;
  const now = Date.now();
  const cached = getAnalyticsCache(cacheKey);

  if (cached && cached.payload && cached.expiresAt > now) {
    return cached.payload;
  }

  // Stale-while-revalidate: return last known payload instantly while recomputing in background.
  if (cached && cached.payload && cached.expiresAt <= now) {
    if (!cached.inFlight) {
      const inFlight = (async () => {
        const payload = await computeBusinessAnalytics(businessType, {
          startDate: normalizedStartDate || undefined,
          endDate: normalizedEndDate || undefined
        });
        setAnalyticsCache(cacheKey, {
          payload,
          expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
          inFlight: null
        });
        return payload;
      })();

      setAnalyticsCache(cacheKey, {
        payload: cached.payload,
        expiresAt: cached.expiresAt,
        inFlight
      });

      inFlight.catch(() => {
        const current = analyticsCache.get(cacheKey);
        if (current && current.inFlight === inFlight) {
          setAnalyticsCache(cacheKey, {
            payload: current.payload,
            expiresAt: Date.now() + Math.floor(ANALYTICS_CACHE_TTL_MS / 2),
            inFlight: null
          });
        }
      });
    }
    return cached.payload;
  }

  if (cached && cached.inFlight) {
    return cached.inFlight;
  }

  const inFlight = (async () => {
    const payload = await computeBusinessAnalytics(businessType, {
      startDate: normalizedStartDate || undefined,
      endDate: normalizedEndDate || undefined
    });
    setAnalyticsCache(cacheKey, {
      payload,
      expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
      inFlight: null
    });
    return payload;
  })();

  setAnalyticsCache(cacheKey, {
    payload: cached?.payload || null,
    expiresAt: cached?.expiresAt || 0,
    inFlight
  });

  try {
    return await inFlight;
  } catch (error) {
    analyticsCache.delete(cacheKey);
    throw error;
  }
}

async function computeBusinessAnalytics(businessType, options = {}) {
  const business = await Business.findOne({ slug: businessType, isActive: true }).lean();
  if (!business) {
    throw new ApiError(404, "Business not found");
  }

  const bounds = currentPeriodBounds();
  const hasCustomRange = Boolean(options.startDate && options.endDate);
  const customRange = hasCustomRange ? parseDateOnlyToUtcBounds(options.startDate, options.endDate) : null;
  const rangeStart = customRange ? customRange.start : bounds.monthStart;
  const rangeEnd = customRange ? customRange.end : bounds.monthEnd;
  const trendWindow = hasCustomRange
    ? clampTrendRange(rangeStart, rangeEnd)
    : { start: bounds.trendStart, end: bounds.trendEnd };
  const analysisStart = bounds.trendStart < bounds.monthStart ? bounds.trendStart : bounds.monthStart;

  const [employees, allBusinessEmployees, windowRows, customRangeRows] = await Promise.all([
    Employee.find({ businessType, isActive: true }).sort({ createdAt: -1 }).lean(),
    Employee.find({ businessType }).select("_id phone email name placeId").lean(),
    aggregateEmployeeDaily(businessType, analysisStart, bounds.monthEnd, business.calcType),
    hasCustomRange
      ? aggregateEmployeeDaily(businessType, rangeStart, rangeEnd, business.calcType)
      : Promise.resolve(null)
  ]);
  const activeIdentity = employees.map((emp) => ({
    id: String(emp._id),
    phone: normalizeIdentityValue(emp.phone),
    email: normalizeIdentityValue(emp.email),
    name: normalizeLooseName(emp.name),
    placeId: normalizeIdentityValue(emp.placeId)
  }));

  const ownerByHistoricalId = new Map();
  activeIdentity.forEach((entry) => ownerByHistoricalId.set(entry.id, entry.id));
  allBusinessEmployees.forEach((row) => {
    const historicalId = String(row._id);
    const phone = normalizeIdentityValue(row.phone);
    const email = normalizeIdentityValue(row.email);
    const name = normalizeLooseName(row.name);
    const placeId = normalizeIdentityValue(row.placeId);

    let owner =
      activeIdentity.find((entry) => entry.phone && entry.email && entry.phone === phone && entry.email === email)
        ?.id ||
      activeIdentity.find((entry) => entry.phone && entry.phone === phone)?.id ||
      activeIdentity.find((entry) => entry.email && entry.email === email)?.id ||
      activeIdentity.find((entry) => entry.name && entry.placeId && entry.name === name && entry.placeId === placeId)
        ?.id ||
      activeIdentity.find((entry) => entry.name && entry.name === name)?.id;

    if (!owner && ownerByHistoricalId.has(historicalId)) {
      owner = ownerByHistoricalId.get(historicalId);
    }
    if (owner) {
      ownerByHistoricalId.set(historicalId, owner);
    }
  });

  const totalEnd = hasCustomRange ? rangeEnd : bounds.todayEnd;
  const totalRows = await aggregateEmployeeDailyByEmployees(
    Array.from(ownerByHistoricalId.keys()).map((id) => new mongoose.Types.ObjectId(id)),
    businessType,
    new Date(Date.UTC(1970, 0, 1)),
    totalEnd,
    business.calcType
  );
  const rangeRows = hasCustomRange ? customRangeRows || [] : windowRows;

  const employeeBreakdown = new Map(
    employees.map((emp) => [
      String(emp._id),
      {
        employeeId: emp._id,
        name: emp.name,
        phone: emp.phone,
        email: emp.email,
        placeId: emp.placeId,
        location: emp.location,
        yesterday: emptyWindow(),
        today: emptyWindow(),
        week: emptyWindow(),
        month: emptyWindow(),
        range: emptyWindow(),
        total: emptyWindow(),
        rangeDaily: {}
      }
    ])
  );

  const trendMap = new Map();
  for (let d = new Date(trendWindow.start); d <= trendWindow.end; d = addDays(d, 1)) {
    trendMap.set(dateKey(d), 0);
  }

  const summary = {
    yesterday: { totalHours: 0, totalEarningsOrCuts: 0 },
    today: { totalHours: 0, totalEarningsOrCuts: 0 },
    week: { totalHours: 0, totalEarningsOrCuts: 0 },
    month: { totalHours: 0, totalEarningsOrCuts: 0 },
    range: { totalHours: 0, totalEarningsOrCuts: 0 },
    total: { totalHours: 0, totalEarningsOrCuts: 0 }
  };

  windowRows.forEach((row) => {
    const key = String(row.employeeId);
    if (!employeeBreakdown.has(key)) {
      return;
    }

    const d = new Date(row.workDate);
    const breakdown = employeeBreakdown.get(key);
    const hours = Number(row.dayHours) || 0;
    const total = Number(row.dayTotal) || 0;

    breakdown.month.hours += hours;
    breakdown.month.total += total;
    summary.month.totalHours += hours;
    summary.month.totalEarningsOrCuts += total;

    if (d >= bounds.yesterdayStart && d <= bounds.yesterdayEnd) {
      breakdown.yesterday.hours += hours;
      breakdown.yesterday.total += total;
      summary.yesterday.totalHours += hours;
      summary.yesterday.totalEarningsOrCuts += total;
    }

    if (d >= bounds.weekStart && d <= bounds.weekEnd) {
      breakdown.week.hours += hours;
      breakdown.week.total += total;
      summary.week.totalHours += hours;
      summary.week.totalEarningsOrCuts += total;
    }

    if (d >= bounds.todayStart && d <= bounds.todayEnd) {
      breakdown.today.hours += hours;
      breakdown.today.total += total;
      summary.today.totalHours += hours;
      summary.today.totalEarningsOrCuts += total;
    }

    if (!hasCustomRange && d >= trendWindow.start && d <= trendWindow.end) {
      const dk = dateKey(d);
      trendMap.set(dk, (trendMap.get(dk) || 0) + total);
    }
  });

  rangeRows.forEach((row) => {
    const key = String(row.employeeId);
    if (!employeeBreakdown.has(key)) {
      return;
    }

    const d = new Date(row.workDate);
    const dk = dateKey(d);
    const breakdown = employeeBreakdown.get(key);
    const hours = Number(row.dayHours) || 0;
    const total = Number(row.dayTotal) || 0;

    if (d >= rangeStart && d <= rangeEnd) {
      breakdown.range.hours += hours;
      breakdown.range.total += total;
      breakdown.rangeDaily[dk] = (Number(breakdown.rangeDaily[dk]) || 0) + total;
      summary.range.totalHours += hours;
      summary.range.totalEarningsOrCuts += total;
    }

    if (hasCustomRange && d >= trendWindow.start && d <= trendWindow.end) {
      trendMap.set(dk, (trendMap.get(dk) || 0) + total);
    }
  });

  if (!hasCustomRange) {
    summary.range.totalHours = summary.month.totalHours;
    summary.range.totalEarningsOrCuts = summary.month.totalEarningsOrCuts;
    const monthDateSet = new Set(buildDateSeries(rangeStart, rangeEnd));
    employeeBreakdown.forEach((row) => {
      row.range = { ...row.month };
      row.rangeDaily = {};
    });
    windowRows.forEach((entry) => {
      const key = String(entry.employeeId);
      const row = employeeBreakdown.get(key);
      if (!row) return;
      const dk = dateKey(entry.workDate);
      if (!monthDateSet.has(dk)) return;
      row.rangeDaily[dk] = (Number(row.rangeDaily[dk]) || 0) + (Number(entry.dayTotal) || 0);
    });
  }

  totalRows.forEach((row) => {
    const sourceId = String(row.employeeId);
    const key = ownerByHistoricalId.get(sourceId) || sourceId;
    if (!employeeBreakdown.has(key)) {
      return;
    }
    const breakdown = employeeBreakdown.get(key);
    const hours = Number(row.dayHours) || 0;
    const total = Number(row.dayTotal) || 0;
    breakdown.total.hours += hours;
    breakdown.total.total += total;
    summary.total.totalHours += hours;
    summary.total.totalEarningsOrCuts += total;
  });

  const dailyTrend = Array.from(trendMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    businessName: business.name,
    businessType,
    calcType: business.calcType,
    unit: business.calcType === "butcher_cuts_v1" ? "cuts" : "earnings",
    yesterday: summary.yesterday,
    today: summary.today,
    week: summary.week,
    month: summary.month,
    range: summary.range,
    total: summary.total,
    selectedRange: {
      startDate: dateKey(rangeStart),
      endDate: dateKey(rangeEnd),
      mode: hasCustomRange ? "custom" : "month"
    },
    rangeDates: buildDateSeries(rangeStart, rangeEnd),
    dailyTrend,
    employeeBreakdown: Array.from(employeeBreakdown.values())
  };
}

function invalidateBusinessAnalyticsCache(businessType) {
  if (!businessType) {
    analyticsCache.clear();
    return;
  }
  const cacheBusiness = String(businessType);
  const prefix = `${ANALYTICS_CACHE_SCHEMA_VERSION}:${cacheBusiness}:`;
  Array.from(analyticsCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      analyticsCache.delete(key);
    }
  });
}

function parseDateOnlyToUtcBounds(startDate, endDate) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
  return { start, end };
}

function parseMonthToUtcBounds(month) {
  const [year, mm] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mm - 1, 1));
  const end = new Date(Date.UTC(year, mm, 0, 23, 59, 59, 999));
  return { start, end };
}

async function getEmployeeWorkHistory(employeeId, query) {
  const { month, startDate, endDate } = query;
  const { start, end } =
    month && !startDate && !endDate
      ? parseMonthToUtcBounds(month)
      : parseDateOnlyToUtcBounds(startDate, endDate);
  const employeeObjectId = new mongoose.Types.ObjectId(employeeId);

  const rows = await WorkEntry.aggregate([
    {
      $match: {
        employeeId: employeeObjectId,
        isDeleted: { $ne: true },
        workDate: { $gte: start, $lte: end }
      }
    },
    { $sort: { workDate: 1, createdAt: 1 } },
    {
      $group: {
        _id: { workDate: "$workDate", employeeId: "$employeeId", businessType: "$businessType" },
        entries: {
          $push: {
            id: "$_id",
            hours: "$hours",
            videoId: "$videoId",
            note: "$note",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt"
          }
        },
        totalHours: { $sum: "$hours" }
      }
    },
    ...ruleLookupStages("$_id.businessType"),
    {
      $lookup: {
        from: "businesses",
        localField: "_id.businessType",
        foreignField: "slug",
        as: "businessDoc"
      }
    },
    {
      $addFields: {
        businessDoc: { $arrayElemAt: ["$businessDoc", 0] }
      }
    },
    {
      $addFields: {
        resolvedCalcType: {
          $ifNull: ["$chosenRule.calcType", { $ifNull: ["$businessDoc.calcType", "tailor_slab_v1"] }]
        }
      }
    },
    {
      $addFields: {
        dayMetric: {
          $cond: [
            { $eq: ["$resolvedCalcType", "butcher_cuts_v1"] },
            butcherCutsExpressionWithRule("$totalHours", "$chosenRule"),
            tailorEarningsExpressionWithRule("$totalHours", "$chosenRule")
          ]
        }
      }
    },
    { $sort: { "_id.workDate": 1 } }
  ]);

  return rows.map((r) => ({
    date: r._id.workDate,
    entries: r.entries,
    totalHours: r.totalHours,
    derivedMetric: r.dayMetric
  }));
}

module.exports = {
  getBusinessAnalytics,
  getEmployeeWorkHistory,
  invalidateBusinessAnalyticsCache
};
