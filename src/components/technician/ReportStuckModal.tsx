import React, { useState } from 'react';
import { Project, StuckIncident, StuckCategory } from '../../types';
import { AlertOctagon, X, Clock, ShieldAlert, Send } from 'lucide-react';

interface Props {
  project: Project;
  isOpen: boolean;
  reporterName: string;
  onClose: () => void;
  onSubmit: (incident: StuckIncident) => void;
}

const CATEGORIES: { key: StuckCategory; label: string; icon: string }[] = [
  { key: 'HARDWARE_SHORTAGE', label: 'کسری یراق، پایه سقفی/دیواری یا براکت', icon: '🔩' },
  { key: 'FABRIC_SHORTAGE', label: 'کسری پارچه پرده یا شید', icon: '✂️' },
  { key: 'FABRIC_DEFECT', label: 'پارگی، زدگی یا عیب بافت پارچه', icon: '⚠️' },
  { key: 'MEASUREMENT_MISMATCH', label: 'مغایرت متراژ پنجره با ابعاد دوخته‌شده', icon: '📐' },
  { key: 'DRYWALL_SUBSTRUCTURE_ISSUE', label: 'نقص زیرسازی کناف، عدم قوطی‌کشی یا سستی سقف', icon: '🏗️' },
  { key: 'POWER_FAILURE', label: 'عدم سیم‌کشی برق کناف یا قطعی تغذیه موتور', icon: '⚡' },
  { key: 'OTHER', label: 'سایر موانع فنی حاد پیش‌بینی‌نشده', icon: '🛑' },
];

export const ReportStuckModal: React.FC<Props> = ({
  project,
  isOpen,
  reporterName,
  onClose,
  onSubmit,
}) => {
  const [category, setCategory] = useState<StuckCategory>('HARDWARE_SHORTAGE');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('لطفاً شرح دقیق مانع یا دلیل توقف کار را یادداشت فرمایید.');
      return;
    }

    const incident: StuckIncident = {
      id: `stuck-${Date.now()}`,
      stuckAt: new Date().toISOString(),
      category,
      description: description.trim(),
      reportedBy: reporterName || 'تکنسین نصب',
      photos: [],
      targetMaxHours: 72,
      resolutionStatus: 'OPEN',
      previousStatus: project.status,
    };

    onSubmit(incident);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-stuck-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full shadow-2xl border border-rose-500/40 overflow-hidden my-6 transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header in Rose & Obsidian */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-rose-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="report-stuck-title" className="font-black text-base sm:text-lg text-white">
                ثبت توقف کار سر پروژه (پرونده استاک)
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

        {/* Warning & KPI Banner */}
        <div className="bg-rose-500/10 dark:bg-rose-950/40 border-b border-rose-500/20 p-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>گیت‌وی رفع توقف زیر ۷۲ ساعت (KPI دفتر مرکزی)</span>
          </div>
          <span className="bg-rose-600 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-black">
            KPI &lt; 72h
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
              دسته‌بندی مانع و علت توقف (FMEA):
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setCategory(cat.key);
                      setError('');
                    }}
                    className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer border ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-200 font-black shadow-2xs'
                        : 'bg-[#FAF7F2] dark:bg-[#222222] border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 hover:border-rose-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                    {isSelected && <span className="text-rose-600 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="stuck-description" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              شرح دقیق کسری یا مانع فنی جهت اقدام مسئولین فنی: *
            </label>
            <textarea
              id="stuck-description"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError('');
              }}
              placeholder="مثال: کسری ۲ عدد پایه دوبل سقفی تقویتی برای لت‌های ۴ متری و عدم وجود سیم‌کشی برق در لبه شرقی کناف..."
              className="w-full text-xs p-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-[#FAF7F2] dark:bg-[#141414] dark:text-white leading-relaxed resize-none"
            />
            {error && <p className="text-rose-600 text-xs font-bold mt-1">{error}</p>}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-zinc-400 bg-[#FAF7F2] dark:bg-[#222222] p-3 rounded-xl border border-[#E8E4DC] dark:border-[#2D2D2D] leading-relaxed">
            با ارسال این گزارش، پروژه بلافاصله در دسک رفع استاک تحت پیگیری مسئولین فنی قرار گرفته و شمارش معکوس ۷۲ ساعته آغاز می‌شود.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#FAF7F2] dark:bg-[#252525] hover:bg-[#EAE6DD] text-slate-700 dark:text-zinc-300 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارسال به دسک رفع استاک</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
