'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  MessageSquare, Edit3, Plus, CheckCircle2, XCircle, Clock, Send, Loader2,
} from 'lucide-react';
import {
  fetchTimeline,
  addComment,
  type TimelineEvent,
  type FetchTimelineResult,
} from '@/app/dashboard/erp/[doctype]/[name]/timeline-actions';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

interface ERPFormTimelineProps {
  doctype: string;
  recordName: string;
}

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.replace(/[@.]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function CreationEvent({ event }: { event: TimelineEvent }): JSX.Element {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">{initials(event.owner)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.owner || 'Unknown'}</span>
          <span className="text-muted-foreground"> created this record</span>
        </p>
        <p className="text-xs text-muted-foreground">{relativeTime(event.creation)}</p>
      </div>
      <Plus className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
    </div>
  );
}

function StatusEvent({ event }: { event: TimelineEvent }): JSX.Element {
  const variant = event.status === 'Submitted' ? 'default' : 'destructive';
  const Icon = event.status === 'Submitted' ? CheckCircle2 : XCircle;
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs bg-green-100 text-green-700">
          <Icon className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.owner || 'Unknown'}</span>
          <span className="text-muted-foreground"> changed status to </span>
          <Badge variant={variant} className="text-xs ml-1">{event.status}</Badge>
        </p>
        <p className="text-xs text-muted-foreground">{relativeTime(event.creation)}</p>
      </div>
    </div>
  );
}

function VersionEvent({ event }: { event: TimelineEvent }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  if (!event.changes || event.changes.length === 0) return <></>;

  const displayChanges = expanded ? event.changes : event.changes.slice(0, 3);
  const moreCount = event.changes.length - 3;

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
          <Edit3 className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.owner || 'Unknown'}</span>
          <span className="text-muted-foreground"> edited {event.changes.length} field(s)</span>
        </p>
        <p className="text-xs text-muted-foreground mb-1">{relativeTime(event.creation)}</p>
        <div className="space-y-1">
          {displayChanges.map(([field, oldVal, newVal], i) => (
            <div key={i} className="text-xs flex items-center gap-1.5">
              <span className="font-mono text-muted-foreground">{field}</span>:
              <span className="line-through text-red-400/70 truncate max-w-[120px]">{String(oldVal) || '(empty)'}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-600 truncate max-w-[120px]">{String(newVal) || '(empty)'}</span>
            </div>
          ))}
        </div>
        {!expanded && moreCount > 0 && (
          <button onClick={() => setExpanded(true)} className="text-xs text-blue-500 hover:underline mt-1">
            +{moreCount} more change(s)
          </button>
        )}
      </div>
    </div>
  );
}

function CommentEvent({ event }: { event: TimelineEvent }): JSX.Element {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
          <MessageSquare className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.owner || 'Unknown'}</span>
          <span className="text-muted-foreground"> commented</span>
        </p>
        <p className="text-xs text-muted-foreground mb-1">{relativeTime(event.creation)}</p>
        <div className="rounded-md bg-muted/50 p-2 text-sm whitespace-pre-wrap">{event.content}</div>
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function TimelineSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ERPFormTimeline({ doctype, recordName }: ERPFormTimelineProps): JSX.Element {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    const result: FetchTimelineResult = await fetchTimeline(doctype, recordName);
    if (result.success) {
      setEvents(result.events);
    }
    setLoading(false);
  }, [doctype, recordName]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    const result = await addComment(doctype, recordName, commentText);
    if (result.success) {
      setCommentText('');
      await loadTimeline();
    }
    setSubmitting(false);
  }, [doctype, recordName, commentText, loadTimeline]);

  const doctypeLabel = toDisplayLabel(doctype);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          Activity
        </CardTitle>
        <CardDescription>{doctypeLabel} / {recordName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment input */}
        <div className={isMobile ? 'space-y-2' : 'flex gap-2'}>
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[60px] text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
            }}
          />
          <Button
            size="sm"
            onClick={handleAddComment}
            disabled={submitting || !commentText.trim()}
            className={isMobile ? 'w-full' : 'shrink-0 self-end'}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Timeline events — skeleton while loading */}
        {loading ? (
          <TimelineSkeleton />
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              switch (event.type) {
                case 'creation':
                  return <CreationEvent key={event.name} event={event} />;
                case 'status':
                  return <StatusEvent key={event.name} event={event} />;
                case 'version':
                  return <VersionEvent key={event.name} event={event} />;
                case 'comment':
                  return <CommentEvent key={event.name} event={event} />;
                default:
                  return null;
              }
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
