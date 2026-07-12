import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import prisma from "../lib/prisma.js";
import { Parser } from "json2csv";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────
// CSV helper
// If ?format=csv is in the query string, returns CSV.
// Otherwise returns JSON.
// ─────────────────────────────────────────────
function sendCsvOrJson<T extends object>(
  req: Request,
  res: Response,
  filename: string,
  data: T[]
): void {
  if (req.query["format"] === "csv") {
    if (data.length === 0) {
      res.status(200).type("text/csv").send("");
      return;
    }
    const parser = new Parser<T>();
    const csv = parser.parse(data);
    res
      .setHeader("Content-Type", "text/csv")
      .setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`)
      .status(200)
      .send(csv);
    return;
  }
  res.json({ data, count: data.length });
}

// ─────────────────────────────────────────────
// GET /api/reports/fuel-efficiency
// km per liter per vehicle, based on COMPLETED trips
// Roles: all authenticated
// CSV: ?format=csv
// ─────────────────────────────────────────────
router.get(
  "/fuel-efficiency",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const trips = await prisma.trip.findMany({
        where: {
          status: "COMPLETED",
          fuelConsumed: { not: null },
          plannedDistance: { gt: 0 },
        },
        include: {
          vehicle: {
            select: {
              id: true,
              name: true,
              registrationNumber: true,
              type: true,
            },
          },
        },
      });

      // Aggregate totals per vehicle
      const map = new Map<
        number,
        {
          vehicleId: number;
          vehicleName: string;
          registrationNumber: string;
          type: string;
          totalDistance: number;
          totalFuelConsumed: number;
        }
      >();

      for (const trip of trips) {
        const fuel = trip.fuelConsumed ?? 0;
        if (fuel <= 0) continue; // guard: skip zero-fuel trips to avoid division by zero

        const existing = map.get(trip.vehicleId);
        if (existing) {
          existing.totalDistance += trip.plannedDistance;
          existing.totalFuelConsumed += fuel;
        } else {
          map.set(trip.vehicleId, {
            vehicleId: trip.vehicleId,
            vehicleName: trip.vehicle.name,
            registrationNumber: trip.vehicle.registrationNumber,
            type: trip.vehicle.type,
            totalDistance: trip.plannedDistance,
            totalFuelConsumed: fuel,
          });
        }
      }

      const result = Array.from(map.values()).map((v) => ({
        ...v,
        efficiency: parseFloat((v.totalDistance / v.totalFuelConsumed).toFixed(2)),
      }));

      sendCsvOrJson(req, res, "fuel-efficiency", result);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/reports/fleet-utilization
// % of vehicles currently ON_TRIP vs total fleet
// Optional: ?type= to filter by vehicle type
// Roles: all authenticated
// CSV: ?format=csv
// ─────────────────────────────────────────────
router.get(
  "/fleet-utilization",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      const typeFilter = type ? { type: type as string } : {};

      const [total, onTrip, available, inShop, retired] = await Promise.all([
        prisma.vehicle.count({ where: { ...typeFilter } }),
        prisma.vehicle.count({ where: { ...typeFilter, status: "ON_TRIP" } }),
        prisma.vehicle.count({ where: { ...typeFilter, status: "AVAILABLE" } }),
        prisma.vehicle.count({ where: { ...typeFilter, status: "IN_SHOP" } }),
        prisma.vehicle.count({ where: { ...typeFilter, status: "RETIRED" } }),
      ]);

      const utilizationPercentage =
        total > 0 ? parseFloat(((onTrip / total) * 100).toFixed(2)) : 0;

      const result = [
        {
          totalVehicles: total,
          activeVehicles: onTrip,
          availableVehicles: available,
          inShopVehicles: inShop,
          retiredVehicles: retired,
          utilizationPercentage,
        },
      ];

      sendCsvOrJson(req, res, "fleet-utilization", result);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/reports/operational-cost
// Maintenance + Fuel + Expenses aggregated per vehicle
// Optional filters: ?vehicleId=, ?dateFrom=, ?dateTo=
// Roles: FLEET_MANAGER, FINANCIAL_ANALYST
// CSV: ?format=csv
// ─────────────────────────────────────────────
router.get(
  "/operational-cost",
  authorize("FLEET_MANAGER", "FINANCIAL_ANALYST"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId, dateFrom, dateTo } = req.query;

      const dateRangeFilter =
        dateFrom || dateTo
          ? {
              date: {
                ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}),
                ...(dateTo ? { lte: new Date(dateTo as string) } : {}),
              },
            }
          : {};

      const maintenanceDateFilter =
        dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}),
                ...(dateTo ? { lte: new Date(dateTo as string) } : {}),
              },
            }
          : {};

      const vehicleFilter = vehicleId
        ? { id: parseInt(vehicleId as string) }
        : {};

      const vehicles = await prisma.vehicle.findMany({
        where: vehicleFilter,
        select: {
          id: true,
          name: true,
          registrationNumber: true,
          type: true,
          acquisitionCost: true,
          maintenanceLogs: {
            where: maintenanceDateFilter,
            select: { cost: true },
          },
          fuelLogs: {
            where: dateRangeFilter,
            select: { cost: true },
          },
          expenses: {
            where: dateRangeFilter,
            select: { amount: true },
          },
        },
        orderBy: { id: "asc" },
      });

      const result = vehicles.map((v) => {
        const maintenanceCost = v.maintenanceLogs.reduce(
          (s, m) => s + m.cost,
          0
        );
        const fuelCost = v.fuelLogs.reduce((s, f) => s + f.cost, 0);
        const expenseCost = v.expenses.reduce((s, e) => s + e.amount, 0);
        const totalCost = maintenanceCost + fuelCost + expenseCost;

        return {
          vehicleId: v.id,
          vehicleName: v.name,
          registrationNumber: v.registrationNumber,
          type: v.type,
          maintenanceCost: parseFloat(maintenanceCost.toFixed(2)),
          fuelCost: parseFloat(fuelCost.toFixed(2)),
          expenseCost: parseFloat(expenseCost.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2)),
        };
      });

      sendCsvOrJson(req, res, "operational-cost", result);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/reports/vehicle-roi
// (Revenue - (Maintenance + Fuel)) / AcquisitionCost * 100
// Only considers COMPLETED trips with revenue set
// Vehicles with acquisitionCost = 0 are excluded (guard division by zero)
// Roles: FLEET_MANAGER, FINANCIAL_ANALYST
// CSV: ?format=csv
// ─────────────────────────────────────────────
router.get(
  "/vehicle-roi",
  authorize("FLEET_MANAGER", "FINANCIAL_ANALYST"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicles = await prisma.vehicle.findMany({
        where: {
          acquisitionCost: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          registrationNumber: true,
          type: true,
          acquisitionCost: true,
          maintenanceLogs: { select: { cost: true } },
          fuelLogs: { select: { cost: true } },
          trips: {
            where: {
              status: "COMPLETED",
              revenue: { not: null },
            },
            select: { revenue: true },
          },
        },
        orderBy: { id: "asc" },
      });

      const result = vehicles.map((v) => {
        const totalRevenue = v.trips.reduce((s, t) => s + (t.revenue ?? 0), 0);
        const maintenanceCost = v.maintenanceLogs.reduce(
          (s, m) => s + m.cost,
          0
        );
        const fuelCost = v.fuelLogs.reduce((s, f) => s + f.cost, 0);
        const totalCost = maintenanceCost + fuelCost;
        const roi = parseFloat(
          (((totalRevenue - totalCost) / v.acquisitionCost) * 100).toFixed(2)
        );

        return {
          vehicleId: v.id,
          vehicleName: v.name,
          registrationNumber: v.registrationNumber,
          type: v.type,
          acquisitionCost: v.acquisitionCost,
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2)),
          roi,
        };
      });

      sendCsvOrJson(req, res, "vehicle-roi", result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;