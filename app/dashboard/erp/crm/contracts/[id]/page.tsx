export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import ContractDetailClient from './contract-detail-client';

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const c = await prisma.contract.findUnique({ where: { name: id } });
    if (!c) throw new Error('Not found');
    const record = {
      name: c.name, party_type: c.party_type, party_name: c.party_name,
      status: c.status || 'Draft', contract_template: c.contract_template,
      start_date: c.start_date, end_date: c.end_date, is_signed: c.is_signed || false,
      docstatus: c.docstatus || 0, party_user: c.party_user,
      fulfilment_status: c.fulfilment_status, signee: c.signee,
      signed_on: c.signed_on, contract_terms: c.contract_terms,
      requires_fulfilment: c.requires_fulfilment || false,
      fulfilment_deadline: c.fulfilment_deadline,
      document_type: c.document_type, document_name: c.document_name,
      party_full_name: c.party_full_name, signed_by_company: c.signed_by_company,
    };
    return <ContractDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Contract not found</div>; }
}
