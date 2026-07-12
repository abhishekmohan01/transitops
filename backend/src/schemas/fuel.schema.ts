import { z } from "zod";

// ─────────────────────────────────────────────
// POST /api/fuel
// ─────────────────────────────────────────────
export const createFuelLogSchema = z.object({
  vehicleId: z
    .number({
      required_error: "vehicleId is required",
      invalid_type_error: "vehicleId must be a number",
    })
    .int()
    .positive("vehicleId must be a positive integer"),
  liters: z
    .number({ required_error: "liters is required" })
    .positive("Liters must be greater than 0"),
  cost: z
    .number({ required_error: "cost is required" })
    .positive("Cost must be greater than 0"),
  date: z.coerce.date({ required_error: "date is required" }),
});

// ─────────────────────────────────────────────
// PUT /api/fuel/:id
// ─────────────────────────────────────────────
export const updateFuelLogSchema = z
  .object({
    vehicleId: z.number().int().positive().optional(),
    liters: z.number().positive("Liters must be greater than 0").optional(),
    cost: z.number().positive("Cost must be greater than 0").optional(),
    date: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;
export type UpdateFuelLogInput = z.infer<typeof updateFuelLogSchema>;
