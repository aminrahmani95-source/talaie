import React, { useState } from 'react';
import { Project, StuckIncident, StuckCategory } from '../../types';
import { AlertOctagon, X, Clock, ShieldAlert, Send } from 'lucide-react';
import { getDisplayName } from '../../utils/technicianName';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!description.trim()) {
      setError('لطفاً شرح دقیق مانع یا دلیل توقف کار را یادداشت فرمایید.');
      return;
    }

    const incident: StuckIncident = {
      id: `stuck-${Date.now()}`,
      stuckAt: new Date().toISOString(),
      category,
      description: description.trim(),
      reportedBy: getDisplayName(reporterName) || 'تکنسین نصب',
      photos: [],
      targetMaxHours: 72,
      resolutionStatus: 'OPEN',
      previousStatus: project.status,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(incident);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت استاک.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-stuck-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-[#151B23] rounded-lg max-w-lg w-full shadow-2xl border border-rose-500/30 overflow-hidden my-6 transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header in Rose & Graphite */}
        <div className="bg-[#0D1117] px-6 py-4 text-[#F0F4F8] flex items-center justify-between border-b border-[#212835]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 id="report-stuck-title" className="font-bold text-base sm:text-lg text-[#F0F4F8]">
                ثبت توقف کار سر پروژه (پرونده استاک)
              </h3>
              <p className="text-xs text-rose-400 mt-0.5">
                <span className="font-mono">{project.code}</span> • {project.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-rose-500/10 border-b border-rose-500/20 p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-rose-300 font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>مهلت رفع توقف زیر ۷۲ ساعت (دفتر مرکزی)</span>
          </div>
          <span className="bg-rose-600/90 text-white text-xs font-mono px-2 py-0.5 rounded font-bold">
            &lt; 72h
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#F0F4F8] mb-2">
              دسته‌بندی مانع و علت توقف:
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
                    className={`w-full text-right p-2.5 rounded-md text-xs font-medium flex items-center justify-between transition cursor-pointer border ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 font-bold'
                        : 'bg-[#111620] border-[#212835] text-[#9BA7B6] hover:border-[#2D3748] hover:text-[#F0F4F8]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                    {isSelected && <span className="text-rose-400 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="stuck-description" className="block text-xs font-semibold text-[#F0F4F8] mb-1.5">
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
              className="w-full text-xs p-3 rounded-md border border-[#212835] focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-[#0D1117] text-[#F0F4F8] leading-relaxed resize-none"
            />
            {error && <p className="text-rose-400 text-xs font-semibold mt-1">{error}</p>}
          </div>

          <div className="text-xs text-[#9BA7B6] bg-[#111620] p-3 rounded-md border border-[#212835] leading-relaxed">
            با ارسال این گزارش، پروژه بلافاصله در فهرست پروژه‌های متوقف‌شده تحت پیگیری مسئولین فنی قرار گرفته و شمارش معکوس ۷۲ ساعته آغاز می‌شود.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-md text-xs font-semibold bg-[#1C232D] hover:bg-[#252F3D] text-[#9BA7B6] hover:text-[#F0F4F8] transition disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال گزارش توقف'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
