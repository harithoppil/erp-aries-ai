import { listTimesheets, type ClientSafeTimesheet } from "./actions";
import TimesheetsClient from "./timesheets-client";

export default async function TimesheetsPage() {
  const result = await listTimesheets();
  const timesheets = result.success ? result.timesheets : [];
  return <TimesheetsClient initialTimesheets={timesheets} />;
}
