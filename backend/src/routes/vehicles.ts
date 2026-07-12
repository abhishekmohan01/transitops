import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { sendError } from "../utils/errors.js";
import prisma from "../lib/prisma.js";
import { z } from "zod";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Zod schemas ────────────────────────────────────────────────
const createVehicleSchema = z.object({
  registrationNumber: z.string().min(1, "Registration number is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  maxLoadCapacity: z.number().positive("Max load capacity must be positive"),
  odometer: z.number().nonnegative("Odometer must be 0 or greater").default(0),
  acquisitionCost: z.number().nonnegative("Acquisition cost must be 0 or greater"),
  imageUrl: z.string().url().nullish().default(null),
  status: z
    .enum(["AVAILABLE", "ON_TRIP", "IN_SHOP", "RETIRED"])
    .optional()
    .default("AVAILABLE"),
});

const updateVehicleSchema = z.object({
  registrationNumber: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  maxLoadCapacity: z.number().positive().optional(),
  odometer: z.number().nonnegative().optional(),
  acquisitionCost: z.number().nonnegative().optional(),
  imageUrl: z.string().url().nullish().default(null),
  status: z.enum(["AVAILABLE", "ON_TRIP", "IN_SHOP", "RETIRED"]).optional(),
});

const updateVehicleStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "IN_SHOP", "RETIRED"], {
    required_error: "status is required",
    invalid_type_error: "Invalid vehicle status. Allowed: AVAILABLE, IN_SHOP, RETIRED",
  }),
});

// ─── Shared include for GET /:id ─────────────────────────────────
const vehicleDetailInclude = {
  trips: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: {
      id: true,
      source: true,
      destination: true,
      status: true,
      createdAt: true,
    },
  },
  maintenanceLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 3,
    select: {
      id: true,
      description: true,
      status: true,
      cost: true,
      createdAt: true,
    },
  },
};

// ─────────────────────────────────────────────
// GET /api/vehicles
// List all vehicles — all authenticated roles
// Optional filters: ?status=, ?type=
// ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type } = req.query;
    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(type ? { type: type as string } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: vehicles, count: vehicles.length });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/vehicles/:id
// Single vehicle + last 5 trips + last 3 maintenance logs — all roles
// ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) return sendError(res, 400, "Invalid vehicle id");
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: vehicleDetailInclude,
    });
    if (!vehicle) return sendError(res, 404, "Vehicle not found");
    res.json(vehicle);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/vehicles
// Create vehicle — FLEET_MANAGER only
// BR-1: registrationNumber must be unique
// ─────────────────────────────────────────────
router.post(
  "/",
  authorize("FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createVehicleSchema.parse(req.body);
      const existing = await prisma.vehicle.findUnique({
        where: { registrationNumber: data.registrationNumber },
      });
      if (existing) {
        return sendError(
          res,
          409,
          `Registration number "${data.registrationNumber}" is already registered`
        );
      }
      const vehicle = await prisma.vehicle.create({ data });
      res.status(201).json({ message: "Vehicle created successfully", data: vehicle });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PUT /api/vehicles/:id
// Full update — FLEET_MANAGER only
// Guard: ON_TRIP cannot be set manually
// ─────────────────────────────────────────────
router.put(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid vehicle id");
      const data = updateVehicleSchema.parse(req.body);
      const existing = await prisma.vehicle.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Vehicle not found");

      // Guard: ON_TRIP is managed exclusively by trip dispatch
      if (data.status === "ON_TRIP") {
        return sendError(
          res,
          400,
          "Vehicle status cannot be manually set to ON_TRIP. Use the trip dispatch endpoint."
        );
      }

      // BR-1: if registrationNumber changes, ensure uniqueness
      if (
        data.registrationNumber &&
        data.registrationNumber !== existing.registrationNumber
      ) {
        const conflict = await prisma.vehicle.findUnique({
          where: { registrationNumber: data.registrationNumber },
        });
        if (conflict) {
          return sendError(
            res,
            409,
            `Registration number "${data.registrationNumber}" is already registered`
          );
        }
      }

      const updateData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );
      const vehicle = await prisma.vehicle.update({ where: { id }, data: updateData });
      res.json({ message: "Vehicle updated successfully", data: vehicle });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PATCH /api/vehicles/:id/status
// Status-only update — FLEET_MANAGER only
// ON_TRIP excluded at schema level — only set via trip dispatch
// ─────────────────────────────────────────────
router.patch(
  "/:id/status",
  authorize("FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid vehicle id");
      const { status } = updateVehicleStatusSchema.parse(req.body);
      const existing = await prisma.vehicle.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Vehicle not found");
      const vehicle = await prisma.vehicle.update({ where: { id }, data: { status } });
      res.json({ message: "Vehicle status updated successfully", data: vehicle });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// DELETE /api/vehicles/:id
// Delete — FLEET_MANAGER only
// Guard 1: no trip history (prevents FK constraint crash)
// Guard 2: no active maintenance record
// ─────────────────────────────────────────────
router.delete(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid vehicle id");
      const existing = await prisma.vehicle.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Vehicle not found");

      const tripCount = await prisma.trip.count({ where: { vehicleId: id } });
      if (tripCount > 0) {
        return sendError(res, 409, "Cannot delete vehicle with existing trip history.");
      }

      const activeMaintenance = await prisma.maintenanceLog.findFirst({
        where: { vehicleId: id, status: "ACTIVE" },
      });
      if (activeMaintenance) {
        return sendError(
          res,
          409,
          "Cannot delete vehicle with an active maintenance record. Close it first."
        );
      }

      await prisma.vehicle.delete({ where: { id } });
      res.json({ message: "Vehicle deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
