import { prisma } from '@/lib/prisma';
import StockDetailClient from '@/app/erp/stock/[id]/stock-detail-client';

export default async function StockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.items.findUnique({
    where: { id },
    include: {
      bins: {
        include: {
          warehouses: true,
        },
      },
      stock_entries: {
        include: {
          warehouses_stock_entries_source_warehouseTowarehouses: true,
          warehouses_stock_entries_target_warehouseTowarehouses: true,
        },
        orderBy: { posting_date: 'desc' },
        take: 20,
      },
    },
  });
  if (!record) return <div className="p-8 text-center text-muted-foreground">Item not found</div>;
  return <StockDetailClient record={JSON.parse(JSON.stringify(record))} />;
}
