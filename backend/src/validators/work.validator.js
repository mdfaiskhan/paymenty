const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const hoursSchema = z
  .number()
  .gt(0)
  .lte(24)
  .refine(
    // Frontend sends decimal hours rounded to 6 dp (e.g. 1h 32m => 1.533333),
    // so allow small floating-point drift when converting back to minutes.
    (v) => Math.abs(v * 60 - Math.round(v * 60)) < 1e-2,
    "Hours must support minute precision (e.g. 1h 23m)"
  );

const createWorkSchema = z.object({
  body: z.object({
    employeeId: objectId,
    workDate: dateOnly,
    hours: hoursSchema,
    videoId: z.string().trim().max(120).optional(),
    note: z.string().trim().max(300).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const updateWorkSchema = z.object({
  body: z.object({
    workDate: dateOnly.optional(),
    hours: hoursSchema.optional(),
    videoId: z.string().trim().max(120).optional(),
    note: z.string().trim().max(300).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const deleteWorkSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const listWorkSchema = z.object({
  body: z.object({}).passthrough(),
  query: z
    .object({
      employeeId: objectId,
      month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM").optional(),
      startDate: dateOnly.optional(),
      endDate: dateOnly.optional()
    })
    .superRefine((query, ctx) => {
      const hasMonth = Boolean(query.month);
      const hasRange = Boolean(query.startDate || query.endDate);

      if (!hasMonth && !hasRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide month or startDate/endDate"
        });
      }

      if (hasMonth && hasRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use either month or startDate/endDate, not both"
        });
      }

      if (!hasMonth && (Boolean(query.startDate) !== Boolean(query.endDate))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Both startDate and endDate are required for range queries"
        });
      }
    }),
  params: z.object({}).passthrough()
});

module.exports = {
  createWorkSchema,
  updateWorkSchema,
  deleteWorkSchema,
  listWorkSchema
};
