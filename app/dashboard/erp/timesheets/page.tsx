import { listTimesheets, type ClientSafeTimesheet } from "@/app/dashboard/erp/timesheets/actions";

export const dynamic = 'force-dynamic';
import TimesheetsClient from "@/app/dashboard/erp/timesheets/timesheets-client";

export default async function TimesheetsPage() {
  const result = await listTimesheets();
  const timesheets = result.success ? result.timesheets : [];
  return <TimesheetsClient initialTimesheets={timesheets} />;
}
