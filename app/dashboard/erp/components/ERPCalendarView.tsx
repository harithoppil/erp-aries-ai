'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import { CalendarDays, Loader2 } from 'lucide-react';
import {
  fetchCalendarEvents,
  updateCalendarEventDate,
  type CalendarEvent,
  type CalendarConfig,
  type FetchCalendarResult,
} from '@/app/dashboard/erp/calendar-actions';

interface ERPCalendarViewProps {
  doctype: string;
}

function CalendarSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array(35).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ERPCalendarView({ doctype }: ERPCalendarViewProps): JSX.Element {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result: FetchCalendarResult = await fetchCalendarEvents(doctype);
    if (result.success) {
      setEvents(result.events);
      setConfig(result.config);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [doctype]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const dt = info.event.extendedProps.doctype as string | undefined;
    const name = info.event.extendedProps.name as string | undefined;
    if (dt && name) {
      router.push(`/dashboard/erp/${dt}/${encodeURIComponent(name)}`);
    }
  }, [router]);

  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    if (!config || !info.event.start) {
      info.revert();
      return;
    }

    const dt = info.event.extendedProps.doctype as string | undefined;
    if (!dt) { info.revert(); return; }

    const result = await updateCalendarEventDate(
      dt,
      info.event.id,
      config.dateField,
      info.event.start.toISOString(),
      config.dateFieldEnd,
      info.event.end?.toISOString(),
    );

    if (!result.success) {
      info.revert();
      toast.error(result.error || 'Failed to move event');
    } else {
      toast.success('Event moved');
    }
  }, [config]);

  const handleDateClick = useCallback((info: { dateStr: string }) => {
    router.push(`/dashboard/erp/${doctype}/new?${config?.dateField}=${encodeURIComponent(info.dateStr)}`);
  }, [doctype, config]);

  if (loading) {
    return <CalendarSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4" />
          Calendar — {config?.doctypeLabel || doctype}
        </CardTitle>
        {config && (
          <CardDescription>
            Showing {config.dateField}{config.dateFieldEnd ? ` → ${config.dateFieldEnd}` : ''} • {events.length} event(s)
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className={isMobile ? 'text-xs' : ''}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={isMobile ? 'dayGridMonth' : 'dayGridMonth'}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: isMobile ? 'dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.start,
              end: e.end,
              allDay: e.allDay,
              backgroundColor: e.color || '#3b82f6',
              borderColor: e.color || '#3b82f6',
              extendedProps: { doctype: e.doctype, name: e.name },
            }))}
            editable={true}
            droppable={true}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            dateClick={handleDateClick}
            height="auto"
            dayMaxEvents={3}
            nowIndicator={true}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
