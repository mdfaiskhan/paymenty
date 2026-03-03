const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createRuleSchema } = require("../validators/rule.validator");
const { createRule } = require("../controllers/rule.controller");

const router = express.Router();

router.use(auth);
router.post("/", validate(createRuleSchema), createRule);

module.exports = router;
