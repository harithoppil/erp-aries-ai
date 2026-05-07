import { getGeneralLedger, type GLEntry } from "../actions";
import GeneralLedgerClient from "./general-ledger-client";

export default async function GeneralLedgerPage() {
  const result = await getGeneralLedger({ from_date: "2026-01-01", to_date: "2026-12-31" });
  return (
    <GeneralLedgerClient
      initialEntries={result.success ? result.entries : []}
      initialTotal={result.success ? result.total : { debit: 0, credit: 0 }}
    />
  );
}
