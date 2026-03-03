const Employee = require("../models/Employee.model");
const WorkEntry = require("../models/WorkEntry.model");
const PaymentLog = require("../models/PaymentLog.model");
const { monthBounds } = require("../utils/date");
const {
  tailorEarningsExpressionWithRule,
  butcherCutsExpressionWithRule
} = require("./payout.service");

function ruleLookupStages(businessType) {
  return [
    {
      $lookup: {
        from: "incentiverules",
        let: {
          employeeId: "$_id.employeeId",
          workDate: "$_id.workDate",
          businessType
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

async function getReconciliation(businessType, month) {
  const { start, end } = monthBounds(month);

  const derivedRows = await WorkEntry.aggregate([
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
    {
      $addFields: {
        dayMetric:
          businessType === "tailor"
            ? tailorEarningsExpressionWithRule("$dayHours", "$chosenRule")
            : butcherCutsExpressionWithRule("$dayHours", "$chosenRule")
      }
    },
    {
      $group: {
        _id: "$_id.employeeId",
        derivedAmount: { $sum: "$dayMetric" }
      }
    }
  ]);

  const paidRows = await PaymentLog.aggregate([
    {
      $match: {
        businessType,
        periodStart: { $lte: end },
        periodEnd: { $gte: start }
      }
    },
    {
      $group: {
        _id: "$employeeId",
        totalPaid: {
          $sum: {
            $cond: [{ $in: ["$status", ["partial", "paid"]] }, "$paidAmount", 0]
          }
        },
        lastPaidAt: { $max: "$paidAt" }
      }
    }
  ]);

  const derivedMap = new Map(derivedRows.map((r) => [String(r._id), r.derivedAmount || 0]));
  const paidMap = new Map(
    paidRows.map((r) => [String(r._id), { totalPaid: r.totalPaid || 0, lastPaidAt: r.lastPaidAt || null }])
  );

  const employees = await Employee.find({ businessType, isActive: true }).lean();

  return employees.map((emp) => {
    const derivedAmount = derivedMap.get(String(emp._id)) || 0;
    const paid = paidMap.get(String(emp._id)) || { totalPaid: 0, lastPaidAt: null };
    const outstanding = derivedAmount - paid.totalPaid;

    let reconStatus = "unpaid";
    if (derivedAmount > 0 && outstanding <= 0) {
      reconStatus = "settled";
    } else if (paid.totalPaid > 0 && outstanding > 0) {
      reconStatus = "partial";
    }

    return {
      employeeId: emp._id,
      name: emp.name,
      derivedAmount,
      totalPaid: paid.totalPaid,
      outstanding,
      reconStatus,
      lastPaidAt: paid.lastPaidAt
    };
  });
}

async function getDerivedAmountForEmployeePeriod(employeeId, businessType, periodStart, periodEnd) {
  const rows = await WorkEntry.aggregate([
    {
      $match: {
        employeeId,
        businessType,
        isDeleted: false,
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
        dayMetric:
          businessType === "tailor"
            ? tailorEarningsExpressionWithRule("$dayHours", "$chosenRule")
            : butcherCutsExpressionWithRule("$dayHours", "$chosenRule")
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$dayMetric" }
      }
    }
  ]);

  return rows[0]?.total || 0;
}

module.exports = {
  getReconciliation,
  getDerivedAmountForEmployeePeriod
};
