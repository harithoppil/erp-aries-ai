"use client";

import { useState } from "react";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Plus, Search, UserCircle } from "lucide-react";

const DEMO_EMPLOYEES = [
  {"id":"1","employee_number":"AME-001","full_name":"Captain Ahmed Al-Rashid","email":"ahmed.rashid@ariesmarine.ae","phone":"+971-50-123-4567","department":"Marine Operations","designation":"Vessel Master","date_of_joining":"2018-03-15","status":"Active","grade":"A"},
  {"id":"2","employee_number":"AME-042","full_name":"Sarah Williams","email":"sarah.w@ariesmarine.ae","phone":"+971-55-234-5678","department":"Diving","designation":"Lead Dive Supervisor","date_of_joining":"2020-06-01","status":"Active","grade":"A"},
  {"id":"3","employee_number":"AME-089","full_name":"Mohammed Hassan","email":"m.hassan@ariesmarine.ae","phone":"+971-50-345-6789","department":"Engineering","designation":"Chief Engineer","date_of_joining":"2019-01-10","status":"Active","grade":"B"},
  {"id":"4","employee_number":"AME-112","full_name":"Priya Sharma","email":"priya.s@ariesmarine.ae","phone":"+971-55-456-7890","department":"Finance","designation":"Finance Manager","date_of_joining":"2021-09-01","status":"Active","grade":"A"},
  {"id":"5","employee_number":"AME-134","full_name":"James O\'Brien","email":"james.ob@ariesmarine.ae","phone":"+971-50-567-8901","department":"HSE","designation":"HSE Coordinator","date_of_joining":"2022-02-14","status":"On Leave","grade":"B"},
  {"id":"6","employee_number":"AME-156","full_name":"Fatima Al-Zaabi","email":"fatima.z@ariesmarine.ae","phone":"+971-55-678-9012","department":"Projects","designation":"Project Manager","date_of_joining":"2023-04-01","status":"Active","grade":"A"},
  {"id":"7","employee_number":"AME-178","full_name":"Raj Patel","email":"raj.p@ariesmarine.ae","phone":"+971-50-789-0123","department":"Procurement","designation":"Procurement Officer","date_of_joining":"2024-01-15","status":"Active","grade":"C"},
];

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");

  const filtered = DEMO_EMPLOYEES.filter(e => {
    const matchSearch = !search || e.full_name.toLowerCase().includes(search.toLowerCase()) || e.employee_number.toLowerCase().includes(search.toLowerCase());
    const matchDept = !dept || e.department === dept;
    return matchSearch && matchDept;
  });

  const departments = [...new Set(DEMO_EMPLOYEES.map(e => e.department))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Employees</h1>
          <p className="text-sm text-gray-500">{filtered.length} active employees</p>
        </div>
        <a href="/hr/employees/new" className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-[#B08D2F] text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Employee
        </a>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold/50">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="px-4 py-3"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center"><UserCircle className="w-4 h-4 text-gold" /></div>
                  <div><p className="text-sm font-medium text-navy">{e.full_name}</p><p className="text-xs text-gray-500">{e.email}</p></div>
                </div></td>
                <td className="px-4 py-3 text-sm text-gray-600">{e.employee_number}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{e.department}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{e.designation}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(e.date_of_joining)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(e.status)}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
