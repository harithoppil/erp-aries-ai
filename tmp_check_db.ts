import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Check connection
    const result = await prisma.$queryRawUnsafe('SELECT current_database(), current_schema(), version();');
    console.log('Connected:', JSON.stringify(result, null, 2));

    // List existing schemas
    const schemas = await prisma.$queryRawUnsafe(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name;`);
    console.log('Schemas:', JSON.stringify(schemas, null, 2));

    // Create erpnext_port schema
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS "erpnext_port";');
    console.log('Schema erpnext_port created or already exists');

    // Verify
    const schemasAfter = await prisma.$queryRawUnsafe(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'erpnext_port';`);
    console.log('After create:', JSON.stringify(schemasAfter, null, 2));

  } catch (e: any) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
