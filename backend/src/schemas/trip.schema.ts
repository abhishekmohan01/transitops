import { z } from "zod";

export const createTripSchema = z.object({
  source: z.string().min(1, "Source is required"),
  destination: z.string().min(1, "Destination is required"),
  vehicleId: z
    .number({ required_error: "vehicleId is required", invalid_type_error: "vehicleId must be a number" })
    .int()
    .positive("vehicleId must be a positive integer"),
  driverId: z
    .number({ required_error: "driverId is required", invalid_type_error: "driverId must be a number" })
    .int()
    .positive("driverId must be a positive integer"),
  cargoWeight: z
    .number({ required_error: "cargoWeight is required" })
    .positive("Cargo weight must be greater than 0"),
  plannedDistance: z
    .number({ required_error: "plannedDistance is required" })
    .positive("Planned distance must be greater than 0"),
});

// Used by PATCH /trips/:id/complete
export const completeTripSchema = z.object({
  finalOdometer: z
    .number({ required_error: "finalOdometer is required" })
    .nonnegative("Final odometer must be 0 or greater"),
  fuelConsumed: z
    .number({ required_error: "fuelConsumed is required" })
    .positive("Fuel consumed must be greater than 0"),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type CompleteTripInput = z.infer<typeof completeTripSchema>;
