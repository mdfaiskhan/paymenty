const IncentiveRule = require("../models/IncentiveRule.model");
const ApiError = require("../utils/ApiError");
const { parseYyyyMmDd } = require("../utils/date");
const { assertNoRuleOverlap } = require("../services/rules.service");
const { invalidateBusinessAnalyticsCache } = require("../services/analytics.service");
const { getBusinessBySlug, toSlug } = require("../services/business.service");

async function createRule(req, res, next) {
  try {
    const payload = { ...req.validated.body };
    payload.businessType = toSlug(payload.businessType);
    await getBusinessBySlug(payload.businessType);
    payload.effectiveFrom = parseYyyyMmDd(payload.effectiveFrom);
    payload.effectiveTo = payload.effectiveTo ? parseYyyyMmDd(payload.effectiveTo) : null;

    if (!payload.effectiveFrom || (req.validated.body.effectiveTo && !payload.effectiveTo)) {
      throw new ApiError(400, "Invalid effective date");
    }

    if (payload.effectiveTo && payload.effectiveFrom > payload.effectiveTo) {
      throw new ApiError(400, "effectiveFrom cannot be after effectiveTo");
    }

    if (payload.scope === "employee" && !payload.employeeId) {
      throw new ApiError(400, "employeeId is required for employee scope");
    }

    if (payload.scope === "business") {
      payload.employeeId = null;
    }

    await assertNoRuleOverlap(payload);
    const rule = await IncentiveRule.create(payload);
    invalidateBusinessAnalyticsCache(rule.businessType);
    return res.status(201).json(rule);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRule
};
