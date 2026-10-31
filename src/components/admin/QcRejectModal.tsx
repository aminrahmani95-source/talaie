import React, { useState } from 'react';
import { Project } from '../../types';
import { XCircle, X, AlertTriangle, Send, Calendar } from 'lucide-react';
import { getUpcomingDays } from '../../utils/jalali';

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
  const [reason, setReason] = useState('');
  const [quickDefects, setQuickDefects] = useState<string[]>([]);
  const [newScheduledDate, setNewScheduledDate] = useState(project.scheduledDate || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const upcomingDays = getUpcomingDays(30);

  const DEFECT_TEMPLATES = [
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qc-reject-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full shadow-2xl border border-rose-500/40 overflow-hidden my-6 transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-rose-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="qc-reject-title" className="font-black text-base sm:text-lg text-white">
                عدم تایید کیفی / دستور اصلاح (QC Return)
              </h3>
              <p className="text-xs text-rose-300 font-mono mt-0.5">
                {project.code} • {project.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Note */}
        <div className="bg-rose-500/10 dark:bg-rose-950/40 border-b border-rose-500/20 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>پروژه مجدداً در کارتابل تکنسین‌ها به وضعیت «در حال اصلاح» برمی‌گردد.</span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
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
                    className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer border ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-200 font-bold'
                        : 'bg-[#FAF7F2] dark:bg-[#222222] border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 hover:border-rose-300'
                    }`}
                  >
                    <span>{item}</span>
                    {isSelected && <span className="text-rose-600 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="qc-reject-notes" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
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
              placeholder="مثال: چین لت سمت چپ ۲ سانتیمتر نامتقارن است و نیاز به بخاردهی مجدد دارد..."
              className="w-full text-xs p-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-[#FAF7F2] dark:bg-[#141414] dark:text-white leading-relaxed resize-none"
            />
            {error && <p className="text-rose-600 text-xs font-bold mt-1">{error}</p>}
          </div>

          <div>
            <label htmlFor="qc-reject-date" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-rose-500" />
              <span>تاریخ برنامه‌ریزی مجدد کارتابل (اختیاری):</span>
            </label>
            <select
              id="qc-reject-date"
              value={newScheduledDate}
              onChange={(e) => setNewScheduledDate(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
            >
              <option value="">بدون تغییر ({project.scheduledDate || 'تعیین‌نشده'})</option>
              {upcomingDays.map((d) => (
                <option key={d.dateKey} value={d.dateKey}>
                  {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} - {d.persianDayNum} {d.persianMonthName} ({d.dateKey})
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#FAF7F2] dark:bg-[#252525] hover:bg-[#EAE6DD] text-slate-700 dark:text-zinc-300 transition disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال دستور اصلاح به تکنسین'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
