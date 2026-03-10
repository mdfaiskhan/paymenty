const Owner = require("../models/Owner.model");
const OwnerCommissionRule = require("../models/OwnerCommissionRule.model");
const OwnerDailyHours = require("../models/OwnerDailyHours.model");
const WorkEntry = require("../models/WorkEntry.model");
const ApiError = require("../utils/ApiError");
const { parseYyyyMmDd } = require("../utils/date");
const { getBusinessBySlug, listActiveBusinesses, toSlug } = require("./business.service");

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

function periodBounds(range) {
  const nowUtc = new Date();
  const todayStart = utcStartOfDay(nowUtc);
  const todayEnd = utcEndOfDay(nowUtc);

  if (range === "today") {
    return { start: todayStart, end: todayEnd };
  }

  if (range === "week") {
    const utcDay = nowUtc.getUTCDay(); // 0=Sun ... 6=Sat
    const diffToMonday = (utcDay + 6) % 7;
    const weekStart = new Date(
      Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - diffToMonday)
    );
    const weekEnd = utcEndOfDay(addDays(weekStart, 6));
    return { start: weekStart, end: weekEnd };
  }

  const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start: monthStart, end: monthEnd };
}

function parseCustomBounds({ rangeType, month, startDate, endDate }) {
  if (rangeType === "all") {
    return {
      start: new Date(Date.UTC(1970, 0, 1)),
      end: utcEndOfDay(new Date())
    };
  }

  if (month) {
    const [year, mm] = month.split("-").map(Number);
    return {
      start: new Date(Date.UTC(year, mm - 1, 1)),
      end: new Date(Date.UTC(year, mm, 0, 23, 59, 59, 999))
    };
  }

  const start = parseYyyyMmDd(startDate);
  const endRaw = parseYyyyMmDd(endDate);
  if (!start || !endRaw) {
    throw new ApiError(400, "Invalid date range");
  }
  const end = utcEndOfDay(endRaw);
  if (start > end) {
    throw new ApiError(400, "startDate cannot be after endDate");
  }
  return { start, end };
}

async function aggregateDailyOwnerHours(start, end, ownerIds) {
  const rows = await OwnerDailyHours.aggregate([
    {
      $match: {
        ownerId: { $in: ownerIds },
        workDate: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          ownerId: "$ownerId",
          workDate: "$workDate"
        },
        hours: { $sum: "$hours" }
      }
    }
  ]);

  const byOwner = new Map();
  rows.forEach((row) => {
    const ownerKey = String(row._id.ownerId);
    if (!byOwner.has(ownerKey)) {
      byOwner.set(ownerKey, new Map());
    }
    byOwner.get(ownerKey).set(dateKey(row._id.workDate), Number(row.hours) || 0);
  });
  return byOwner;
}

async function aggregateDailyEmployeeHoursByBusiness(start, end, businessTypes) {
  if (!businessTypes.length) {
    return new Map();
  }

  const rows = await WorkEntry.aggregate([
    {
      $match: {
        businessType: { $in: businessTypes },
        isDeleted: { $ne: true },
        workDate: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          businessType: "$businessType",
          workDate: "$workDate"
        },
        hours: { $sum: "$hours" }
      }
    }
  ]);

  const byBusiness = new Map();
  rows.forEach((row) => {
    const businessType = String(row._id.businessType || "");
    if (!businessType) {
      return;
    }
    if (!byBusiness.has(businessType)) {
      byBusiness.set(businessType, new Map());
    }
    byBusiness.get(businessType).set(dateKey(row._id.workDate), Number(row.hours) || 0);
  });

  return byBusiness;
}

function commissionForDate(rules, date) {
  for (const rule of rules) {
    const fromOk = rule.effectiveFrom <= date;
    const toOk = !rule.effectiveTo || rule.effectiveTo >= date;
    if (fromOk && toOk) {
      return Number(rule.commissionPerHour) || 0;
    }
  }
  return 0;
}

function groupRulesByOwner(rules) {
  const rulesByOwner = new Map();
  rules.forEach((rule) => {
    const key = String(rule.ownerId);
    if (!rulesByOwner.has(key)) {
      rulesByOwner.set(key, []);
    }
    rulesByOwner.get(key).push(rule);
  });
  return rulesByOwner;
}

async function getOwnersWithCurrentCommission({ businessType, search, ownerId } = {}) {
  const filter = { isActive: true };
  if (businessType) {
    filter.businessType = toSlug(businessType);
  }
  if (ownerId) {
    filter._id = ownerId;
  }
  if (search) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [{ name: regex }, { phone: regex }];
  }

  const owners = await Owner.find(filter).sort({ createdAt: -1 }).lean();
  const ownerIds = owners.map((o) => o._id);

  const today = utcStartOfDay(new Date());
  const currentRules = await OwnerCommissionRule.find({
    ownerId: { $in: ownerIds },
    effectiveFrom: { $lte: today },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: today } }]
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  const currentRateMap = new Map();
  currentRules.forEach((rule) => {
    const key = String(rule.ownerId);
    if (!currentRateMap.has(key)) {
      currentRateMap.set(key, Number(rule.commissionPerHour) || 0);
    }
  });

  return owners.map((owner) => ({
    ...owner,
    currentCommissionPerHour: currentRateMap.get(String(owner._id)) || 0
  }));
}

async function getOwnerDerivedRowsForPeriod({ owners, start, end }) {
  if (!owners.length) {
    return new Map();
  }

  const ownerIds = owners.map((owner) => owner._id);
  const businessTypes = Array.from(
    new Set(
      owners
        .map((owner) => String(owner.businessType || "").trim())
        .filter(Boolean)
    )
  );

  const [rules, businessHoursByBusiness] = await Promise.all([
    OwnerCommissionRule.find({
      ownerId: { $in: ownerIds },
      effectiveFrom: { $lte: end },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }]
    })
      .sort({ effectiveFrom: -1 })
      .lean(),
    aggregateDailyEmployeeHoursByBusiness(start, end, businessTypes)
  ]);

  const rulesByOwner = groupRulesByOwner(rules);
  const rowsByOwner = new Map();

  owners.forEach((owner) => {
    const ownerKey = String(owner._id);
    const businessHours = businessHoursByBusiness.get(owner.businessType) || new Map();
    const rulesForOwner = rulesByOwner.get(ownerKey) || [];
    const ownerRows = new Map();

    businessHours.forEach((hours, dayKey) => {
      const day = new Date(`${dayKey}T00:00:00.000Z`);
      const rate = commissionForDate(rulesForOwner, day);
      ownerRows.set(dayKey, {
        date: day,
        totalEmployeeHours: Number(hours) || 0,
        commissionRate: rate,
        earned: (Number(hours) || 0) * rate
      });
    });

    rowsByOwner.set(ownerKey, ownerRows);
  });

  return rowsByOwner;
}

async function getOwnerDerivedTotalsForPeriod({ owners, start, end }) {
  const rowsByOwner = await getOwnerDerivedRowsForPeriod({ owners, start, end });
  const totalsByOwner = new Map();

  rowsByOwner.forEach((rows, ownerKey) => {
    let hoursWorked = 0;
    let computedAmount = 0;
    rows.forEach((row) => {
      hoursWorked += Number(row.totalEmployeeHours) || 0;
      computedAmount += Number(row.earned) || 0;
    });
    totalsByOwner.set(ownerKey, { hoursWorked, computedAmount });
  });

  return totalsByOwner;
}

async function createOwnerWithRule(payload) {
  const normalizedBusinessType = toSlug(payload.businessType);
  await getBusinessBySlug(normalizedBusinessType);
  const effectiveFrom = payload.effectiveFrom ? parseYyyyMmDd(payload.effectiveFrom) : utcStartOfDay(new Date());
  if (!effectiveFrom) {
    throw new ApiError(400, "Invalid effectiveFrom");
  }

  const owner = await Owner.create({
    name: payload.name,
    phone: payload.phone,
    businessType: normalizedBusinessType,
    workerCount: payload.workerCount
  });

  await OwnerCommissionRule.create({
    ownerId: owner._id,
    commissionPerHour: payload.commissionPerHour,
    effectiveFrom,
    effectiveTo: null
  });

  return owner;
}

async function createOwnerCommissionVersion(ownerId, { commissionPerHour, effectiveFrom }) {
  const start = parseYyyyMmDd(effectiveFrom);
  if (!start) {
    throw new ApiError(400, "Invalid effectiveFrom");
  }

  const owner = await Owner.findOne({ _id: ownerId, isActive: true }).lean();
  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }

  const activeRule = await OwnerCommissionRule.findOne({
    ownerId,
    effectiveTo: null
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  if (activeRule && start <= activeRule.effectiveFrom) {
    throw new ApiError(400, "effectiveFrom must be after current active rule start date");
  }

  if (activeRule) {
    const previousEnd = new Date(start.getTime() - 1);
    await OwnerCommissionRule.updateOne({ _id: activeRule._id }, { effectiveTo: previousEnd });
  }

  const nextRule = await OwnerCommissionRule.create({
    ownerId,
    commissionPerHour,
    effectiveFrom: start,
    effectiveTo: null
  });

  return nextRule;
}

async function upsertOwnerDailyHours(ownerId, { workDate, hours, note }, adminId) {
  const owner = await Owner.findOne({ _id: ownerId, isActive: true }).lean();
  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }

  const parsedDate = parseYyyyMmDd(workDate);
  if (!parsedDate) {
    throw new ApiError(400, "Invalid workDate");
  }

  return OwnerDailyHours.findOneAndUpdate(
    { ownerId, workDate: parsedDate },
    {
      ownerId,
      workDate: parsedDate,
      hours,
      note,
      updatedBy: adminId,
      $setOnInsert: { createdBy: adminId }
    },
    { new: true, upsert: true }
  );
}

function sumForRange(rowsByDate, start, end) {
  let hours = 0;
  let commission = 0;
  rowsByDate.forEach((row, key) => {
    const d = new Date(`${key}T00:00:00.000Z`);
    if (d >= start && d <= end) {
      hours += row.totalEmployeeHours;
      commission += row.earned;
    }
  });
  return { hours, commission };
}

async function getOwnersAnalytics({ ownerId, range }) {
  const owners = await getOwnersWithCurrentCommission({ ownerId });
  const businesses = await listActiveBusinesses();
  const businessNameMap = new Map(
    businesses.map((business) => [String(business.slug || ""), business.name])
  );

  const monthBounds = periodBounds("month");
  const ownerRowsMap = await getOwnerDerivedRowsForPeriod({
    owners,
    start: monthBounds.start,
    end: monthBounds.end
  });
  const today = periodBounds("today");
  const week = periodBounds("week");

  const ownersRows = owners.map((owner) => {
    const dailyRows = ownerRowsMap.get(String(owner._id)) || new Map();

    const todayTotals = sumForRange(dailyRows, today.start, today.end);
    const weekTotals = sumForRange(dailyRows, week.start, week.end);
    const monthTotals = sumForRange(dailyRows, monthBounds.start, monthBounds.end);

    return {
      ownerId: owner._id,
      name: owner.name,
      phone: owner.phone,
      businessType: owner.businessType,
      businessName: businessNameMap.get(String(owner.businessType || "")) || owner.businessType,
      workerCount: owner.workerCount,
      commissionPerHour: owner.currentCommissionPerHour || 0,
      todayHours: todayTotals.hours,
      todayCommission: todayTotals.commission,
      weekHours: weekTotals.hours,
      weekCommission: weekTotals.commission,
      monthHours: monthTotals.hours,
      monthCommission: monthTotals.commission
    };
  });

  const cards = ownersRows.reduce(
    (acc, row) => {
      acc.todayHours += row.todayHours;
      acc.weekHours += row.weekHours;
      acc.monthHours += row.monthHours;
      acc.todayCommission += row.todayCommission;
      acc.weekCommission += row.weekCommission;
      acc.monthCommission += row.monthCommission;
      return acc;
    },
    {
      todayHours: 0,
      weekHours: 0,
      monthHours: 0,
      todayCommission: 0,
      weekCommission: 0,
      monthCommission: 0
    }
  );

  if (range) {
    return {
      range,
      totalCommission:
        range === "today" ? cards.todayCommission : range === "week" ? cards.weekCommission : cards.monthCommission,
      owners: ownersRows
    };
  }

  return {
    cards,
    owners: ownersRows
  };
}

async function getOwnerBreakdown(ownerId, query) {
  const owner = await Owner.findOne({ _id: ownerId, isActive: true }).lean();
  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }

  const { start, end } = parseCustomBounds(query);
  const business = await getBusinessBySlug(owner.businessType);
  const ownerRows = await getOwnerDerivedRowsForPeriod({ owners: [owner], start, end });
  const rows = Array.from((ownerRows.get(String(owner._id)) || new Map()).entries())
    .map(([dayKey, row]) => ({
      date: dayKey,
      totalEmployeeHours: row.totalEmployeeHours,
      totalWorkerHours: row.totalEmployeeHours,
      commissionRate: row.commissionRate,
      ownerCut: row.earned,
      earned: row.earned
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalEmployeeHours += row.totalEmployeeHours;
      acc.totalWorkerHours += row.totalEmployeeHours;
      acc.totalOwnerCut += row.ownerCut;
      acc.totalEarned += row.ownerCut;
      return acc;
    },
    { totalEmployeeHours: 0, totalWorkerHours: 0, totalOwnerCut: 0, totalEarned: 0 }
  );

  return {
    owner: {
      ownerId: owner._id,
      name: owner.name,
      phone: owner.phone,
      businessType: owner.businessType,
      businessName: business.name
    },
    range:
      query.rangeType === "all"
        ? { rangeType: "all" }
        : query.month
          ? { month: query.month }
          : { startDate: query.startDate, endDate: query.endDate },
    totals,
    rows
  };
}

async function getOwnerDerivedAmountForPeriod(ownerId, periodStart, periodEnd) {
  const owner = await Owner.findOne({ _id: ownerId, isActive: true }).lean();
  if (!owner) {
    throw new ApiError(404, "Owner not found or inactive");
  }

  const totalsByOwner = await getOwnerDerivedTotalsForPeriod({
    owners: [owner],
    start: periodStart,
    end: periodEnd
  });

  return totalsByOwner.get(String(owner._id)) || { hoursWorked: 0, computedAmount: 0 };
}

module.exports = {
  getOwnersWithCurrentCommission,
  createOwnerWithRule,
  createOwnerCommissionVersion,
  upsertOwnerDailyHours,
  getOwnersAnalytics,
  getOwnerBreakdown,
  getOwnerDerivedAmountForPeriod
};
