import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { sendError } from "../utils/errors.js";
import prisma from "../lib/prisma.js";
import { createTripSchema, completeTripSchema } from "../schemas/trip.schema.js";
import { validateTripCreation } from "../services/tripValidation.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Nested vehicle + driver select — reused across GET endpoints
const tripInclude = {
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      name: true,
      type: true,
      maxLoadCapacity: true,
      status: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      licenseNumber: true,
      licenseCategory: true,
      licenseExpiryDate: true,
      status: true,
      safetyScore: true,
    },
  },
};

// ─────────────────────────────────────────────
// GET /api/trips
// List all trips — all authenticated roles
// Optional filters: ?status=, ?vehicleId=, ?driverId=
// ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { status, vehicleId, driverId } = req.query;

    const trips = await prisma.trip.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(vehicleId ? { vehicleId: parseInt(vehicleId as string) } : {}),
        ...(driverId ? { driverId: parseInt(driverId as string) } : {}),
      },
      include: tripInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: trips, count: trips.length });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/trips/:id
// Single trip with nested vehicle + driver — all authenticated roles
// ─────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, "Invalid trip id");

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: tripInclude,
    });

    if (!trip) return sendError(res, 404, "Trip not found");

    res.json(trip);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/trips
// Create trip as DRAFT — FLEET_MANAGER + DRIVER
// No validation here — validation runs at dispatch time
// ─────────────────────────────────────────────
router.post(
  "/",
  authorize("FLEET_MANAGER", "DRIVER"),
  async (req, res, next) => {
    try {
      const data = createTripSchema.parse(req.body);

      // Verify vehicle and driver exist
      const [vehicle, driver] = await Promise.all([
        prisma.vehicle.findUnique({ where: { id: data.vehicleId } }),
        prisma.driver.findUnique({ where: { id: data.driverId } }),
      ]);
      if (!vehicle) return sendError(res, 404, `Vehicle with id ${data.vehicleId} not found`);
      if (!driver) return sendError(res, 404, `Driver with id ${data.driverId} not found`);

      const trip = await prisma.trip.create({
        data: {
          source: data.source,
          destination: data.destination,
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          cargoWeight: data.cargoWeight,
          plannedDistance: data.plannedDistance,
          status: "DRAFT",
        },
        include: tripInclude,
      });

      res.status(201).json({ message: "Trip created successfully", data: trip });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PATCH /api/trips/:id/dispatch
// Run all business-rule validation, then atomically:
//   trip → DISPATCHED, vehicle → ON_TRIP, driver → ON_TRIP
// Allowed roles: FLEET_MANAGER + DRIVER
// ─────────────────────────────────────────────
router.patch(
  "/:id/dispatch",
  authorize("FLEET_MANAGER", "DRIVER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return sendError(res, 400, "Invalid trip id");

      const trip = await prisma.trip.findUnique({ where: { id } });
      if (!trip) return sendError(res, 404, "Trip not found");

      // State guard: can only dispatch from DRAFT
      if (trip.status !== "DRAFT") {
        return sendError(
          res,
          409,
          `Trip cannot be dispatched from "${trip.status}" state. Only DRAFT trips can be dispatched.`
        );
      }

      // Run all 5 business rule checks (BR-2, BR-3, BR-4, BR-5)
      await validateTripCreation({
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        cargoWeight: trip.cargoWeight,
      });

      // Atomic transaction: flip trip + vehicle + driver simultaneously
      const [updatedTrip] = await prisma.$transaction([
        prisma.trip.update({
          where: { id },
          data: { status: "DISPATCHED" },
          include: tripInclude,
        }),
        prisma.vehicle.update({
          where: { id: trip.vehicleId },
          data: { status: "ON_TRIP" },
        }),
        prisma.driver.update({
          where: { id: trip.driverId },
          data: { status: "ON_TRIP" },
        }),
      ]);

      res.json({ message: "Trip dispatched successfully", data: updatedTrip });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PATCH /api/trips/:id/complete
// Capture finalOdometer + fuelConsumed, then atomically:
//   trip → COMPLETED, vehicle → AVAILABLE (odometer updated), driver → AVAILABLE
// Allowed roles: FLEET_MANAGER + DRIVER
// ─────────────────────────────────────────────
router.patch(
  "/:id/complete",
  authorize("FLEET_MANAGER", "DRIVER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return sendError(res, 400, "Invalid trip id");

      const { finalOdometer, fuelConsumed } = completeTripSchema.parse(req.body);

      const trip = await prisma.trip.findUnique({ where: { id } });
      if (!trip) return sendError(res, 404, "Trip not found");

      // State guard: can only complete from DISPATCHED
      if (trip.status !== "DISPATCHED") {
        return sendError(
          res,
          409,
          `Trip cannot be completed from "${trip.status}" state. Only DISPATCHED trips can be completed.`
        );
      }

      // Atomic transaction: update trip + vehicle odometer + driver status
      const [updatedTrip] = await prisma.$transaction([
        prisma.trip.update({
          where: { id },
          data: { status: "COMPLETED", finalOdometer, fuelConsumed },
          include: tripInclude,
        }),
        prisma.vehicle.update({
          where: { id: trip.vehicleId },
          data: { status: "AVAILABLE", odometer: finalOdometer },
        }),
        prisma.driver.update({
          where: { id: trip.driverId },
          data: { status: "AVAILABLE" },
        }),
      ]);

      res.json({ message: "Trip completed successfully", data: updatedTrip });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PATCH /api/trips/:id/cancel
// Cancel a dispatched trip — FLEET_MANAGER only
// Atomically: trip → CANCELLED, vehicle → AVAILABLE, driver → AVAILABLE
// ─────────────────────────────────────────────
router.patch(
  "/:id/cancel",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return sendError(res, 400, "Invalid trip id");

      const trip = await prisma.trip.findUnique({ where: { id } });
      if (!trip) return sendError(res, 404, "Trip not found");

      // State guard: can only cancel from DISPATCHED
      if (trip.status !== "DISPATCHED") {
        return sendError(
          res,
          409,
          `Trip cannot be cancelled from "${trip.status}" state. Only DISPATCHED trips can be cancelled.`
        );
      }

      // Atomic transaction: revert all statuses
      const [updatedTrip] = await prisma.$transaction([
        prisma.trip.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: tripInclude,
        }),
        prisma.vehicle.update({
          where: { id: trip.vehicleId },
          data: { status: "AVAILABLE" },
        }),
        prisma.driver.update({
          where: { id: trip.driverId },
          data: { status: "AVAILABLE" },
        }),
      ]);

      res.json({ message: "Trip cancelled successfully", data: updatedTrip });
    } catch (error) {
      next(error);
    }
  }
);

export default router;