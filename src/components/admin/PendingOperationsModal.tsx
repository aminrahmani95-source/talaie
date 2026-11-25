import React, { useState, useEffect } from 'react';
import { Portal } from '../ui/Portal';
import {
  X,
  Cloud,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { OfflineQueue, OutboxOperation } from '../../utils/offlineQueue';
import { SupabaseSyncService } from '../../utils/supabase';
import { toPersianDigits, formatJalaliDateTime } from '../../utils/jalali';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
  currentUserId?: string;
}

export const PendingOperationsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onActionComplete,
  currentUserId,
}) => {
  useEscapeKey(onClose, isOpen);
  const [pendingOps, setPendingOps] = useState<OutboxOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const ops = await OfflineQueue.getPendingOperations(currentUserId);
      setPendingOps(ops.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.warn('Failed to load pending operations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setNotice(null);
    }
  }, [isOpen, currentUserId]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setNotice(null);
    try {
      await SupabaseSyncService.processOfflineQueue(currentUserId);
      await new Promise((r) => setTimeout(r, 600));
      await loadData();
      setNotice('درخواست ارسال فوری با موفقیت به موتور همگام‌سازی ارسال گردید.');
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setNotice(`خطا در همگام‌سازی: ${err?.message || 'ارتباط با سرور برقرار نشد.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('آیا از تخلیه و پاکسازی کامل صف تغییرات محلی اطمینان دارید؟')) return;
    setIsClearing(true);
    setNotice(null);
    try {
      const count = await OfflineQueue.clearPendingOperations(currentUserId);
      setPendingOps([]);
      setNotice(`تعداد ${toPersianDigits(count)} عملیات از صف پاکسازی شد و وضعیت به همگام تغییر یافت.`);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setNotice(`خطا در پاکسازی: ${err?.message || 'عملیات ناموفق بود.'}`);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Portal><div
      role="dialog"
      aria-modal="true"
      aria-label="مدیریت صف تغییرات آفلاین"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-surface border border-line rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl text-ink overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-canvas shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <span>صف تغییرات محلی و آفلاین</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {toPersianDigits(pendingOps.length)} مورد
                </span>
              </h3>
              <p className="text-[12px] text-ink-2">
                تغییراتی که در حافظه محلی دستگاه ذخیره شده و در صف ارسال به سرور ابری هستند
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-2 hover:text-ink hover:bg-raised transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice */}
        {notice && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-raised border border-line-strong text-xs text-brand-soft flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-brand-ink shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Content list */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-12 text-center text-ink-2 text-xs">
              در حال دریافت اطلاعات صف...
            </div>
          ) : pendingOps.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
              <p className="font-bold text-sm text-ink">صف کاملاً خالی و همگام است</p>
              <p className="text-xs text-ink-2">
                تمامی تغییرات و ثبت‌های شما با سرور یا حافظه محلی تطبیق یافته است.
              </p>
            </div>
          ) : (
            pendingOps.map((op) => (
              <div
                key={op.id}
                className="p-3.5 rounded-xl bg-canvas border border-line hover:border-line-strong transition space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-soft">{op.type}</span>
                    <span className="font-mono text-[11px] text-ink-3 bg-surface px-1.5 py-0.5 rounded">
                      {op.orderingKey}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-3 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {formatJalaliDateTime(new Date(op.createdAt).toISOString())}
                  </span>
                </div>

                {op.executionState && (
                  <div className="text-[11px] text-ink-2 flex items-center gap-1.5">
                    <span>وضعیت:</span>
                    <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      op.executionState === 'QUEUED'
                        ? 'bg-amber-500/10 text-amber-300'
                        : op.executionState === 'CONFLICT_HOLD'
                        ? 'bg-rose-500/10 text-rose-300'
                        : 'bg-blue-500/10 text-blue-300'
                    }`}>
                      {op.executionState}
                    </span>
                    {op.conflictDetails?.reason && (
                      <span className="text-rose-300 truncate max-w-xs">
                        ({op.conflictDetails.reason})
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-line bg-canvas flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isClearing || pendingOps.length === 0}
            onClick={handleClearAll}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearing ? 'در حال پاکسازی...' : 'تخلیه و پاکسازی صف'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-raised hover:bg-hover text-ink-2 hover:text-ink transition cursor-pointer"
            >
              بستن
            </button>
            <button
              type="button"
              disabled={isSyncing || pendingOps.length === 0}
              onClick={handleSyncNow}
              className="px-4 py-2 rounded-xl text-xs font-black bg-brand hover:bg-brand-hover text-on-brand transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'در حال ارسال...' : 'ارسال فوری به سرور'}</span>
            </button>
          </div>
        </div>
      </div>
    </div></Portal>
  );
};
