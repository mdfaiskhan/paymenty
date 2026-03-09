const { z } = require("zod");

const analyticsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
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
