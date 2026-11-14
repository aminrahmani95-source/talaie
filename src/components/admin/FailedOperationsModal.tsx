import React, { useState, useEffect } from 'react';
import {
  X,
  AlertOctagon,
  AlertTriangle,
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
  currentUserId?: string;
}

export const FailedOperationsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onActionComplete,
  currentUserId,
}) => {
  const [failedOps, setFailedOps] = useState<FailedOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isRequeuing, setIsRequeuing] = useState(false);
  const [requeueNotice, setRequeueNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const ops = await OfflineQueue.getFailedOperations(currentUserId);
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
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

  const unsupportedMaterialOps = failedOps.filter((op) => {
    const isMaterialOp =
      (op.orderingKey && op.orderingKey.startsWith('material:')) ||
      op.type === 'CREATE_MATERIAL_REQUEST' ||
      op.type === 'PATCH_MATERIAL_REQUEST' ||
      op.type === 'DELETE_MATERIAL_REQUEST';

    const isServerNotImplementedError =
      op.errorReason.includes('FEATURE_NOT_IMPLEMENTED_ON_SERVER') ||
      op.errorReason.includes('همگام‌سازی ابری متریال هنوز در سرور فعال نشده است') ||
      op.errorReason.includes('در انتظار مایگریشن');

    return isMaterialOp && isServerNotImplementedError;
  });

  const handleRequeueMaterialOps = async () => {
    if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
      setRequeueNotice('خطا: دسترسی غیرمجاز؛ شناسه کاربر احرازنشده است.');
      return;
    }
    const cleanUserId = currentUserId.trim();

    setIsRequeuing(true);
    setRequeueNotice(null);
    try {
      const result = await OfflineQueue.requeueUnsupportedMaterialOperations(cleanUserId);
      if (result.requeuedCount > 0) {
        setRequeueNotice(
          `تعداد ${toPersianDigits(result.requeuedCount)} عملیات متریال با حفظ تقدم زمانی (FIFO) به صف ارسال بازگردانده شدند.`
        );
        await loadData();
        if (onActionComplete) onActionComplete();
      } else {
        setRequeueNotice('هیچ عملیات متریال واجد شرایطی برای بازیابی یافت نشد.');
      }
    } catch (err) {
      console.error('Error requeuing material ops:', err);
      setRequeueNotice('خطا در بازیابی عملیات‌های متریال.');
    } finally {
      setIsRequeuing(false);
    }
  };

  const handleRetry = async (id: string) => {
    if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
      return;
    }
    const cleanUserId = currentUserId.trim();

    setProcessingId(id);
    try {
      await OfflineQueue.retryFailedOperation(id, cleanUserId);
      await loadData();
      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('Error retrying operation:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
      return;
    }
    const cleanUserId = currentUserId.trim();

    if (!confirm('آیا از حذف این عملیات از صف اطمینان دارید؟ تغییرات ذخیره‌نشده دور ریخته خواهند شد.')) {
      return;
    }
    setProcessingId(id);
    try {
      await OfflineQueue.deleteFailedOperation(id, cleanUserId);
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
      case 'CREATE_MATERIAL_REQUEST':
        return 'ثبت درخواست متریال';
      case 'PATCH_MATERIAL_REQUEST':
        return 'تخصیص / تایید تحویل متریال';
      case 'DELETE_MATERIAL_REQUEST':
        return 'ابطال درخواست متریال';
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
      <div className="bg-[#151B23] w-full max-w-2xl rounded-lg border border-[#E8E4DC] dark:border-[#2E2E2E] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#E8E4DC] dark:border-[#2E2E2E] flex items-center justify-between bg-[#111620]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
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
            className="w-9 h-9 rounded-md flex items-center justify-center text-[#71717A] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {requeueNotice && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{requeueNotice}</span>
            </div>
          )}

          {unsupportedMaterialOps.length > 0 && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  تعداد {toPersianDigits(unsupportedMaterialOps.length)} عملیات متریال در انتظار ارتقای سرور هستند. در صورت استقرار جداول می‌توانید آن‌ها را بازیابی کنید.
                </span>
              </div>
              <button
                type="button"
                onClick={handleRequeueMaterialOps}
                disabled={isRequeuing}
                className="shrink-0 px-3.5 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer mr-auto sm:mr-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRequeuing ? 'animate-spin' : ''}`} />
                <span>بازیابی و صف‌بندی مجدد</span>
              </button>
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-sm text-[#71717A] dark:text-[#A1A1AA] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C5A059]" />
              <span>در حال بارگذاری لیست ارسال‌های ناموفق...</span>
            </div>
          ) : failedOps.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center justify-center">
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
                className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                        {getOperationTitle(op)}
                      </span>
                      {op.orderingKey && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {op.orderingKey}
                        </span>
                      )}
                    </div>
                    {op.payload?.title && (
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                        <FolderKanban className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>{op.payload.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{formatJalaliDateTime(new Date(op.failedAt))}</span>
                  </div>
                </div>

                {/* Error message */}
                <div className="p-3 rounded-md bg-white/80 dark:bg-black/40 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs leading-relaxed break-all">
                  <span className="font-bold text-rose-700 dark:text-rose-400">علت خطا: </span>
                  {op.errorReason}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-rose-500/10">
                  <span className="text-xs text-zinc-500">
                    تعداد تلاش‌ها: <strong className="text-zinc-700 dark:text-zinc-300">{toPersianDigits(op.retryCount)}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={processingId === op.id}
                      onClick={() => handleRetry(op.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#C1A056] text-[#212121] text-xs font-bold hover:bg-[#A88738] active:scale-95 transition disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${processingId === op.id ? 'animate-spin' : ''}`} />
                      <span>تلاش دوباره</span>
                    </button>
                    <button
                      type="button"
                      disabled={processingId === op.id}
                      onClick={() => handleDelete(op.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-bold active:scale-95 transition disabled:opacity-50 cursor-pointer"
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
        <div className="p-4 sm:p-5 border-t border-[#E8E4DC] dark:border-[#2E2E2E] bg-[#111620] flex items-center justify-between">
          <span className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
            {toPersianDigits(failedOps.length)} مورد ناموفق در انتظار بررسی
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-[#0D1117] dark:bg-[#FAF7F2] text-white dark:text-[#212121] text-xs font-bold active:scale-95 transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
