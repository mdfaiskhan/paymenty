const mongoose = require("mongoose");
const WorkEntry = require("../models/WorkEntry.model");
const Employee = require("../models/Employee.model");
const {
  tailorEarningsExpressionWithRule,
  butcherCutsExpressionWithRule
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

function currentPeriodBounds() {
  const nowUtc = new Date();

  const todayStart = utcStartOfDay(nowUtc);
  const todayEnd = utcEndOfDay(nowUtc);

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
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    trendStart,
    trendEnd
  };
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

function metricStage(businessType) {
  if (businessType === "tailor") {
    return {
      $addFields: {
        dayTotal: tailorEarningsExpressionWithRule("$dayHours", "$chosenRule")
      }
    };
  }

  return {
    $addFields: {
      dayTotal: butcherCutsExpressionWithRule("$dayHours", "$chosenRule")
    }
  };
}

async function aggregateEmployeeDaily(businessType, start, end) {
  return WorkEntry.aggregate([
    {
      $match: {
        businessType,
        isDeleted: false,
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
    metricStage(businessType),
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

async function getBusinessAnalytics(businessType) {
  const bounds = currentPeriodBounds();
  const analysisStart = bounds.trendStart < bounds.monthStart ? bounds.trendStart : bounds.monthStart;

  const [employees, monthDaily] = await Promise.all([
    Employee.find({ businessType, isActive: true }).sort({ createdAt: -1 }).lean(),
    aggregateEmployeeDaily(businessType, analysisStart, bounds.monthEnd)
  ]);

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
        today: emptyWindow(),
        week: emptyWindow(),
        month: emptyWindow()
      }
    ])
  );

  const trendMap = new Map();
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(bounds.trendStart, i);
    trendMap.set(dateKey(d), 0);
  }

  const summary = {
    today: { totalHours: 0, totalEarningsOrCuts: 0 },
    week: { totalHours: 0, totalEarningsOrCuts: 0 },
    month: { totalHours: 0, totalEarningsOrCuts: 0 }
  };

  monthDaily.forEach((row) => {
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

    if (d >= bounds.trendStart && d <= bounds.trendEnd) {
      const dk = dateKey(d);
      trendMap.set(dk, (trendMap.get(dk) || 0) + total);
    }
  });

  const dailyTrend = Array.from(trendMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    businessType,
    unit: businessType === "tailor" ? "earnings" : "cuts",
    today: summary.today,
    week: summary.week,
    month: summary.month,
    dailyTrend,
    employeeBreakdown: Array.from(employeeBreakdown.values())
  };
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
        isDeleted: false,
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
      $addFields: {
        dayMetric: {
          $cond: [
            { $eq: ["$_id.businessType", "tailor"] },
            tailorEarningsExpressionWithRule("$totalHours", "$chosenRule"),
            butcherCutsExpressionWithRule("$totalHours", "$chosenRule")
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
    derivedEarnings: r._id.businessType === "tailor" ? r.dayMetric : undefined,
    derivedCuts: r._id.businessType === "butcher" ? r.dayMetric : undefined
  }));
}

module.exports = {
  getBusinessAnalytics,
  getEmployeeWorkHistory
};
