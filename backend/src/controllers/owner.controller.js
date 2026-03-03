const Owner = require("../models/Owner.model");
const ApiError = require("../utils/ApiError");
const {
  getOwnersWithCurrentCommission,
  createOwnerWithRule,
  createOwnerCommissionVersion,
  upsertOwnerDailyHours,
  getOwnersAnalytics,
  getOwnerBreakdown
} = require("../services/owner.service");

async function createOwner(req, res, next) {
  try {
    const owner = await createOwnerWithRule(req.validated.body);
    return res.status(201).json(owner);
  } catch (error) {
    return next(error);
  }
}

async function listOwners(req, res, next) {
  try {
    const rows = await getOwnersWithCurrentCommission(req.validated.query);
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
}

async function updateOwner(req, res, next) {
  try {
    const { id } = req.validated.params;
    const row = await Owner.findOneAndUpdate({ _id: id, isActive: true }, req.validated.body, { new: true });
    if (!row) {
      throw new ApiError(404, "Owner not found");
    }
    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

async function deleteOwner(req, res, next) {
  try {
    const { id } = req.validated.params;
    const row = await Owner.findOneAndUpdate(
      { _id: id, isActive: true },
      { isActive: false, deletedAt: new Date() },
      { new: true }
    );

    if (!row) {
      throw new ApiError(404, "Owner not found");
    }

    return res.status(200).json({ message: "Owner deleted" });
  } catch (error) {
    return next(error);
  }
}

async function createCommissionRule(req, res, next) {
  try {
    const { id } = req.validated.params;
    const rule = await createOwnerCommissionVersion(id, req.validated.body);
    return res.status(201).json(rule);
  } catch (error) {
    return next(error);
  }
}

async function upsertDailyHours(req, res, next) {
  try {
    const { id } = req.validated.params;
    const row = await upsertOwnerDailyHours(id, req.validated.body, req.user?.id || null);
    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

async function ownersAnalytics(req, res, next) {
  try {
    const payload = await getOwnersAnalytics(req.validated.query);
    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

async function ownerBreakdown(req, res, next) {
  try {
    const { id } = req.validated.params;
    const payload = await getOwnerBreakdown(id, req.validated.query);
    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOwner,
  listOwners,
  updateOwner,
  deleteOwner,
  createCommissionRule,
  upsertDailyHours,
  ownersAnalytics,
  ownerBreakdown
};
