import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('pgvector extension created successfully');
  } catch (e: any) {
    console.error('Failed to create pgvector:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
