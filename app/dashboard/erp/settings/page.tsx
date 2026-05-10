// Module settings index — links to each module's singleton settings doctype.

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShoppingCart,
  ShoppingBag,
  Package,
  Factory,
  Calculator,
} from 'lucide-react';

export const metadata = { title: 'Module Settings' };

const MODULES = [
  {
    slug: 'accounts-settings',
    label: 'Accounts Settings',
    description: 'Default Customer/Supplier/Round-off accounts, fiscal-year locks, GL controls.',
    Icon: Calculator,
  },
  {
    slug: 'selling-settings',
    label: 'Selling Settings',
    description: 'Customer naming, sales-cycle defaults, allow zero-rate, etc.',
    Icon: ShoppingCart,
  },
  {
    slug: 'buying-settings',
    label: 'Buying Settings',
    description: 'Supplier naming, purchase-cycle defaults, RFQ controls.',
    Icon: ShoppingBag,
  },
  {
    slug: 'stock-settings',
    label: 'Stock Settings',
    description: 'Default warehouse, valuation method, stock UOM rules.',
    Icon: Package,
  },
  {
    slug: 'manufacturing-settings',
    label: 'Manufacturing Settings',
    description: 'Default work-order shelf life, BOM exploding behaviour, material transfer.',
    Icon: Factory,
  },
];

export default function ModuleSettingsIndex() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Module Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-module configuration. Each entry opens its singleton settings record.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MODULES.map(({ slug, label, description, Icon }) => (
          <Link key={slug} href={`/dashboard/erp/settings/${slug}`} className="block">
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
