import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export const TOAST_EVENT = 'talaie:toast';

export function triggerToast(type: ToastType, message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { type, message },
      })
    );
  }
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-[90vw] pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
      classes:
        'bg-[#151B23]/95 text-[#F0F4F8] border border-emerald-500/40 shadow-xl backdrop-blur-md',
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
      classes:
        'bg-[#1F1315]/95 text-rose-100 border border-rose-500/40 shadow-xl backdrop-blur-md',
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      classes:
        'bg-[#221B10]/95 text-amber-100 border border-amber-500/40 shadow-xl backdrop-blur-md',
    },
    info: {
      icon: <Info className="w-4 h-4 text-sky-400 shrink-0" />,
      classes:
        'bg-[#151B23]/95 text-[#F0F4F8] border border-sky-500/40 shadow-xl backdrop-blur-md',
    },
  }[toast.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-md animate-in slide-in-from-bottom-2 duration-150 ${config.classes}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {config.icon}
        <span className="text-xs sm:text-sm font-bold truncate leading-snug">
          {toast.message}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="بستن پیام"
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
