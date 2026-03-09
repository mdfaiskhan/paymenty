const Owner = require("../models/Owner.model");
const OwnerCommissionRule = require("../models/OwnerCommissionRule.model");
const OwnerDailyHours = require("../models/OwnerDailyHours.model");
const ApiError = require("../utils/ApiError");
const { parseYyyyMmDd } = require("../utils/date");
const { getBusinessBySlug, toSlug } = require("./business.service");

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

function parseCustomBounds({ month, startDate, endDate }) {
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
      hours += row.hours;
      commission += row.earned;
    }
  });
  return { hours, commission };
}

async function getOwnersAnalytics({ ownerId, range }) {
  const owners = await getOwnersWithCurrentCommission({ ownerId });
  const ownerIds = owners.map((o) => o._id);
  const rules = await OwnerCommissionRule.find({ ownerId: { $in: ownerIds } })
    .sort({ effectiveFrom: -1 })
    .lean();

  const rulesByOwner = new Map();
  rules.forEach((rule) => {
    const key = String(rule.ownerId);
    if (!rulesByOwner.has(key)) {
      rulesByOwner.set(key, []);
    }
    rulesByOwner.get(key).push(rule);
  });

  const monthBounds = periodBounds("month");
  const ownerHours = await aggregateDailyOwnerHours(monthBounds.start, monthBounds.end, ownerIds);
  const today = periodBounds("today");
  const week = periodBounds("week");

  const ownersRows = owners.map((owner) => {
    const rulesForOwner = rulesByOwner.get(String(owner._id)) || [];
    const dailyRows = new Map();
    const hoursForOwner = ownerHours.get(String(owner._id)) || new Map();
    hoursForOwner.forEach((hours, dayKey) => {
      const d = new Date(`${dayKey}T00:00:00.000Z`);
      const rate = commissionForDate(rulesForOwner, d);
      dailyRows.set(dayKey, {
        date: d,
        hours,
        rate,
        earned: hours * rate
      });
    });

    const todayTotals = sumForRange(dailyRows, today.start, today.end);
    const weekTotals = sumForRange(dailyRows, week.start, week.end);
    const monthTotals = sumForRange(dailyRows, monthBounds.start, monthBounds.end);

    return {
      ownerId: owner._id,
      name: owner.name,
      phone: owner.phone,
      businessType: owner.businessType,
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
      acc.todayCommission += row.todayCommission;
      acc.weekCommission += row.weekCommission;
      acc.monthCommission += row.monthCommission;
      return acc;
    },
    { todayCommission: 0, weekCommission: 0, monthCommission: 0 }
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
  const byOwner = await aggregateDailyOwnerHours(start, end, [owner._id]);
  const dailyHours = byOwner.get(String(owner._id)) || new Map();

  const rules = await OwnerCommissionRule.find({ ownerId }).sort({ effectiveFrom: -1 }).lean();

  const rows = Array.from(dailyHours.entries())
    .map(([dayKey, hours]) => {
      const d = new Date(`${dayKey}T00:00:00.000Z`);
      const commissionRate = commissionForDate(rules, d);
      return {
        date: dayKey,
        totalWorkerHours: hours,
        commissionRate,
        earned: hours * commissionRate
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalWorkerHours += row.totalWorkerHours;
      acc.totalEarned += row.earned;
      return acc;
    },
    { totalWorkerHours: 0, totalEarned: 0 }
  );

  return {
    owner: {
      ownerId: owner._id,
      name: owner.name,
      phone: owner.phone,
      businessType: owner.businessType
    },
    range: query.month ? { month: query.month } : { startDate: query.startDate, endDate: query.endDate },
    totals,
    rows
  };
}

module.exports = {
  getOwnersWithCurrentCommission,
  createOwnerWithRule,
  createOwnerCommissionVersion,
  upsertOwnerDailyHours,
  getOwnersAnalytics,
  getOwnerBreakdown
};
