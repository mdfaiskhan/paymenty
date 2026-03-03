const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { analyticsSchema } = require("../validators/analytics.validator");
const { getAnalytics } = require("../controllers/analytics.controller");

const router = express.Router();

router.use(auth);
router.get("/:businessType", validate(analyticsSchema), getAnalytics);

module.exports = router;
