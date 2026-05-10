import { getGeneralLedger, type GLEntry } from "@/app/dashboard/erp/reports/actions";

export const dynamic = 'force-dynamic';
import GeneralLedgerClient from "@/app/dashboard/erp/reports/general-ledger/general-ledger-client";

export default async function GeneralLedgerPage() {
  const result = await getGeneralLedger({ from_date: `${new Date().getFullYear()}-01-01`, to_date: `${new Date().getFullYear()}-12-31` });
  return (
    <GeneralLedgerClient
      initialEntries={result.success ? result.entries : []}
      initialTotal={result.success ? result.total : { debit: 0, credit: 0 }}
    />
  );
}
