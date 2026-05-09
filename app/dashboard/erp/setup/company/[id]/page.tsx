import { prisma } from '@/lib/prisma';
import CompanyDetailClient from './company-detail-client';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const company = await prisma.company.findUnique({ where: { name: id } });
    if (!company) throw new Error('Not found');
    const record = {
      name: company.name, company_name: company.company_name, abbr: company.abbr,
      default_currency: company.default_currency, country: company.country,
      tax_id: company.tax_id, domain: company.domain, is_group: company.is_group || false,
      parent_company: company.parent_company, docstatus: company.docstatus || 0,
      default_finance_book: company.default_finance_book, company_logo: company.company_logo,
      company_description: company.company_description,
      default_bank_account: company.default_bank_account, default_cash_account: company.default_cash_account,
      default_receivable_account: company.default_receivable_account,
      default_payable_account: company.default_payable_account,
      default_expense_account: company.default_expense_account,
      default_income_account: company.default_income_account,
      default_inventory_account: company.default_inventory_account,
      cost_center: company.cost_center, phone_no: company.phone_no,
      email: company.email, website: company.website,
      date_of_establishment: company.date_of_establishment,
    };
    return <CompanyDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Company not found</div>; }
}
