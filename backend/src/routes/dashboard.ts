import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────
// GET /api/dashboard
// Returns all KPI cards in a single request.
// Roles: all authenticated
//
// KPIs:
//   activeVehicles       — vehicles currently ON_TRIP
//   availableVehicles    — vehicles AVAILABLE for dispatch
//   vehiclesInMaintenance — vehicles IN_SHOP
//   retiredVehicles      — vehicles RETIRED
//   totalVehicles        — sum of above
//   activeTrips          — trips currently DISPATCHED
//   pendingTrips         — trips in DRAFT state
//   driversOnDuty        — drivers currently ON_TRIP
//   availableDrivers     — drivers AVAILABLE
//   fleetUtilization     — activeVehicles / totalVehicles * 100 (%)
//   expiringLicenses     — drivers whose license expires within 30 days
// ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [
      activeVehicles,
      availableVehicles,
      vehiclesInMaintenance,
      retiredVehicles,
      activeTrips,
      pendingTrips,
      driversOnDuty,
      availableDrivers,
      expiringLicenses,
    ] = await Promise.all([
      prisma.vehicle.count({ where: { status: "ON_TRIP" } }),
      prisma.vehicle.count({ where: { status: "AVAILABLE" } }),
      prisma.vehicle.count({ where: { status: "IN_SHOP" } }),
      prisma.vehicle.count({ where: { status: "RETIRED" } }),
      prisma.trip.count({ where: { status: "DISPATCHED" } }),
      prisma.trip.count({ where: { status: "DRAFT" } }),
      prisma.driver.count({ where: { status: "ON_TRIP" } }),
      prisma.driver.count({ where: { status: "AVAILABLE" } }),
      // Drivers with license expiring within 30 days and not already SUSPENDED
      prisma.driver.count({
        where: {
          licenseExpiryDate: { lte: thirtyDaysFromNow },
          status: { not: "SUSPENDED" },
        },
      }),
    ]);

    const totalVehicles =
      activeVehicles + availableVehicles + vehiclesInMaintenance + retiredVehicles;

    const fleetUtilization =
      totalVehicles > 0
        ? parseFloat(((activeVehicles / totalVehicles) * 100).toFixed(2))
        : 0;

    res.json({
      vehicles: {
        total: totalVehicles,
        active: activeVehicles,
        available: availableVehicles,
        inMaintenance: vehiclesInMaintenance,
        retired: retiredVehicles,
      },
      trips: {
        active: activeTrips,
        pending: pendingTrips,
      },
      drivers: {
        onDuty: driversOnDuty,
        available: availableDrivers,
        expiringLicenses,
      },
      fleetUtilization,
    });
  } catch (error) {
    next(error);
  }
});

export default router;