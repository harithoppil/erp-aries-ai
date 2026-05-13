import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getWorkspaceSlugs } from '@/app/dashboard/erp/workspace-actions';
import { WorkspaceClient } from './workspace-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return getWorkspaceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const label = slug.charAt(0).toUpperCase() + slug.slice(1);
  return { title: `${label} — ERP Workspace` };
}

export default async function WorkspacePage({ params }: PageProps) {
  const { slug } = await params;

  const slugs = getWorkspaceSlugs();
  if (!slugs.includes(slug)) {
    notFound();
  }

  return <WorkspaceClient slug={slug} />;
}
