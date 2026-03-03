const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const createPaymentSchema = z.object({
  body: z.object({
    employeeId: objectId,
    businessType: z.enum(["tailor", "butcher"]),
    periodStart: dateOnly,
    periodEnd: dateOnly,
    computedAmount: z.coerce.number().min(0).optional(),
    paidAmount: z.coerce.number().min(0),
    status: z.enum(["pending", "partial", "paid", "reversed"]),
    method: z.enum(["cash", "bank", "upi", "other"]).optional(),
    reference: z.string().max(120).optional(),
    note: z.string().max(400).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const reconciliationSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    businessType: z.enum(["tailor", "butcher"]),
    month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
  }),
  params: z.object({}).passthrough()
});

module.exports = {
  createPaymentSchema,
  reconciliationSchema
};
