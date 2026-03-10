const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  addBusiness,
  listBusinesses,
  editBusiness,
  removeBusiness,
  removeBusinessAction
} = require("../controllers/business.controller");
const {
  createBusinessSchema,
  updateBusinessSchema,
  deleteBusinessSchema,
  deleteBusinessActionSchema,
  listBusinessSchema
} = require("../validators/business.validator");

const router = express.Router();

router.use(auth);
router.get("/", validate(listBusinessSchema), listBusinesses);
router.post("/", validate(createBusinessSchema), addBusiness);
router.post("/delete", validate(deleteBusinessActionSchema), removeBusinessAction);
router.put("/:idOrSlug", validate(updateBusinessSchema), editBusiness);
router.delete("/:idOrSlug", validate(deleteBusinessSchema), removeBusiness);

module.exports = router;
