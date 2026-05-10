import { listBankAccounts, type ClientSafeBankAccount } from './actions';

export const dynamic = 'force-dynamic';
import BankAccountsClient from './bank-accounts-client';

export default async function BankAccountsPage() {
  const result = await listBankAccounts();
  const bankAccounts = result.success ? result.bankAccounts : [];
  return <BankAccountsClient initialRecords={JSON.parse(JSON.stringify(bankAccounts))} />;
}
