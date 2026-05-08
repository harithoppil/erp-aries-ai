import { listCustomers, type ClientSafeCustomer } from "@/app/dashboard/erp/customers/actions";
import CustomersClient from "@/app/dashboard/erp/customers/customers-client";

export default async function CustomersPage() {
  const result = await listCustomers();
  const customers = result.success ? result.customers : [];
  return <CustomersClient initialCustomers={customers} />;
}
