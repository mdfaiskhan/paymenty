const Employee = require("../models/Employee.model");
const Owner = require("../models/Owner.model");
const Business = require("../models/Business.model");
const WorkEntry = require("../models/WorkEntry.model");
const PaymentLog = require("../models/PaymentLog.model");
const ApiError = require("../utils/ApiError");
const { parseYyyyMmDd } = require("../utils/date");
const { getOwnerDerivedAmountForPeriod, getOwnersWithCurrentCommission } = require("./owner.service");
const {
  metricExpressionForCalcTypeWithRule
} = require("./payout.service");

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

function rangeBounds({ rangeType = "month", startDate, endDate } = {}) {
  if (rangeType === "all") {
    return {
      start: new Date(Date.UTC(1970, 0, 1)),
      end: utcEndOfDay(new Date())
    };
  }

  const nowUtc = new Date();
  const todayStart = utcStartOfDay(nowUtc);
  const todayEnd = utcEndOfDay(nowUtc);

  if (rangeType === "today") {
    return { start: todayStart, end: todayEnd };
  }

  if (rangeType === "week") {
    const utcDay = nowUtc.getUTCDay();
    const diffToMonday = (utcDay + 6) % 7;
    const weekStart = new Date(
      Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - diffToMonday)
    );
    return { start: weekStart, end: utcEndOfDay(addDays(weekStart, 6)) };
  }

  if (rangeType === "custom") {
    const parsedStart = parseYyyyMmDd(startDate);
    const parsedEnd = parseYyyyMmDd(endDate);
    if (!parsedStart || !parsedEnd) {
      throw new ApiError(400, "startDate and endDate are required for custom range");
    }
    const boundedEnd = utcEndOfDay(parsedEnd);
    if (parsedStart > boundedEnd) {
      throw new ApiError(400, "startDate cannot be after endDate");
    }
    return { start: parsedStart, end: boundedEnd };
  }

  const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start: monthStart, end: monthEnd };
}

function paymentMatchForRange(start, end, businessType = "all") {
  const match = {
    periodStart: { $lte: end },
    periodEnd: { $gte: start }
  };

  if (businessType === "all") {
    match.businessType = { $ne: "owners" };
  } else if (businessType) {
    match.businessType = businessType;
  }
  return match;
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

async function getEmployeeDerivedByBusiness(businessType, calcType, start, end) {
  const rows = await WorkEntry.aggregate([
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
    {
      $addFields: {
        dayMetric: metricExpressionForCalcTypeWithRule(calcType, "$dayHours", "$chosenRule")
      }
    },
    {
      $group: {
        _id: "$_id.employeeId",
        hoursWorked: { $sum: "$dayHours" },
        computedAmount: { $sum: "$dayMetric" }
      }
    }
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      { hoursWorked: Number(row.hoursWorked) || 0, computedAmount: Number(row.computedAmount) || 0 }
    ])
  );
}

async function getDailyEarnedByBusiness(businessType, calcType, start, end) {
  const rows = await WorkEntry.aggregate([
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
    {
      $addFields: {
        dayMetric: metricExpressionForCalcTypeWithRule(calcType, "$dayHours", "$chosenRule")
      }
    },
    {
      $group: {
        _id: "$_id.workDate",
        totalEarned: { $sum: "$dayMetric" }
      }
    },
    {
      $project: {
        _id: 0,
        date: { $dateToString: { format: "%Y-%m-%d", date: "$_id" } },
        totalEarned: 1
      }
    }
  ]);

  return rows;
}

async function getEarnedTrend({ businessType = "all", start, end }) {
  const businesses =
    businessType === "all"
      ? await Business.find({ isActive: true }).select({ slug: 1, calcType: 1 }).lean()
      : await Business.find({ isActive: true, slug: businessType }).select({ slug: 1, calcType: 1 }).lean();

  const rowGroups = await Promise.all(
    businesses.map((b) => getDailyEarnedByBusiness(b.slug, b.calcType || "tailor_slab_v1", start, end))
  );
  const rows = rowGroups.flat();

  const byDate = new Map();
  rows.forEach((row) => {
    const key = row.date;
    byDate.set(key, (byDate.get(key) || 0) + (Number(row.totalEarned) || 0));
  });

  const trend = [];
  const startDay = utcStartOfDay(start);
  const endDay = utcStartOfDay(end);
  for (let d = new Date(startDay); d <= endDay; d = addDays(d, 1)) {
    const key = dateKey(d);
    trend.push({
      date: key,
      totalEarned: byDate.get(key) || 0
    });
  }
  return trend;
}

async function getOwnerDerivedMap(start, end) {
  const owners = await getOwnersWithCurrentCommission();
  const rows = await Promise.all(
    owners.map(async (owner) => ({
      ownerId: String(owner._id),
      totals: await getOwnerDerivedAmountForPeriod(owner._id, start, end)
    }))
  );

  return new Map(
    rows.map((row) => [row.ownerId, row.totals])
  );
}

async function getEntityDerivedMap({ businessType = "all", start, end }) {
  const result = new Map();

  const businesses =
    businessType === "all"
      ? await Business.find({ isActive: true }).select({ slug: 1, calcType: 1 }).lean()
      : await Business.find({ isActive: true, slug: businessType }).select({ slug: 1, calcType: 1 }).lean();

  const derivedGroups = await Promise.all(
    businesses.map(async (business) => ({
      slug: business.slug,
      rows: await getEmployeeDerivedByBusiness(
        business.slug,
        business.calcType || "tailor_slab_v1",
        start,
        end
      )
    }))
  );

  derivedGroups.forEach((group) => {
    group.rows.forEach((value, key) => {
      result.set(`employee:${key}`, {
        entityType: "employee",
        businessType: group.slug,
        ...value
      });
    });
  });

  if (businessType === "owners") {
    const ownerMap = await getOwnerDerivedMap(start, end);
    ownerMap.forEach((value, key) => {
      result.set(`owner:${key}`, {
        entityType: "owner",
        businessType: "owners",
        hoursWorked: value.hoursWorked || 0,
        computedAmount: value.computedAmount || 0
      });
    });
  }

  return result;
}

async function getPaidAggregation({ businessType = "all", start, end }) {
  const rows = await PaymentLog.aggregate([
    {
      $match: paymentMatchForRange(start, end, businessType)
    },
    {
      $group: {
        _id: {
          entityType: {
            $cond: [{ $eq: ["$businessType", "owners"] }, "owner", "employee"]
          },
          entityId: { $ifNull: ["$ownerId", "$employeeId"] }
        },
        totalPaid: { $sum: "$paidAmount" },
        lastPaymentDate: { $max: "$paidAt" }
      }
    }
  ]);

  return new Map(
    rows.map((row) => [
      `${row._id.entityType}:${String(row._id.entityId)}`,
      {
        totalPaid: Number(row.totalPaid) || 0,
        lastPaymentDate: row.lastPaymentDate || null
      }
    ])
  );
}

async function getEntityNameMaps() {
  const [employees, owners] = await Promise.all([
    Employee.find({ isActive: true }).lean(),
    Owner.find({ isActive: true }).lean()
  ]);

  return {
    employeeMap: new Map(employees.map((row) => [String(row._id), row])),
    ownerMap: new Map(owners.map((row) => [String(row._id), row]))
  };
}

function safeStatus(computedAmount, paidAmount) {
  if (paidAmount <= 0) {
    return "pending";
  }
  if (paidAmount >= computedAmount) {
    return "paid";
  }
  return "partial";
}

function parsePaymentDoc(payment) {
  return {
    id: payment._id,
    employeeId: payment.employeeId,
    ownerId: payment.ownerId,
    businessType: payment.businessType,
    periodStart: payment.periodStart,
    periodEnd: payment.periodEnd,
    hoursWorked: Number(payment.hoursWorked) || 0,
    computedAmount: Number(payment.computedAmount) || 0,
    paidAmount: Number(payment.paidAmount) || 0,
    status: payment.status,
    method: payment.method,
    referenceId: payment.referenceId || "",
    notes: payment.notes || "",
    paidAt: payment.paidAt,
    createdAt: payment.createdAt
  };
}

async function getExistingPaidAmountForExactPeriod({
  businessType,
  employeeId = null,
  ownerId = null,
  periodStart,
  periodEnd,
  excludePaymentId = null
}) {
  const match = {
    businessType,
    employeeId: employeeId || null,
    ownerId: ownerId || null,
    periodStart,
    periodEnd
  };

  if (excludePaymentId) {
    match._id = { $ne: excludePaymentId };
  }

  const rows = await PaymentLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: "$paidAmount" }
      }
    }
  ]);

  return Number(rows[0]?.totalPaid) || 0;
}

async function getDerivedAmountForEmployeePeriod(employeeId, businessType, periodStart, periodEnd) {
  const business = await Business.findOne({ slug: businessType, isActive: true }).lean();
  if (!business) {
    throw new ApiError(400, "Unknown business type");
  }
  const rows = await WorkEntry.aggregate([
    {
      $match: {
        employeeId,
        businessType,
        isDeleted: { $ne: true },
        workDate: { $gte: periodStart, $lte: periodEnd }
      }
    },
    {
      $group: {
        _id: { employeeId: "$employeeId", workDate: "$workDate" },
        dayHours: { $sum: "$hours" }
      }
    },
    ...ruleLookupStages(businessType),
    {
      $addFields: {
        dayMetric: metricExpressionForCalcTypeWithRule(
          business.calcType || "tailor_slab_v1",
          "$dayHours",
          "$chosenRule"
        )
      }
    },
    {
      $group: {
        _id: null,
        totalHours: { $sum: "$dayHours" },
        total: { $sum: "$dayMetric" }
      }
    }
  ]);

  return {
    hoursWorked: rows[0]?.totalHours || 0,
    computedAmount: rows[0]?.total || 0
  };
}

async function getDerivedAmountForOwnerPeriod(ownerId, periodStart, periodEnd) {
  return getOwnerDerivedAmountForPeriod(ownerId, periodStart, periodEnd);
}

async function createPaymentLog(payload, adminId) {
  const periodStart = parseYyyyMmDd(payload.periodStart);
  const parsedPeriodEnd = parseYyyyMmDd(payload.periodEnd);
  if (!periodStart || !parsedPeriodEnd) {
    throw new ApiError(400, "Invalid period date");
  }
  const periodEnd = utcEndOfDay(parsedPeriodEnd);

  if (periodStart > periodEnd) {
    throw new ApiError(400, "periodStart cannot be after periodEnd");
  }

  let computed = { hoursWorked: 0, computedAmount: 0 };
  if (payload.businessType === "owners") {
    if (!payload.ownerId || payload.employeeId) {
      throw new ApiError(400, "Owners payments require ownerId only");
    }
    computed = await getDerivedAmountForOwnerPeriod(payload.ownerId, periodStart, periodEnd);
  } else {
    const business = await Business.findOne({ slug: payload.businessType, isActive: true }).lean();
    if (!business) {
      throw new ApiError(400, "Unknown business type");
    }
    if (!payload.employeeId || payload.ownerId) {
      throw new ApiError(400, "Employee payments require employeeId only");
    }
    const employee = await Employee.findOne({ _id: payload.employeeId, isActive: true }).lean();
    if (!employee) {
      throw new ApiError(404, "Employee not found or inactive");
    }
    if (employee.businessType !== payload.businessType) {
      throw new ApiError(400, "businessType does not match employee business type");
    }
    computed = await getDerivedAmountForEmployeePeriod(
      employee._id,
      payload.businessType,
      periodStart,
      periodEnd
    );
  }

  const paidAmount = Number(payload.paidAmount) || 0;
  const existingPaidAmount = await getExistingPaidAmountForExactPeriod({
    businessType: payload.businessType,
    employeeId: payload.employeeId || null,
    ownerId: payload.ownerId || null,
    periodStart,
    periodEnd
  });
  const totalPaidForPeriod = existingPaidAmount + paidAmount;
  const status = payload.status || safeStatus(computed.computedAmount, totalPaidForPeriod);
  const paidAt = status === "pending" ? null : new Date();

  const created = await PaymentLog.create({
    employeeId: payload.employeeId || null,
    ownerId: payload.ownerId || null,
    businessType: payload.businessType,
    periodStart,
    periodEnd,
    hoursWorked: computed.hoursWorked,
    computedAmount: computed.computedAmount,
    paidAmount,
    status,
    method: payload.method || "cash",
    referenceId: payload.referenceId || "",
    notes: payload.notes || "",
    createdBy: adminId,
    paidAt
  });

  return parsePaymentDoc(created.toObject ? created.toObject() : created);
}

async function updatePaymentLog(paymentId, payload) {
  const payment = await PaymentLog.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  if (typeof payload.paidAmount !== "undefined") {
    payment.paidAmount = payload.paidAmount;
  }
  if (typeof payload.method !== "undefined") {
    payment.method = payload.method;
  }
  if (typeof payload.referenceId !== "undefined") {
    payment.referenceId = payload.referenceId;
  }
  if (typeof payload.notes !== "undefined") {
    payment.notes = payload.notes;
  }

  const existingPaidAmount = await getExistingPaidAmountForExactPeriod({
    businessType: payment.businessType,
    employeeId: payment.employeeId || null,
    ownerId: payment.ownerId || null,
    periodStart: payment.periodStart,
    periodEnd: payment.periodEnd,
    excludePaymentId: payment._id
  });
  const totalPaidForPeriod = existingPaidAmount + (Number(payment.paidAmount) || 0);

  if (typeof payload.status !== "undefined") {
    payment.status = payload.status;
  } else {
    payment.status = safeStatus(payment.computedAmount, totalPaidForPeriod);
  }

  payment.paidAt = payment.status === "pending" ? null : new Date();
  await payment.save();
  return parsePaymentDoc(payment.toObject());
}

async function getPaymentById(paymentId) {
  const payment = await PaymentLog.findById(paymentId).lean();
  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }
  return parsePaymentDoc(payment);
}

async function deletePaymentById(paymentId) {
  const payment = await PaymentLog.findByIdAndDelete(paymentId).lean();
  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }
  return { message: "Payment deleted" };
}

function matchBySearch(rows, search) {
  const q = String(search || "")
    .trim()
    .toLowerCase();
  if (!q) {
    return rows;
  }
  return rows.filter((row) => row.name.toLowerCase().includes(q));
}

async function listPaymentsWithBalances({ businessType = "all", rangeType, startDate, endDate, search }) {
  const { start, end } = rangeBounds({ rangeType, startDate, endDate });
  const [derivedMap, paidMap, names] = await Promise.all([
    getEntityDerivedMap({ businessType, start, end }),
    getPaidAggregation({ businessType, start, end }),
    getEntityNameMaps()
  ]);

  const allKeys = new Set([...derivedMap.keys(), ...paidMap.keys()]);
  if (businessType === "all" || businessType !== "owners") {
    names.employeeMap.forEach((value, key) => {
      if (businessType === "all" || value.businessType === businessType) {
        allKeys.add(`employee:${key}`);
      }
    });
  }
  if (businessType === "owners") {
    names.ownerMap.forEach((_, key) => {
      allKeys.add(`owner:${key}`);
    });
  }
  const rows = [];

  allKeys.forEach((key) => {
    const derived = derivedMap.get(key) || { hoursWorked: 0, computedAmount: 0 };
    const paid = paidMap.get(key) || { totalPaid: 0, lastPaymentDate: null };
    const [entityType, entityId] = key.split(":");
    const name =
      entityType === "owner"
        ? names.ownerMap.get(entityId)?.name || "Unknown Owner"
        : names.employeeMap.get(entityId)?.name || "Unknown Employee";

    const rowBusinessType =
      derived.businessType ||
      (entityType === "owner" ? "owners" : names.employeeMap.get(entityId)?.businessType || "unknown");
    const totalEarned = Number(derived.computedAmount) || 0;
    const totalPaid = Number(paid.totalPaid) || 0;
    const pendingBalance = totalEarned - totalPaid;

    rows.push({
      id: key,
      entityType,
      employeeId: entityType === "employee" ? entityId : null,
      ownerId: entityType === "owner" ? entityId : null,
      name,
      businessType: rowBusinessType,
      hoursWorked: Number(derived.hoursWorked) || 0,
      totalEarned,
      totalPaid,
      pendingBalance,
      lastPaymentDate: paid.lastPaymentDate
    });
  });

  const filtered = matchBySearch(rows, search).sort((a, b) => b.pendingBalance - a.pendingBalance);

  return {
    filters: { businessType, rangeType: rangeType || "all", startDate, endDate },
    rows: filtered
  };
}

async function getPaymentHistory({ employeeId, ownerId, businessType, rangeType, startDate, endDate }) {
  const { start, end } = rangeBounds({ rangeType, startDate, endDate });
  const match = paymentMatchForRange(start, end, businessType || "all");
  if (employeeId) {
    match.employeeId = employeeId;
  }
  if (ownerId) {
    match.ownerId = ownerId;
  }

  const rows = await PaymentLog.find(match).sort({ createdAt: -1 }).lean();
  return rows.map((row) => parsePaymentDoc(row));
}

async function getPaidTrendLast7Days({ businessType = "all" }) {
  const todayEnd = utcEndOfDay(new Date());
  const trendStart = utcStartOfDay(addDays(todayEnd, -6));
  const match = {
    paidAt: { $gte: trendStart, $lte: todayEnd }
  };
  if (businessType === "all") {
    match.businessType = { $ne: "owners" };
  } else {
    match.businessType = businessType;
  }

  const rows = await PaymentLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$paidAt" }
        },
        amountPaid: { $sum: "$paidAmount" }
      }
    }
  ]);

  const map = new Map(rows.map((row) => [row._id, Number(row.amountPaid) || 0]));
  const trend = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(trendStart, i);
    const dk = dateKey(d);
    trend.push({ date: dk, amountPaid: map.get(dk) || 0 });
  }
  return trend;
}

async function getSummary({ businessType = "all", rangeType, startDate, endDate }) {
  const { start, end } = rangeBounds({ rangeType, startDate, endDate });
  const [derivedMap, paidMap, trend, earnedTrend] = await Promise.all([
    getEntityDerivedMap({ businessType, start, end }),
    getPaidAggregation({ businessType, start, end }),
    getPaidTrendLast7Days({ businessType }),
    getEarnedTrend({ businessType, start, end })
  ]);

  let totalEarned = 0;
  derivedMap.forEach((row) => {
    totalEarned += Number(row.computedAmount) || 0;
  });

  let totalPaid = 0;
  paidMap.forEach((row) => {
    totalPaid += Number(row.totalPaid) || 0;
  });

  return {
    filters: { businessType, rangeType: rangeType || "all", startDate, endDate },
    totalEarned,
    totalPaid,
    pendingBalance: totalEarned - totalPaid,
    trend,
    earnedTrend
  };
}

module.exports = {
  createPaymentLog,
  updatePaymentLog,
  getPaymentById,
  deletePaymentById,
  listPaymentsWithBalances,
  getPaymentHistory,
  getSummary
};
