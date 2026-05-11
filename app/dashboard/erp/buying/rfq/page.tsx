import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RFQPage() {
  redirect('/dashboard/erp/request-for-quotation');
}
