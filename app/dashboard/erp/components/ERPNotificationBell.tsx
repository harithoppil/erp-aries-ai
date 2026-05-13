'use client';

import { useState, useEffect, useTransition } from 'react';
import { Bell, Check, CheckCheck, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  type NotificationInfo,
  type NotificationType,
} from '@/app/dashboard/erp/notifications/notification-actions';
import { formatDatetime } from '@/lib/erpnext/locale';
import { useRouter } from 'next/navigation';

const TYPE_COLORS: Record<NotificationType, string> = {
  Info: 'bg-blue-100 text-blue-800',
  Success: 'bg-green-100 text-green-800',
  Warning: 'bg-amber-100 text-amber-800',
  Alert: 'bg-orange-100 text-orange-800',
  Error: 'bg-red-100 text-red-800',
};

export default function ERPNotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadCount = () => {
    getUnreadCount().then(setUnreadCount);
  };

  const loadNotifications = () => {
    startTransition(async () => {
      const result = await listNotifications(undefined, false, 30);
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
      }
    });
  };

  // Poll for unread count every 30s
  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load full list when popover opens
  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      const result = await markNotificationRead(id);
      if (result.success) {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteNotification(id);
      if (result.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        loadCount();
      }
    });
  };

  const handleClearAll = () => {
    startTransition(async () => {
      const result = await clearAllNotifications();
      if (result.success) {
        setNotifications([]);
        setUnreadCount(0);
        toast.success('All notifications cleared');
      }
    });
  };

  const handleNavigate = (n: NotificationInfo) => {
    if (!n.read) handleMarkRead(n.id);
    if (n.doctype && n.docname) {
      setOpen(false);
      router.push(`/dashboard/erp/${n.doctype}/${encodeURIComponent(n.docname)}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                <CheckCheck className="mr-1 h-3 w-3" /> Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={handleClearAll}>
                <Trash2 className="mr-1 h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {pending && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-6 w-6 opacity-40" />
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}
                onClick={() => handleNavigate(n)}
              >
                <Badge variant="outline" className={`mt-0.5 text-[9px] shrink-0 ${TYPE_COLORS[n.type]}`}>
                  {n.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${!n.read ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {n.subject}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDatetime(n.creation)}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                      title="Mark as read"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  {n.doctype && n.docname && (
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}