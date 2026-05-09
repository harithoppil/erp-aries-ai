import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // List all tables in all schemas
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE' 
      AND table_schema IN ('public', 'app', 'erpnext_port')
      ORDER BY table_schema, table_name;
    `);
    console.log('=== TABLES ===');
    for (const t of tables as any[]) {
      console.log(`${t.table_schema}.${t.table_name}`);
    }

    // Count rows in each table
    console.log('\n=== ROW COUNTS ===');
    for (const t of tables as any[]) {
      try {
        const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "${t.table_schema}"."${t.table_name}";`);
        console.log(`${t.table_schema}.${t.table_name}: ${(count as any[])[0].cnt}`);
      } catch (e: any) {
        console.log(`${t.table_schema}.${t.table_name}: ERROR - ${e.message}`);
      }
    }

    // List all enums
    console.log('\n=== ENUMS ===');
    const enums = await prisma.$queryRawUnsafe(`
      SELECT n.nspname as schema, t.typname as name, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname IN ('public', 'app')
      GROUP BY n.nspname, t.typname;
    `);
    for (const e of enums as any[]) {
      console.log(`${e.schema}.${e.name}: ${e.values.join(', ')}`);
    }

  } catch (e: any) {
    console.error('FATAL ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
