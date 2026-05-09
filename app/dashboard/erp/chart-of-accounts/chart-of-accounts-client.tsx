"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-responsive";
import { getAccountTree } from "@/app/dashboard/erp/accounts/actions";
import type { AccountTreeNode } from "@/lib/erpnext/types";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function ChartOfAccountsClient() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAccountTree();
        if (res.success) setAccounts(res.accounts);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading chart of accounts…</div>;

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/erp">ERP</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/erp/accounts">Invoicing</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Chart of Accounts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="space-y-1">
      {accounts.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 rounded-lg border px-3 py-2"
          style={{ marginLeft: a.level * (isMobile ? 12 : 24) }}
        >
          <span className="text-xs text-muted-foreground w-8">{a.account_number || "—"}</span>
          <span className="flex-1 text-sm font-medium">{a.name}</span>
          <span className="text-xs text-muted-foreground">{a.root_type}</span>
          <span className="text-sm font-medium tabular-nums">
            {a.balance?.toLocaleString("en-AE", { style: "currency", currency: "AED" }) || "AED 0.00"}
          </span>
        </div>
      ))}
      </div>
    </div>
  );
}
