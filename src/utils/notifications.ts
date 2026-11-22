import type { NotificationEvent } from './notificationRules';
import { triggerToast } from '../components/Toast';

/**
 * Delivering notifications: system notification on the phone (via the service worker,
 * which Android requires), an in-app history for the bell, and the app-icon badge.
 */

export const NOTIFICATIONS_CHANGED_EVENT = 'talaie:notifications-changed';
export const NOTIFICATION_OPEN_TAB_EVENT = 'talaie:notification-open-tab';
const HISTORY_KEY = 'talaie_notifications_v1';
const SEEN_KEY = 'talaie_notifications_seen_v1';
const PROMPT_DISMISSED_KEY = 'talaie_notifications_prompt_dismissed_v1';
const MAX_HISTORY = 60;
const MAX_SEEN = 400;
/** how long an edit made on this device keeps its own echo from notifying */
const LOCAL_WINDOW_MS = 20000;

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  tab?: string;
  urgent?: boolean;
  at: number;
  read: boolean;
}

// ---------------------------------------------------------------- own edits
const localChanges = new Map<string, number>();

/** called for every change this device makes, so its own edits never notify */
export function markLocalChange(entityKey: string | undefined): void {
  if (!entityKey) return;
  localChanges.set(entityKey, Date.now());
}

export function wasChangedLocally(entityKey: string): boolean {
  const at = localChanges.get(entityKey);
  return at !== undefined && Date.now() - at < LOCAL_WINDOW_MS;
}

// ---------------------------------------------------------------- storage
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: notifications still show, only history is lost
  }
}

const historyKey = (userId: string) => `${HISTORY_KEY}:${userId}`;
const seenKey = (userId: string) => `${SEEN_KEY}:${userId}`;

export function getNotificationHistory(userId: string): StoredNotification[] {
  return read<StoredNotification[]>(historyKey(userId), []);
}

export function getUnreadCount(userId: string): number {
  return getNotificationHistory(userId).filter((n) => !n.read).length;
}

export function markAllRead(userId: string): void {
  write(
    historyKey(userId),
    getNotificationHistory(userId).map((n) => ({ ...n, read: true })),
  );
  updateAppBadge(0);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function clearNotificationHistory(userId: string): void {
  write(historyKey(userId), []);
  updateAppBadge(0);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

function updateAppBadge(count: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) void nav.setAppBadge?.(count);
    else void nav.clearAppBadge?.();
  } catch {
    // not supported
  }
}

// ---------------------------------------------------------------- permission
export type NotificationSupport = 'granted' | 'default' | 'denied' | 'ios-install' | 'unsupported';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === 'undefined') return 'unsupported';
  // iPhone only allows notifications for apps added to the home screen (iOS 16.4+)
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationSupport;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (!('Notification' in window)) return getNotificationSupport();
  try {
    await Notification.requestPermission();
  } catch {
    // old Safari uses a callback form; the current state is read below either way
  }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  return getNotificationSupport();
}

export function isPromptDismissed(): boolean {
  return read<boolean>(PROMPT_DISMISSED_KEY, false);
}

export function dismissPrompt(): void {
  write(PROMPT_DISMISSED_KEY, true);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

// ---------------------------------------------------------------- delivery
async function showSystemNotification(n: StoredNotification): Promise<void> {
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: n.body,
    tag: n.id,
    icon: './icon-192.png',
    badge: './badge-96.png',
    dir: 'rtl',
    lang: 'fa',
    data: { tab: n.tab },
    vibrate: n.urgent ? [200, 100, 200] : [120],
    requireInteraction: Boolean(n.urgent),
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(n.title, options);
      return;
    }
    // no service worker (dev mode): desktop browsers still allow the plain constructor
    new Notification(n.title, options);
  } catch {
    // Android Chrome throws on the constructor without a service worker; the in-app copy remains
  }
}

/**
 * Show a batch of events. Already-seen ids and this device's own edits are skipped.
 * A large batch (e.g. catching up after the phone was off) becomes one summary notification.
 */
export function deliverNotifications(userId: string, events: NotificationEvent[]): void {
  const seen = new Set(read<string[]>(seenKey(userId), []));
  const fresh = events.filter((e) => !seen.has(e.id) && !wasChangedLocally(e.entityKey));
  if (fresh.length === 0) return;

  const now = Date.now();
  const stored: StoredNotification[] = fresh.map((e) => ({
    id: e.id,
    title: e.title,
    body: e.body,
    tab: e.tab,
    urgent: e.urgent,
    at: now,
    read: false,
  }));

  write(seenKey(userId), [...fresh.map((e) => e.id), ...seen].slice(0, MAX_SEEN));
  const history = [...stored, ...getNotificationHistory(userId)].slice(0, MAX_HISTORY);
  write(historyKey(userId), history);
  updateAppBadge(history.filter((n) => !n.read).length);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));

  const appVisible = document.visibilityState === 'visible';
  if (appVisible) {
    // the person is looking at the app: a toast is enough, no system banner on top of it
    const first = stored[0];
    triggerToast(
      first.urgent ? 'warning' : 'info',
      stored.length === 1 ? `${first.title}: ${first.body}` : `${stored.length} اعلان جدید — ${first.title}`,
    );
    if (stored.some((s) => s.urgent)) {
      try {
        navigator.vibrate?.([150, 80, 150]);
      } catch {
        // not supported
      }
    }
    return;
  }

  if (getNotificationSupport() !== 'granted') return;
  if (stored.length > 3) {
    void showSystemNotification({
      id: `summary:${now}`,
      title: `${stored.length} اعلان جدید`,
      body: stored.slice(0, 3).map((s) => s.title).join(' · '),
      urgent: stored.some((s) => s.urgent),
      at: now,
      read: false,
    });
    return;
  }
  for (const s of stored) void showSystemNotification(s);
}

/** remember events without showing them (first load: what already existed is not "new") */
export function markEventsSeen(userId: string, events: NotificationEvent[]): void {
  if (events.length === 0) return;
  const seen = read<string[]>(seenKey(userId), []);
  write(seenKey(userId), [...events.map((e) => e.id), ...seen].slice(0, MAX_SEEN));
}
