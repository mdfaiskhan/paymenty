const Business = require("../models/Business.model");
const Owner = require("../models/Owner.model");
const OwnerCommissionRule = require("../models/OwnerCommissionRule.model");
const ApiError = require("../utils/ApiError");

function toSlug(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function utcStartOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function syncOwnerForBusiness(business, ownerPayload = {}) {
  const ownerName = String(ownerPayload.ownerName ?? business.ownerName ?? "").trim();
  const ownerPhone = String(ownerPayload.ownerPhone ?? business.ownerPhone ?? "").trim();
  const ownerCommissionPerHour = Number(
    ownerPayload.ownerCommissionPerHour ?? business.ownerCommissionPerHour ?? 0
  );
  const ownerWorkerCount = Number(ownerPayload.ownerWorkerCount ?? business.ownerWorkerCount ?? 0);

  if (!ownerName || !ownerPhone) {
    return null;
  }

  const existingOwner = await Owner.findOne({ businessType: business.slug, isActive: true }).sort({ createdAt: -1 });
  const owner =
    existingOwner ||
    new Owner({
      businessType: business.slug
    });

  owner.name = ownerName;
  owner.phone = ownerPhone;
  owner.workerCount = ownerWorkerCount;
  owner.businessType = business.slug;
  owner.isActive = true;
  owner.deletedAt = null;
  await owner.save();

  const today = utcStartOfDay(new Date());
  const activeRule = await OwnerCommissionRule.findOne({ ownerId: owner._id, effectiveTo: null })
    .sort({ effectiveFrom: -1 });

  if (!activeRule) {
    await OwnerCommissionRule.create({
      ownerId: owner._id,
      commissionPerHour: ownerCommissionPerHour,
      effectiveFrom: today,
      effectiveTo: null
    });
  } else if (Number(activeRule.commissionPerHour) !== ownerCommissionPerHour) {
    await OwnerCommissionRule.updateOne(
      { _id: activeRule._id },
      { effectiveTo: new Date(today.getTime() - 1) }
    );
    await OwnerCommissionRule.create({
      ownerId: owner._id,
      commissionPerHour: ownerCommissionPerHour,
      effectiveFrom: today,
      effectiveTo: null
    });
  }

  return owner;
}

async function ensureDefaultBusinesses() {
  const defaults = [
    { name: "Tailor", slug: "tailor", calcType: "tailor_slab_v1" },
    { name: "Butcher", slug: "butcher", calcType: "butcher_cuts_v1" }
  ];

  await Promise.all(
    defaults.map((row) =>
      Business.findOneAndUpdate(
        { slug: row.slug },
        { $setOnInsert: row },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );
}

async function listActiveBusinesses() {
  return Business.find({ isActive: true }).sort({ createdAt: 1 }).lean();
}

async function getBusinessBySlug(slug) {
  const normalized = toSlug(slug);
  if (!normalized) {
    throw new ApiError(400, "Invalid business slug");
  }
  const business = await Business.findOne({ slug: normalized, isActive: true }).lean();
  if (!business) {
    throw new ApiError(404, "Business not found");
  }
  return business;
}

async function createBusiness(payload) {
  const explicitSlug = String(payload.slug || "").trim();
  const baseSlug = toSlug(explicitSlug || payload.name);
  if (!baseSlug) {
    throw new ApiError(400, "Could not derive a valid business slug");
  }

  let slug = baseSlug;
  let existing = await Business.findOne({ slug }).lean();

  if (existing && existing.isActive) {
    if (explicitSlug) {
      throw new ApiError(409, "Business already exists");
    }

    // Auto-resolve conflicts when slug is derived from name.
    let counter = 2;
    while (existing && existing.isActive) {
      const suffix = `-${counter}`;
      slug = `${baseSlug}`.slice(0, Math.max(1, 80 - suffix.length)) + suffix;
      existing = await Business.findOne({ slug }).lean();
      counter += 1;
      if (counter > 9999) {
        throw new ApiError(500, "Could not generate unique business slug");
      }
    }
  }

  if (existing && !existing.isActive) {
    const restored = await Business.findByIdAndUpdate(
      existing._id,
      {
        name: payload.name,
        slug,
        ownerName: payload.ownerName,
        ownerPhone: payload.ownerPhone,
        ownerCommissionPerHour: Number(payload.ownerCommissionPerHour) || 0,
        ownerWorkerCount: Number(payload.ownerWorkerCount) || 0,
        calcType: payload.calcType || existing.calcType || "tailor_slab_v1",
        isActive: true
      },
      { new: true }
    );
    await syncOwnerForBusiness(restored, payload);
    return restored.toObject ? restored.toObject() : restored;
  }

  const created = await Business.create({
    name: payload.name,
    slug,
    ownerName: payload.ownerName,
    ownerPhone: payload.ownerPhone,
    ownerCommissionPerHour: Number(payload.ownerCommissionPerHour) || 0,
    ownerWorkerCount: Number(payload.ownerWorkerCount) || 0,
    calcType: payload.calcType || "tailor_slab_v1"
  });
  await syncOwnerForBusiness(created, payload);
  return created.toObject ? created.toObject() : created;
}

function businessFilterByIdentifier(idOrSlug) {
  const raw = String(idOrSlug || "").trim();
  if (!raw) {
    throw new ApiError(400, "Invalid business identifier");
  }

  if (/^[a-f\d]{24}$/i.test(raw)) {
    return { _id: raw, isActive: true };
  }

  const slug = toSlug(raw);
  if (!slug) {
    throw new ApiError(400, "Invalid business identifier");
  }
  return { slug, isActive: true };
}

async function updateBusiness(idOrSlug, payload) {
  const updates = {};
  if (typeof payload.name === "string" && payload.name.trim()) {
    updates.name = payload.name.trim();
  }
  if (typeof payload.ownerName === "string") {
    updates.ownerName = payload.ownerName.trim();
  }
  if (typeof payload.ownerPhone === "string") {
    updates.ownerPhone = payload.ownerPhone.trim();
  }
  if (typeof payload.ownerCommissionPerHour !== "undefined") {
    updates.ownerCommissionPerHour = Number(payload.ownerCommissionPerHour) || 0;
  }
  if (typeof payload.ownerWorkerCount !== "undefined") {
    updates.ownerWorkerCount = Number(payload.ownerWorkerCount) || 0;
  }
  if (payload.calcType) {
    updates.calcType = payload.calcType;
  }

  if (!Object.keys(updates).length) {
    throw new ApiError(400, "No fields to update");
  }

  const row = await Business.findOneAndUpdate(businessFilterByIdentifier(idOrSlug), updates, { new: true }).lean();
  if (!row) {
    throw new ApiError(404, "Business not found");
  }
  await syncOwnerForBusiness(row, updates);
  return row;
}

async function deleteBusiness(idOrSlug) {
  const baseFilter = businessFilterByIdentifier(idOrSlug);
  const row = await Business.findOne(baseFilter).lean();
  if (!row) {
    // Idempotent delete behavior: treat missing record as already deleted.
    return { message: "Business already deleted" };
  }

  if (!row.isActive) {
    return { message: "Business already deleted" };
  }

  await Business.updateOne({ _id: row._id }, { isActive: false });
  await Owner.updateMany(
    { businessType: row.slug, isActive: true },
    { isActive: false, deletedAt: new Date() }
  );
  return { message: "Business deleted" };
}

module.exports = {
  toSlug,
  ensureDefaultBusinesses,
  listActiveBusinesses,
  getBusinessBySlug,
  createBusiness,
  updateBusiness,
  deleteBusiness
};
