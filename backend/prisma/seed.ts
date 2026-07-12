import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = [
    {
      name: "System Admin",
      email: "superadmin@transitops.com",
      password: passwordHash,
      role: "ADMIN" as const,
    },
    {
      name: "Fleet Manager",
      email: "fleet@transitops.com",
      password: passwordHash,
      role: "FLEET_MANAGER" as const,
    },
    {
      name: "Dispatcher User",
      email: "dispatcher@transitops.com",
      password: passwordHash,
      role: "DRIVER" as const,
    },
    {
      name: "Safety Officer",
      email: "safety@transitops.com",
      password: passwordHash,
      role: "SAFETY_OFFICER" as const,
    },
    {
      name: "Finance User",
      email: "finance@transitops.com",
      password: passwordHash,
      role: "FINANCIAL_ANALYST" as const,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  // Seed vehicles
  await prisma.vehicle.upsert({
    where: { registrationNumber: "TR-1001" },
    update: {},
    create: {
      registrationNumber: "TR-1001",
      name: "Volvo VNL 860",
      type: "Heavy Truck",
      maxLoadCapacity: 15000,
      acquisitionCost: 150000,
      odometer: 45000,
      status: "AVAILABLE",
    }
  });

  // Seed drivers
  await prisma.driver.upsert({
    where: { licenseNumber: "DL-987654321" },
    update: {},
    create: {
      name: "John Doe",
      licenseNumber: "DL-987654321",
      licenseCategory: "Class A",
      licenseExpiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // expires in 15 days
      contactNumber: "555-1234",
      status: "AVAILABLE"
    }
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
