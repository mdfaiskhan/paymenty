const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const createRuleSchema = z.object({
  body: z.object({
    businessType: z.enum(["tailor", "butcher"]),
    scope: z.enum(["business", "employee"]),
    employeeId: objectId.optional(),
    effectiveFrom: dateOnly,
    effectiveTo: dateOnly.optional(),
    calcType: z.enum(["tailor_slab_v1", "butcher_cuts_v1"]),
    config: z.record(z.any())
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = {
  createRuleSchema
};
