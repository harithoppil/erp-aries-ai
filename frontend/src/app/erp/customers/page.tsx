import { listCustomers, type ClientSafeCustomer } from "./actions";
import CustomersClient from "./customers-client";

export default async function CustomersPage() {
  const result = await listCustomers();
  const customers = result.success ? result.customers : [];
  return <CustomersClient initialCustomers={customers} />;
}
