import React, { useState, useEffect } from 'react';
import {
  X,
  AlertOctagon,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  FolderKanban,
  FileText,
} from 'lucide-react';
import { OfflineQueue, FailedOperation } from '../../utils/offlineQueue';
import { toPersianDigits, formatJalaliDateTime } from '../../utils/jalali';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

export const FailedOperationsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onActionComplete,
}) => {
  const [failedOps, setFailedOps] = useState<FailedOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const ops = await OfflineQueue.getFailedOperations();
      setFailedOps(ops.sort((a, b) => b.failedAt - a.failedAt));
    } catch (err) {
      console.warn('Failed to load failed operations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRetry = async (id: string) => {
    setProcessingId(id);
    try {
      await OfflineQueue.retryFailedOperation(id);
      await loadData();
      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('Error retrying operation:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این عملیات از صف اطمینان دارید؟ تغییرات ذخیره‌نشده دور ریخته خواهند شد.')) {
      return;
    }
    setProcessingId(id);
    try {
      await OfflineQueue.deleteFailedOperation(id);
      await loadData();
      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('Error deleting failed operation:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const getOperationTitle = (op: FailedOperation): string => {
    switch (op.type) {
      case 'CREATE_PROJECT':
        return 'ثبت پروژه جدید';
      case 'PATCH_PROJECT':
        return 'به‌روزرسانی جزئی پروژه';
      case 'APPEND_PROJECT_EVALUATION':
        return 'ثبت ارزیابی پرسنل';
      case 'DELETE_PROJECT':
        return 'حذف پروژه';
      case 'CREATE_TICKET':
        return 'ثبت تیکت اضطراری';
      case 'PATCH_TICKET':
        return 'به‌روزرسانی تیکت';
      case 'DELETE_TICKET':
        return 'حذف تیکت';
      case 'UPDATE_SETTINGS':
        return 'به‌روزرسانی تنظیمات سیستم';
      default:
        return 'عملیات سیستمی';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="failed-ops-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-[#1A1A1A] w-full max-w-2xl rounded-3xl border border-[#E8E4DC] dark:border-[#2E2E2E] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#E8E4DC] dark:border-[#2E2E2E] flex items-center justify-between bg-[#FAF7F2] dark:bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="failed-ops-title" className="text-base sm:text-lg font-black text-[#1E1E1E] dark:text-[#F5EFEB]">
                مدیریت ارسال‌های ناموفق به سرور
              </h2>
              <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-0.5">
                تغییراتی که پس از چند تلاش به دلیل خطا یا اعتبارسنجی سرور ارسال نشدند
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#71717A] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#71717A] dark:text-[#A1A1AA] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C1A056]" />
              <span>در حال بارگذاری لیست ارسال‌های ناموفق...</span>
            </div>
          ) : failedOps.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                هیچ عملیات ناموفقی در سیستم وجود ندارد.
              </div>
              <p className="text-xs text-zinc-400">تمام تغییرات با موفقیت در سرور ابری ثبت شده‌اند.</p>
            </div>
          ) : (
            failedOps.map((op) => (
              <div
                key={op.id}
                className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                        {getOperationTitle(op)}
                      </span>
                      {op.orderingKey && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {op.orderingKey}
                        </span>
                      )}
                    </div>
                    {op.payload?.title && (
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                        <FolderKanban className="w-3.5 h-3.5 text-[#C1A056]" />
                        <span>{op.payload.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{formatJalaliDateTime(new Date(op.failedAt))}</span>
                  </div>
                </div>

                {/* Error message */}
                <div className="p-3 rounded-xl bg-white/80 dark:bg-black/40 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-mono leading-relaxed break-all">
                  <span className="font-bold text-rose-700 dark:text-rose-400">علت خطا: </span>
                  {op.errorReason}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-rose-500/10">
                  <span className="text-[11px] text-zinc-500">
                    تعداد تلاش‌ها: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{toPersianDigits(op.retryCount)}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={processingId === op.id}
                      onClick={() => handleRetry(op.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C1A056] text-[#212121] text-xs font-bold hover:bg-[#A88738] active:scale-95 transition disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${processingId === op.id ? 'animate-spin' : ''}`} />
                      <span>تلاش دوباره</span>
                    </button>
                    <button
                      type="button"
                      disabled={processingId === op.id}
                      onClick={() => handleDelete(op.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-bold active:scale-95 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E8E4DC] dark:border-[#2E2E2E] bg-[#FAF7F2] dark:bg-[#141414] flex items-center justify-between">
          <span className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
            {toPersianDigits(failedOps.length)} مورد ناموفق در انتظار بررسی
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#212121] dark:bg-[#FAF7F2] text-white dark:text-[#212121] text-xs font-bold active:scale-95 transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
