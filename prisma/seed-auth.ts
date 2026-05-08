import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding auth users...");

  // Default admin user
  const adminEmail = "admin@ariesmarine.com";
  const existing = await prisma.users.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    console.log("Admin user already exists, skipping.");
  } else {
    const passwordHash = await bcrypt.hash("admin123", 12);

    await prisma.users.create({
      data: {
        email: adminEmail,
        password_hash: passwordHash,
        name: "Admin",
        role: "admin",
        company: "Aries Marine",
        is_active: true,
      },
    });

    console.log("Created admin user: admin@ariesmarine.com / admin123");
  }

  // Optional: Demo manager user
  const managerEmail = "manager@ariesmarine.com";
  const existingManager = await prisma.users.findUnique({
    where: { email: managerEmail },
  });

  if (!existingManager) {
    const passwordHash = await bcrypt.hash("manager123", 12);

    await prisma.users.create({
      data: {
        email: managerEmail,
        password_hash: passwordHash,
        name: "Operations Manager",
        role: "manager",
        department: "Operations",
        subsidiary: "Aries Marine LLC",
        company: "Aries Marine",
        is_active: true,
      },
    });

    console.log("Created manager user: manager@ariesmarine.com / manager123");
  }

  console.log("Auth seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
