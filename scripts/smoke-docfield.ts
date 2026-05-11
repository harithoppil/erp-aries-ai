import { prisma } from '@/lib/prisma';

const fields = await prisma.docField.findMany({
  where: { parent: 'Supplier' },
  take: 5,
  orderBy: { idx: 'asc' },
  select: { fieldname: true, label: true, fieldtype: true, idx: true, in_list_view: true },
});
console.log(JSON.stringify(fields, null, 2));
await prisma.$disconnect();
