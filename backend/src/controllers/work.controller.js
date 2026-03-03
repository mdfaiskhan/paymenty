const WorkEntry = require("../models/WorkEntry.model");
const Employee = require("../models/Employee.model");
const ApiError = require("../utils/ApiError");
const { parseYyyyMmDd } = require("../utils/date");
const { getEmployeeWorkHistory } = require("../services/analytics.service");

async function createWorkEntry(req, res, next) {
  try {
    const { employeeId, workDate, hours, videoId, note } = req.validated.body;
    const normalizedDate = parseYyyyMmDd(workDate);
    if (!normalizedDate) {
      throw new ApiError(400, "Invalid workDate");
    }

    const employee = await Employee.findOne({ _id: employeeId, isActive: true }).lean();
    if (!employee) {
      throw new ApiError(404, "Employee not found or inactive");
    }

    const row = await WorkEntry.create({
      employeeId,
      businessType: employee.businessType,
      workDate: normalizedDate,
      hours,
      videoId,
      note,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function updateWorkEntry(req, res, next) {
  try {
    const { id } = req.validated.params;
    const row = await WorkEntry.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { ...req.validated.body, updatedBy: req.user.id },
      { new: true }
    );

    if (!row) {
      throw new ApiError(404, "Work entry not found");
    }

    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

async function deleteWorkEntry(req, res, next) {
  try {
    const { id } = req.validated.params;
    const row = await WorkEntry.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), updatedBy: req.user.id },
      { new: true }
    );

    if (!row) {
      throw new ApiError(404, "Work entry not found");
    }

    return res.status(200).json({ message: "Work entry deleted" });
  } catch (error) {
    return next(error);
  }
}

async function listWorkEntries(req, res, next) {
  try {
    const { employeeId, month, startDate, endDate } = req.validated.query;
    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    const days = await getEmployeeWorkHistory(employeeId, { month, startDate, endDate });

    return res.status(200).json({
      employeeId,
      businessType: employee.businessType,
      month: month || null,
      startDate: startDate || null,
      endDate: endDate || null,
      days
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createWorkEntry,
  updateWorkEntry,
  deleteWorkEntry,
  listWorkEntries
};
