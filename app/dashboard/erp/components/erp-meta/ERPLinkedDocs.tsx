'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Link2, ChevronRight } from 'lucide-react';
import {
  fetchLinkedDocs,
  type LinkedDocType,
  type FetchLinkedDocsResult,
} from '@/app/dashboard/erp/[doctype]/[name]/linked-docs-actions';

interface ERPLinkedDocsProps {
  doctype: string;
  recordName: string;
}

function LinkedDocsSkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="ml-2 space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ERPLinkedDocs({ doctype, recordName }: ERPLinkedDocsProps): JSX.Element {
  const [links, setLinks] = useState<LinkedDocType[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLinkedDocs(doctype, recordName).then((result: FetchLinkedDocsResult) => {
      if (cancelled) return;
      if (result.success) setLinks(result.links);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [doctype, recordName]);

  if (!loading && links.length === 0) {
    return <></>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4" />
          Linked Documents
          {links.length > 0 && (
            <Badge variant="secondary" className="text-xs">{links.reduce((s, l) => s + l.count, 0)}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LinkedDocsSkeleton />
        ) : (
          <div className={isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4'}>
            {links.map((link) => (
              <div key={`${link.doctype}-${link.fieldname}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{link.doctypeLabel}</span>
                  <Badge variant="outline" className="text-[10px]">{link.fieldname}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{link.count}</Badge>
                </div>
                <div className="space-y-0.5 ml-2">
                  {link.records.map((r) => (
                    <button
                      key={r.name}
                      onClick={() => router.push(`/dashboard/erp/${link.doctype.toLowerCase().replace(/_/g, '-')}/${encodeURIComponent(r.name)}`)}
                      className="flex items-center gap-1.5 w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded px-2 py-1 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{r.name}</span>
                      {r.label && r.label !== r.name && (
                        <span className="truncate">— {r.label}</span>
                      )}
                    </button>
                  ))}
                  {link.count > 5 && (
                    <button
                      onClick={() => router.push(`/dashboard/erp/${link.doctype.toLowerCase().replace(/_/g, '-')}?filters=${encodeURIComponent(JSON.stringify({ [link.fieldname]: recordName }))}`)}
                      className="text-xs text-blue-500 hover:underline px-2 py-0.5"
                    >
                      View all {link.count} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
