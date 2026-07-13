import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Seed Users (Demo Accounts)
  const users = [
    { name: "System Admin", email: "admin@transitops.com", password: passwordHash, role: "ADMIN" as const },
    { name: "Fleet Manager", email: "fleet@transitops.com", password: passwordHash, role: "FLEET_MANAGER" as const },
    { name: "Dispatcher User", email: "dispatcher@transitops.com", password: passwordHash, role: "DRIVER" as const },
    { name: "Safety Officer", email: "safety@transitops.com", password: passwordHash, role: "SAFETY_OFFICER" as const },
    { name: "Finance User", email: "finance@transitops.com", password: passwordHash, role: "FINANCIAL_ANALYST" as const },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  // 2. Seed 10 Vehicles
  const vehicles = [
    { registrationNumber: "TR-1001", name: "Volvo VNL 860", type: "Heavy Truck", maxLoadCapacity: 15000, acquisitionCost: 150000, odometer: 45000, status: "AVAILABLE" },
    { registrationNumber: "TR-1002", name: "Freightliner Cascadia", type: "Heavy Truck", maxLoadCapacity: 16000, acquisitionCost: 145000, odometer: 32000, status: "AVAILABLE" },
    { registrationNumber: "VN-2001", name: "Ford Transit 350", type: "Cargo Van", maxLoadCapacity: 2000, acquisitionCost: 45000, odometer: 12000, status: "IN_SHOP" },
    { registrationNumber: "VN-2002", name: "Mercedes Sprinter", type: "Cargo Van", maxLoadCapacity: 2500, acquisitionCost: 55000, odometer: 8000, status: "ON_TRIP" },
    { registrationNumber: "TR-1003", name: "Peterbilt 579", type: "Heavy Truck", maxLoadCapacity: 15500, acquisitionCost: 160000, odometer: 120000, status: "AVAILABLE" },
    { registrationNumber: "TR-1004", name: "Kenworth T680", type: "Heavy Truck", maxLoadCapacity: 15000, acquisitionCost: 155000, odometer: 85000, status: "RETIRED" },
    { registrationNumber: "VN-2003", name: "Ram ProMaster", type: "Cargo Van", maxLoadCapacity: 2100, acquisitionCost: 40000, odometer: 5000, status: "AVAILABLE" },
    { registrationNumber: "PU-3001", name: "Ford F-250", type: "Pickup", maxLoadCapacity: 1500, acquisitionCost: 65000, odometer: 22000, status: "ON_TRIP" },
    { registrationNumber: "PU-3002", name: "Chevy Silverado 2500", type: "Pickup", maxLoadCapacity: 1600, acquisitionCost: 62000, odometer: 15000, status: "AVAILABLE" },
    { registrationNumber: "TR-1005", name: "Mack Anthem", type: "Heavy Truck", maxLoadCapacity: 16500, acquisitionCost: 148000, odometer: 1000, status: "AVAILABLE" },
  ];

  const vehicleIds: Record<string, number> = {};
  for (const v of vehicles) {
    const created = await prisma.vehicle.upsert({
      where: { registrationNumber: v.registrationNumber },
      update: {},
      create: v as any,
    });
    vehicleIds[v.registrationNumber] = created.id;
  }

  // 3. Seed 10 Drivers
  const today = new Date();
  const nextYear = new Date(); nextYear.setFullYear(today.getFullYear() + 1);
  const nextMonth = new Date(); nextMonth.setDate(today.getDate() + 20); // expiring soon
  const lastMonth = new Date(); lastMonth.setDate(today.getDate() - 30); // expired

  const drivers = [
    { licenseNumber: "DL-001", name: "John Doe", licenseCategory: "Class A", licenseExpiryDate: nextYear, contactNumber: "555-0001", status: "AVAILABLE" },
    { licenseNumber: "DL-002", name: "Jane Smith", licenseCategory: "Class A", licenseExpiryDate: nextYear, contactNumber: "555-0002", status: "ON_TRIP" },
    { licenseNumber: "DL-003", name: "Mike Johnson", licenseCategory: "Class B", licenseExpiryDate: nextMonth, contactNumber: "555-0003", status: "AVAILABLE" },
    { licenseNumber: "DL-004", name: "Sarah Davis", licenseCategory: "Class B", licenseExpiryDate: lastMonth, contactNumber: "555-0004", status: "SUSPENDED" }, // expired
    { licenseNumber: "DL-005", name: "Robert Wilson", licenseCategory: "Class A", licenseExpiryDate: nextYear, contactNumber: "555-0005", status: "ON_TRIP" },
    { licenseNumber: "DL-006", name: "Linda Moore", licenseCategory: "Class C", licenseExpiryDate: nextYear, contactNumber: "555-0006", status: "AVAILABLE" },
    { licenseNumber: "DL-007", name: "William Taylor", licenseCategory: "Class A", licenseExpiryDate: nextYear, contactNumber: "555-0007", status: "AVAILABLE" },
    { licenseNumber: "DL-008", name: "David Anderson", licenseCategory: "Class C", licenseExpiryDate: nextYear, contactNumber: "555-0008", status: "AVAILABLE" },
    { licenseNumber: "DL-009", name: "Richard Thomas", licenseCategory: "Class A", licenseExpiryDate: nextYear, contactNumber: "555-0009", status: "SUSPENDED" }, // manual suspension
    { licenseNumber: "DL-010", name: "Patricia Jackson", licenseCategory: "Class B", licenseExpiryDate: nextYear, contactNumber: "555-0010", status: "AVAILABLE" },
  ];

  const driverIds: Record<string, number> = {};
  for (const d of drivers) {
    const created = await prisma.driver.upsert({
      where: { licenseNumber: d.licenseNumber },
      update: {},
      create: d as any,
    });
    driverIds[d.licenseNumber] = created.id;
  }

  // Clear existing transactions to avoid dupes on re-seed
  await prisma.expense.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.trip.deleteMany();

  // 4. Seed 10 Trips (Mix of DRAFT, DISPATCHED, COMPLETED, CANCELLED)
  const trips = [
    { source: "Chicago, IL", destination: "Detroit, MI", vehicleId: vehicleIds["TR-1001"], driverId: driverIds["DL-001"], cargoWeight: 12000, plannedDistance: 450, status: "COMPLETED", revenue: 2500, finalOdometer: 45450, fuelConsumed: 60 },
    { source: "Dallas, TX", destination: "Houston, TX", vehicleId: vehicleIds["TR-1002"], driverId: driverIds["DL-006"], cargoWeight: 14000, plannedDistance: 390, status: "COMPLETED", revenue: 1800, finalOdometer: 32390, fuelConsumed: 55 },
    { source: "Los Angeles, CA", destination: "Phoenix, AZ", vehicleId: vehicleIds["VN-2002"], driverId: driverIds["DL-002"], cargoWeight: 2000, plannedDistance: 600, status: "DISPATCHED", revenue: null }, // ON_TRIP
    { source: "New York, NY", destination: "Boston, MA", vehicleId: vehicleIds["PU-3001"], driverId: driverIds["DL-005"], cargoWeight: 1200, plannedDistance: 350, status: "DISPATCHED", revenue: null }, // ON_TRIP
    { source: "Miami, FL", destination: "Orlando, FL", vehicleId: vehicleIds["VN-2003"], driverId: driverIds["DL-008"], cargoWeight: 1800, plannedDistance: 380, status: "DRAFT", revenue: null },
    { source: "Seattle, WA", destination: "Portland, OR", vehicleId: vehicleIds["TR-1003"], driverId: driverIds["DL-007"], cargoWeight: 15000, plannedDistance: 280, status: "DRAFT", revenue: null },
    { source: "Denver, CO", destination: "Salt Lake City, UT", vehicleId: vehicleIds["TR-1005"], driverId: driverIds["DL-010"], cargoWeight: 16000, plannedDistance: 850, status: "CANCELLED", revenue: null },
    { source: "Atlanta, GA", destination: "Charlotte, NC", vehicleId: vehicleIds["TR-1001"], driverId: driverIds["DL-001"], cargoWeight: 10000, plannedDistance: 400, status: "COMPLETED", revenue: 2200, finalOdometer: 45850, fuelConsumed: 50 },
    { source: "Columbus, OH", destination: "Indianapolis, IN", vehicleId: vehicleIds["TR-1002"], driverId: driverIds["DL-003"], cargoWeight: 15000, plannedDistance: 280, status: "COMPLETED", revenue: 1500, finalOdometer: 32670, fuelConsumed: 40 },
    { source: "Memphis, TN", destination: "Nashville, TN", vehicleId: vehicleIds["PU-3002"], driverId: driverIds["DL-007"], cargoWeight: 1000, plannedDistance: 340, status: "COMPLETED", revenue: 900, finalOdometer: 15340, fuelConsumed: 30 },
  ];
  await prisma.trip.createMany({ data: trips as any });

  // 5. Seed 10 Maintenance Logs (Mix of ACTIVE, CLOSED)
  const maintenance = [
    { vehicleId: vehicleIds["VN-2001"], description: "Engine replacement", status: "ACTIVE", cost: 0 }, // Vehicle is IN_SHOP
    { vehicleId: vehicleIds["TR-1001"], description: "Oil change and tire rotation", status: "CLOSED", cost: 1200 },
    { vehicleId: vehicleIds["TR-1002"], description: "Brake pad replacement", status: "CLOSED", cost: 850 },
    { vehicleId: vehicleIds["TR-1003"], description: "Transmission check", status: "CLOSED", cost: 450 },
    { vehicleId: vehicleIds["TR-1004"], description: "Major collision repair", status: "CLOSED", cost: 15000 },
    { vehicleId: vehicleIds["VN-2003"], description: "Routine inspection", status: "CLOSED", cost: 200 },
    { vehicleId: vehicleIds["PU-3001"], description: "Spark plug replacement", status: "CLOSED", cost: 350 },
    { vehicleId: vehicleIds["PU-3002"], description: "Battery replacement", status: "CLOSED", cost: 180 },
    { vehicleId: vehicleIds["TR-1005"], description: "Alignment", status: "CLOSED", cost: 400 },
    { vehicleId: vehicleIds["VN-2002"], description: "AC repair", status: "CLOSED", cost: 600 },
  ];
  await prisma.maintenanceLog.createMany({ data: maintenance as any });

  // 6. Seed 10 Fuel Logs
  const fuels = [
    { vehicleId: vehicleIds["TR-1001"], liters: 150, cost: 450, date: new Date() },
    { vehicleId: vehicleIds["TR-1002"], liters: 120, cost: 360, date: new Date() },
    { vehicleId: vehicleIds["VN-2001"], liters: 20, cost: 65, date: new Date() },
    { vehicleId: vehicleIds["VN-2002"], liters: 25, cost: 80, date: new Date() },
    { vehicleId: vehicleIds["TR-1003"], liters: 100, cost: 310, date: new Date() },
    { vehicleId: vehicleIds["TR-1004"], liters: 50, cost: 160, date: new Date() },
    { vehicleId: vehicleIds["VN-2003"], liters: 15, cost: 50, date: new Date() },
    { vehicleId: vehicleIds["PU-3001"], liters: 30, cost: 95, date: new Date() },
    { vehicleId: vehicleIds["PU-3002"], liters: 25, cost: 80, date: new Date() },
    { vehicleId: vehicleIds["TR-1005"], liters: 140, cost: 420, date: new Date() },
  ];
  await prisma.fuelLog.createMany({ data: fuels as any });

  // 7. Seed 10 Expenses
  const expenses = [
    { vehicleId: vehicleIds["TR-1001"], driverId: driverIds["DL-001"], category: "TOLL", amount: 45.50, description: "Chicago Turnpike", date: new Date() },
    { vehicleId: vehicleIds["TR-1002"], driverId: driverIds["DL-006"], category: "FOOD", amount: 25.00, description: "Lunch meal allowance", date: new Date() },
    { vehicleId: vehicleIds["VN-2002"], driverId: driverIds["DL-002"], category: "LODGING", amount: 120.00, description: "Motel stay", date: new Date() },
    { vehicleId: vehicleIds["PU-3001"], driverId: driverIds["DL-005"], category: "OTHER", amount: 15.00, description: "Parking fee", date: new Date() },
    { vehicleId: vehicleIds["TR-1003"], driverId: driverIds["DL-007"], category: "TOLL", amount: 65.00, description: "Bridge toll", date: new Date() },
    { vehicleId: vehicleIds["TR-1001"], driverId: driverIds["DL-001"], category: "LODGING", amount: 150.00, description: "Hotel stay - Charlotte", date: new Date() },
    { vehicleId: vehicleIds["TR-1002"], driverId: driverIds["DL-003"], category: "TOLL", amount: 35.00, description: "Ohio tollway", date: new Date() },
    { vehicleId: vehicleIds["PU-3002"], driverId: driverIds["DL-007"], category: "FOOD", amount: 30.00, description: "Dinner", date: new Date() },
    { vehicleId: vehicleIds["TR-1005"], driverId: driverIds["DL-010"], category: "OTHER", amount: 50.00, description: "Scale ticket fee", date: new Date() },
    { vehicleId: vehicleIds["VN-2003"], driverId: driverIds["DL-008"], category: "FOOD", amount: 18.00, description: "Breakfast", date: new Date() },
  ];
  await prisma.expense.createMany({ data: expenses as any });

  console.log("==========================================");
  console.log("✅ Database seeded with 10 examples per entity!");
  console.log("==========================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
