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
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] sm:w-auto min-w-[320px] pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-150"
    >
      <div
        className={`flex items-center justify-between gap-3 p-3.5 rounded-md shadow-2xl border backdrop-blur-md ${
          isSuccess
            ? 'bg-[#151B23]/95 border-[#C5A059] text-[#F0F4F8]'
            : isError
            ? 'bg-[#1F1315]/95 border-rose-500/60 text-rose-100'
            : isWarning
            ? 'bg-[#221B10]/95 border-amber-500/60 text-amber-100'
            : 'bg-[#151B23]/95 border-[#212835] text-[#F0F4F8]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
              isSuccess
                ? 'bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30'
                : isError
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : isWarning
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-[#1C232D] text-[#9BA7B6] border border-[#212835]'
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
          className="p-1 rounded-md text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#1C232D] transition shrink-0 cursor-pointer"
          aria-label="بستن اعلان"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
