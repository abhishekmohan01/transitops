import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { sendError } from "../utils/errors.js";
import prisma from "../lib/prisma.js";
import {
  createMaintenanceSchema,
  updateMaintenanceSchema,
} from "../schemas/maintenance.schema.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Nested vehicle select — reused across GET endpoints
const maintenanceInclude = {
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
// GET /api/maintenance
// List all maintenance logs — all authenticated roles
// Optional filters: ?vehicleId=, ?status=ACTIVE|CLOSED
// ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { vehicleId, status } = req.query;

    const logs = await prisma.maintenanceLog.findMany({
      where: {
        ...(vehicleId ? { vehicleId: parseInt(vehicleId as string) } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: maintenanceInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: logs, count: logs.length });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/maintenance/:id
// Single maintenance log — all authenticated roles
// ─────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params["id"]!);
    if (isNaN(id)) return sendError(res, 400, "Invalid maintenance log id");

    const log = await prisma.maintenanceLog.findUnique({
      where: { id },
      include: maintenanceInclude,
    });

    if (!log) return sendError(res, 404, "Maintenance log not found");

    res.json(log);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/maintenance
// Create a maintenance log + atomically set vehicle → IN_SHOP (BR-9)
// Allowed: FLEET_MANAGER only
// Guards:
//   - Vehicle must exist
//   - Vehicle must not be RETIRED (cannot put a retired vehicle in shop)
//   - Vehicle must not already have an ACTIVE maintenance record
// ─────────────────────────────────────────────
router.post(
  "/",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const data = createMaintenanceSchema.parse(req.body);

      // Fetch vehicle
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
      });
      if (!vehicle) {
        return sendError(res, 404, `Vehicle with id ${data.vehicleId} not found`);
      }

      // Guard: cannot open maintenance on a RETIRED vehicle
      if (vehicle.status === "RETIRED") {
        return sendError(
          res,
          400,
          "Cannot open a maintenance record for a retired vehicle"
        );
      }

      // Guard: no duplicate active maintenance records
      const existingActive = await prisma.maintenanceLog.findFirst({
        where: { vehicleId: data.vehicleId, status: "ACTIVE" },
      });
      if (existingActive) {
        return sendError(
          res,
          409,
          `Vehicle already has an active maintenance record (id: ${existingActive.id}). Close it before opening a new one.`
        );
      }

      // BR-9: Atomic — create log + set vehicle IN_SHOP
      const [log] = await prisma.$transaction([
        prisma.maintenanceLog.create({
          data: {
            vehicleId: data.vehicleId,
            description: data.description,
            cost: data.cost,
            status: "ACTIVE",
          },
          include: maintenanceInclude,
        }),
        prisma.vehicle.update({
          where: { id: data.vehicleId },
          data: { status: "IN_SHOP" },
        }),
      ]);

      res.status(201).json({
        message: "Maintenance record created. Vehicle is now IN_SHOP.",
        data: log,
      });
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
// PATCH /api/maintenance/:id/close
// Close an ACTIVE maintenance log + atomically set vehicle → AVAILABLE (BR-10)
// Allowed: FLEET_MANAGER only
// Guards:
//   - Log must exist
//   - Log must be ACTIVE (cannot close already-closed)
//   - If vehicle is RETIRED: close the log but do NOT change vehicle status
// ─────────────────────────────────────────────
router.patch(
  "/:id/close",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid maintenance log id");

      const log = await prisma.maintenanceLog.findUnique({
        where: { id },
        include: { vehicle: true },
      });

      if (!log) return sendError(res, 404, "Maintenance log not found");

      if (log.status === "CLOSED") {
        return sendError(res, 409, "Maintenance log is already closed");
      }

      const closedAt = new Date();

      if (log.vehicle.status === "RETIRED") {
        // BR-10 guard: close the log but keep vehicle as RETIRED
        const closedLog = await prisma.maintenanceLog.update({
          where: { id },
          data: { status: "CLOSED", closedAt },
          include: maintenanceInclude,
        });

        return res.json({
          message:
            "Maintenance log closed. Vehicle remains RETIRED (status unchanged).",
          data: closedLog,
        });
      }

      // BR-10: Atomic — close log + set vehicle AVAILABLE
      const [closedLog] = await prisma.$transaction([
        prisma.maintenanceLog.update({
          where: { id },
          data: { status: "CLOSED", closedAt },
          include: maintenanceInclude,
        }),
        prisma.vehicle.update({
          where: { id: log.vehicleId },
          data: { status: "AVAILABLE" },
        }),
      ]);

      res.json({
        message: "Maintenance log closed. Vehicle is now AVAILABLE.",
        data: closedLog,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PUT /api/maintenance/:id
// Edit description / cost — FLEET_MANAGER only
// Only allowed on ACTIVE records (closed logs are immutable)
// ─────────────────────────────────────────────
router.put(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid maintenance log id");

      const data = updateMaintenanceSchema.parse(req.body);

      const existing = await prisma.maintenanceLog.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Maintenance log not found");

      if (existing.status === "CLOSED") {
        return sendError(res, 400, "Cannot edit a closed maintenance log");
      }

      // Strip undefined keys — required due to exactOptionalPropertyTypes in tsconfig
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      const log = await prisma.maintenanceLog.update({
        where: { id },
        data: updateData,
        include: maintenanceInclude,
      });

      res.json({ message: "Maintenance log updated successfully", data: log });
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
// DELETE /api/maintenance/:id
// Delete — FLEET_MANAGER only
// Guard: only CLOSED logs can be deleted
//   (deleting an ACTIVE log would bypass the vehicle-status sync)
// ─────────────────────────────────────────────
router.delete(
  "/:id",
  authorize("FLEET_MANAGER"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params["id"]!);
      if (isNaN(id)) return sendError(res, 400, "Invalid maintenance log id");

      const existing = await prisma.maintenanceLog.findUnique({ where: { id } });
      if (!existing) return sendError(res, 404, "Maintenance log not found");

      if (existing.status === "ACTIVE") {
        return sendError(
          res,
          409,
          "Cannot delete an active maintenance record. Close it first to release the vehicle back to AVAILABLE."
        );
      }

      await prisma.maintenanceLog.delete({ where: { id } });
      res.json({ message: "Maintenance log deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;