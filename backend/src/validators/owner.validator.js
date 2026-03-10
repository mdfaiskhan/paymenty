const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const businessSlug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Invalid business slug");

const createOwnerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(25),
    businessType: businessSlug,
    workerCount: z.coerce.number().int().min(0),
    commissionPerHour: z.coerce.number().min(0),
    effectiveFrom: dateOnly.optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const updateOwnerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(5).max(25).optional(),
    businessType: businessSlug.optional(),
    workerCount: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const deleteOwnerSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const createCommissionRuleSchema = z.object({
  body: z.object({
    commissionPerHour: z.coerce.number().min(0),
    effectiveFrom: dateOnly
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const hoursSchema = z
  .coerce
  .number()
  .gt(0)
  .refine(
    (v) => Math.abs(v * 60 - Math.round(v * 60)) < 1e-2,
    "Hours must support minute precision (e.g. 1h 23m)"
  );

const upsertOwnerDailyHoursSchema = z.object({
  body: z.object({
    workDate: dateOnly,
    hours: hoursSchema,
    note: z.string().trim().max(300).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const listOwnersSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    businessType: businessSlug.optional(),
    search: z.string().trim().optional()
  }),
  params: z.object({}).passthrough()
});

const ownersAnalyticsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    ownerId: objectId.optional(),
    range: z.enum(["today", "week", "month"]).optional()
  }),
  params: z.object({}).passthrough()
});

const ownerBreakdownSchema = z.object({
  body: z.object({}).passthrough(),
  query: z
    .object({
      rangeType: z.enum(["all"]).optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM").optional(),
      startDate: dateOnly.optional(),
      endDate: dateOnly.optional()
    })
    .superRefine((query, ctx) => {
      const isAllTime = query.rangeType === "all";
      const hasMonth = Boolean(query.month);
      const hasRange = Boolean(query.startDate || query.endDate);

      if (!isAllTime && !hasMonth && !hasRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide rangeType=all, month, or startDate/endDate"
        });
      }

      if ((isAllTime && hasMonth) || (isAllTime && hasRange) || (hasMonth && hasRange)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use only one filter: rangeType=all, month, or startDate/endDate"
        });
      }

      if (!hasMonth && (Boolean(query.startDate) !== Boolean(query.endDate))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Both startDate and endDate are required for range queries"
        });
      }
    }),
  params: z.object({ id: objectId })
});

module.exports = {
  createOwnerSchema,
  updateOwnerSchema,
  deleteOwnerSchema,
  createCommissionRuleSchema,
  upsertOwnerDailyHoursSchema,
  listOwnersSchema,
  ownersAnalyticsSchema,
  ownerBreakdownSchema
};
