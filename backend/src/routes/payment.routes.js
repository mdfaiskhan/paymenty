const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
  paymentByIdSchema,
  summarySchema,
  reconciliationSchema
} = require("../validators/payment.validator");
const {
  createPayment,
  listPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  getPaymentSummary,
  reconciliation
} = require("../controllers/payment.controller");

const router = express.Router();

router.use(auth);
router.get("/summary", validate(summarySchema), getPaymentSummary);
router.get("/reconciliation", validate(reconciliationSchema), reconciliation);
router.get("/", validate(listPaymentsSchema), listPayments);
router.post("/", validate(createPaymentSchema), createPayment);
router.get("/:id", validate(paymentByIdSchema), getPaymentById);
router.put("/:id", validate(updatePaymentSchema), updatePayment);
router.delete("/:id", validate(paymentByIdSchema), deletePayment);

module.exports = router;
