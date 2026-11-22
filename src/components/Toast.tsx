import React, { useEffect, useRef } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const TOAST_EVENT = 'talaie:toast';

export function triggerToast(type: 'success' | 'error' | 'warning' | 'info', message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { type, message },
      })
    );
  }
}

interface Props {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ toast, onClose }) => {
  // onClose is usually an inline arrow: keep it in a ref so parent re-renders
  // don't restart the timer (that kept toasts on screen indefinitely).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!toast) return;
    // errors stay a little longer so they can actually be read
    const timer = setTimeout(() => closeRef.current(), toast.type === 'error' ? 7000 : 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';

  return (
    <aside
      aria-label="اعلان پیام سامانه"
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] sm:w-auto min-w-[320px] pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-150"
    >
      <div
        className={`flex items-center justify-between gap-3 p-3.5 rounded-md shadow-2xl border backdrop-blur-md ${
          isSuccess
            ? 'bg-surface/95 border-brand text-ink'
            : isError
            ? 'bg-surface/95 border-rose-500/60 text-ink'
            : isWarning
            ? 'bg-surface/95 border-amber-500/60 text-ink'
            : 'bg-surface/95 border-line text-ink'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
              isSuccess
                ? 'bg-brand/15 text-brand-ink border border-brand/30'
                : isError
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : isWarning
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-raised text-ink-2 border border-line'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            {isError && <AlertOctagon className="w-4 h-4" aria-hidden="true" />}
            {isWarning && <AlertTriangle className="w-4 h-4" aria-hidden="true" />}
            {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4" aria-hidden="true" />}
          </div>
          <p className="text-xs sm:text-sm font-bold leading-snug">{toast.message}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-ink-2 hover:text-ink hover:bg-raised transition shrink-0 cursor-pointer"
          aria-label="بستن اعلان"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
