import React, { useEffect } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface Props {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';

  return (
    <aside
      aria-label="اعلان پیام سامانه"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] sm:w-auto min-w-[320px] pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div
        className={`flex items-center justify-between gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
          isSuccess
            ? 'bg-[#181818]/95 border-[#C1A056] text-[#FAF7F2]'
            : isError
            ? 'bg-rose-950/95 border-rose-500 text-rose-100'
            : isWarning
            ? 'bg-amber-950/95 border-amber-500 text-amber-100'
            : 'bg-[#181818]/95 border-white/20 text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isSuccess
                ? 'bg-[#C1A056]/20 text-[#C1A056] border border-[#C1A056]/40'
                : isError
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : isWarning
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-white/10 text-white'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-5 h-5" aria-hidden="true" />}
            {isError && <AlertOctagon className="w-5 h-5" aria-hidden="true" />}
            {isWarning && <AlertTriangle className="w-5 h-5" aria-hidden="true" />}
            {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5" aria-hidden="true" />}
          </div>
          <p className="text-xs sm:text-sm font-bold leading-snug">{toast.message}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition shrink-0"
          aria-label="بستن اعلان"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
