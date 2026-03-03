const { z } = require("zod");

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const signupSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

module.exports = {
  loginSchema,
  signupSchema
};
