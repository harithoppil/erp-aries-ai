'use server';

import { prisma } from '@/lib/prisma';
import { listInvoices, type ClientSafeInvoice } from '@/app/erp/accounts/actions';
import { listPayments, type ClientSafePayment } from '@/app/erp/payments/actions';
import { listProjects, type ClientSafeProject } from '@/app/erp/projects/actions';
import { listPersonnel, type ClientSafePersonnel } from '@/app/erp/hr/actions';
import { listAssets, type ClientSafeAsset } from '@/app/erp/assets/actions';
import { listItems, type ClientSafeItem } from '@/app/erp/stock/actions';
import { listTimesheets, type ClientSafeTimesheet } from '@/app/erp/timesheets/actions';

export type ClientSafeCertification = {
  id: string;
  personnel_id: string;
  cert_type: string;
  issuing_body: string | null;
  issue_date: Date | null;
  expiry_date: Date | null;
  cert_number: string | null;
  status: string;
};

export interface ReportsSummary {
  invoices: ClientSafeInvoice[];
  payments: ClientSafePayment[];
  projects: ClientSafeProject[];
  personnel: ClientSafePersonnel[];
  assets: ClientSafeAsset[];
  items: ClientSafeItem[];
  timesheets: ClientSafeTimesheet[];
  certifications: ClientSafeCertification[];
}

export async function getReportsSummary(): Promise<
  { success: true; data: ReportsSummary } | { success: false; error: string }
> {
  try {
    const [
      invRes, payRes, projRes, perRes, assetRes, itemRes, tsRes,
    ] = await Promise.all([
      listInvoices(),
      listPayments(),
      listProjects(),
      listPersonnel(),
      listAssets(),
      listItems(),
      listTimesheets(),
    ]);

    // Certifications come directly from Prisma
    const certifications = await prisma.certifications.findMany({ orderBy: { issue_date: 'desc' } });
    const clientSafeCerts: ClientSafeCertification[] = certifications.map((c) => ({
      id: c.id,
      personnel_id: c.personnel_id,
      cert_type: c.cert_type,
      issuing_body: c.issuing_body,
      issue_date: c.issue_date,
      expiry_date: c.expiry_date,
      cert_number: c.cert_number,
      status: String(c.status),
    }));

    return {
      success: true,
      data: {
        invoices: invRes.success ? invRes.invoices : [],
        payments: payRes.success ? payRes.payments : [],
        projects: projRes.success ? projRes.projects : [],
        personnel: perRes.success ? perRes.personnel : [],
        assets: assetRes.success ? assetRes.assets : [],
        items: itemRes.success ? itemRes.items : [],
        timesheets: tsRes.success ? tsRes.timesheets : [],
        certifications: clientSafeCerts,
      }
    };
  } catch (error) {
    console.error('Error fetching reports summary:', error);
    return { success: false, error: 'Failed to fetch reports data' };
  }
}
