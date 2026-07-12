import type { Driver, Vehicle } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

interface ValidationInput {
  vehicleId: number;
  driverId: number;
  cargoWeight: number;
}

interface ValidationResult {
  vehicle: Vehicle;
  driver: Driver;
}

/**
 * Core business-rule enforcement for trip assignment.
 * Enforces PRD Section 6 rules: BR-2, BR-3, BR-4, BR-5.
 *
 * Throws AppError with a human-readable message on any violation.
 * Returns fetched vehicle + driver on success — callers do NOT need to re-query.
 */
export async function validateTripCreation(
  input: ValidationInput
): Promise<ValidationResult> {
  const { vehicleId, driverId, cargoWeight } = input;

  // Fetch vehicle and driver in parallel
  const [vehicle, driver] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    prisma.driver.findUnique({ where: { id: driverId } }),
  ]);

  // --- Existence checks ---
  if (!vehicle) {
    throw new AppError(`Vehicle with id ${vehicleId} not found`, 404);
  }
  if (!driver) {
    throw new AppError(`Driver with id ${driverId} not found`, 404);
  }

  // --- BR-2: Vehicle must not be RETIRED or IN_SHOP ---
  if (vehicle.status === "RETIRED") {
    throw new AppError(
      "Vehicle is retired and cannot be dispatched",
      400
    );
  }
  if (vehicle.status === "IN_SHOP") {
    throw new AppError(
      "Vehicle is currently in maintenance and cannot be dispatched",
      400
    );
  }

  // --- BR-4 (Vehicle): Vehicle must not already be ON_TRIP ---
  if (vehicle.status === "ON_TRIP") {
    throw new AppError(
      "Vehicle is already on an active trip and cannot be assigned",
      409
    );
  }

  // --- BR-3: Driver must not be SUSPENDED ---
  if (driver.status === "SUSPENDED") {
    throw new AppError(
      "Driver is suspended and cannot be assigned to a trip",
      400
    );
  }

  // --- BR-3: Driver license must not be expired ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(driver.licenseExpiryDate);
  expiryDate.setHours(0, 0, 0, 0);

  if (expiryDate < today) {
    throw new AppError(
      `Driver's license expired on ${driver.licenseExpiryDate.toISOString().split("T")[0]}. Assign a driver with a valid license.`,
      400
    );
  }

  // --- BR-4 (Driver): Driver must not already be ON_TRIP ---
  if (driver.status === "ON_TRIP") {
    throw new AppError(
      "Driver is already on an active trip and cannot be assigned",
      409
    );
  }

  // --- BR-5: Cargo weight must not exceed vehicle max load capacity ---
  if (cargoWeight > vehicle.maxLoadCapacity) {
    throw new AppError(
      `Cargo weight (${cargoWeight}kg) exceeds vehicle max load capacity (${vehicle.maxLoadCapacity}kg)`,
      400
    );
  }

  return { vehicle, driver };
}