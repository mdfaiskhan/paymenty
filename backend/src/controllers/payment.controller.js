const {
  createPaymentLog,
  updatePaymentLog,
  getPaymentById: getPaymentByIdService,
  deletePaymentById,
  listPaymentsWithBalances,
  getPaymentHistory,
  getSummary
} = require("../services/payment.service");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { toSlug } = require("../services/business.service");

function ensureOwnerModuleAccess(req) {
  const provided = req.headers["x-owner-password"];
  if (!provided || provided !== env.ownerModulePassword) {
    throw new ApiError(403, "Invalid owner module password");
  }
}

async function createPayment(req, res, next) {
  try {
    req.validated.body.businessType = toSlug(req.validated.body.businessType);
    if (req.validated.body.businessType === "owners") {
      ensureOwnerModuleAccess(req);
    }
    const row = await createPaymentLog(req.validated.body, req.user.id);
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function listPayments(req, res, next) {
  try {
    const normalizedBusinessType =
      req.validated.query.businessType && req.validated.query.businessType !== "all"
        ? toSlug(req.validated.query.businessType)
        : req.validated.query.businessType || "all";
    const { rangeType = "month", startDate, endDate, search } = req.validated.query;
    if (normalizedBusinessType === "owners") {
      ensureOwnerModuleAccess(req);
    }
    const payload = await listPaymentsWithBalances({
      businessType: normalizedBusinessType,
      rangeType,
      startDate,
      endDate,
      search
    });
    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getPaymentById(req, res, next) {
  try {
    const row = await getPaymentByIdService(req.validated.params.id);
    if (row.businessType === "owners") {
      ensureOwnerModuleAccess(req);
    }
    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

async function updatePayment(req, res, next) {
  try {
    const existing = await getPaymentByIdService(req.validated.params.id);
    if (existing.businessType === "owners") {
      ensureOwnerModuleAccess(req);
    }
    const row = await updatePaymentLog(req.validated.params.id, req.validated.body);
    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

async function deletePayment(req, res, next) {
  try {
    const existing = await getPaymentByIdService(req.validated.params.id);
    if (existing.businessType === "owners") {
      ensureOwnerModuleAccess(req);
    }
    const payload = await deletePaymentById(req.validated.params.id);
    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getPaymentSummary(req, res, next) {
  try {
    const normalizedBusinessType =
      req.validated.query.businessType && req.validated.query.businessType !== "all"
        ? toSlug(req.validated.query.businessType)
        : req.validated.query.businessType || "all";
    const { rangeType = "month", startDate, endDate } = req.validated.query;
    if (normalizedBusinessType === "owners") {
      ensureOwnerModuleAccess(req);
    }
    const summary = await getSummary({ businessType: normalizedBusinessType, rangeType, startDate, endDate });
    const history = await getPaymentHistory({
      businessType: normalizedBusinessType,
      rangeType,
      startDate,
      endDate
    });
    return res.status(200).json({
      ...summary,
      paymentHistory: history
    });
  } catch (error) {
    return next(error);
  }
}

async function reconciliation(req, res, next) {
  try {
    const { month } = req.validated.query;
    const businessType = toSlug(req.validated.query.businessType);
    const [year, mm] = month.split("-").map(Number);
    const startDate = `${year}-${String(mm).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(year, mm, 0)).getUTCDate();
    const endDate = `${year}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const payload = await listPaymentsWithBalances({
      businessType,
      rangeType: "custom",
      startDate,
      endDate
    });

    return res.status(200).json({
      businessType,
      month,
      rows: (payload.rows || []).filter((row) => row.entityType === "employee").map((row) => ({
        employeeId: row.employeeId,
        name: row.name,
        derivedAmount: row.totalEarned,
        totalPaid: row.totalPaid,
        outstanding: row.pendingBalance,
        reconStatus:
          row.totalPaid <= 0 ? "unpaid" : row.pendingBalance <= 0 ? "settled" : "partial",
        lastPaidAt: row.lastPaymentDate
      }))
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createPayment,
  listPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  getPaymentSummary,
  reconciliation
};
