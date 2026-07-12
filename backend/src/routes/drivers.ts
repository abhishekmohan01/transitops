import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { sendError } from "../utils/errors.js";
import prisma from "../lib/prisma.js";
import {
  createDriverSchema,
  updateDriverSchema,
  updateDriverStatusSchema,
} from "../schemas/driver.schema.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────
// GET /api/drivers
// List all drivers — all authenticated roles
// Optional query: ?status=AVAILABLE|ON_TRIP|OFF_DUTY|SUSPENDED
// ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;

    const drivers = await prisma.driver.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: drivers, count: drivers.length });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/drivers/:id
// Single driver — all authenticated roles
// ─────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, "Invalid driver id");

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        trips: {
          orderBy: { createdAt: "desc" },
          take: 5, // last 5 trips for context
        },
      },
    });

    if (!driver) return sendError(res, 404, "Driver not found");

    res.json(driver);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/drivers
// Create driver — FLEET_MANAGER only
// ─────────────────────────────────────────────
router.post(
  "/",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const data = createDriverSchema.parse(req.body);

      // License number must be unique — cleaner error than DB constraint message
      const existing = await prisma.driver.findUnique({
        where: { licenseNumber: data.licenseNumber },
      });
      if (existing) {
        return sendError(
          res,
          409,
          `License number "${data.licenseNumber}" is already registered`
        );
      }

      const driver = await prisma.driver.create({ data });
      res.status(201).json({ message: "Driver created successfully", data: driver });
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
// PUT /api/drivers/:id
// Full update — FLEET_MANAGER only
// ─────────────────────────────────────────────
router.put(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return sendError(res, 400, "Invalid driver id");

      const data = updateDriverSchema.parse(req.body);

      const existing = await prisma.driver.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Driver not found");

      // If licenseNumber is being changed, ensure uniqueness
      if (data.licenseNumber && data.licenseNumber !== existing.licenseNumber) {
        const conflict = await prisma.driver.findUnique({
          where: { licenseNumber: data.licenseNumber },
        });
        if (conflict) {
          return sendError(
            res,
            409,
            `License number "${data.licenseNumber}" is already registered`
          );
        }
      }

      const driver = await prisma.driver.update({ where: { id }, data });
      res.json({ message: "Driver updated successfully", data: driver });
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
// PATCH /api/drivers/:id/status
// Status + safetyScore only — FLEET_MANAGER + SAFETY_OFFICER
// ─────────────────────────────────────────────
router.patch(
  "/:id/status",
  authorize("FLEET_MANAGER", "SAFETY_OFFICER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return sendError(res, 400, "Invalid driver id");

      const data = updateDriverStatusSchema.parse(req.body);

      const existing = await prisma.driver.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Driver not found");

      // Guard: ON_TRIP is managed exclusively by trip dispatch — not manually settable
      if (data.status === "ON_TRIP") {
        return sendError(
          res,
          400,
          "Driver status cannot be manually set to ON_TRIP. Use the trip dispatch endpoint."
        );
      }

      const driver = await prisma.driver.update({ where: { id }, data });
      res.json({ message: "Driver status updated successfully", data: driver });
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
// DELETE /api/drivers/:id
// Delete driver — FLEET_MANAGER only
// Guard: cannot delete if driver has a DISPATCHED trip
// ─────────────────────────────────────────────
router.delete(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return sendError(res, 400, "Invalid driver id");

      const existing = await prisma.driver.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Driver not found");

      // Guard: prevent deletion if driver is currently on an active trip
      const activeTrip = await prisma.trip.findFirst({
        where: { driverId: id, status: "DISPATCHED" },
      });
      if (activeTrip) {
        return sendError(
          res,
          409,
          "Cannot delete driver who is currently on an active trip. Complete or cancel the trip first."
        );
      }

      await prisma.driver.delete({ where: { id } });
      res.json({ message: "Driver deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;