const Business = require("../models/Business.model");
const ApiError = require("../utils/ApiError");

function toSlug(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
        calcType: payload.calcType || existing.calcType || "tailor_slab_v1",
        isActive: true
      },
      { new: true }
    );
    return restored.toObject ? restored.toObject() : restored;
  }

  const created = await Business.create({
    name: payload.name,
    slug,
    calcType: payload.calcType || "tailor_slab_v1"
  });
  return created.toObject ? created.toObject() : created;
}

module.exports = {
  toSlug,
  ensureDefaultBusinesses,
  listActiveBusinesses,
  getBusinessBySlug,
  createBusiness
};
