const { z } = require("zod");

const businessType = z.enum(["tailor", "butcher"]);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

const createEmployeeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(25),
    email: z.string().trim().email().max(160),
    placeId: z.string().trim().min(1).max(80),
    location: z.string().trim().min(1).max(120),
    businessType
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough()
});

const updateEmployeeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(5).max(25).optional(),
    email: z.string().trim().email().max(160).optional(),
    placeId: z.string().trim().min(1).max(80).optional(),
    location: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

const listEmployeesSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    businessType: businessType.optional(),
    search: z.string().trim().optional()
  }),
  params: z.object({}).passthrough()
});

const deleteEmployeeSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: objectId })
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesSchema,
  deleteEmployeeSchema
};
