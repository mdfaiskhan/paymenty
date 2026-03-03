const PaymentLog = require("../models/PaymentLog.model");
const Employee = require("../models/Employee.model");
const ApiError = require("../utils/ApiError");
const { parseYyyyMmDd } = require("../utils/date");
const {
  getReconciliation,
  getDerivedAmountForEmployeePeriod
} = require("../services/payment.service");

async function createPayment(req, res, next) {
  try {
    const payload = { ...req.validated.body };
    payload.periodStart = parseYyyyMmDd(payload.periodStart);
    payload.periodEnd = parseYyyyMmDd(payload.periodEnd);

    if (!payload.periodStart || !payload.periodEnd) {
      throw new ApiError(400, "Invalid period date");
    }

    if (payload.periodStart > payload.periodEnd) {
      throw new ApiError(400, "periodStart cannot be after periodEnd");
    }

    const employee = await Employee.findOne({ _id: payload.employeeId, isActive: true }).lean();
    if (!employee) {
      throw new ApiError(404, "Employee not found or inactive");
    }
    if (employee.businessType !== payload.businessType) {
      throw new ApiError(400, "businessType does not match employee business type");
    }

    payload.computedAmount = await getDerivedAmountForEmployeePeriod(
      employee._id,
      payload.businessType,
      payload.periodStart,
      payload.periodEnd
    );
    payload.paidAt = ["partial", "paid"].includes(payload.status) ? new Date() : null;
    payload.createdBy = req.user.id;

    const log = await PaymentLog.create(payload);
    return res.status(201).json(log);
  } catch (error) {
    return next(error);
  }
}

async function reconciliation(req, res, next) {
  try {
    const { businessType, month } = req.validated.query;
    const rows = await getReconciliation(businessType, month);
    return res.status(200).json({ businessType, month, rows });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createPayment,
  reconciliation
};
