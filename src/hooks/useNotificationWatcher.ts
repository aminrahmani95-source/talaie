import { useEffect, useRef } from 'react';
import type { User } from '../types';
import { computeNotificationEvents, type NotifySnapshot } from '../utils/notificationRules';
import { deliverNotifications, markEventsSeen } from '../utils/notifications';

/**
 * Compares each new data snapshot with the previous one and notifies about changes
 * relevant to this person's role. Until the first sync with the server finishes, the
 * snapshot only becomes the baseline: data loaded at startup is not "new".
 */
export function useNotificationWatcher(
  snapshot: NotifySnapshot,
  user: User | null,
  isSyncedWithServer: boolean,
): void {
  const prevRef = useRef<NotifySnapshot | null>(null);
  const userIdRef = useRef<string | null>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      prevRef.current = null;
      userIdRef.current = null;
      armedRef.current = false;
      return;
    }
    if (userIdRef.current !== user.id) {
      // new session: start over with a fresh baseline
      userIdRef.current = user.id;
      prevRef.current = snapshot;
      armedRef.current = false;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = snapshot;
    if (!prev) return;

    const events = computeNotificationEvents(prev, snapshot, user);
    if (!armedRef.current) {
      // still loading: remember what exists so it is never announced later as new
      markEventsSeen(user.id, events);
      if (isSyncedWithServer) armedRef.current = true;
      return;
    }
    deliverNotifications(user.id, events);
  }, [snapshot, user, isSyncedWithServer]);
}
