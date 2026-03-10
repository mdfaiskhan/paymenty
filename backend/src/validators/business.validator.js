const { z } = require("zod");

const businessIdentifier = z
  .string()
  .trim()
  .regex(/^(?:[a-f\d]{24}|[a-z0-9]+(?:-[a-z0-9]+)*)$/i, "Invalid business identifier");

const optionalSlug = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  },
  z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Slug must contain letters/numbers and optional hyphens")
    .max(80)
    .optional()
);

const createBusinessSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    slug: optionalSlug,
    calcType: z.enum(["tailor_slab_v1", "butcher_cuts_v1"]).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const updateBusinessSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    calcType: z.enum(["tailor_slab_v1", "butcher_cuts_v1"]).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ idOrSlug: businessIdentifier })
});

const deleteBusinessSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ idOrSlug: businessIdentifier })
});

const listBusinessSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = {
  createBusinessSchema,
  updateBusinessSchema,
  deleteBusinessSchema,
  listBusinessSchema
};
