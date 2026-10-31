import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
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
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      classes:
        'bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-white border border-emerald-200 dark:border-emerald-800/60 shadow-lg',
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
      classes:
        'bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-white border border-rose-300 dark:border-rose-800/60 shadow-lg',
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      classes:
        'bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-white border border-amber-300 dark:border-amber-800/60 shadow-lg',
    },
    info: {
      icon: <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />,
      classes:
        'bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-white border border-sky-300 dark:border-sky-800/60 shadow-lg',
    },
  }[toast.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl animate-in slide-in-from-bottom-2 duration-200 ${config.classes}`}
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
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
