const { getBusinessAnalytics } = require("../services/analytics.service");
const { toSlug } = require("../services/business.service");

async function getAnalytics(req, res, next) {
  try {
    const { businessType } = req.validated.params;
    const { startDate, endDate } = req.validated.query;
    const payload = await getBusinessAnalytics(toSlug(businessType), { startDate, endDate });
    res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAnalytics
};
