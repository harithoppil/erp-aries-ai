import { listAccounts, listInvoices, type ClientSafeAccount, type ClientSafeInvoice } from "@/app/dashboard/erp/accounts/actions";
import AccountsClient from "@/app/dashboard/erp/accounts/accounts-client";

export default async function AccountsListPage() {
  const [accResult, invResult] = await Promise.all([
    listAccounts(),
    listInvoices(),
  ]);
  const accounts = accResult.success ? accResult.accounts : [];
  const invoices = invResult.success ? invResult.invoices : [];

  return <AccountsClient initialAccounts={accounts} initialInvoices={invoices} />;
}
