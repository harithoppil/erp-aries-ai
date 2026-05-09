import { prisma } from '@/lib/prisma';
import BankAccountDetailClient from './bank-account-detail-client';

export default async function BankAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ba = await prisma.bankAccount.findUnique({ where: { name: id } });
    if (!ba) throw new Error('Not found');
    const record = {
      name: ba.name, account_name: ba.account_name, bank: ba.bank,
      account_type: ba.account_type, bank_account_no: ba.bank_account_no,
      company: ba.company, is_default: ba.is_default || false,
      is_company_account: ba.is_company_account || false,
      disabled: ba.disabled || false, docstatus: ba.docstatus || 0,
      account: ba.account, account_subtype: ba.account_subtype,
      party_type: ba.party_type, party: ba.party,
      iban: ba.iban, branch_code: ba.branch_code,
    };
    return <BankAccountDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Bank Account not found</div>; }
}
