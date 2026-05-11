<payouts>
  <!--
  This file contains a concatenated representation of a codebase.
  An <index> is provided below with the list of files included.
  To find the contents of a specific file, search for `<filename>` and `</filename>` tags.
  -->

  ## File Index

  ```
  <index>
    actions.ts
    page.tsx
    add/page.tsx
    retrieve/TransferForm.tsx
    retrieve/actions.ts
    retrieve/page.tsx
  </index>
  ```

  ---

  | # | File | Path | Lines | Tokens |
  |---|------|------|-------|--------|
  | 1 | [`actions.ts`](#actions-ts) | `./` | 909 | 5,830 |
  | 2 | [`page.tsx`](#page-tsx) | `./` | 617 | 4,736 |
  | 3 | [`page.tsx`](#add-page-tsx) | `add` | 791 | 5,798 |
  | 4 | [`TransferForm.tsx`](#retrieve-transferform-tsx) | `retrieve` | 767 | 6,335 |
  | 5 | [`actions.ts`](#retrieve-actions-ts) | `retrieve` | 859 | 5,226 |
  | 6 | [`page.tsx`](#retrieve-page-tsx) | `retrieve` | 548 | 4,642 |
  | | **Total** | | **4,491** | **32,567** |

  ---

  <actions.ts>

<a name="actions-ts"></a>
### `actions.ts`

```ts
// app/actions/payouts.ts
'use server';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/newAuth';
import { prisma } from '@/lib/prisma';
import type { $Enums } from '@prisma/client';

import { z } from 'zod';
import { countryList } from '@/app/actions/data'; // Assuming data.ts is in the same directory

// --- Configuration ---
// These values should be in your .env.local file.
// NEVER expose your API key in client-side code.
const WISE_API_URL = process.env.WISE_ENDPOINT;
const WISE_API_KEY = process.env.WISE_API_KEY;
const WISE_PROFILE_ID = process.env.WISE_BUSINESS_PROFILE_ID;

// --- Type Definitions (from the documentation) ---
// These types are derived directly from the 'account-requirements' response schema.

type QuoteResponseV2 = {
  sourceAmount: number;
  guaranteedTargetAmountAllowed: boolean;
  targetAmountAllowed: boolean;
  paymentOptions: Array<{
    formattedEstimatedDelivery: string;
    estimatedDeliveryDelays: Array<any>;
    allowedProfileTypes: Array<string>;
    feePercentage: number;
    estimatedDelivery: string;
    disabled: boolean;
    sourceAmount: number;
    targetAmount: number;
    sourceCurrency: string;
    targetCurrency: string;
    payOut: string;
    payIn: string;
    price: {
      priceSetId: number;
      total: {
        type: string;
        label: string;
        value: {
          amount: number;
          currency: string;
          label: string;
        };
      };
      items: Array<{
        type: string;
        label: string;
        value: {
          amount: number;
          currency: string;
          label: string;
        };
      }>;
      priceDecisionReferenceId: string;
    };
    fee: {
      transferwise: number;
      payIn: number;
      discount: number;
      total: number;
      priceSetId: number;
      partner: number;
    };
  }>;
  notices: Array<any>;
  transferFlowConfig: {
    highAmount: {
      showFeePercentage: boolean;
      trackAsHighAmountSender: boolean;
      showEducationStep: boolean;
      offerPrefundingOption: boolean;
      overLimitThroughCs: boolean;
      overLimitThroughWiseAccount: boolean;
    };
  };
  rateTimestamp: string;
  clientId: string;
  expirationTime: string;
  id: string;
  type: string;
  status: string;
  user: number;
  profile: number;
  rate: number;
  sourceCurrency: string;
  targetCurrency: string;
  createdTime: string;
  rateType: string;
  rateExpirationTime: string;
  payOut: string;
  guaranteedTargetAmount: boolean;
  providedAmountType: string;
  payInCountry: string;
  funding: string;
};

export type RecipientReqFieldType = {
  key: string;
  name: string;
  type: 'text' | 'select' | 'radio' | 'date';
  refreshRequirementsOnChange: boolean;
  required: boolean;
  example: string;
  validationRegexp?: string;
  valuesAllowed?: Array<{ key: string; name: string }>;
};

export type RecipientReqType = {
  type: string;
  title: string;
  fields: Array<{
    name: string;
    group: RecipientReqFieldType[];
  }>;
};

type RecipientListObjectV2 = {
  content: Array<RecipientObjectV2>;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  size: number;
};

type RecipientObjectV2 = {
  id: number;
  creatorId: number;
  profileId?: number;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
    middleName: string;
    patronymicName: string;
    cannotHavePatronymicName: any;
  };
  address?: {
    country: string;
    firstLine: string;
    postCode: string;
    city: string;
    state?: string;
  };
  currency: string;
  country: string;
  type: string;
  legalEntityType: string;
  active: boolean;
  details: {
    accountNumber: string;
    hashedByLooseHashAlgorithm: string;
    abartn?: string;
    accountType?: string;
  };
  commonFieldMap: {
    accountNumberField: string;
    bankCodeField?: string;
  };
  isDefaultAccount: boolean;
  hash: string;
  accountSummary: string;
  longAccountSummary: string;
  displayFields: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  isInternal: boolean;
  ownedByCustomer: boolean;
  email?: string;
  error: any | null;
};

type RecipientDetailsV1 = {
  address: {
    country: string;
    countryCode: string;
    firstLine: string;
    postCode: string;
    city: string;
    state: string;
  };
  email: string | null;
  legalType: 'PRIVATE' | 'BUSINESS' | string; // Often 'PRIVATE' or 'BUSINESS'
  accountHolderName: string | null;
  accountNumber: string;
  sortCode: string | null;
  abartn: string | null; // ABA routing number for US accounts
  accountType: string | null; // e.g., 'CHECKING', 'SAVINGS'
  bankgiroNumber: string | null;
  ifscCode: string | null;
  bsbCode: string | null;
  institutionNumber: string | null;
  transitNumber: string | null;
  phoneNumber: string | null;
  bankCode: string | null;
  russiaRegion: string | null;
  routingNumber: string | null; // Often a synonym for abartn
  branchCode: string | null;
  cpf: string | null;
  cardToken: string | null;
  idType: string | null;
  idNumber: string | null;
  idCountryIso3: string | null;
  idValidFrom: string | null;
  idValidTo: string | null;
  clabe: string | null;
  swiftCode: string | null;
  dateOfBirth: string | null; // Format: 'YYYY-MM-DD'
  clearingNumber: string | null;
  bankName: string | null;
  branchName: string | null;
  businessNumber: string | null;
  province: string | null;
  city: string | null;
  rut: string | null;
  token: string | null;
  cnpj: string | null;
  payinReference: string | null;
  pspReference: string | null;
  orderId: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  identificationNumber: string | null;
  targetProfile: number | null;
  targetUserId: number | null;
  taxId: string | null;
  job: string | null;
  nationality: string | null;
  interacAccount: string | null;
  bban: string | null;
  town: string | null;
  postCode: string | null;
  language: string | null;
  billerCode: string | null;
  customerReferenceNumber: string | null;
  prefix: string | null;
  relationship: string | null;
  IBAN: string | null;
  iban: string | null;
  bic: string | null;
  BIC: string | null;
};

/**
 * The main type for the response from the Wise 'Create Recipient' endpoint.
 */
export type RecipientResponseTypeV1 = {
  id: number;
  business: number | null; // Can be a business ID or null
  profile: number;
  accountHolderName: string;
  currency: string;
  country: string;
  type: string; // e.g., 'aba', 'iban', 'swift'
  details: RecipientDetailsV1;
  user: number;
  active: boolean;
  ownedByCustomer: boolean;
  confirmations: any | null; // Type is unknown, so 'any' is a safe bet
  errors: any | null;
};

/**
 * Fetches all payout recipients for the current user
 */
export async function getPayoutRecipients() {
  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const recipients = await prisma.payout_recipients.findMany({
      where: {
        user_id: session.data.id,
        is_active: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return {
      success: true,
      recipients
    };
  } catch (error) {
    console.error('Error fetching recipients:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

//

/**
 * List all payouts for the current user
 */
export async function listPayouts(): Promise<
  | {
      success: false;
      error: string;
      payouts?: undefined;
    }
  | {
      success: true;
      payouts: {
        id: string;
        createdAt: Date;
        amount: number;
        currency: string;
        status: $Enums.TransactionStatus;
        finalPayoutAmount: number | null;
        wiseTransferId: string | null;
        recipientName: string;
        recipientAccount: any;
      }[];
      error?: undefined;
    }
> {
  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const payouts = await prisma.transaction.findMany({
      where: {
        userId: session.data.id,
        // Only get transactions that have been initiated for payout
        OR: [
          { status: 'PAYOUT_READY' },
          { status: 'PAYOUT_PROCESSING' },
          { status: 'PAYOUT_COMPLETED' },
          { status: 'PAYOUT_FAILED' },
          { wiseTransferId: { not: null } }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    // For each payout, get the recipient details if available
    const enhancedPayouts = await Promise.all(
      payouts.map(async (payout) => {
        let recipientName = '';
        let recipientAccount = null;

        if (payout.wiseRecipientId) {
          try {
            const recipient = await prisma.payout_recipients.findFirst({
              where: {
                wise_recipient_id: payout.wiseRecipientId,
                user_id: session.data.id
              }
            });

            if (recipient) {
              recipientName = `${recipient.account_holder_name}`;
              recipientAccount =
                recipient.account_summary || `${recipient.currency} account`;
            }
          } catch (error) {
            console.error('Error fetching recipient details:', error);
          }
        }

        return {
          id: payout.id,
          createdAt: payout.createdAt,
          amount: payout.amount,
          currency: payout.currency,
          status: payout.status,
          finalPayoutAmount: payout.finalPayoutAmount,
          wiseTransferId: payout.wiseTransferId,
          recipientName,
          recipientAccount
        };
      })
    );

    return {
      success: true,
      payouts: enhancedPayouts
    };
  } catch (error) {
    console.error('Error listing payouts:', error);
    return { success: false, error: 'Failed to list payouts' };
  }
}

/**
 * List all payout recipients for the current user
 */
export async function listRecipients(): Promise<
  | {
      success: false;
      error: string;
      recipients?: undefined;
    }
  | {
      success: true;
      recipients: {
        id: string;
        accountHolderName: string;
        accountType: string;
        accountSummary: string;
        longAccountSummary: string;
        currency: string;
        displayDetails: string;
        isActive: boolean;
        isDefault: boolean;
        createdAt: Date;
      }[];
      error?: undefined;
    }
> {
  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const recipients = await prisma.payout_recipients.findMany({
      where: {
        user_id: session.data.id,
        is_active: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return {
      success: true,
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        accountHolderName: `${recipient.account_holder_name}`,
        accountType: recipient.account_type,
        accountSummary: recipient.account_summary ?? '',
        longAccountSummary: recipient.long_account_summary ?? '',
        currency: recipient.currency,
        displayDetails: recipient.account_summary ?? '',
        isActive: recipient.is_active || false,
        isDefault: recipient.is_default || false,
        createdAt: recipient.created_at || new Date()
      }))
    };
  } catch (error: any) {
    console.error('Error listing recipients:', error);
    return { success: false, error: 'Failed to list recipients' };
  }
}

/**
 * Get payout statistics for the current user
 */
export async function getPayoutStats(): Promise<
  | {
      success: false;
      error: string;
      availableAmount: number;
      processingAmount: number;
      last30DaysAmount: number;
      readyCount: number;
      processingCount: number;
      last30DaysCount: number;
    }
  | {
      success: true;
      availableAmount: number;
      processingAmount: number;
      last30DaysAmount: number;
      readyCount: number;
      processingCount: number;
      last30DaysCount: number;
      error?: undefined;
    }
> {
  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return {
        success: false,
        error: 'Not authenticated',
        availableAmount: 0,
        processingAmount: 0,
        last30DaysAmount: 0,
        readyCount: 0,
        processingCount: 0,
        last30DaysCount: 0
      };
    }

    // Get available amount (PAYOUT_READY)
    const readyTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.data.id,
        status: 'PAYOUT_READY'
      }
    });

    const availableAmount = readyTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    // Get processing amount (PAYOUT_PROCESSING)
    const processingTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.data.id,
        status: 'PAYOUT_PROCESSING'
      }
    });

    const processingAmount = processingTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    // Get last 30 days completed payouts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const last30DaysTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.data.id,
        status: 'PAYOUT_COMPLETED',
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    const last30DaysAmount = last30DaysTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    return {
      success: true,
      availableAmount,
      processingAmount,
      last30DaysAmount,
      readyCount: readyTransactions.length,
      processingCount: processingTransactions.length,
      last30DaysCount: last30DaysTransactions.length
    };
  } catch (error) {
    console.error('Error getting payout stats:', error);
    return {
      success: false,
      error: 'Failed to get payout statistics',
      availableAmount: 0,
      processingAmount: 0,
      last30DaysAmount: 0,
      readyCount: 0,
      processingCount: 0,
      last30DaysCount: 0
    };
  }
}

/**
 * Set a recipient as the default for a user
 */
export async function setDefaultRecipient(recipientId: string) {
  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // First, unset any existing default
    await prisma.payout_recipients.updateMany({
      where: {
        user_id: session.data.id,
        is_default: true
      },
      data: {
        is_default: false
      }
    });

    // Then set the new default
    await prisma.payout_recipients.update({
      where: {
        id: recipientId,
        user_id: session.data.id
      },
      data: {
        is_default: true
      }
    });

    revalidatePath('/dashboard1/payout');
    return { success: true };
  } catch (error) {
    console.error('Error setting default recipient:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Deactivate a recipient (soft delete)
 */
export async function deactivateRecipient(recipientId: string) {
  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    await prisma.payout_recipients.update({
      where: {
        id: recipientId,
        user_id: session.data.id
      },
      data: {
        is_active: false
      }
    });

    revalidatePath('/dashboard1/payout');
    return { success: true };
  } catch (error) {
    console.error('Error deactivating recipient:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper function to transform flat object with dot notation keys into a nested structure
 * Example: { "address.city": "New York" } -> { address: { city: "New York" } }
 */
function processNestedFields(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      if (!result[parent]) {
        result[parent] = {};
      }
      result[parent][child] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

// STEP 1 & 2: Get a Quote and Fetch Initial Requirements.

export async function getInitialRequirements(targetCurrency: string) {
  // Validate that the currency is one we support in our UI
  if (!countryList.some((c) => c.currencyCode === targetCurrency)) {
    return { success: false, error: 'Unsupported currency selected.' };
  }

  try {
    // Step 1: Create a temporary quote to get a quoteId.
    const quoteResponse = await fetch(`${WISE_API_URL}/v2/quotes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WISE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceCurrency: 'USD',
        targetCurrency,
        sourceAmount: 100, // A nominal amount is sufficient.
        profile: WISE_PROFILE_ID
      })
    });
    if (!quoteResponse.ok)
      throw new Error(
        `Failed to create Wise quote: ${await quoteResponse.text()}`
      );
    const quote: QuoteResponseV2 = await quoteResponse.json();

    // Step 2: Use the quoteId to get the initial dynamic form schema.
    const requirementsResponse = await fetch(
      `${WISE_API_URL}/v1/quotes/${quote.id}/account-requirements`,
      {
        headers: { Authorization: `Bearer ${WISE_API_KEY}` }
      }
    );
    if (!requirementsResponse.ok)
      throw new Error(
        `Failed to fetch requirements: ${await requirementsResponse.text()}`
      );
    const requirements: RecipientReqType[] = await requirementsResponse.json();

    return { success: true, data: { quoteId: quote.id, requirements } };
  } catch (error) {
    console.error('getInitialRequirements Error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred.'
    };
  }
}

// * Creates a Wise recipient and then fetches the full v2 recipient object  to store in the local database.

export async function createRecipientAction(formData: { [key: string]: any }) {
  const session = await getSession();
  if (!session?.data?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  // Use Zod for strict backend validation before hitting the Wise API.
  const payloadSchema = z
    .object({
      currency: z.string(),
      type: z.string(),
      accountHolderName: z.string().min(1, 'Account holder name is required.')
    })
    .passthrough();

  const validation = payloadSchema.safeParse(formData);
  if (!validation.success)
    return { success: false, error: 'Invalid form data provided.' };

  // Structure the payload for the v1 creation endpoint.
  const { type, currency, accountHolderName, ...flatDetails } = validation.data;
  const details = processNestedFields(flatDetails); // Assuming this helper function exists

  const wisePayload = {
    profile: WISE_PROFILE_ID,
    accountHolderName,
    currency: currency.toUpperCase(),
    type,
    ownedByCustomer: false,
    details
  };

  console.log(
    'Submitting to POST /v1/accounts:',
    JSON.stringify(wisePayload, null, 2)
  );

  try {
    // STEP 1: Create the recipient using the v1 endpoint.
    const v1Response = await fetch(`${WISE_API_URL}/v1/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WISE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(wisePayload)
    });

    // The v1 response is minimal and not ideal for storing.
    const v1Data: RecipientResponseTypeV1 = await v1Response.json();

    if (!v1Response.ok) {
      const errorMessage =
        v1Data.errors?.[0]?.message ||
        'An unknown error occurred during recipient creation.';
      throw new Error(`Wise API Error (v1 Create): ${errorMessage}`);
    }

    const newRecipientId = v1Data.id;
    if (!newRecipientId) {
      console.log(
        'wise v1/accounts quote issue- no newRecipientId',
        JSON.stringify(v1Data, null, 2)
      );
      throw new Error('Wise did not return a recipient ID after creation.');
    }
    console.log(
      `Recipient created with ID: ${newRecipientId}. Fetching v2 details...`
    );

    // STEP 2: Fetch the rich v2 recipient object using the ID from the previous step.
    const v2Response = await fetch(
      `${WISE_API_URL}/v2/accounts/${newRecipientId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${WISE_API_KEY}` }
      }
    );

    const v2RecipientData: RecipientObjectV2 = await v2Response.json();

    if (!v2Response.ok) {
      const errorMessage =
        v2RecipientData.error?.[0]?.message ||
        'Failed to fetch full recipient details after creation.';
      throw new Error(`Wise API Error (v2 Fetch): ${errorMessage}`);
    }
    console.log(
      'Successfully fetched v2 Recipient Object:',
      JSON.stringify(v2RecipientData, null, 2)
    );

    // STEP 3: Save the rich v2 data to your own database using Prisma.
    await prisma.payout_recipients.create({
      data: {
        user_id: session.data.id,
        // Ensure you convert the number ID to BigInt for Prisma
        wise_recipient_id: `${v2RecipientData.id}`,
        // Now populate your DB with the clean, rich data from the v2 object
        account_holder_name: v2RecipientData.name.fullName,
        email: v2RecipientData.email, // Will be null if not present
        currency: v2RecipientData.currency,
        account_type: v2RecipientData.type,
        account_summary: v2RecipientData.accountSummary,
        long_account_summary: v2RecipientData.longAccountSummary,
        // Safely access optional address fields using optional chaining (?.)
        address_country: v2RecipientData.address?.country,
        address_first_line: v2RecipientData.address?.firstLine,
        address_post_code: v2RecipientData.address?.postCode,
        address_city: v2RecipientData.address?.city,
        address_state: v2RecipientData.address?.state,
        // Store the full, rich v2 response for future reference or debugging
        raw_wise_response: v2RecipientData
      }
    });

    // Use the name from the rich object for the success message
    return {
      success: true,
      message: `Recipient for ${v2RecipientData.name.fullName} created!`
    };
  } catch (error) {
    console.error('createRecipientAction Error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to create recipient.'
    };
  }
}

// STEP 3: Refresh Requirements When a Critical Field Changes.

export async function refreshRequirements(
  quoteId: string,
  type: string,
  details: object
): Promise<
  | {
      success: true;
      data: {
        requirements: RecipientReqType[];
      };
      error?: undefined;
    }
  | {
      success: false;
      error: string;
      data?: undefined;
    }
> {
  try {
    // Process the details to ensure nested fields are properly structured
    const processedDetails = processNestedFields(details);

    // This POST request sends the partial data to get an updated form schema.
    const response = await fetch(
      `${WISE_API_URL}/v1/quotes/${quoteId}/account-requirements`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WISE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, details: processedDetails })
      }
    );

    if (!response.ok)
      throw new Error(
        `Failed to refresh requirements: ${await response.text()}`
      );
    const requirements: RecipientReqType[] = await response.json();
    return { success: true, data: { requirements } };
  } catch (error) {
    console.error('refreshRequirements Error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred.'
    };
  }
}
```

  </actions.ts>

  <page.tsx>

<a name="page-tsx"></a>
### `page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  PlusCircle,
  RefreshCcw,
  Download,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  ArrowUpRight,
  CreditCard,
  Building,
  AlertCircle,
  Star
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  listPayouts,
  listRecipients,
  getPayoutStats,
  setDefaultRecipient,
  deactivateRecipient
} from '@/app/dashboard/payouts/actions';
import type { $Enums } from '@prisma/client';
import { countryList } from '@/app/actions/data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export default function PayoutsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('recipients');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ProductStatCard = ({
    label,
    count,
    isActive
  }: {
    label: string;
    count: number;
    isActive: boolean;
  }) => (
    <div
      className={`p-4 rounded-lg w-full ${isActive ? 'border-2 border-indigo-600' : 'border border-gray-200'}`}
    >
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-2xl font-semibold text-gray-800">{count}</p>
    </div>
  );
  const [recipients, setRecipients] = useState<
    | {
        id: string;
        accountHolderName: string;
        currency: string;
        accountType: string;
        accountSummary: string;
        longAccountSummary: string;
        displayDetails: any;
        isActive: boolean;
        isDefault: boolean;
        createdAt: Date;
      }[]
    | []
  >([]);
  const [payouts, setPayouts] = useState<
    | {
        id: string;
        createdAt: Date;
        amount: number;
        currency: string;
        status: $Enums.TransactionStatus;
        finalPayoutAmount: number | null;
        wiseTransferId: string | null;
        recipientName: string;
        recipientAccount: any;
      }[]
    | []
  >([]);
  const [stats, setStats] = useState({
    availableAmount: 0,
    processingAmount: 0,
    last30DaysAmount: 0,
    readyCount: 0,
    processingCount: 0,
    last30DaysCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all necessary data in parallel
      const [recipientsResult, payoutsResult, statsResult] = await Promise.all([
        listRecipients(),
        listPayouts(),
        getPayoutStats()
      ]);

      if (recipientsResult.success) {
        setRecipients(recipientsResult.recipients);
      } else {
        console.error('Failed to load recipients:', recipientsResult.error);
      }

      if (payoutsResult.success) {
        let b = payoutsResult.payouts;
        setPayouts(payoutsResult.payouts);
      } else {
        console.error('Failed to load payouts:', payoutsResult.error);
      }

      if (statsResult.success) {
        setStats({
          availableAmount: statsResult.availableAmount,
          processingAmount: statsResult.processingAmount,
          last30DaysAmount: statsResult.last30DaysAmount,
          readyCount: statsResult.readyCount,
          processingCount: statsResult.processingCount,
          last30DaysCount: statsResult.last30DaysCount
        });
      } else {
        console.error('Failed to load stats:', statsResult.error);
      }
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleSetDefault = async (recipientId: string) => {
    try {
      const result = await setDefaultRecipient(recipientId);
      if (result.success) {
        // Update the recipients list to reflect the change
        setRecipients((prev) =>
          prev.map((r) => ({
            ...r,
            isDefault: r.id === recipientId
          }))
        );
      } else {
        setError(result.error || 'Failed to set default recipient');
      }
    } catch (err) {
      setError('An error occurred while setting default recipient');
      console.error(err);
    }
  };

  const handleDeactivate = async (recipientId: string) => {
    if (!confirm('Are you sure you want to remove this payout account?'))
      return;

    try {
      const result = await deactivateRecipient(recipientId);
      if (result.success) {
        // Remove the recipient from the list
        setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
      } else {
        setError(result.error || 'Failed to remove recipient');
      }
    } catch (err) {
      setError('An error occurred while removing the recipient');
      console.error(err);
    }
  };

  // Helper function to render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYOUT_COMPLETED':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            Completed
          </Badge>
        );
      case 'PAYOUT_PROCESSING':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            Processing
          </Badge>
        );
      case 'PAYOUT_FAILED':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            Failed
          </Badge>
        );
      case 'PAYOUT_READY':
        return <Badge variant="outline">Ready</Badge>;
      default:
        return <Badge variant="outline">{status.replace('PAYOUT_', '')}</Badge>;
    }
  };

  return (
    <div className="py-2 space-y-2">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-950">
          Payouts
        </h1>
        <div className="flex gap-1 sm:gap-2">
          <Button variant="outline" size="sm" className="px-2 sm:px-3">
            <Download className="sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="default" size="sm" asChild className="px-2 sm:px-3">
            <Link href="/dashboard/payouts/retrieve">
              <ArrowUpRight className="sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Withdraw Funds</span>
              <span className="sm:hidden">Withdraw</span>
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Stats Cards */}

      <div className="grid grid-cols-1  gap-4 mb-6">
        <div className="grid grid-cols-3  gap-2 md:gap-4">
          <Card>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-500">
                Payout Ready
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 justify-center items center sm:p-6 sm:pt-0">
              {isLoading ? (
                <div className="h-5 sm:h-6 w-24 sm:w-32 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                <>
                  <div className=" text-1xl  sm:text-2xl font-bold">
                    {formatCurrency(stats.availableAmount, 'USD')}
                  </div>
                  <p className="text-[10px] hidden sm:block sm:text-xs text-gray-500 mt-1">
                    {stats.readyCount} transaction ready for payout
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-500">
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 justify-center items center sm:p-6 sm:pt-0">
              {isLoading ? (
                <div className="h-5 sm:h-6 w-24 sm:w-32 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                <>
                  <div className="text-1xl  sm:text-2xl font-bold">
                    {formatCurrency(stats.processingAmount, 'USD')}
                  </div>
                  <p className="hidden sm:block text-[10px] sm:text-xs text-gray-500 mt-1">
                    Expected within 24 hours
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-500">
                Last 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 justify-center items center sm:p-6 sm:pt-0">
              {isLoading ? (
                <div className="h-5 sm:h-6 w-24 sm:w-32 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                <>
                  <div className="text-1xl  sm:text-2xl font-bold">
                    {formatCurrency(stats.last30DaysAmount, 'USD')}
                  </div>
                  <p className="hidden sm:block text-[10px] sm:text-xs text-gray-500 mt-1">
                    {stats.last30DaysCount} successful payouts
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-2 w-full justify-start">
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
        </TabsList>

        {/* Recipients Tab */}
        <TabsContent value="recipients" className="space-y-2">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row pb-2 sm:items-center justify-between gap-2">
              <div className="flex flex-col space-y-1 sm:space-y-2">
                <CardTitle className="text-base sm:text-lg">
                  Recipient Accounts
                </CardTitle>
                <CardDescription>
                  Bank accounts you can send money to
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-9 w-9"
                  >
                    <RefreshCcw
                      className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                    />
                  </Button>
                  {recipients.length > 0 && (
                    <Button size="sm" asChild className="h-9">
                      <Link href="/dashboard/payouts/add">
                        <PlusCircle className="sm:mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Add Recipient</span>
                        <span className="sm:hidden">Add</span>
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="border rounded-md p-4 flex justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                        <div>
                          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2"></div>
                        </div>
                      </div>
                      <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : recipients.length > 0 ? (
                <div className="rounded-md border overflow-x-auto overflow-hidden">
                  {recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-full">
                          <Building className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {recipient.accountHolderName}
                            </p>
                            <Badge variant="outline">
                              {recipient.currency}
                            </Badge>
                            {recipient.isDefault && (
                              <Badge
                                variant="secondary"
                                className="bg-amber-50 text-amber-700 border-amber-200"
                              >
                                <Star className="w-3 h-3 mr-1" /> Default
                              </Badge>
                            )}
                            {countryList.find(
                              (c) => c.currencyCode === recipient.currency
                            ) && (
                              <span className="text-lg">
                                {
                                  countryList.find(
                                    (c) => c.currencyCode === recipient.currency
                                  )?.flag
                                }
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {recipient.accountType}
                            {recipient.accountSummary ||
                              recipient.longAccountSummary}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild className="flex-shrink-0">
                          <Button variant="ghost" className="h-8 w-8 p-0 ml-2">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={recipient.isDefault}
                            onClick={() => {
                              if (!recipient.isDefault) {
                                handleSetDefault(recipient.id);
                              }
                            }}
                          >
                            Set as Default
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(recipient.id)}
                            className="text-red-500 focus:text-red-500"
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12 px-4">
                  <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-md font-semibold text-gray-800">
                    No payout accounts found
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-4">
                    Add a new bank account to start withdrawing your funds.
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/payouts/add">
                      <PlusCircle className="w-4 h-4 mr-2" /> Add payout account
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-2">
          <Card>
            <CardHeader className="pb-2 flex flex-col sm:flex-row justify-between gap-2">
              <div className="flex flex-col space-y-1 sm:space-y-2">
                <CardTitle className="text-base sm:text-lg">
                  Payout History
                </CardTitle>
                <CardDescription>
                  View all payouts to your accounts
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="self-end"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="rounded-md border">
                  <div className="h-10 w-full bg-gray-100 border-b flex items-center px-4">
                    <div className="h-4 w-full grid grid-cols-5 gap-4">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="h-4 bg-gray-200 rounded animate-pulse"
                        ></div>
                      ))}
                    </div>
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 w-full border-b last:border-0 px-4 flex items-center"
                    >
                      <div className="h-4 w-full grid grid-cols-5 gap-4">
                        {[...Array(5)].map((_, j) => (
                          <div
                            key={j}
                            className="h-4 bg-gray-200 rounded animate-pulse"
                          ></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : payouts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right pr-2 sm:pr-6">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>{formatDate(payout.createdAt)}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payout.amount, payout.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{payout.recipientName || 'Unknown'}</span>
                            <span className="text-xs text-gray-500">
                              {payout.recipientAccount || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(payout.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              href={`/dashboard/payout/history/${payout.id}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 sm:py-12 px-4">
                  <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-md font-semibold text-gray-800">
                    No payout history found
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-4">
                    Add a new bank account to start initating payouts.
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/payouts/add">
                      <PlusCircle className="w-4 h-4 mr-2" /> Add payout account
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

  </page.tsx>

  <add/page.tsx>

<a name="add-page-tsx"></a>
### `add/page.tsx`

```tsx
'use client';
// app/payouts/add/page.tsx ( Adds recipient account without form element)
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';

// shadcn/ui imports
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';

// Server actions
import { countryList } from '@/app/actions/data';
import {
  getInitialRequirements,
  createRecipientAction,
  refreshRequirements
} from '@/app/dashboard/payouts/actions';
import { Loader2, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────
export type RequirementField = {
  key: string;
  name: string;
  type: 'text' | 'select' | 'radio' | 'date';
  refreshRequirementsOnChange: boolean;
  required: boolean;
  example: string;
  validationRegexp?: string;
  valuesAllowed?: Array<{ key: string; name: string }>;
};

export type RequirementType = {
  type: string;
  title: string;
  fields: Array<{
    name: string;
    group: RequirementField[];
  }>;
};

// ─── Custom Alert Component (Stripe-like) ────────────────────────────
const StripeAlert = ({
  variant,
  title,
  children
}: {
  variant: 'destructive' | 'success';
  title: string;
  children: React.ReactNode;
}) => {
  const baseClasses = 'flex items-start p-4 rounded-md border';
  const variantClasses = {
    destructive: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-700'
  };
  const iconClasses = {
    destructive: 'text-red-500',
    success: 'text-green-500'
  };
  const Icon = variant === 'destructive' ? AlertCircle : CheckCircle;

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      <Icon className={`h-5 w-5 mr-3 mt-0.5 ${iconClasses[variant]}`} />
      <div>
        <h5 className="font-semibold">{title}</h5>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};

// ─── Utility: Nest Flat Payload for Server ─────────────────────────────
function processNestedFields(payload: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      result[parent] = result[parent] || {};
      result[parent][child] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Main Component ────────────────────────────────────────────────────
export default function PayoutRecipientAdditionPage() {
  // 1️⃣ Currency and all "forms" from server
  const [targetCurrency, setTargetCurrency] = useState<string>('');
  const [requirementTypes, setRequirementTypes] = useState<RequirementType[]>(
    []
  );
  const [quoteId, setQuoteId] = useState<string | null>(null);

  // 2️⃣ Active tab/requirement type + loading flags
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [tabLoading, setTabLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // 3️⃣ Visible groups → their fields
  const [visibleGroups, setVisibleGroups] = useState<
    Record<string, RequirementField[]>
  >({});

  // 4️⃣ Field values
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // 5️⃣ Field-specific errors (regex mismatches)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 6️⃣ Which field is mid-refresh
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);

  // 7️⃣ Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [successMessage, setSuccessMessage] = useState<string | undefined>(
    undefined
  );

  // ────────────────────────────────────────────────────────────────
  // On mount: initialize with first currency in list
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (countryList.length > 0 && !targetCurrency) {
      setTargetCurrency(countryList[0].currencyCode);
    }
  }, [targetCurrency]);

  // ────────────────────────────────────────────────────────────────
  // When currency changes: load initial requirements
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetCurrency) return;

    async function fetchRequirementsForCurrency() {
      setIsInitialLoading(true);
      setError(undefined);
      setSuccessMessage(undefined);

      try {
        const result = await getInitialRequirements(targetCurrency);
        if (result.success && result.data) {
          setQuoteId(result.data.quoteId);
          setRequirementTypes(result.data.requirements);
          setActiveIndex(0);

          if (result.data.requirements.length) {
            initializeForm(result.data.requirements[0]);
          }
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load requirements'
        );
      } finally {
        setIsInitialLoading(false);
      }
    }

    fetchRequirementsForCurrency();
  }, [targetCurrency]);

  // ────────────────────────────────────────────────────────────────
  // When tab clicked: show skeleton then init that form
  // ────────────────────────────────────────────────────────────────
  function handleTabClick(idx: number) {
    setTabLoading(true);
    setActiveIndex(idx);
  }

  useEffect(() => {
    const chosen = requirementTypes[activeIndex];
    if (chosen) initializeForm(chosen);

    // Ensure skeleton shows briefly
    const t = setTimeout(() => setTabLoading(false), 200);
    return () => clearTimeout(t);
  }, [activeIndex, requirementTypes]);

  // ────────────────────────────────────────────────────────────────
  // Init form: build visibleGroups + preserve or seed fieldValues
  // ────────────────────────────────────────────────────────────────
  function initializeForm(form: RequirementType) {
    const groups: Record<string, RequirementField[]> = {};
    const values = { ...fieldValues };
    const errors = { ...fieldErrors };

    // Always include accountHolderName in form values
    if (!values['accountHolderName']) values['accountHolderName'] = '';
    if (!values['legalType']) values['legalType'] = 'PRIVATE';

    form.fields.forEach(({ name, group }) => {
      groups[name] = group;
      group.forEach((f) => {
        // Seed missing values/errors
        if (!(f.key in values)) values[f.key] = '';
        if (!(f.key in errors)) errors[f.key] = '';
      });
    });

    // Clean up any values that are no longer in the form
    const allFieldKeys = Object.values(groups).flatMap((fields) =>
      fields.map((f) => f.key)
    );

    // Add accountHolderName and legalType to the allowed keys
    allFieldKeys.push('accountHolderName', 'legalType');

    const allowedKeys = new Set(allFieldKeys);

    Object.keys(values).forEach((key) => {
      if (!allowedKeys.has(key)) {
        delete values[key];
        delete errors[key];
      }
    });

    setVisibleGroups(groups);
    setFieldValues(values);
    setFieldErrors(errors);
    setRefreshingKey(null);
  }

  // ────────────────────────────────────────────────────────────────
  // Debounced server refresh (500ms)
  // ────────────────────────────────────────────────────────────────
  const debouncedRefresh = useDebouncedCallback(
    async (key: string, value: string) => {
      setRefreshingKey(key);

      if (!quoteId) return;
      const type = requirementTypes[activeIndex].type;
      const payload = processNestedFields({ [key]: value });

      try {
        const res = await refreshRequirements(quoteId, type, payload);
        if (!res.success || !res.data) {
          setError(res.error);
          setRefreshingKey(null);
          return;
        }

        // Update schema with new requirements
        const updatedForm = res.data.requirements[activeIndex];
        const newGroups: Record<string, RequirementField[]> = {};
        const newValues = { ...fieldValues };
        const newErrors = { ...fieldErrors };

        updatedForm.fields.forEach(({ name, group }) => {
          newGroups[name] = group;
          group.forEach((f) => {
            if (!(f.key in newValues)) newValues[f.key] = '';
            if (!(f.key in newErrors)) newErrors[f.key] = '';
          });
        });

        // Prune removed keys (excluding accountHolderName and legalType)
        const allowed = new Set([
          ...Object.values(newGroups).flatMap((fields) =>
            fields.map((f) => f.key)
          ),
          'accountHolderName',
          'legalType'
        ]);

        Object.keys(newValues).forEach((k) => {
          if (!allowed.has(k)) {
            delete newValues[k];
            delete newErrors[k];
          }
        });

        setVisibleGroups(newGroups);
        setFieldValues(newValues);
        setFieldErrors(newErrors);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to refresh requirements'
        );
      } finally {
        setRefreshingKey(null);
      }
    },
    500,
    { leading: false, trailing: true }
  );

  // ────────────────────────────────────────────────────────────────
  // On user edit: update value + validate + possibly refresh
  // ────────────────────────────────────────────────────────────────
  function onFieldChange(field: RequirementField, val: string) {
    // 1) Update value
    setFieldValues((prev) => ({ ...prev, [field.key]: val }));

    // 2) Run regex validation if provided
    if (field.validationRegexp) {
      try {
        const re = new RegExp(field.validationRegexp);
        const ok = re.test(val);
        console.log('validation field :', field.validationRegexp, 'val ', val);

        if (!ok) {
          console.log(
            'validation triggered regex:',
            field.validationRegexp,
            'val ',
            val
          );
          setFieldErrors((prev) => ({
            ...prev,
            [field.key]: ok ? '' : 'Value does not match required format.'
          }));
        }
      } catch {
        // Invalid regexp → skip
        setFieldErrors((prev) => ({ ...prev, [field.key]: '' }));
      }
    }

    // 3) Only refresh server if needed **and** no validation error
    if (
      field.refreshRequirementsOnChange &&
      (!field.validationRegexp || fieldErrors[field.key] === '')
    ) {
      debouncedRefresh(field.key, val);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Handle standard field changes (accountHolderName, legalType)
  // ────────────────────────────────────────────────────────────────
  function handleStandardFieldChange(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));

    if (key === 'accountHolderName' && !value) {
      setFieldErrors((prev) => ({
        ...prev,
        [key]: 'Account holder name is required'
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Validate all required fields and return if form is valid
  // ────────────────────────────────────────────────────────────────
  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Validate accountHolderName (always required)
    if (!fieldValues.accountHolderName) {
      newErrors['accountHolderName'] = 'Account holder name is required';
      isValid = false;
    }

    // Validate all visible fields from current requirement type
    const allFields = Object.values(visibleGroups).flat();

    allFields.forEach((field) => {
      const value = fieldValues[field.key] || '';

      // Check required fields
      if (field.required && !value) {
        newErrors[field.key] = 'This field is required';
        isValid = false;
      }
      // Check validation regex if present
      else if (field.validationRegexp && value) {
        try {
          const re = new RegExp(field.validationRegexp);
          if (!re.test(value)) {
            newErrors[field.key] = 'Value does not match required format';
            isValid = false;
          }
        } catch {
          // Invalid regex, skip
        }
      }
    });

    setFieldErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  }

  // ────────────────────────────────────────────────────────────────
  // Handle form submission
  // ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(undefined);
    setSuccessMessage(undefined);

    // Validate the form first
    if (!validateForm()) {
      setError('Please fill in all required fields correctly');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare submission payload
      const currentType = requirementTypes[activeIndex].type;

      const submissionData = {
        ...fieldValues,
        currency: targetCurrency,
        type: currentType
      };

      const result = await createRecipientAction(submissionData);

      if (result.success) {
        setSuccessMessage(result.message);

        // Reset form data after successful submission
        setTimeout(() => {
          // Keep only currency and reset form
          const resetValues = {
            accountHolderName: '',
            legalType: 'PRIVATE'
          };
          setFieldValues(resetValues);
          setFieldErrors({});
        }, 2000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Render one field with error or skeleton
  // ────────────────────────────────────────────────────────────────
  function renderField(field: RequirementField) {
    const val = fieldValues[field.key] || '';
    const error = fieldErrors[field.key];
    const loading = field.key === refreshingKey;

    if (loading) {
      return (
        <div className="animate-pulse max-w-sm space-y-2">
          <div className="h-4 w-24 bg-gray-300 rounded"></div>
          <div className="h-8 w-full bg-gray-200 rounded-md border border-gray-300"></div>
        </div>
      );
    }

    switch (field.type) {
      case 'text':
      case 'date':
        return (
          <>
            <Input
              id={field.key}
              type={field.type}
              placeholder={field.example}
              value={val}
              className={`w-full ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
              onChange={(e) => onFieldChange(field, e.target.value)}
              disabled={isSubmitting}
            />
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </>
        );

      case 'select':
        return (
          <>
            <Select
              value={val}
              onValueChange={(v) => onFieldChange(field, v)}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id={field.key}
                className={`w-full ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
              >
                <SelectValue
                  placeholder={field.example || 'Select an option'}
                />
              </SelectTrigger>
              <SelectContent>
                {field.valuesAllowed?.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </>
        );

      case 'radio':
        return (
          <>
            <RadioGroup
              id={field.key}
              value={val}
              onValueChange={(v) => onFieldChange(field, v)}
              className={error ? 'border-red-500 rounded p-2' : ''}
              disabled={isSubmitting}
            >
              {field.valuesAllowed?.map((opt) => (
                <div key={opt.key} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={opt.key}
                    id={`${field.key}-${opt.key}`}
                  />
                  <label htmlFor={`${field.key}-${opt.key}`}>{opt.name}</label>
                </div>
              ))}
            </RadioGroup>
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </>
        );

      default:
        return null;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Final JSX
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard/payouts" className="hover:text-gray-700">
            Payouts
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="font-medium text-gray-700">Add account</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Add account</h1>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <StripeAlert variant="destructive" title="Error">
          {error}
        </StripeAlert>
      )}

      {successMessage && (
        <StripeAlert variant="success" title="Success">
          {successMessage}
        </StripeAlert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Currency selector column */}
        <div className="md:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            1. Select currency
          </h3>
          <div className="max-h-[600px] overflow-y-auto pr-2 -mr-2 space-y-1.5">
            {countryList.map((country) => (
              <div
                key={country.currencyCode}
                className={`p-3 border rounded-md cursor-pointer transition-colors flex items-center justify-between ${
                  targetCurrency === country.currencyCode
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setTargetCurrency(country.currencyCode)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{country.flag}</span>
                  <div>
                    <p className="font-medium text-sm">{country.country}</p>
                    <p className="text-xs text-gray-500">
                      {country.currencyCode}
                    </p>
                  </div>
                </div>
                {targetCurrency === country.currencyCode && (
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form column */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            2. Enter account details
          </h3>

          {isInitialLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : requirementTypes.length > 0 ? (
            <Card className="max-h-[800px] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">
                  {requirementTypes[activeIndex]?.title || 'Loading...'}
                </CardTitle>

                {/* Tabs for requirement types */}
                {requirementTypes.length > 1 && (
                  <Tabs
                    value={`tab-${activeIndex}`}
                    onValueChange={(val) =>
                      handleTabClick(Number(val.replace('tab-', '')))
                    }
                  >
                    <TabsList className="border-b">
                      {requirementTypes.map((rt, idx) => (
                        <TabsTrigger
                          key={rt.type}
                          value={`tab-${idx}`}
                          className="px-4 py-2 hover:bg-gray-100"
                          disabled={isSubmitting}
                        >
                          {rt.title}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
              </CardHeader>

              <CardContent className="space-y-6 p-6">
                {/* Account holder name and legal type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="accountHolderName"
                      className="block font-medium"
                    >
                      Full name of the account holder
                      <span className="text-red-500"> *</span>
                    </label>
                    <Input
                      id="accountHolderName"
                      type="text"
                      placeholder="e.g., John Smith"
                      value={fieldValues.accountHolderName || ''}
                      className={`w-full ${fieldErrors.accountHolderName ? 'border-red-500 focus:ring-red-500' : ''}`}
                      onChange={(e) =>
                        handleStandardFieldChange(
                          'accountHolderName',
                          e.target.value
                        )
                      }
                      disabled={isSubmitting}
                    />
                    {fieldErrors.accountHolderName && (
                      <p className="text-red-600 text-sm mt-1">
                        {fieldErrors.accountHolderName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="legalType" className="block font-medium">
                      Account Type
                      <span className="text-red-500"> *</span>
                    </label>
                    <Select
                      value={fieldValues.legalType || 'PRIVATE'}
                      onValueChange={(v) =>
                        handleStandardFieldChange('legalType', v)
                      }
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="legalType" className="w-full">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIVATE">Personal</SelectItem>
                        <SelectItem value="BUSINESS">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dynamic fields */}
                {tabLoading ? (
                  <div className="flex flex-col space-y-3">
                    <Skeleton className="h-[400px] w-[250px] rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ) : (
                  Object.entries(visibleGroups).map(([groupName, fields]) => (
                    <div
                      key={groupName}
                      className="space-y-4 pt-4 border-t first:border-t-0 first:pt-0"
                    >
                      <h4 className="font-medium text-gray-800">{groupName}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fields.map((field) => (
                          <div key={field.key} className="space-y-1">
                            <label
                              htmlFor={field.key}
                              className="block font-medium"
                            >
                              {field.name}
                              {field.required && (
                                <span className="text-red-500"> *</span>
                              )}
                              {field.example && (
                                <span className="text-xs ml-2 text-gray-500">
                                  ({field.example})
                                </span>
                              )}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}

                {/* Action buttons */}
                <div className="flex justify-end space-x-2 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.history.back()}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      refreshingKey !== null ||
                      isSubmitting ||
                      !requirementTypes.length
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Add payout method'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <StripeAlert variant="destructive" title="Error loading form">
              {error}
            </StripeAlert>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

  </add/page.tsx>

  <retrieve/TransferForm.tsx>

<a name="retrieve-transferform-tsx"></a>
### `retrieve/TransferForm.tsx`

```tsx
"use client";
// app/dashboard/payouts/transfer/DynamicTransferForm.tsx
import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDebounce } from "use-debounce";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, AlertCircleIcon, CheckCircle, Loader2 } from "lucide-react";

import { getTransferRequirements, refreshTransferRequirements, createTransfer, fundTransfer } from "./actions";

// Define types
type RequirementField = {
  key: string;
  name: string;
  type: string;
  refreshRequirementsOnChange: boolean;
  required: boolean;
  displayFormat: any;
  example: any;
  minLength: any;
  maxLength?: number;
  validationRegexp?: string;
  validationAsync: any;
  valuesAllowed?: Array<{ key: string; name: string }>;
};

type RequirementGroup = {
  name: string;
  group: RequirementField[];
};

type Requirement = {
  type: string;
  usageInfo: any;
  fields: RequirementGroup[];
};

type TransferResponse = {
  id: number;
  user: number;
  targetAccount: number;
  sourceAccount: number;
  quote: any;
  quoteUuid: string;
  status: string;
  reference: string;
  rate: number;
  created: string;
  business: number;
  transferRequest: any;
  details: {
    reference: string;
  };
  hasActiveIssues: boolean;
  sourceCurrency: string;
  sourceValue: number;
  targetCurrency: string;
  targetValue: number;
  customerTransactionId: string;
};

// Custom Alert Component
const StatusAlert = ({ variant, title, children }: { variant: "error" | "success" | "warning" | "info"; title: string; children: React.ReactNode }) => {
  const baseClasses = "flex items-start p-4 rounded-md border text-sm";
  const variantClasses = {
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-green-50 border-green-200 text-green-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };
  const Icon = variant === "error" ? AlertCircle : CheckCircle;

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      <Icon className="h-5 w-5 mr-3 mt-0.5" />
      <div>
        <h5 className="font-semibold">{title}</h5>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};

export default function DynamicTransferForm({ recipientId, quoteId, customerTransactionId }: { recipientId: string; quoteId: string; customerTransactionId: string }) {
  const { toast } = useToast();

  // ────────────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ────────────────────────────────────────────────────────────────

  // 1️⃣ Requirements data
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [groupedFields, setGroupedFields] = useState<Record<string, RequirementField[]>>({});

  // 2️⃣ Field values and errors
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 3️⃣ Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [refreshingField, setRefreshingField] = useState<string | null>(null);
  const isRefreshing = useRef<boolean>(false);
  const [shouldRefreshNext, setShouldRefreshNext] = useState<boolean>(false);

  // 4️⃣ Form status
  const [formStatus, setFormStatus] = useState<"loading" | "incomplete" | "validation_error" | "complete" | "transfer_created" | "transfer_funded">("loading");
  const [showLocalErrors, setShowLocalErrors] = useState<boolean>(false);

  // 5️⃣ Results
  const [transferResponse, setTransferResponse] = useState<TransferResponse | null>(null);
  const [fundTransferResponse, setFundTransferResponse] = useState<any>(null);
  const [showTransferDialog, setShowTransferDialog] = useState<boolean>(false);

  // 6️⃣ Error handling
  const [error, setError] = useState<string | null>(null);

  // 7️⃣ Debounce form data changes
  const [debouncedFieldValues] = useDebounce(fieldValues, 1000);

  // ────────────────────────────────────────────────────────────────
  // INITIAL DATA FETCHING
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recipientId || !quoteId || !customerTransactionId) return;

    const fetchRequirements = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getTransferRequirements(recipientId, quoteId, customerTransactionId);

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch transfer requirements");
        }

        setRequirements(result.data);

        // Initialize with reference
        const initialValues = {
          reference: "DEVTESTMOVE",
        };

        setFieldValues(initialValues);
        processRequirementsToGroups(result.data);
        setFormStatus("incomplete");
      } catch (err) {
        console.error("Failed to fetch requirements:", err);
        setError(err instanceof Error ? err.message : "Something went wrong loading the form");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequirements();
  }, [recipientId, quoteId, customerTransactionId]);

  // ────────────────────────────────────────────────────────────────
  // PROCESS REQUIREMENTS INTO GROUPED FIELDS
  // ────────────────────────────────────────────────────────────────
  const processRequirementsToGroups = (reqs: Requirement[]) => {
    const groups: Record<string, RequirementField[]> = {};

    reqs.forEach((requirement) => {
      requirement.fields.forEach((field) => {
        groups[field.name] = field.group;
      });
    });

    setGroupedFields(groups);
  };

  // ────────────────────────────────────────────────────────────────
  // FIND FIELD CONFIGURATION
  // ────────────────────────────────────────────────────────────────
  const findFieldConfig = (fieldKey: string): RequirementField | null => {
    for (const fields of Object.values(groupedFields)) {
      const field = fields.find((f) => f.key === fieldKey);
      if (field) return field;
    }
    return null;
  };

  // ────────────────────────────────────────────────────────────────
  // VALIDATE A SINGLE FIELD
  // ────────────────────────────────────────────────────────────────
  const validateField = (fieldConfig: RequirementField, value: any): string => {
    if (fieldConfig.required && (!value || value === "")) {
      return "This field is required";
    }

    if (fieldConfig.type.toLowerCase() === "text" && value) {
      if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
        return `Minimum length is ${fieldConfig.minLength} characters`;
      }
      if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
        return `Maximum length is ${fieldConfig.maxLength} characters`;
      }
      if (fieldConfig.validationRegexp && !new RegExp(fieldConfig.validationRegexp).test(value)) {
        return `Invalid format for ${fieldConfig.name}`;
      }
    }

    return "";
  };

  // ────────────────────────────────────────────────────────────────
  // VALIDATE ALL FIELDS AND UPDATE FORM STATUS
  // ────────────────────────────────────────────────────────────────
  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Check all visible fields
    Object.values(groupedFields)
      .flat()
      .forEach((field) => {
        const value = fieldValues[field.key] || "";
        const error = validateField(field, value);

        if (error) {
          newErrors[field.key] = error;
          isValid = false;
        }
      });

    // Update error state
    setFieldErrors(newErrors);

    // Update form status
    setFormStatus(
      Object.keys(newErrors).length > 0 ? "validation_error"
      : isValid ? "complete"
      : "incomplete"
    );

    return isValid;
  };

  // ────────────────────────────────────────────────────────────────
  // HANDLE FIELD CHANGES
  // ────────────────────────────────────────────────────────────────
  const handleFieldChange = (fieldKey: string, value: string) => {
    // Update field value
    setFieldValues((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));

    // Clear error for this field when changed
    if (fieldErrors[fieldKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }

    // Validate this field
    const fieldConfig = findFieldConfig(fieldKey);
    if (fieldConfig) {
      const error = validateField(fieldConfig, value);
      if (error && showLocalErrors) {
        setFieldErrors((prev) => ({
          ...prev,
          [fieldKey]: error,
        }));
      }
    }
  };

  // ────────────────────────────────────────────────────────────────
  // WATCH FOR FIELDS THAT NEED REFRESHING
  // ────────────────────────────────────────────────────────────────
  // REFRESH REQUIREMENTS WHEN FIELD CHANGES
  // ────────────────────────────────────────────────────────────────
  const handleRefreshRequirements = async (changedField: string) => {
    if (isRefreshing.current) {
      setShouldRefreshNext(true);
      return;
    }

    isRefreshing.current = true;
    setRefreshingField(changedField);

    try {
      // Create details object for API
      const details = createNestedDetails(fieldValues);

      const result = await refreshTransferRequirements(recipientId, quoteId, customerTransactionId, details);

      if (result.success && result.data) {
        // Update requirements and fields
        setRequirements(result.data);
        processRequirementsToGroups(result.data);

        // Validate all fields with new requirements
        validateAllFields();
      } else {
        setError(result.error || "Failed to refresh form requirements");
      }
    } catch (err) {
      console.error("Error refreshing requirements:", err);
      setError("Failed to update form. Please try again.");
    } finally {
      setRefreshingField(null);
      isRefreshing.current = false;

      // If another refresh was requested, handle it
      if (shouldRefreshNext) {
        setShouldRefreshNext(false);
        setTimeout(() => handleRefreshRequirements(changedField), 0);
      }
    }
  };
  
  useEffect(() => {
    if (Object.keys(debouncedFieldValues).length === 0 || isRefreshing.current) return;

    // Find fields that need to refresh requirements
    const refreshableFields = Object.entries(debouncedFieldValues).filter(([key, value]) => {
      if (!value) return false;

      const fieldConfig = findFieldConfig(key);
      return fieldConfig?.refreshRequirementsOnChange === true;
    });

    if (refreshableFields.length > 0) {
      const [key, value] = refreshableFields[0]; // Take the first one that changed
      handleRefreshRequirements(key);
    }
  }, [debouncedFieldValues, findFieldConfig, recipientId, quoteId, customerTransactionId]);

  // ────────────────────────────────────────────────────────────────
  // CREATE NESTED DETAILS OBJECT
  // ────────────────────────────────────────────────────────────────
  const createNestedDetails = (data: Record<string, any>) => {
    const details: Record<string, any> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (key.includes(".")) {
        const [parent, child] = key.split(".");
        details[parent] = details[parent] || {};
        details[parent][child] = value;
      } else {
        details[key] = value;
      }
    });

    return details;
  };


  // ────────────────────────────────────────────────────────────────
  // SHOW ALL VALIDATION ERRORS
  // ────────────────────────────────────────────────────────────────
  const showValidationErrors = () => {
    setShowLocalErrors(true);
    validateAllFields();
  };

  // ────────────────────────────────────────────────────────────────
  // HANDLE FORM SUBMISSION
  // ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Show validation errors
    setShowLocalErrors(true);

    // Validate all fields
    const isValid = validateAllFields();

    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const details = createNestedDetails(fieldValues);

      const result = await createTransfer(recipientId, quoteId, customerTransactionId, details);

      if (result.success) {
        setTransferResponse(result.data);
        setFormStatus("transfer_created");
        setShowTransferDialog(true);
      } else {
        toast({
          title: "Transfer Creation Failed",
          description: result.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error creating transfer:", err);
      setError("Failed to create transfer. Please try again later.");
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the transfer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // HANDLE FUND TRANSFER
  // ────────────────────────────────────────────────────────────────
  const handleFundTransfer = async () => {
    if (!transferResponse) return;

    setIsSubmitting(true);

    try {
      const result = await fundTransfer(transferResponse.id);

      setFundTransferResponse(result);
      setFormStatus("transfer_funded");
    } catch (err) {
      console.error("Error funding transfer:", err);
      toast({
        title: "Error",
        description: "Failed to fund the transfer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER FIELD BY TYPE
  // ────────────────────────────────────────────────────────────────
  const renderField = (field: RequirementField) => {
    const value = fieldValues[field.key] || "";
    const error = fieldErrors[field.key] || "";
    const isRefreshingThis = refreshingField === field.key;

    // Show skeleton while refreshing this field
    if (isRefreshingThis) {
      return (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-full bg-gray-200 rounded-md"></div>
        </div>
      );
    }

    // Render different field types
    switch (field.type.toLowerCase()) {
      case "text":
        return (
          <>
            <Input
              id={field.key}
              value={value}
              placeholder={field.example || ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className={`w-full ${error ? "border-red-500" : ""} ${field.refreshRequirementsOnChange ? "border-blue-300" : ""}`}
              disabled={isSubmitting}
            />
            {field.example && !error && <div className="text-xs text-gray-500 mt-1">Example: {field.example}</div>}
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
          </>
        );

      case "select":
        return (
          <>
            <Select value={value} onValueChange={(val) => handleFieldChange(field.key, val)} disabled={isSubmitting}>
              <SelectTrigger className={`w-full ${error ? "border-red-500" : ""} ${field.refreshRequirementsOnChange ? "border-blue-300" : ""}`}>
                <SelectValue placeholder={field.example || "Select an option"} />
              </SelectTrigger>
              <SelectContent>
                {field.valuesAllowed?.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
          </>
        );

      case "radio":
        return (
          <>
            <RadioGroup value={value} onValueChange={(val) => handleFieldChange(field.key, val)} className={`${error ? "border-red-500 rounded p-2" : ""}`} disabled={isSubmitting}>
              {field.valuesAllowed?.map((option) => (
                <div key={option.key} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.key} id={`${field.key}-${option.key}`} />
                  <label htmlFor={`${field.key}-${option.key}`}>{option.name}</label>
                </div>
              ))}
            </RadioGroup>
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
          </>
        );

      case "date":
        return (
          <>
            <Input
              type="date"
              id={field.key}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className={`w-full ${error ? "border-red-500" : ""} ${field.refreshRequirementsOnChange ? "border-blue-300" : ""}`}
              disabled={isSubmitting}
            />
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
          </>
        );

      default:
        return (
          <>
            <Input
              type="text"
              id={field.key}
              value={value}
              placeholder={field.example || ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className={`w-full ${error ? "border-red-500" : ""} ${field.refreshRequirementsOnChange ? "border-blue-300" : ""}`}
              disabled={isSubmitting}
            />
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
            <div className="text-xs text-gray-400 mt-1">(Unknown field type: {field.type})</div>
          </>
        );
    }
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER LOADING SKELETON
  // ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <FormSkeleton />;
  }

  // ────────────────────────────────────────────────────────────────
  // RENDER MAIN COMPONENT
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Form Status Indicator */}
      <StatusAlert
        variant={
          formStatus === "complete" ? "success"
          : formStatus === "validation_error" ?
            "error"
          : formStatus === "incomplete" ?
            "warning"
          : formStatus === "transfer_created" ?
            "info"
          : formStatus === "transfer_funded" ?
            "success"
          : "info"
        }
        title={
          formStatus === "complete" ? "Ready to Submit"
          : formStatus === "validation_error" ?
            "Please Fix Errors"
          : formStatus === "incomplete" ?
            "Please Complete Form"
          : formStatus === "transfer_created" ?
            "Transfer Created"
          : formStatus === "transfer_funded" ?
            "Transfer Funded"
          : "Loading Form"
        }>
        {formStatus === "complete" ?
          "The form is complete and ready to submit."
        : formStatus === "validation_error" ?
          "Please fix the highlighted errors before submitting."
        : formStatus === "incomplete" ?
          "Please complete all required fields."
        : formStatus === "transfer_created" ?
          "Transfer created successfully! Click 'Fund Transfer' to complete."
        : formStatus === "transfer_funded" ?
          "Transfer has been funded! Transaction complete."
        : "Loading form requirements..."}
      </StatusAlert>

      {/* Error Display */}
      {error && (
        <StatusAlert variant="error" title="Error">
          {error}
        </StatusAlert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
        {/* Dynamic Form - Takes 2/3 of width on larger screens */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md relative ">
          <h2 className="text-lg font-semibold mb-6 pl-6 ">Transfer Information</h2>

          {/* Loading Overlay */}
          {isSubmitting && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col justify-center z-10 p-6">
              <div className="flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-2" />
                <p className="text-lg font-medium text-gray-700">Processing your request...</p>
              </div>
            </div>
          )}

          {/* Dynamic Form Fields */}
          <div className="space-y-8">
            {Object.entries(groupedFields).map(([groupName, fields], groupIndex) => (
              <div key={`group-${groupIndex}`} className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0">
                {groupName !== fields[0].name && (
                  <>
                    <div className="font-medium text-gray-700 flex flex-row space-x-2 items-center">
                      <AlertCircleIcon className=" text-yellow-500 h-6 w-6 mr-2" /> {groupName}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
                  {fields.map((field, fieldIndex) => (
                    <div key={`field-${field.key}-${fieldIndex}`} className="space-y-2">
                      <label htmlFor={field.key} className="block font-medium text-sm">
                        {field.name}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                        {field.refreshRequirementsOnChange && <span className="text-xs text-blue-600 ml-2">(Updates form)</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Form Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={showValidationErrors} disabled={isSubmitting}>
                Validate Form
              </Button>

              <Button variant="default" onClick={handleSubmit} disabled={isSubmitting || (formStatus !== "complete" && showLocalErrors)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmitting ?
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                : "Create Transfer"}
              </Button>
            </div>
          </div>
        </div>

        {/* Info Panel - Takes 1/3 of width */}
        <div className="md:col-span-1 bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col h-fit">
          <h3 className="font-medium text-gray-800 mb-3">{`Form Instructions`}</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-red-500 mr-2">*</span>
              <span>{`Fields marked with an asterisk are required`}</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>{`Fields marked "Updates form" will refresh the form when changed`}</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>{`Click "Validate Form" to check for errors before submitting`}</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>{`After submitting, you'll need to confirm by funding the transfer`}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Transfer Created Successfully</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-4">
            {/* Transfer Response */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-md font-semibold mb-2">Transfer Details</h3>
              <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-40">{JSON.stringify(transferResponse, null, 2)}</pre>
            </div>

            {/* Fund Transfer Response (if available) */}
            {fundTransferResponse && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="text-md font-semibold mb-2">Fund Transfer Response</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-40">{JSON.stringify(fundTransferResponse, null, 2)}</pre>
              </div>
            )}

            {/* Status Message */}
            <StatusAlert variant={formStatus === "transfer_funded" ? "success" : "info"} title={formStatus === "transfer_funded" ? "Transfer Funded" : "Transfer Created"}>
              {formStatus === "transfer_funded" ? "Your transfer has been funded successfully!" : "Transfer has been created. Click 'Fund Transfer' to complete the process."}
            </StatusAlert>
          </div>

          <DialogFooter>
            {formStatus !== "transfer_funded" ?
              <Button onClick={handleFundTransfer} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmitting ?
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                : "Fund Transfer"}
              </Button>
            : <Button onClick={() => setShowTransferDialog(false)}>Close</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Skeleton loader for the form
function FormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full rounded-md" />

      <div className="bg-white p-6 rounded-lg shadow-md">
        <Skeleton className="h-6 w-1/3 mb-6" />

        <div className="space-y-8">
          {[1, 2, 3].map((group) => (
            <div key={group} className="space-y-4">
              <Skeleton className="h-5 w-1/4 mb-2" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((field) => (
                  <div key={field} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-4">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

  </retrieve/TransferForm.tsx>

  <retrieve/actions.ts>

<a name="retrieve-actions-ts"></a>
### `retrieve/actions.ts`

```ts
'use server';
//app/dashboard/payouts/retrieve/actions.ts
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'; // <--- Import the crypto module
import { prisma } from '@/lib/prisma';
import { getSession } from '@/app/actions/newAuth';
import { nanoid } from 'nanoid';
import { TransactionStatus } from '@prisma/client';
const wiseEndpoint = `${process.env.WISE_ENDPOINT}`;
const apiKey = `${process.env.WISE_API_KEY}`;
const profileId = Number(process.env.WISE_BUSINESS_PROFILE_ID); // Business profile ID
const sourceAccount = `${process.env.WISE_SOURCE_ACCOUNT}`;
const sourceCurrency = 'USD';
type WiseError = {
  errors: Array<{
    code: string;
    message: string;
    field: string;
    arguments: Array<any>;
  }>;
};

type ListRecipientsV2 = {
  content: Array<{
    id: number;
    creatorId: number;
    profileId?: number;
    name: {
      fullName: string;
      givenName: string;
      familyName: string;
      middleName: string;
      patronymicName: string;
      cannotHavePatronymicName: boolean;
    };
    address?: {
      country: string;
      firstLine: string;
      postCode: string;
      city: string;
      state: string;
    };
    currency: string;
    country: string;
    type: string;
    legalEntityType: string;
    active: boolean;
    details: {
      accountNumber: string;
      hashedByLooseHashAlgorithm: string;
    };
    commonFieldMap: {
      accountNumberField: string;
    };
    isDefaultAccount: boolean;
    hash: string;
    accountSummary: string;
    longAccountSummary: string;
    displayFields: Array<{
      key: string;
      label: string;
      value: string;
    }>;
    isInternal: boolean;
    ownedByCustomer: boolean;
    email?: string;
  }>;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  size: number;
};

type AuthenticatedQuoteV3 = {
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  expirationTime: string;
  profile: number;
  targetAccount: number;
  paymentOptions: Array<any>;
  [key: string]: any;
};

type V1CreateTransferReqs = Array<{
  type: string;
  usageInfo: any;
  fields: Array<{
    name: string;
    group: Array<{
      key: string;
      name: string;
      type: string;
      refreshRequirementsOnChange: boolean;
      required: boolean;
      displayFormat: any;
      example: any;
      minLength: any;
      maxLength?: number;
      validationRegexp?: string;
      validationAsync: any;
      valuesAllowed?: Array<{
        key: string;
        name: string;
      }>;
    }>;
  }>;
}>;

type V1CreateTransfer = {
  id: number;
  user: number;
  targetAccount: number;
  sourceAccount: number;
  quote: any;
  quoteUuid: string;
  status: string;
  reference: string;
  rate: number;
  created: string;
  business: number;
  transferRequest: any;
  details: {
    reference: string;
  };
  hasActiveIssues: boolean;
  sourceCurrency: string;
  sourceValue: number;
  targetCurrency: string;
  targetValue: number;
  customerTransactionId: string;
};

//  Create an authenticated quote using Transaction
export async function createAuthenticatedQuoteWithTransactions(
  recipientId: string,
  transactionIds: string[]
): Promise<
  | {
      success: false;
      error: string;
      quoteData?: undefined;
      customerTransactionId?: undefined;
    }
  | {
      success: true;
      error?: undefined;
      quoteData: AuthenticatedQuoteV3;
      customerTransactionId: string;
    }
> {
  try {
    // 1. --- Input Validation ---
    if (!transactionIds || transactionIds.length === 0) {
      return {
        success: false,
        error: 'No transactions were selected for payout.'
      };
    }
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    const userId = session.data.id;
    // 2. --- Securely Fetch Data from Database in Parallel ---
    const [recipient, transactionList] = await Promise.all([
      // Fetch the recipient, ensuring it belongs to the authenticated user
      prisma.payout_recipients.findUnique({
        where: { id: recipientId, user_id: userId } // SECURITY: Scopes to the logged-in user
      }),
      // Fetch the transactions, ensuring they belong to the user and are ready for payout
      prisma.transaction.findMany({
        where: {
          id: { in: transactionIds },
          userId: userId, // SECURITY: Scopes to the logged-in user
          status: 'PAYOUT_READY', // LOGIC: Ensures transactions are in the correct state
          netAmount: { not: null } // DATA INTEGRITY: Ensures we have an amount to send
        }
      })
    ]);

    // 3. --- Validate the Fetched Data ---
    if (!recipient) {
      return {
        success: false,
        error: 'Recipient not found or you do not have permission to use it.'
      };
    }
    if (transactionList.length !== transactionIds.length) {
      // This means some of the requested IDs were invalid (wrong status, wrong user, or didn't exist)
      return {
        success: false,
        error: 'One or more selected transactions are not valid for payout.'
      };
    }

    // 4. --- Aggregate and Prepare API Payload ---
    const santizedTransactionIds = transactionList.map((tx) => tx.id);

    // Sum the net amounts of the validated transactions
    const sourceAmount = transactionList.reduce(
      (sum, tx) => sum + tx.netAmount!,
      0
    );

    // The target currency and account come directly from the validated recipient
    const targetCurrency = recipient.currency;
    const targetAccount = recipient.wise_recipient_id; // This is the Wise ID for the recipient

    if (sourceAmount <= 0) {
      return {
        success: false,
        error: 'Total payout amount must be greater than zero.'
      };
    }
    const response = await fetch(
      `${wiseEndpoint}/v3/profiles/${profileId}/quotes`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceCurrency: sourceCurrency,
          targetCurrency: targetCurrency,
          sourceAmount: sourceAmount / 100,
          targetAmount: null,
          preferredPayIn: 'BALANCE',
          targetAccount: targetAccount.toString(),
          paymentMetadata: {
            transferNature: 'DEVTESTMOVE'
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: `${errorData.message}` || 'Failed to create authenticated quote'
      };
    }

    const data: AuthenticatedQuoteV3 = await response.json();

    // 2. Calculate the exchange rate plus fees
    const exchangeRatePlusFees = data.targetAmount / data.sourceAmount;

    // 3. Allocate targetAmount proportionally & calculate wiseFees ( TODO)
    const updatedTransactionList = transactionList.map((tx) => {
      const targetShare = Math.round(
        (tx.netAmount || tx.amount * 0.97) * exchangeRatePlusFees
      ); // allocated in target currency (e.g., EUR cents)
      const wiseFee = (tx.netAmount || tx.amount * 0.97) - targetShare; // fee in USD cents
      return {
        ...tx,
        wiseFees: wiseFee
      };
    });

    const wiseQuoteId = data.id;
    const customerTransactionId = uuidv4();

    const updateResult = await prisma.transaction.updateMany({
      where: {
        id: { in: santizedTransactionIds }
      },
      data: {
        wiseQuoteId,
        wiseFee: exchangeRatePlusFees,
        wiseTransferId: customerTransactionId,
        wiseRecipientId: recipientId,
        updatedAt: new Date()
      }
    });

    //console.log(`Payout batch: Marked ${updateResult.count} transactions as PAYOUT_PROCESSING`);

    // Generate a new customer transaction ID

    return {
      success: true,
      quoteData: data,
      customerTransactionId
    };
  } catch (error) {
    console.error('Error creating authenticated quote:', error);
    return {
      success: false,
      error: 'An error occurred while creating authenticated quote'
    };
  }
}

type FundTransferSuccess = {
  success: true;
  data: any;
  error?: undefined;
};

type FundTransferFailure = {
  success: false;
  error: string;
  data?: undefined;
};

type FundTransferResponse = FundTransferSuccess | FundTransferFailure;

/**
 * List all payout recipients for the current user
 */
export async function listRecipients(): Promise<
  | {
      success: false;
      error: string;
      recipients?: undefined;
    }
  | {
      success: true;
      recipients: {
        id: string;
        accountHolderName: string;
        accountType: string;
        accountSummary: string;
        longAccountSummary: string;
        currency: string;
        displayDetails: string;
        isActive: boolean;
        isDefault: boolean;
        createdAt: Date;
      }[];
      error?: undefined;
    }
> {
  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const recipients = await prisma.payout_recipients.findMany({
      where: {
        user_id: session.data.id,
        is_active: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return {
      success: true,
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        accountHolderName: `${recipient.account_holder_name}`,
        accountType: recipient.account_type,
        accountSummary: recipient.account_summary ?? '',
        longAccountSummary: recipient.long_account_summary ?? '',
        currency: recipient.currency,
        displayDetails: recipient.account_summary ?? '',
        isActive: recipient.is_active || false,
        isDefault: recipient.is_default || false,
        createdAt: recipient.created_at || new Date()
      }))
    };
  } catch (error) {
    console.error('Error listing recipients:', error);
    return { success: false, error: 'Failed to list recipients' };
  }
}

/**
 * Get all transactions available for withdrawal
 *
 * This function retrieves all transactions that are in the PAYOUT_READY state
 * for the currently authenticated user.
 *
 * @returns A list of transactions ready for payout
 */
export async function getAvailableTransactions(): Promise<
  | {
      success: false;
      error: string;
      transactions?: undefined;
    }
  | {
      success: true;
      transactions: {
        id: string;
        amount: number;
        netAmount: number;
        currency: string;
        createdAt: Date;
        metadata: any;
        paymentMethod?: string;
        customerName?: string;
        description?: string;
      }[];
      totalAmount: number;
      error?: undefined;
    }
> {
  // Generate a request ID for tracking
  const requestId = `req_${nanoid(8)}`;
  console.log(`${requestId}: Fetching available transactions`);

  try {
    // Validate authentication
    const session = await getSession();
    if (!session?.data?.id) {
      console.error(`${requestId}: Authentication failed`);
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.data.id;
    console.log(`${requestId}: Authenticated as user ${userId}`);

    // Query transactions in PAYOUT_READY state
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        status: TransactionStatus.PAYOUT_READY
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(
      `${requestId}: Found ${transactions.length} transactions available for payout`
    );

    // Calculate total available amount
    const totalNetAmount = transactions.reduce(
      (sum, t) => sum + (t.netAmount || 0),
      0
    );

    // Enhanced response with additional fields extracted from metadata
    return {
      success: true,
      transactions: transactions.map((t) => {
        // Extract useful information from metadata if available
        const metadata = t.metadata || {};
        return {
          id: t.id,
          amount: t.amount,
          netAmount: t.netAmount || 0,
          currency: t.currency,
          createdAt: t.createdAt,
          metadata: t.metadata
          // Optional fields extracted from metadata
        };
      }),
      totalAmount: totalNetAmount
    };
  } catch (error) {
    console.error(
      `${requestId}: Error fetching available transactions:`,
      error
    );

    // Provide a helpful error message
    let errorMessage = 'Failed to retrieve available transactions';
    if (error instanceof Error) {
      if (
        error.message.includes('database') ||
        error.message.includes('query')
      ) {
        errorMessage =
          'Database error while retrieving transactions. Please try again.';
      } else if (
        error.message.includes('timeout') ||
        error.message.includes('network')
      ) {
        errorMessage =
          'Network timeout while retrieving transactions. Please try again.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

// Step 3: Get transfer requirements
export async function getTransferRequirements(
  prismaRecipientId: string,
  quoteUuid: string,
  customerTransactionId: string
): Promise<
  | {
      success: false;
      error: any;
      data?: undefined;
    }
  | {
      success: true;
      data: V1CreateTransferReqs;
      error?: undefined;
    }
> {
  const wiseEndpoint = `${process.env.WISE_ENDPOINT}`;
  const apiKey = `${process.env.WISE_API_KEY}`;

  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    const userId = session.data.id;

    let wiseRecipientPrisma = await prisma.payout_recipients.findUnique({
      where: { id: prismaRecipientId, user_id: userId },
      select: { wise_recipient_id: true }
    });

    if (!wiseRecipientPrisma) {
      return { success: false, error: 'Not recipient id found in db' };
    }

    let wiseRecipientId = `${wiseRecipientPrisma?.wise_recipient_id}`;

    const response = await fetch(`${wiseEndpoint}/v1/transfer-requirements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetAccount: wiseRecipientId,
        quoteUuid: quoteUuid,
        customerTransactionId: customerTransactionId,
        details: {
          reference: 'DEV_TEST_MOVING_MONEY'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,

        error: errorData.message || 'Failed to get transfer requirements'
      };
    }

    const data: V1CreateTransferReqs = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error getting transfer requirements:', error);
    return {
      success: false,
      error: 'An error occurred while getting transfer requirements'
    };
  }
}

// Step 4: Refresh transfer requirements form (if needed)
export async function refreshTransferRequirements(
  prismaRecipientId: string,
  quoteUuid: string,
  customerTransactionId: string,
  details: Record<string, any>
): Promise<
  | {
      success: false;
      error: any;
      data?: undefined;
    }
  | {
      success: true;
      data: V1CreateTransferReqs;
      error?: undefined;
    }
> {
  const wiseEndpoint = `${process.env.WISE_ENDPOINT}`;
  const apiKey = `${process.env.WISE_API_KEY}`;

  try {
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    const userId = session.data.id;

    let wiseRecipientPrisma = await prisma.payout_recipients.findUnique({
      where: { id: prismaRecipientId, user_id: userId },
      select: { wise_recipient_id: true }
    });

    if (!wiseRecipientPrisma) {
      return { success: false, error: 'Not recipient id found in db' };
    }

    let wiseRecipientId = `${wiseRecipientPrisma?.wise_recipient_id}`;
    const response = await fetch(`${wiseEndpoint}/v1/transfer-requirements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetAccount: wiseRecipientId,
        quoteUuid,
        customerTransactionId,
        details
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,

        error: errorData.message || 'Failed to refresh transfer requirements'
      };
    }

    const data: V1CreateTransferReqs = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error refreshing transfer requirements:', error);
    return {
      success: false,
      error: 'An error occurred while refreshing transfer requirements'
    };
  }
}

// Step 5: Create transfer
export async function createTransfer(
  prismaRecipientId: string,
  quoteUuid: string,
  customerTransactionId: string,
  details: any
): Promise<
  | {
      success: false;
      error: string;
      data?: undefined;
    }
  | {
      success: true;
      data: V1CreateTransfer;
      error?: undefined;
    }
> {
  try {
    console.log(
      'createTransfer called prismaRecipientId: ',
      prismaRecipientId,
      'quoteUuid ',
      quoteUuid,
      'customerTransactionId ',
      customerTransactionId
    );
    const session = await getSession();
    if (!session?.data?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    const userId = session.data.id;
    console.log(' user is signed in ');
    const wiseRecipientPrisma = await prisma.payout_recipients.findUnique({
      where: { id: prismaRecipientId, user_id: userId },
      select: { wise_recipient_id: true }
    });
    console.log(' obtained prisma row ');
    console.log('wiseRecipientPrisma ', wiseRecipientPrisma);

    if (!wiseRecipientPrisma) {
      return { success: false, error: 'Not recipient id found in db' };
    }

    let wiseRecipientId = `${wiseRecipientPrisma?.wise_recipient_id}`;
    console.log('string wiseRecipientId ', wiseRecipientId);

    console.log(
      'transfer payload  ',
      JSON.stringify(
        {
          sourceAccount: sourceAccount,
          targetAccount: wiseRecipientId,
          quoteUuid: quoteUuid,
          customerTransactionId: customerTransactionId,
          details: details
        },
        null,
        2
      )
    );

    const response = await fetch(`${wiseEndpoint}/v1/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceAccount: sourceAccount,
        targetAccount: wiseRecipientId,
        quoteUuid: quoteUuid,
        customerTransactionId: customerTransactionId,
        details: details
      })
    });
    console.log();

    if (!response.ok) {
      console.log('response NOT OK');

      const errorData: WiseError = await response.json();
      return {
        success: false,
        error: `${errorData.errors[0].message}` || 'Failed to create transfer'
      };
    }
    console.log('response is ok');
    const data: V1CreateTransfer = await response.json();

    console.log('response is data ', JSON.stringify(data, null, 2));

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error creating transfer:', error);
    return {
      success: false,
      error: `An error occurred while creating transfer ${error}`
    };
  }
}

export async function fundTransfer(transferId: number) {
  console.log('fund transfer called ', transferId);
  const privateKey = process.env.WISE_PRIVATE_KEY;

  try {
    if (!privateKey) {
      return {
        status: 500,
        error: 'Server configuration error: Missing private key.'
      };
    }

    const url = `${wiseEndpoint}/v3/profiles/${profileId}/transfers/${transferId}/payments`;
    const body = JSON.stringify({ type: 'BALANCE' });

    // Make the Initial Request
    const initialResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body
    });

    if (initialResponse.ok) {
      const data: {
        status: number;
        data: {
          type: string;
          status: string;
          errorCode: string;
          errorMessage: string;
          balanceTransactionId: number;
        };
      } = await initialResponse.json();
      console.log(JSON.stringify(data, null, 2));
      return {
        status: initialResponse.status,
        data: data.data
      };
    }

    // Handle SCA Challenge (403 Forbidden)
    if (initialResponse.status === 403) {
      const oneTimeToken = initialResponse.headers.get('x-2fa-approval');
      console.log('oneTimeToken ', oneTimeToken);
      if (!oneTimeToken) {
        const errorData = await initialResponse.json();
        console.log('!oneTimeToken', JSON.stringify(errorData, null, 2));

        return {
          status: 403,
          data: errorData,
          error: 'Forbidden access, but not an SCA challenge.'
        };
      }

      try {
        // Create the signature
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(oneTimeToken);
        const signature = signer.sign(privateKey, 'base64');

        // Retry with signature
        const signedResponse = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'x-2fa-approval': oneTimeToken,
            'X-Signature': signature
          },
          body: body
        });

        const data: {
          status: number;
          data: {
            type: string;
            status: string;
            errorCode: any;
            errorMessage: any;
            balanceTransactionId: number;
          };
        } = await signedResponse.json();
        console.log('signedResponse', JSON.stringify(data, null, 2));

        return {
          status: signedResponse.status,
          data: data.data
        };
      } catch (signError) {
        return {
          status: 500,
          error: 'Failed to create digital signature.'
        };
      }
    }

    // Handle other unexpected errors
    const errorData = await initialResponse.json();
    return {
      status: initialResponse.status,
      data: errorData,
      error: 'An unexpected error occurred while funding the transfer.'
    };
  } catch (error) {
    console.error('Error funding transfer:', error);
    return {
      error: 'An error occurred while funding transfer'
    };
  }
}
```

  </retrieve/actions.ts>

  <retrieve/page.tsx>

<a name="retrieve-page-tsx"></a>
### `retrieve/page.tsx`

```tsx
"use client";
// app/dashboard/payouts/retrieve/page.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, AlertCircle, CheckCircle, ArrowLeft, CreditCard, Plus, ExternalLink, Filter, FilterX } from "lucide-react";

import { getCountryByCurrency } from "@/app/actions/data";
import { listRecipients, createAuthenticatedQuoteWithTransactions, getAvailableTransactions } from "@/app/dashboard/payouts/retrieve/actions";
import TransferForm from "@/app/dashboard/payouts/retrieve/TransferForm";

// Status Alert Component
const StatusAlert = ({ variant, title, children }: { variant: "destructive" | "success"; title: string; children: React.ReactNode }) => {
  const baseClasses = "flex items-start p-4 rounded-md border text-sm";
  const variantClasses = {
    destructive: "bg-red-50 border-red-200 text-red-900",
    success: "bg-green-50 border-green-200 text-green-900",
  };
  const Icon = variant === "destructive" ? AlertCircle : CheckCircle;

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      <Icon className="h-5 w-5 mr-3 mt-0.5" />
      <div>
        <h5 className="font-semibold">{title}</h5>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};

// Main Page Component
export default function PayoutsRetrievePage() {
  const router = useRouter();

  // Data states
  const [recipients, setRecipients] = useState<
    Array<{
      id: string;
      accountHolderName: string;
      accountType: string;
      accountSummary: string;
      longAccountSummary: string;
      currency: string;
      displayDetails: string;
      isActive: boolean;
      isDefault: boolean;
      createdAt: Date;
    }>
  >([]);

  const [transactions, setTransactions] = useState<
    Array<{
      id: string;
      amount: number;
      netAmount: number;
      currency: string;
      createdAt: Date;
      metadata: any;
      paymentMethod?: string;
      customerName?: string;
      description?: string;
    }>
  >([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isRouting, setIsRouting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selection states
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | undefined>(undefined);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [totalSelectedAmount, setTotalSelectedAmount] = useState(0);
  const [showSelectionToast, setShowSelectionToast] = useState(false);

  // Transfer form states
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [customerTransactionId, setCustomerTransactionId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Load recipients and transactions in parallel
        const [recipientsData, transactionsData] = await Promise.all([listRecipients(), getAvailableTransactions()]);

        if (recipientsData.success) {
          setRecipients(recipientsData.recipients);
        } else {
          throw new Error("Failed to load recipients.");
        }

        if (transactionsData.success) {
          setTransactions(transactionsData.transactions);
        } else {
          throw new Error("Failed to load available transactions.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred during setup.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Update total amount when selections change
  useEffect(() => {
    const selectedIds = new Set(selectedTransactions);
    let total = 0;

    transactions.forEach((transaction) => {
      if (selectedIds.has(transaction.id)) {
        const fee = Math.max(0, transaction.amount - (transaction.netAmount || 0));
        const netAmount = transaction.netAmount || (fee > 0 ? transaction.amount - fee : transaction.amount * 0.96);
        total += netAmount;
      }
    });

    setTotalSelectedAmount(total);

    // Show toast with selected transaction IDs when they change
    if (selectedTransactions.length > 0) {
      setShowSelectionToast(true);
      const timer = setTimeout(() => setShowSelectionToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedTransactions, transactions]);

  // Handle select all toggle
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all transactions
      const allTransactionIds = transactions.map((t) => t.id);
      setSelectedTransactions(allTransactionIds);
    } else {
      // Deselect all transactions
      setSelectedTransactions([]);
    }

    setSelectAllChecked(checked);
  };

  // Handle transaction selection
  const handleTransactionSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedTransactions((prev) => [...prev, id]);
    } else {
      setSelectedTransactions((prev) => prev.filter((txId) => txId !== id));
    }
  };

  // Handle recipient selection
  const handleRecipientSelect = (id: string) => {
    setSelectedRecipientId(id);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedRecipientId || selectedTransactions.length === 0) {
      setError("Please select a recipient and at least one transaction");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Create quote with transactions
      const result = await createAuthenticatedQuoteWithTransactions(selectedRecipientId, selectedTransactions);

      if (result.success) {
        // Store data for transfer form
        setQuoteData(result.quoteData);
        setCustomerTransactionId(result.customerTransactionId);

        // Show the transfer form
        setShowTransferForm(true);
      } else {
        setError(result.error || "Failed to create quote for payout.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format currency amount
  const formatAmount = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  // Render transaction form view
  if (showTransferForm && quoteData && customerTransactionId && selectedRecipientId) {
    return (
      <div className="space-y-4">
        <div>
          <button onClick={() => setShowTransferForm(false)} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mb-3">
            <ArrowLeft className="w-4 h-4" />
            Back to Transaction Selection
          </button>
          <h1 className="text-2xl font-bold text-gray-900 pl-2">Complete Your Payout</h1>
        </div>

        {/* Quote Summary */}
        {quoteData && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-medium">Quote Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Source Amount:</div>
                <div className="font-medium">
                  {quoteData.sourceAmount} {quoteData.sourceCurrency}
                </div>
                <div className="text-muted-foreground">Target Amount:</div>
                <div className="font-medium">
                  {quoteData.targetAmount} {quoteData.targetCurrency}
                </div>
                <div className="text-muted-foreground">Exchange Rate:</div>
                <div className="font-medium">
                  1 {quoteData.sourceCurrency} = {quoteData.rate} {quoteData.targetCurrency}
                </div>
                <div className="text-muted-foreground">Recipient:</div>
                <div className="font-medium">{recipients.find((r) => r.id === selectedRecipientId)?.accountHolderName}</div>
              </div>
            </CardContent>
          </Card>
        )}

        <TransferForm recipientId={selectedRecipientId} quoteId={quoteData.id} customerTransactionId={customerTransactionId} />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">New Payout</h1>
            <p className="text-muted-foreground">Select transactions to withdraw to your account.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No recipients state
  if (recipients.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">New Payout</h1>
            <p className="text-muted-foreground">Select transactions to withdraw to your account.</p>
          </div>
        </div>

        <Card>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No Payout Methods Found</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">You need to add a recipient before you can send a payout.</p>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Link href="/dashboard/payouts/add">
                <Plus className="w-4 h-4 mr-2" />
                Add Recipient
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Main view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/payouts" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mb-3">
            <ArrowLeft className="w-4 h-4" />
            Back to Payouts
          </Link>
          <h1 className="text-2xl font-semibold">New Payout</h1>
          <p className="text-muted-foreground">Select transactions to withdraw to your account.</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <StatusAlert variant="destructive" title="Error">
          {error}
        </StatusAlert>
      )}

      {success && (
        <StatusAlert variant="success" title="Success">
          {success}
        </StatusAlert>
      )}

      {/* Selection Toast */}
      {showSelectionToast && selectedTransactions.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-indigo-600 text-white px-4 py-3 rounded-md shadow-lg max-w-sm">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5" />
            <div>
              <p className="font-medium">Selected {selectedTransactions.length} transaction(s)</p>
              <p className="text-xs mt-1 text-indigo-100">
                IDs: {selectedTransactions.slice(0, 3).join(", ")}
                {selectedTransactions.length > 3 ? ` and ${selectedTransactions.length - 3} more` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Select Recipient</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Select value={selectedRecipientId} onValueChange={handleRecipientSelect}>
              <SelectTrigger className="h-12">
                {selectedRecipientId ?
                  <RecipientDisplay recipient={recipients.find((r) => r.id === selectedRecipientId)} />
                : <SelectValue placeholder="Select a recipient" />}
              </SelectTrigger>
              <SelectContent>
                {recipients.map((recipient) => (
                  <SelectItem key={recipient.id} value={recipient.id} className="h-12 group">
                    <RecipientDisplay recipient={recipient} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle>Select Transactions</CardTitle>
          <div className="flex items-center gap-2">
            {selectedTransactions.length > 0 && <span className="text-sm text-muted-foreground">{selectedTransactions.length} selected</span>}
            {selectAllChecked ?
              <Button variant="outline" size="sm" onClick={() => handleSelectAll(false)} className="flex items-center gap-1.5">
                <FilterX className="h-4 w-4" />
                Clear Selection
              </Button>
            : <Button variant="outline" size="sm" onClick={() => handleSelectAll(true)} className="flex items-center gap-1.5">
                <Filter className="h-4 w-4" />
                Select All
              </Button>
            }
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ?
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox checked={selectAllChecked} onCheckedChange={handleSelectAll} aria-label="Select all transactions" />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Net Amount</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const customerName = transaction.metadata?.customerName;
                    const customerEmail = transaction.metadata?.customerEmail;
                    const fee = Math.max(0, transaction.amount - (transaction.netAmount || 0));
                    const isSelected = selectedTransactions.includes(transaction.id);

                    return (
                      <TableRow key={transaction.id} className={isSelected ? "bg-indigo-50" : ""}>
                        <TableCell className="py-2">
                          <Checkbox checked={isSelected} onCheckedChange={(checked) => handleTransactionSelect(transaction.id, !!checked)} />
                        </TableCell>
                        <TableCell>{transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="flex flex-row items-center justify-start">
                          {customerName ?
                            <span className="text-sm font-medium">{customerName}</span>
                          : customerEmail ?
                            <span className="text-xs text-gray-500">{customerEmail}</span>
                          : <span className="pl-2 text-xs text-center text-gray-500">-</span>}
                        </TableCell>
                        <TableCell>{formatAmount(transaction.amount)}</TableCell>
                        <TableCell className="font-medium">{formatAmount(transaction.netAmount || (fee > 0 ? transaction.amount - fee : transaction.amount * 0.96))}</TableCell>
                        <TableCell className="font-medium">
                          <div
                            className="h-8 w-8 rounded-sm flex justify-center items-center hover:cursor-pointer hover:bg-indigo-300 hover:text-white"
                            onClick={() => {
                              setIsRouting(true);
                              router.push(`/dashboard/transactions/${transaction.id}`);
                            }}>
                            {isRouting ?
                              <Loader2 className="hover:text-white text-indigo-500 w-4 h-4 animate-spin" />
                            : <ExternalLink className="hover:text-white text-indigo-500 w-4 h-4" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          : <div className="text-center p-6 border border-dashed rounded-md">
              <p className="text-gray-500">No transactions available for withdrawal.</p>
            </div>
          }

          {/* Selected Transaction Summary */}
          {selectedTransactions.length > 0 && (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-md flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-indigo-800">Selected {selectedTransactions.length} transaction(s)</p>
                  <p className="text-xs text-indigo-600">
                    Transaction IDs: {selectedTransactions.slice(0, 2).join(", ")}
                    {selectedTransactions.length > 2 ? ` and ${selectedTransactions.length - 2} more...` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-indigo-600">Total amount</p>
                <p className="text-lg font-bold text-indigo-800">{formatAmount(totalSelectedAmount)}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedTransactions.length === 0 || !selectedRecipientId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
              {isSubmitting ?
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              : "Continue to Transfer Form"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Recipient display component
const RecipientDisplay = ({
  recipient,
}: {
  recipient?: {
    id: string;
    accountHolderName: string;
    accountType: string;
    accountSummary: string;
    longAccountSummary: string;
    currency: string;
    displayDetails: string;
    isActive: boolean;
    isDefault: boolean;
    createdAt: Date;
  };
}) => {
  if (!recipient) return null;

  const name = recipient.accountHolderName;

  return (
    <div className="flex items-center gap-3 w-full h-12">
      {/* Avatar with Flag Overlay */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-indigo-200 text-indigo-700 font-medium group-hover:bg-white">
            {name ?
              name
                .trim()
                .split(" ")
                .reduce((a, c, i, arr) => a + (i === 0 || i === arr.length - 1 ? c[0] : ""), "")
                .toUpperCase()
            : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-popover text-xs">{getCountryByCurrency(recipient.currency)?.flag}</span>
      </div>

      {/* Two-Line Text Block */}
      <div className="flex flex-col">
        <div className="font-semibold text-sm leading-tight">{recipient.accountHolderName}</div>
        <div className="text-xs text-muted-foreground">{recipient.longAccountSummary}</div>
      </div>
    </div>
  );
};
```

  </retrieve/page.tsx>

</payouts>