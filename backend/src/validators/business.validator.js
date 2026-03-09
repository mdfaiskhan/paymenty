const { z } = require("zod");

const createBusinessSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Slug must contain letters/numbers and optional hyphens")
      .max(80)
      .optional(),
    calcType: z.enum(["tailor_slab_v1", "butcher_cuts_v1"]).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const listBusinessSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = {
  createBusinessSchema,
  listBusinessSchema
};
