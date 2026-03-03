const IncentiveRule = require("../models/IncentiveRule.model");
const ApiError = require("../utils/ApiError");

function scopeFilter(scope, employeeId) {
  if (scope === "employee") {
    return { employeeId };
  }
  return { employeeId: null };
}

async function assertNoRuleOverlap(rulePayload) {
  const maxDate = new Date("9999-12-31T00:00:00.000Z");
  const filter = {
    businessType: rulePayload.businessType,
    scope: rulePayload.scope,
    ...scopeFilter(rulePayload.scope, rulePayload.employeeId || null),
    isActive: true,
    effectiveFrom: { $lte: rulePayload.effectiveTo || maxDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: rulePayload.effectiveFrom } }]
  };

  const overlap = await IncentiveRule.findOne(filter).lean();
  if (overlap) {
    throw new ApiError(409, "Overlapping incentive rule exists for this scope and effective range");
  }
}

module.exports = {
  assertNoRuleOverlap
};
