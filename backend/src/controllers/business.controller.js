const {
  createBusiness,
  listActiveBusinesses,
  updateBusiness,
  deleteBusiness
} = require("../services/business.service");

async function listBusinesses(req, res, next) {
  try {
    const rows = await listActiveBusinesses();
    return res.status(200).json(rows);
  } catch (error) {
    return next(error);
  }
}

async function addBusiness(req, res, next) {
  try {
    const row = await createBusiness(req.validated.body);
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function editBusiness(req, res, next) {
  try {
    const { idOrSlug } = req.validated.params;
    const row = await updateBusiness(idOrSlug, req.validated.body);
    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

async function removeBusiness(req, res, next) {
  try {
    const { idOrSlug } = req.validated.params;
    const row = await deleteBusiness(idOrSlug);
    return res.status(200).json(row);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listBusinesses,
  addBusiness,
  editBusiness,
  removeBusiness
};
