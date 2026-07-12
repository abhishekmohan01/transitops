import { z } from "zod";
import { DriverStatus } from "@prisma/client";

export const createDriverSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  licenseNumber: z.string().min(1, "License number is required"),
  licenseCategory: z.string().min(1, "License category is required"),
  licenseExpiryDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "licenseExpiryDate must be a valid ISO date string",
    })
    .transform((val) => new Date(val)),
  contactNumber: z.string().min(1, "Contact number is required"),
  safetyScore: z
    .number()
    .min(0, "Safety score must be at least 0")
    .max(100, "Safety score cannot exceed 100")
    .default(100),
  status: z.nativeEnum(DriverStatus).optional().default(DriverStatus.AVAILABLE),
  imageUrl: z.string().url().nullish().default(null),
  documentUrl: z.string().url().nullish().default(null),
});

// Used by PUT /drivers/:id — FLEET_MANAGER full update (all fields optional)
export const updateDriverSchema = z.object({
  name: z.string().min(2).optional(),
  licenseNumber: z.string().min(1).optional(),
  licenseCategory: z.string().min(1).optional(),
  licenseExpiryDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "licenseExpiryDate must be a valid ISO date string",
    })
    .transform((val) => new Date(val))
    .optional(),
  contactNumber: z.string().min(1).optional(),
  safetyScore: z.number().min(0).max(100).optional(),
  status: z.nativeEnum(DriverStatus).optional(),
  imageUrl: z.string().url().nullish().default(null),
  documentUrl: z.string().url().nullish().default(null),
});

// Used by PATCH /drivers/:id/status — FLEET_MANAGER + SAFETY_OFFICER
// Restricted to only status and safetyScore — principle of least privilege
export const updateDriverStatusSchema = z.object({
  status: z.nativeEnum(DriverStatus, {
    required_error: "status is required",
    invalid_type_error: "Invalid driver status",
  }),
  safetyScore: z.number().min(0).max(100).optional(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type UpdateDriverStatusInput = z.infer<typeof updateDriverStatusSchema>;
