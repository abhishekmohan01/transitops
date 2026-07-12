import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { sendError } from "../utils/errors.js";
import prisma from "../lib/prisma.js";
import {
  createFuelLogSchema,
  updateFuelLogSchema,
} from "../schemas/fuel.schema.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Nested vehicle select — reused across GET endpoints
const fuelInclude = {
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      name: true,
      type: true,
      status: true,
    },
  },
};

// ─────────────────────────────────────────────
// GET /api/fuel
// List all fuel logs — all authenticated roles
// Optional filters: ?vehicleId=, ?dateFrom=, ?dateTo=
// ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { vehicleId, dateFrom, dateTo } = req.query;

    const logs = await prisma.fuelLog.findMany({
      where: {
        ...(vehicleId ? { vehicleId: parseInt(vehicleId as string) } : {}),
        ...(dateFrom || dateTo
          ? {
              date: {
                ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}),
                ...(dateTo ? { lte: new Date(dateTo as string) } : {}),
              },
            }
          : {}),
      },
      include: fuelInclude,
      orderBy: { date: "desc" },
    });

    // Aggregate totals for convenience
    const totalLiters = logs.reduce((sum, l) => sum + l.liters, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);

    res.json({ data: logs, count: logs.length, totalLiters, totalCost });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/fuel/:id
// Single fuel log — all authenticated roles
// ─────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) return sendError(res, 400, "Invalid fuel log id");

    const log = await prisma.fuelLog.findUnique({
      where: { id },
      include: fuelInclude,
    });

    if (!log) return sendError(res, 404, "Fuel log not found");

    res.json(log);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/fuel
// Create a fuel log — FLEET_MANAGER + DRIVER
// ─────────────────────────────────────────────
router.post(
  "/",
  authorize("FLEET_MANAGER", "DRIVER"),
  async (req, res, next) => {
    try {
      const data = createFuelLogSchema.parse(req.body);

      // Verify vehicle exists
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
      });
      if (!vehicle) {
        return sendError(res, 404, `Vehicle with id ${data.vehicleId} not found`);
      }

      const log = await prisma.fuelLog.create({
        data: {
          vehicleId: data.vehicleId,
          liters: data.liters,
          cost: data.cost,
          date: data.date,
        },
        include: fuelInclude,
      });

      res.status(201).json({ message: "Fuel log created successfully", data: log });
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
// PUT /api/fuel/:id
// Full update — FLEET_MANAGER only
// ─────────────────────────────────────────────
router.put(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid fuel log id");

      const data = updateFuelLogSchema.parse(req.body);

      const existing = await prisma.fuelLog.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Fuel log not found");

      // If vehicleId is being changed, verify new vehicle exists
      if (data.vehicleId && data.vehicleId !== existing.vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: data.vehicleId },
        });
        if (!vehicle) {
          return sendError(res, 404, `Vehicle with id ${data.vehicleId} not found`);
        }
      }

      // Strip undefined keys — required due to exactOptionalPropertyTypes in tsconfig
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      const log = await prisma.fuelLog.update({
        where: { id },
        data: updateData,
        include: fuelInclude,
      });

      res.json({ message: "Fuel log updated successfully", data: log });
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
// DELETE /api/fuel/:id
// Delete — FLEET_MANAGER only
// ─────────────────────────────────────────────
router.delete(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid fuel log id");

      const existing = await prisma.fuelLog.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Fuel log not found");

      await prisma.fuelLog.delete({ where: { id } });
      res.json({ message: "Fuel log deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;