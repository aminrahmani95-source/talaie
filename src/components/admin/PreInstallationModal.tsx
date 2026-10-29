import React, { useState } from 'react';
import { Project, PreInstallationInspection } from '../../types';
import {
  Ruler,
  CheckCircle2,
  AlertTriangle,
  X,
  Building,
  Zap,
  Maximize2,
  Calendar,
  FileCheck,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString } from '../../utils/jalali';

interface Props {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSaveInspection: (inspection: PreInstallationInspection, newScheduledDate?: string) => void;
}

export const PreInstallationModal: React.FC<Props> = ({
  project,
  isOpen,
  onClose,
  onSaveInspection,
}) => {
  const existing = project.preInspection;

  const [drywallStructureOk, setDrywallStructureOk] = useState(
    existing?.drywallStructureOk ?? true
  );
  const [electricalWiringOk, setElectricalWiringOk] = useState(
    existing?.electricalWiringOk ?? true
  );
  const [spaceAccessible, setSpaceAccessible] = useState(
    existing?.spaceAccessible ?? true
  );
  const [measurementsMatched, setMeasurementsMatched] = useState(
    existing?.measurementsMatched ?? true
  );
  const [notes, setNotes] = useState(existing?.notes || '');
  const [status, setStatus] = useState<'APPROVED' | 'SPACE_NOT_READY'>(
    existing?.status || 'APPROVED'
  );
  const [postponeDate, setPostponeDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const inspection: PreInstallationInspection = {
      drywallStructureOk,
      electricalWiringOk,
      spaceAccessible,
      measurementsMatched,
      status,
      notes: notes.trim(),
      inspectedBy: 'تیم اندازه‌گیری و اصلاحات (عابدی / علیمحمدی)',
      inspectedAt: getTodayPersianString(),
    };

    onSaveInspection(inspection, status === 'SPACE_NOT_READY' ? postponeDate : undefined);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden my-6 transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#C1A056] border border-[#C1A056]/30">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">
                برگه بازدید پیش از نصب و اندازه‌گیری دوم
              </h3>
              <p className="text-xs text-[#C1A056] font-bold line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            طبق فرآیند رسمی BPMN گالری طلایی، پیش از اعزام اکیپ نصب، زیرسازی کناف، برق موتور و ابعاد نهایی درگاه‌ها باید توسط کارشناس فنی ارزیابی و تایید شود.
          </p>

          {/* 4 Inspection Checkboxes */}
          <div className="space-y-2.5">
            {/* 1. Drywall */}
            <label className="flex items-start gap-3 p-3 rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#222222] cursor-pointer hover:border-[#C1A056]/60 transition">
              <input
                type="checkbox"
                checked={drywallStructureOk}
                onChange={(e) => setDrywallStructureOk(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-[#C1A056] focus:ring-[#C1A056]"
              />
              <div className="text-xs">
                <span className="font-bold text-[#212121] dark:text-white block">
                  ۱. استحکام سقف کاذب و قوطی‌کشی کناف
                </span>
                <span className="text-slate-500 dark:text-zinc-400 mt-0.5 block">
                  زیرسازی آهن جهت مهاربندی وزن شید و ریل پرده چک شد و تحمل بار استاندارد را دارد.
                </span>
              </div>
            </label>

            {/* 2. Electrical */}
            <label className="flex items-start gap-3 p-3 rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#222222] cursor-pointer hover:border-[#C1A056]/60 transition">
              <input
                type="checkbox"
                checked={electricalWiringOk}
                onChange={(e) => setElectricalWiringOk(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-[#C1A056] focus:ring-[#C1A056]"
              />
              <div className="text-xs">
                <span className="font-bold text-[#212121] dark:text-white block">
                  ۲. انشعاب و کابل‌کشی برق موتور برقی (سامفی)
                </span>
                <span className="text-slate-500 dark:text-zinc-400 mt-0.5 block">
                  سیم‌کشی فاز و نول در محل مناسب قرار دارد و ولتاژ برق جهت تست نهایی وصل است.
                </span>
              </div>
            </label>

            {/* 3. Space Accessibility */}
            <label className="flex items-start gap-3 p-3 rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#222222] cursor-pointer hover:border-[#C1A056]/60 transition">
              <input
                type="checkbox"
                checked={spaceAccessible}
                onChange={(e) => setSpaceAccessible(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-[#C1A056] focus:ring-[#C1A056]"
              />
              <div className="text-xs">
                <span className="font-bold text-[#212121] dark:text-white block">
                  ۳. تخلیه فضا و دسترسی به درگاه‌ها
                </span>
                <span className="text-slate-500 dark:text-zinc-400 mt-0.5 block">
                  محیط جهت ورود نردبان و آستری خالی است و کارگران ساختمانی دیگر مانع نصب نیستند.
                </span>
              </div>
            </label>

            {/* 4. Second Measurements */}
            <label className="flex items-start gap-3 p-3 rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#222222] cursor-pointer hover:border-[#C1A056]/60 transition">
              <input
                type="checkbox"
                checked={measurementsMatched}
                onChange={(e) => setMeasurementsMatched(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-[#C1A056] focus:ring-[#C1A056]"
              />
              <div className="text-xs">
                <span className="font-bold text-[#212121] dark:text-white block">
                  ۴. اندازه‌گیری دوم و انطباق با پیش‌فاکتور
                </span>
                <span className="text-slate-500 dark:text-zinc-400 mt-0.5 block">
                  ارتفاع و عرض تمام درگاه‌ها بعد از کف‌سازی نهایی دبل‌چک و تایید شد.
                </span>
              </div>
            </label>
          </div>

          {/* Decision Outcome */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-[#212121] dark:text-white mb-2">
              نتیجه کارشناسی بستر پروژه:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('APPROVED')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  status === 'APPROVED'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>فضا آماده نصب است</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('SPACE_NOT_READY')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  status === 'SPACE_NOT_READY'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/30'
                    : 'border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>فضا هنوز آماده نیست</span>
              </button>
            </div>
          </div>

          {/* Postpone date input if not ready */}
          {status === 'SPACE_NOT_READY' && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 p-3 rounded-2xl space-y-1.5">
              <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200">
                تاریخ پیشنهادی جهت موکول شدن نصب (طبق توافق با فروشنده):
              </label>
              <input
                type="text"
                placeholder="مثال: 1405-08-05"
                value={postponeDate}
                onChange={(e) => setPostponeDate(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-amber-200 bg-white dark:bg-[#151515] dark:text-white font-mono text-left"
                dir="ltr"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              توضیحات تکمیلی کارشناس بازدید:
            </label>
            <textarea
              rows={2}
              placeholder="مثال: قاب پنجره غربی به نردبان 5 متری احتیاج دارد. کناف لبه جنوبی قوطی‌کشی محکم دارد و آماده نصب است."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] bg-[#FAF7F2] dark:bg-[#151515] dark:text-white"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#252525]"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-black rounded-xl text-xs transition border border-[#C1A056]/30 shadow-md active:scale-98"
            >
              ثبت برگه بازدید فنی
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
