import { listDepartments, type ClientSafeDepartment } from './actions';
import DepartmentsClient from './departments-client';

export default async function DepartmentsPage() {
  const result = await listDepartments();
  const departments = result.success ? result.departments : [];
  return <DepartmentsClient initialDepartments={departments} />;
}
