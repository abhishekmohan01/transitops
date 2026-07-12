import { z } from "zod";

// ─────────────────────────────────────────────
// POST /api/maintenance
// ─────────────────────────────────────────────
export const createMaintenanceSchema = z.object({
  vehicleId: z
    .number({
      required_error: "vehicleId is required",
      invalid_type_error: "vehicleId must be a number",
    })
    .int()
    .positive("vehicleId must be a positive integer"),
  description: z.string().min(1, "Description is required").max(500),
  cost: z
    .number({ required_error: "cost is required" })
    .nonnegative("Cost must be 0 or greater"),
});

// ─────────────────────────────────────────────
// PUT /api/maintenance/:id
// Only editable fields on an ACTIVE record
// ─────────────────────────────────────────────
export const updateMaintenanceSchema = z
  .object({
    description: z.string().min(1).max(500).optional(),
    cost: z.number().nonnegative("Cost must be 0 or greater").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (description, cost) must be provided",
  });

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
