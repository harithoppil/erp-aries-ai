'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Image as ImageIcon } from 'lucide-react';
import { fetchDoctypeList } from '@/app/dashboard/erp/[doctype]/actions';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

interface ERPImageViewProps {
  doctype: string;
  imageField: string;
  titleField?: string;
}

interface ImageCard {
  name: string;
  title: string;
  imageUrl: string | null;
  [key: string]: unknown;
}

function ImageCardSkeleton(): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <CardContent className="p-3">
        <Skeleton className="h-4 w-28 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function ImageGridSkeleton({ isMobile }: { isMobile: boolean }): JSX.Element {
  const cols = isMobile ? 2 : 4;
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {Array(8).fill(0).map((_, i) => <ImageCardSkeleton key={i} />)}
    </div>
  );
}

function PlaceholderInitials({ name }: { name: string }): JSX.Element {
  const initials = name
    .split(/[\s-_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="h-40 w-full bg-muted flex items-center justify-center">
      <span className="text-3xl font-bold text-muted-foreground">{initials || '?'}</span>
    </div>
  );
}

export function ERPImageView({ doctype, imageField, titleField }: ERPImageViewProps): JSX.Element {
  const [cards, setCards] = useState<ImageCard[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDoctypeList(doctype, { pageSize: 100 }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        const mapped: ImageCard[] = result.records.map((r) => ({
          name: String(r.name ?? ''),
          title: titleField && r[titleField] ? String(r[titleField]) : String(r.name ?? ''),
          imageUrl: r[imageField] ? String(r[imageField]) : null,
          ...r,
        }));
        setCards(mapped);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [doctype, imageField, titleField]);

  if (loading) {
    return <ImageGridSkeleton isMobile={isMobile} />;
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No records to display</p>
        </CardContent>
      </Card>
    );
  }

  const gridCols = isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Images — {toDisplayLabel(doctype)}
        </h3>
        <Badge variant="secondary" className="text-xs">{cards.length} records</Badge>
      </div>

      <div className={`grid ${gridCols} gap-4`}>
        {cards.map((card) => (
          <Card
            key={card.name}
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(card.name)}`)}
          >
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.imageUrl} alt={card.title} className="h-40 w-full object-cover" />
            ) : (
              <PlaceholderInitials name={card.title || card.name} />
            )}
            <CardContent className="p-3">
              <p className="text-sm font-medium truncate">{card.title}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{card.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
