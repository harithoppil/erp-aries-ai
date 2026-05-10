import { PrismaClient } from "@/prisma/client";
import { hashPassword } from "@/lib/password";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding auth users...");

  // Default admin user
  const adminEmail = "admin@ariesmarine.com";
  const existing = await prisma.users.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    console.log(`  Admin user ${adminEmail} already exists, skipping`);
  } else {
    const passwordHash = await hashPassword("admin123");
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
    console.log(`  Created admin: ${adminEmail} / admin123`);
  }

  console.log("Auth seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
