const { z } = require("zod");

const analyticsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z
    .object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional()
    })
    .superRefine((query, ctx) => {
      const hasStart = Boolean(query.startDate);
      const hasEnd = Boolean(query.endDate);
      if (hasStart !== hasEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Both startDate and endDate are required for range"
        });
      }
      if (hasStart && hasEnd && query.startDate > query.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "startDate cannot be after endDate"
        });
      }
    }),
  params: z.object({
    businessType: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Invalid business slug")
  })
});

module.exports = {
  analyticsSchema
};
