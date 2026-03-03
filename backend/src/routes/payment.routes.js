const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createPaymentSchema, reconciliationSchema } = require("../validators/payment.validator");
const { createPayment, reconciliation } = require("../controllers/payment.controller");

const router = express.Router();

router.use(auth);
router.post("/", validate(createPaymentSchema), createPayment);
router.get("/reconciliation", validate(reconciliationSchema), reconciliation);

module.exports = router;
