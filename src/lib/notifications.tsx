import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  NOTIFICATION_EVENT,
  NOTIFICATIONS_NAMESPACE,
  NotificationEventSchema,
  UNREAD_EVENT,
  UnreadEventSchema,
  localize,
  type Notification,
} from '@/contracts';
import { useAccount } from './account';
import { fetchNotifications, markNotificationsRead } from './api';
import { openSocket } from './realtime';

type NotificationsValue = {
  unread: number;
  items: Notification[] | null;
  /** Loads the list and marks everything read (opening the Notifications screen, FR-26). */
  openList: () => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/** Where a notification leads (FR-26): the Friends list, today's Daily, or the Lobby. */
export function notificationTarget(item: Notification): string {
  if (item.kind === 'friendRequest') return '/friends';
  if (item.kind === 'nudge') return '/';
  return `/lobby/${item.code}`;
}

export function notificationText(item: Notification): string {
  const name = item.actor.username;
  if (item.kind === 'friendRequest') return `${name} sent you a Friend Request`;
  if (item.kind === 'nudge') {
    return item.streak > 0 ? `${name} nudged you — keep your ${item.streak}-day streak going` : `${name} nudged you — today's question is waiting`;
  }
  return `${name} invited you to a Lobby: ${localize(item.quizTitle)}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** The unread count on load, then live over the `/notifications` socket. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { ready, me } = useAccount();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!ready) {
      setUnread(0);
      setItems(null);
      return;
    }
    let live = true;
    fetchNotifications().then(
      (body) => {
        if (!live) return;
        setUnread(body.unread);
        setItems(body.notifications);
      },
      () => {},
    );
    const socket = openSocket(NOTIFICATIONS_NAMESPACE);
    socket.on(NOTIFICATION_EVENT, (payload: unknown) => {
      const event = NotificationEventSchema.safeParse(payload);
      if (!event.success) return;
      setUnread(event.data.unread);
      setItems((current) => [event.data.notification, ...(current ?? []).filter((item) => item.id !== event.data.notification.id)]);
    });
    socket.on(UNREAD_EVENT, (payload: unknown) => {
      const event = UnreadEventSchema.safeParse(payload);
      if (event.success) setUnread(event.data.unread);
    });
    return () => {
      live = false;
      socket.close();
    };
  }, [ready, me?.id]);

  const openList = useCallback(async () => {
    try {
      const body = await fetchNotifications();
      setItems(body.notifications);
      if (body.unread > 0) await markNotificationsRead();
      setUnread(0);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(() => ({ unread, items, openList }), [unread, items, openList]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications needs <NotificationsProvider>');
  return value;
}
