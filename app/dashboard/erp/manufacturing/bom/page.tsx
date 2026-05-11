import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BOMPage() {
  redirect('/dashboard/erp/bom');
}
