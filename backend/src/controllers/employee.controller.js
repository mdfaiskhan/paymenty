const Employee = require("../models/Employee.model");
const ApiError = require("../utils/ApiError");

async function createEmployee(req, res, next) {
  try {
    const employee = await Employee.create(req.validated.body);
    return res.status(201).json(employee);
  } catch (error) {
    return next(error);
  }
}

async function listEmployees(req, res, next) {
  try {
    const { businessType, search } = req.validated.query;
    const filter = { isActive: true };

    if (businessType) {
      filter.businessType = businessType;
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const rows = await Employee.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const { id } = req.validated.params;
    const row = await Employee.findByIdAndUpdate(id, req.validated.body, { new: true });
    if (!row) {
      throw new ApiError(404, "Employee not found");
    }
    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const { id } = req.validated.params;
    const row = await Employee.findByIdAndUpdate(
      id,
      { isActive: false, deletedAt: new Date() },
      { new: true }
    );

    if (!row) {
      throw new ApiError(404, "Employee not found");
    }

    return res.status(200).json({ message: "Employee deleted" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createEmployee,
  listEmployees,
  updateEmployee,
  deleteEmployee
};
