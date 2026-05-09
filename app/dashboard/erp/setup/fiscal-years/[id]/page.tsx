import { prisma } from '@/lib/prisma';
import FiscalYearDetailClient from './fiscal-year-detail-client';

export default async function FiscalYearDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const fy = await prisma.fiscalYear.findUnique({ where: { name: id } });
    if (!fy) throw new Error('Not found');
    const record = {
      name: fy.name, year: fy.year, disabled: fy.disabled || false,
      year_start_date: fy.year_start_date, year_end_date: fy.year_end_date,
      auto_created: fy.auto_created || false, docstatus: fy.docstatus || 0,
      is_short_year: fy.is_short_year || false,
    };
    return <FiscalYearDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Fiscal Year not found</div>; }
}
