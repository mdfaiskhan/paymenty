const { z } = require("zod");

const analyticsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    businessType: z.enum(["tailor", "butcher"])
  })
});

module.exports = {
  analyticsSchema
};
