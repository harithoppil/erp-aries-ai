# Revolyzz Frontend Patterns — Reference Document

> **Purpose:** This document captures the exact source code patterns observed in the revolyzz project. All frontend redesign work in the ERP project MUST follow these 4 patterns.

---

## Pattern 1: Mobile/Desktop Split (`useMediaQuery`)

**Rule:** No `sm:/lg:/md:` responsive class soup. Use a hook to detect viewport size, then conditionally render completely separate component trees.

### The Hook

`app/hooks/use-media-query.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  // Initialize state safely for SSR
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Update matches when media query changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  // Return false during SSR to avoid hydration mismatch
  return mounted ? matches : false;
}
```

### Usage in Pages

```tsx
export default function Page() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <>
      <SiteHeaderLanding userData={userData} />
      <main>
        {isMobile ? <MobileHero /> : <DesktopHero />}
      </main>
    </>
  );
}
```

### Usage in Layout (Multi-Breakpoint)

`app/dashboard/layout.tsx`

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');
  const isMediumScreen = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isSmallScreen = useMediaQuery('(max-width: 639px)');

  const useSplitNavigation = isSmallScreen;

  // Compute the expanded state based on screen size and user choice
  // For large screens: use user choice if set, otherwise expanded
  // For medium screens: always collapsed (icons only)
  // For small screens: doesn't matter (uses mobile layout)
  const expanded = isLargeScreen
    ? userExpandedChoice !== null
      ? userExpandedChoice
      : true
    : false;

  // ... rest of layout
}
```

**Key Rules:**
- Hook returns `false` during SSR (avoids hydration mismatch)
- Components can be inline, in same file, or imported (`MobileHero` / `DesktopHero`)
- Standard breakpoint: `768px` for mobile/desktop divide
- No responsive Tailwind classes cluttering JSX

---

## Pattern 2: Skeleton Loading

**Rule:** Every data-dependent page MUST have a dedicated skeleton component that mirrors the exact layout. Show skeleton while `isLoading`. No generic spinners.

### Full Page Skeleton

`app/dashboard/customers/page.tsx`

```tsx
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

// ... inside component:
if (isLoading) {
  return <CustomerListSkeleton />;
}

// ... at bottom of file:
function CustomerListSkeleton() {
  return (
    <div className="space-y-2 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="hidden sm:flex gap-4">
        <Skeleton className="h-16 w-32" />
        <Skeleton className="h-16 w-32" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-200">
            <Skeleton className="h-9 w-64" />
          </div>
          <div className="p-4">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-center space-x-3 mb-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Inline Table Skeleton (Inside Same Page)

```tsx
const renderSkeletons = () =>
  Array.from({ length: 4 }).map((_, i) => (
    <TableRow key={`skeleton-${i}`}>
      <TableCell>
        <Skeleton className="h-5 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24" />
      </TableCell>
    </TableRow>
  ));
```

**Usage inside Table:**

```tsx
{isLoading ? (
  <div className="overflow-x-auto">
    <Table className="min-w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderSkeletons()}</TableBody>
    </Table>
  </div>
) : (
  <Table>{/* real data */}</Table>
)}
```

**Key Rules:**
- Skeleton mimics the exact layout structure → zero layout shift on load
- Use `Array(5).fill(0).map()` for repeating rows
- Skeleton can be a full-page component OR inline table rows
- Always shown conditionally: `{isLoading ? <Skeleton /> : <RealContent />}`

---

## Pattern 3: Server Component First

**Rule:** `page.tsx` should ALWAYS be an async server component when feasible. No `'use client'`. Fetch data directly, check auth, redirect if needed, transform to client-safe props, then render a client component.

### Server Page

`app/dashboard/transactions/[id]/page.tsx`

```tsx
// app/dashboard/transactions/[id]/page.tsx
'use server';

import { getSession } from '@/app/actions/newAuth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe';
import TransactionDetailsClient, {
  type TransactionDetailsProps
} from '@/app/dashboard/transactions/[id]/TransactionDetails';
import type { Metadata } from 'next';
import type Stripe from 'stripe';

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const transaction = await prisma.transaction.findUnique({
    where: { id: id },
    select: { amount: true, currency: true }
  });
  if (!transaction) return { title: 'Transaction Not Found' };
  return { title: `Transaction ${id.substring(0, 8)}` };
}

export default async function TransactionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Auth check
  const session = await getSession();
  if (!session?.data?.id) redirect(`/`);

  // 2. Direct Prisma query
  const transaction = await prisma.transaction.findFirst({
    where: { id: id, userId: session.data.id }
  });

  if (!transaction) redirect('/dashboard/transactions?error=not-found');

  // 3. Transform to client-safe props (NO Dates, NO functions, NO circular refs)
  const clientProps: TransactionDetailsProps = {
    id: transaction.id,
    amount: transaction.amount,
    netAmount: transaction.netAmount,
    currency: transaction.currency,
    status: transaction.status,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    customer: { name: null, email: null },
    paymentMethod: { brand: null, last4: null, country: null, funding: null },
    timeline: [],
    metadata: {},
    product: null
  };

  // 4. Enhance with related data
  const dbMetadata = (transaction.metadata as Record<string, any>) || {};
  clientProps.customer.name = dbMetadata.customerName || null;
  clientProps.customer.email = dbMetadata.customerEmail || null;

  // Add creation event to timeline
  clientProps.timeline.push({
    timestamp: transaction.createdAt.toISOString(),
    status: 'CREATED',
    title: 'Payment Created',
    description: `A payment for ${new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency }).format(transaction.amount / 100)} was initiated.`
  });

  // 5. Enhance with external API data (Stripe)
  if (transaction.stripePaymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        transaction.stripePaymentIntentId,
        { expand: ['customer', 'latest_charge', 'latest_charge.balance_transaction'] }
      );

      if (paymentIntent.customer && typeof paymentIntent.customer === 'object') {
        clientProps.customer.name =
          (paymentIntent.customer as { name?: string }).name || clientProps.customer.name;
        clientProps.customer.email =
          (paymentIntent.customer as { email?: string }).email || clientProps.customer.email;
      }

      // ... more data enrichment
    } catch (error: any) {
      console.error('Failed to fetch Stripe data:', error.message);
    }
  }

  // 6. Render client component with plain props
  return <TransactionDetailsClient {...clientProps} />;
}
```

### Client Component (Same Folder)

`app/dashboard/transactions/[id]/TransactionDetails.tsx`

```tsx
// app/dashboard/transactions/[id]/TransactionDetailsClient.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { syncTransactionStatus, type SyncResultState } from '@/app/dashboard/transactions/actions';
import { getStatusInfo, statusColorClass } from '@/app/actions/status-helper';
import { getCardLogo } from '@/app/actions/data';
import { TransactionStatus } from '@prisma/client';

// UI Components & Icons
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Clipboard, Check, UserIcon, Mail, CreditCard, Tag } from 'lucide-react';
import { toast } from 'sonner';

// Define the clean props structure
export interface TransactionDetailsProps {
  id: string;
  amount: number;
  netAmount: number | null;
  currency: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  customer: { name: string | null; email: string | null };
  paymentMethod: {
    brand: string | null;
    last4: string | null;
    country: string | null;
    funding: string | null;
  };
  timeline: {
    timestamp: string;
    status: string;
    title: string;
    description: string;
  }[];
  metadata: Record<string, any>;
  product: { id: string; name: string } | null;
}

export default function TransactionDetailsClient(props: TransactionDetailsProps) {
  const [currentStatus, setCurrentStatus] = useState(props.status);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleSyncStatus = async () => {
    setIsSyncing(true);
    toast.loading('Refreshing status...');
    const result = await syncTransactionStatus(props.id);
    toast.dismiss();

    if (result.success) {
      if (result.statusChanged && result.newStatus) {
        setCurrentStatus(result.newStatus);
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
    } else {
      toast.error(result.error);
    }
    setIsSyncing(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ... rest of interactive UI
}
```

**Key Rules:**
1. `page.tsx` = async server component, NO `'use client'`
2. Auth check + `redirect('/')` if unauthorized
3. Direct Prisma queries (or server actions) inside the async component
4. Transform DB data to **client-safe props** — convert Dates to ISO strings, strip sensitive fields
5. Render: `<ClientComponent {...clientProps} />`
6. Client component (same folder) handles all interactivity, mutations, toast, loading states
7. Props interface is exported from client component and imported by server page

---

## Pattern 4: Tabs (Settings Style)

**Rule:** Tabs use shadcn `Tabs` with controlled state. `TabsList` is a gray pill bar. Each `TabsContent` wraps a full `Card`. Server page fetches session, passes to client component containing all tabs logic.

### Server Wrapper

`app/dashboard/settings/page.tsx`

```tsx
// app/dashboard/settings/page.tsx
import SettingsPageComponent from '@/app/dashboard/settings/settings';
import { getSession, type User } from '@/app/actions/newAuth';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const response = await getSession();

  if (!response.success) return redirect('/');

  const userData = response.data;

  return (
    <>
      {userData ? (
        <SettingsPageComponent userDataProp={userData} />
      ) : (
        <div>Loading...</div>
      )}
    </>
  );
}
```

### Client Component with Tabs

`app/dashboard/settings/settings.tsx`

```tsx
'use client';
// app/dashboard/settings/settings.tsx

import { useState, useEffect, useRef } from 'react';
import {
  updateProfileAction,
  changePasswordAction,
  uploadProfileImageAction
} from '@/app/dashboard/settings/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertCircle, Upload, Bell, Key, Trash2, Fingerprint } from 'lucide-react';

type UserData = {
  id: string;
  name: string;
  email: string;
  image: string;
  metadata?: any;
};

interface SettingsPageProps {
  userDataProp: UserData;
}

export default function SettingsPageComponent({ userDataProp }: SettingsPageProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile form state
  const [name, setName] = useState(userDataProp.name || '');
  const [email, setEmail] = useState(userDataProp.email || '');
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [userImage, setUserImage] = useState<string | null>(userDataProp.image);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ... more state for other tabs

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileLoading(true);
    try {
      const result = await updateProfileAction({ name, email });
      if (result.success) {
        toast({ title: 'Profile updated', description: 'Your profile has been updated.' });
      } else {
        toast({ variant: 'destructive', title: 'Update failed', description: result.error });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Something went wrong' });
    } finally {
      setIsProfileLoading(false);
    }
  };

  return (
    <div className="container max-h-full sm:max-w-4xl py-3 sm:py-8 px-2 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Account Settings</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Pill-style tab bar */}
        <TabsList className="grid grid-cols-4 mb-2 sm:mb-8 bg-gray-100 rounded-xl p-1">
          <TabsTrigger
            value="profile"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
          >
            Security
          </TabsTrigger>
          <TabsTrigger
            value="passkeys"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
          >
            Passkeys
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
          >
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and profile settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
                <div className="flex flex-col items-center">
                  <Avatar className="w-24 h-24 mb-4 relative group">
                    <AvatarImage src={userImage || userDataProp.image} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xl font-medium">
                      {userDataProp.name ? userDataProp.name.substring(0, 2).toUpperCase() : 'U'}
                    </AvatarFallback>
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </Avatar>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                  >
                    {isUploadingImage ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-3 h-3 mr-1" /> Change Avatar</>
                    )}
                  </Button>
                </div>

                <form onSubmit={handleProfileUpdate} className="w-full space-y-4">
                  <div className="grid gap-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-10 rounded-xl border-gray-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 rounded-xl border-gray-200"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isProfileLoading}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {isProfileLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your password and security preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Form content */}
            </CardContent>
          </Card>
        </TabsContent>

        {/* More tabs... */}
      </Tabs>
    </div>
  );
}
```

**Key Rules:**
1. Server `page.tsx` — fetches session/data → passes to client component
2. Client `settings.tsx` — `'use client'`, contains all state, tabs, mutations
3. `TabsList` — `grid grid-cols-{n}` with `bg-gray-100 rounded-xl p-1`
4. `TabsTrigger` — `data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all`
5. `TabsContent` — always `className="mt-0"`, wraps a full `Card`
6. **Card** — `CardHeader` with `CardTitle` + `CardDescription`, `CardContent` with form + bottom-right action button
7. **Responsive** — `sm:max-w-4xl`, `sm:py-8`, `sm:text-3xl` on title

---

## Summary: The 4 Patterns

| # | Pattern | Where | Key Rule |
|---|---------|-------|----------|
| 1 | **Mobile/Desktop Split** | `useMediaQuery()` hook + conditional render | No `sm:/lg:` class soup |
| 2 | **Skeleton Loading** | Dedicated `*Skeleton` component + `renderSkeletons()` | Mimic exact layout, zero shift |
| 3 | **Server Component First** | Async `page.tsx` → client-safe props → `<Client {...props} />` | No `'use client'` in page.tsx |
| 4 | **Tabs** | Gray pill `TabsList` + `Card` per `TabsContent` | Always `mt-0`, Card with header + description |

**File Structure Convention:**
```
app/dashboard/[module]/page.tsx           → Server component (data fetch, auth)
app/dashboard/[module]/[id]/page.tsx      → Server component (detail fetch, auth)
app/dashboard/[module]/[id]/ClientComp.tsx → Client component (interactivity, state)
app/dashboard/[module]/actions.ts          → Server actions (mutations)
```
