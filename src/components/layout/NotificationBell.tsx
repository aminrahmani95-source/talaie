import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { toPersianDigits, formatJalaliDateTime } from '../../utils/jalali';
import {
  NOTIFICATIONS_CHANGED_EVENT,
  NOTIFICATION_OPEN_TAB_EVENT,
  clearNotificationHistory,
  getNotificationHistory,
  getNotificationSupport,
  markAllRead,
  requestNotificationPermission,
  isPromptDismissed,
  dismissPrompt,
  type NotificationSupport,
  type StoredNotification,
} from '../../utils/notifications';

function useNotificationState(userId: string) {
  const [items, setItems] = useState<StoredNotification[]>(() => getNotificationHistory(userId));
  const [support, setSupport] = useState<NotificationSupport>(() => getNotificationSupport());
  useEffect(() => {
    const refresh = () => {
      setItems(getNotificationHistory(userId));
      setSupport(getNotificationSupport());
    };
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [userId]);
  return { items, support };
}

/** what to tell the person about turning phone notifications on */
export const PermissionHelp: React.FC<{ support: NotificationSupport; compact?: boolean }> = ({ support, compact }) => {
  const [asking, setAsking] = useState(false);
  if (support === 'granted') {
    return compact ? null : (
      <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
        <BellRing className="w-4 h-4" /> اعلان‌های گوشی روشن است.
      </p>
    );
  }
  if (support === 'ios-install') {
    return (
      <p className="text-xs text-ink-2 leading-relaxed flex items-start gap-1.5">
        <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          روی آیفون، اعلان فقط وقتی کار می‌کند که برنامه را به صفحه‌ی اصلی اضافه کنید: در سافاری دکمه‌ی
          «اشتراک‌گذاری» ← «Add to Home Screen»، بعد برنامه را از روی آیکون باز کنید.
        </span>
      </p>
    );
  }
  if (support === 'denied') {
    return (
      <p className="text-xs text-ink-2 leading-relaxed flex items-start gap-1.5">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
        <span>
          اعلان‌ها برای این سایت مسدود شده است. در تنظیمات مرورگر (آیکون قفل کنار آدرس ← Notifications) آن را روی
          «Allow» بگذارید.
        </span>
      </p>
    );
  }
  if (support === 'unsupported') {
    return <p className="text-xs text-ink-3">این مرورگر از اعلان پشتیبانی نمی‌کند. از Chrome استفاده کنید.</p>;
  }
  return (
    <button
      type="button"
      disabled={asking}
      onClick={async () => {
        setAsking(true);
        await requestNotificationPermission();
        setAsking(false);
      }}
      className="w-full px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-sm font-black flex items-center justify-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-60"
    >
      <BellRing className="w-4 h-4" />
      روشن کردن اعلان‌های گوشی
    </button>
  );
};

export const NotificationBell: React.FC<{ userId: string }> = ({ userId }) => {
  const { items, support } = useNotificationState(userId);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  const close = () => {
    setOpen(false);
    if (unread > 0) markAllRead(userId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `اعلان‌ها، ${toPersianDigits(unread)} خوانده‌نشده` : 'اعلان‌ها'}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-ink-2 hover:text-ink hover:bg-raised cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center tabular-nums">
            {unread > 99 ? '99+' : toPersianDigits(unread)}
          </span>
        )}
        {support === 'default' && unread === 0 && (
          <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
        )}
      </button>

      <Sheet isOpen={open} onClose={close} title="اعلان‌ها">
        <div className="p-4 space-y-4">
          <PermissionHelp support={support} />

          {items.length === 0 ? (
            <p className="text-sm text-ink-3 text-center py-8">هنوز اعلانی نیامده است.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {items.map((n) => (
                <li key={`${n.id}-${n.at}`}>
                  <button
                    type="button"
                    disabled={!n.tab}
                    onClick={() => {
                      if (!n.tab) return;
                      window.dispatchEvent(new CustomEvent(NOTIFICATION_OPEN_TAB_EVENT, { detail: n.tab }));
                      close();
                    }}
                    className="w-full text-right p-3 flex items-start gap-2.5 enabled:hover:bg-raised enabled:cursor-pointer"
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        n.read ? 'bg-transparent' : n.urgent ? 'bg-rose-500' : 'bg-brand'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 grow">
                      <span className="block text-sm font-bold text-ink">{n.title}</span>
                      <span className="block text-xs text-ink-2 mt-0.5 line-clamp-2">{n.body}</span>
                      <span className="block text-[11px] text-ink-3 mt-1 tabular-nums">
                        {formatJalaliDateTime(new Date(n.at))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => clearNotificationHistory(userId)}
              className="text-xs font-bold text-ink-3 hover:text-ink cursor-pointer"
            >
              پاک کردن همه
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
};

/**
 * One-time card that asks to turn phone notifications on. The browser only allows
 * the permission dialog after a tap, so this cannot happen automatically.
 */
export const NotificationPrompt: React.FC<{ userId: string }> = ({ userId }) => {
  const { support } = useNotificationState(userId);
  const [dismissed, setDismissed] = useState(() => isPromptDismissed());
  if (dismissed || (support !== 'default' && support !== 'ios-install')) return null;
  // یک خط جمع‌وجور؛ قبلاً یک کارت بزرگ بالای صفحه جای اولین کار را می‌گرفت
  return (
    <div className="mb-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 flex items-center gap-2 flex-wrap">
      <BellRing className="w-4 h-4 text-brand-ink shrink-0" />
      <p className="text-xs font-bold text-ink grow min-w-0">اعلان گوشی برای توقف، تیکت و کار جدید خاموش است.</p>
      {support === 'default' ? (
        <button
          type="button"
          onClick={() => void requestNotificationPermission()}
          className="shrink-0 px-3 rounded-md bg-brand hover:bg-brand-hover text-on-brand text-xs font-black cursor-pointer min-h-[36px]"
        >
          روشن کن
        </button>
      ) : (
        <div className="w-full">
          <PermissionHelp support={support} compact />
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          dismissPrompt();
          setDismissed(true);
        }}
        className="shrink-0 px-2 text-xs font-bold text-ink-3 hover:text-ink cursor-pointer min-h-[36px]"
      >
        بعداً
      </button>
    </div>
  );
};
