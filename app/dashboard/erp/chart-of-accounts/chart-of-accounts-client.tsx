'use client';

import { type JSX } from 'react';
import ERPTreeView from '@/app/dashboard/erp/components/ERPTreeView';

export default function ChartOfAccountsClient(): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hierarchical view of your account structure.
        </p>
      </div>
      <ERPTreeView
        doctype="Account"
        labelField="accountName"
        parentField="parentAccount"
        isGroupField="isGroup"
        title="Chart of Accounts"
      />
    </div>
  );
}