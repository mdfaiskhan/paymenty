const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { addBusiness, listBusinesses } = require("../controllers/business.controller");
const { createBusinessSchema, listBusinessSchema } = require("../validators/business.validator");

const router = express.Router();

router.use(auth);
router.get("/", validate(listBusinessSchema), listBusinesses);
router.post("/", validate(createBusinessSchema), addBusiness);

module.exports = router;
