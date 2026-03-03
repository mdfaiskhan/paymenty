const { getBusinessAnalytics } = require("../services/analytics.service");

async function getAnalytics(req, res, next) {
  try {
    const { businessType } = req.validated.params;
    const payload = await getBusinessAnalytics(businessType);
    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAnalytics
};
