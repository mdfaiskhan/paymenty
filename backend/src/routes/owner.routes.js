const express = require("express");
const auth = require("../middlewares/auth.middleware");
const ownerAccess = require("../middlewares/ownerAccess.middleware");
const validate = require("../middlewares/validate.middleware");
const controller = require("../controllers/owner.controller");
const validator = require("../validators/owner.validator");

const router = express.Router();

router.use(auth);
router.use(ownerAccess);

router.post("/", validate(validator.createOwnerSchema), controller.createOwner);
router.get("/", validate(validator.listOwnersSchema), controller.listOwners);
router.get("/analytics", validate(validator.ownersAnalyticsSchema), controller.ownersAnalytics);
router.get("/:id/breakdown", validate(validator.ownerBreakdownSchema), controller.ownerBreakdown);
router.post("/:id/commission-rules", validate(validator.createCommissionRuleSchema), controller.createCommissionRule);
router.post("/:id/daily-hours", validate(validator.upsertOwnerDailyHoursSchema), controller.upsertDailyHours);
router.put("/:id", validate(validator.updateOwnerSchema), controller.updateOwner);
router.delete("/:id", validate(validator.deleteOwnerSchema), controller.deleteOwner);

module.exports = router;
