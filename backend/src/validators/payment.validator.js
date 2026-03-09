const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const paymentStatus = z.enum(["pending", "partial", "paid"]);
const businessType = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Invalid business slug");
const paymentMethod = z.enum(["cash", "bank", "upi"]);
const rangeType = z.enum(["today", "week", "month", "custom"]);

const paymentBodySchema = z
  .object({
    employeeId: objectId.optional(),
    ownerId: objectId.optional(),
    businessType,
    periodStart: dateOnly,
    periodEnd: dateOnly,
    paidAmount: z.coerce.number().min(0),
    status: paymentStatus.optional(),
    method: paymentMethod.optional(),
    referenceId: z.string().max(120).optional(),
    notes: z.string().max(400).optional()
  })
  .superRefine((body, ctx) => {
    if (body.businessType === "owners") {
      if (!body.ownerId || body.employeeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Owners payments require ownerId only"
        });
      }
      return;
    }

    if (!body.employeeId || body.ownerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Employee payments require employeeId only"
      });
    }
  });

const createPaymentSchema = z.object({
  body: paymentBodySchema,
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const updatePaymentSchema = z.object({
  body: z.object({
    paidAmount: z.coerce.number().min(0).optional(),
    status: paymentStatus.optional(),
    method: paymentMethod.optional(),
    referenceId: z.string().max(120).optional(),
    notes: z.string().max(400).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const listPaymentsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    businessType: z.union([z.literal("all"), businessType]).optional(),
    rangeType: rangeType.optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    search: z.string().trim().optional()
  }),
  params: z.object({}).passthrough()
});

const paymentByIdSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const summarySchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    businessType: z.union([z.literal("all"), businessType]).optional(),
    rangeType: rangeType.optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional()
  }),
  params: z.object({}).passthrough()
});

const reconciliationSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    businessType,
    month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
  }),
  params: z.object({}).passthrough()
});

module.exports = {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
  paymentByIdSchema,
  summarySchema,
  reconciliationSchema
};
