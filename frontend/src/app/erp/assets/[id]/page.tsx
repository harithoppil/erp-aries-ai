import { prisma } from '@/lib/prisma';
import AssetDetailClient from './asset-detail-client';

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.assets.findUnique({
    where: { id },
    include: {
      warehouses: true,
      personnel: true,
      projects: true,
      maintenance_records: {
        orderBy: { performed_date: 'desc' },
      },
    },
  });
  if (!record) return <div className="p-8 text-center text-muted-foreground">Asset not found</div>;
  return <AssetDetailClient record={JSON.parse(JSON.stringify(record))} />;
}
