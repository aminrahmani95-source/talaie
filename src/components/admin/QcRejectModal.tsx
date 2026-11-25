import React, { useState } from 'react';
import { Portal } from '../ui/Portal';
import { Project } from '../../types';
import { XCircle, X, AlertTriangle, Send, Calendar } from 'lucide-react';
import { getUpcomingDays, formatJalali, toPersianDigits } from '../../utils/jalali';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, newScheduledDate?: string) => void;
}

export const QcRejectModal: React.FC<Props> = ({
  project,
  isOpen,
  onClose,
  onSubmit,
}) => {
  useEscapeKey(onClose, isOpen);
  const initialReason =
    project.isExceptionalCompletion && project.exceptionalCompletionDetails
      ? `رد اتمام استثنایی: الزام به اعزام مجدد اکیپ جهت تکمیل اقلام باقیمانده طرح (${project.exceptionalCompletionDetails.remainingActivities.map((a) => `${a.title}: ${toPersianDigits(a.remainingQuantity)} ${a.unit}`).join('، ')})`
      : '';
  const [reason, setReason] = useState(initialReason);
  const [quickDefects, setQuickDefects] = useState<string[]>([]);
  const [newScheduledDate, setNewScheduledDate] = useState(project.scheduledDate || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const upcomingDays = getUpcomingDays(180);

  const DEFECT_TEMPLATES = [
    ...(project.isExceptionalCompletion
      ? ['رد اتمام استثنایی و الزام به تکمیل کلیه اقلام باقیمانده طرح']
      : []),
    'عدم تراز افقی و شاقول نبودن ریل یا لت‌ها',
    'وجود چروک در لایه زیرین یا عدم اتوکشی کامل والان',
    'عدم جمع‌آوری پایه‌های کریدل و محافظ کف',
    'نقص در ست کردن کد ریموت یا صدای ناهنجار موتور',
    'نظافت ناکافی محل نصب و براده‌های روی قرنیز',
  ];

  const toggleDefect = (text: string) => {
    let next: string[];
    if (quickDefects.includes(text)) {
      next = quickDefects.filter((d) => d !== text);
    } else {
      next = [...quickDefects, text];
    }
    setQuickDefects(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const finalReason = [
      ...quickDefects,
      reason.trim(),
    ]
      .filter(Boolean)
      .join(' | ');

    if (!finalReason) {
      setError('لطفاً حداقل یک نقص کیفی را انتخاب یا شرح آن را بنویسید.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(finalReason, newScheduledDate || undefined);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت دستور اصلاح.');
      setIsSubmitting(false);
    }
  };

  return (
    <Portal><div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qc-reject-title"
      className="fixed inset-0 z-50 flex justify-center items-start bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-surface rounded-lg max-w-lg w-full border border-rose-500/40 overflow-hidden my-auto transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-canvas px-5 py-3.5 text-ink flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="qc-reject-title" className="font-bold text-sm text-ink">
                عدم تایید کیفی / دستور اصلاح
              </h3>
              <p className="text-xs text-rose-400 mt-0.5">
                <span className="font-mono">{project.code}</span> • {project.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-raised hover:bg-line-strong text-ink-2 hover:text-ink transition cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Note */}
        <div className="bg-rose-500/10 border-b border-rose-500/20 p-3.5 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>پروژه مجدداً در کارتابل تکنسین‌ها به وضعیت «در حال اصلاح» برمی‌گردد.</span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-2">
              نواقص پرتکرار جهت انتخاب سریع:
            </label>
            <div className="space-y-1.5">
              {DEFECT_TEMPLATES.map((item) => {
                const isSelected = quickDefects.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      toggleDefect(item);
                      setError('');
                    }}
                    className={`w-full text-right p-2.5 rounded-md text-xs font-semibold flex items-center justify-between transition cursor-pointer border ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500 text-rose-300 font-bold'
                        : 'bg-sunken border-line text-ink-2 hover:border-rose-500/50 hover:text-ink'
                    }`}
                  >
                    <span>{item}</span>
                    {isSelected && <span className="text-rose-400 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="qc-reject-notes" className="block text-xs font-bold text-ink mb-1.5">
              شرح تکمیلی و دستورالعمل اصلاح برای تکنسین:
            </label>
            <textarea
              id="qc-reject-notes"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              placeholder="مثال: چین لت سمت چپ 2 سانتیمتر نامتقارن است و نیاز به بخاردهی مجدد دارد..."
              className="w-full text-xs p-3 rounded-md border border-line-strong focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-canvas text-ink leading-relaxed resize-none"
            />
            {error && <p className="text-rose-400 text-xs font-bold mt-1">{error}</p>}
          </div>

          <div>
            <label htmlFor="qc-reject-date" className="block text-xs font-bold text-ink mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-rose-400" />
              <span>تاریخ برنامه‌ریزی مجدد کارتابل (اختیاری):</span>
            </label>
            <select
              id="qc-reject-date"
              value={newScheduledDate}
              onChange={(e) => setNewScheduledDate(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md border border-line-strong focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-canvas text-ink"
            >
              <option value="">بدون تغییر ({formatJalali(project.scheduledDate, 'تعیین‌نشده')})</option>
              {upcomingDays.map((d) => (
                <option key={d.dateKey} value={d.dateKey}>
                  {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} - {d.persianDayNum} {d.persianMonthName} ({formatJalali(d.dateKey)})
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-md text-xs font-bold bg-raised hover:bg-line-strong text-ink-2 hover:text-ink transition disabled:opacity-50 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال دستور اصلاح به تکنسین'}</span>
            </button>
          </div>
        </form>
      </div>
    </div></Portal>
  );
};
