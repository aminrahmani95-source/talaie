import React, { useState } from 'react';
import { Project, HandoverChecklist } from '../../types';
import {
  Camera,
  CheckCircle2,
  X,
  Star,
  CheckSquare,
  Sparkles,
  SlidersHorizontal,
  Flame,
  ShieldCheck,
  PenTool,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits } from '../../utils/jalali';
import { compressImageFile } from '../../utils/imageCompressor';
import { SignaturePad } from '../SignaturePad';
import { CloudImage } from '../common/CloudImage';

interface Props {
  project: Project;
  onClose: () => void;
  onSubmit: (completionData: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
    completionPhotos: string[];
    handoverChecklist: HandoverChecklist;
    customerSignature?: string;
    customerSatisfaction?: number;
  }) => void;
}

export const ReportCompletionModal: React.FC<Props> = ({
  project,
  onClose,
  onSubmit,
}) => {
  const [activeTab, setActiveTab] = useState<'PHOTOS' | 'CHECKLIST' | 'SIGNATURE'>('PHOTOS');

  // Photo states
  const [beforePhotos, setBeforePhotos] = useState<string[]>(project.beforePhotos || []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(
    project.afterPhotos || project.completionPhotos || []
  );

  // Handover checklist states
  const [checklist, setChecklist] = useState<HandoverChecklist>(
    project.handoverChecklist || {
      floorProtectiveClothUsed: true,
      cradleBracketsSecured: true,
      remoteTested: true,
      leveled: true,
      ironedPleated: true,
      cleaned: true,
    }
  );

  // Signature & satisfaction states
  const [signature, setSignature] = useState<string | undefined>(project.customerSignature);
  const [satisfaction, setSatisfaction] = useState<number>(project.customerSatisfaction || 5);
  const [completionNotes, setCompletionNotes] = useState(project.completionNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'BEFORE' | 'AFTER'
  ) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.75);
        if (type === 'BEFORE') {
          setBeforePhotos((prev) => [...prev, compressed]);
        } else {
          setAfterPhotos((prev) => [...prev, compressed]);
        }
      } catch (err) {
        console.warn('Image compression failed:', err);
      }
    }
    // Clear input so same file can be re-selected if needed
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number, type: 'BEFORE' | 'AFTER') => {
    if (type === 'BEFORE') {
      setBeforePhotos((prev) => prev.filter((_, i) => i !== index));
    } else {
      setAfterPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const toggleChecklistItem = (key: keyof HandoverChecklist) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectAllChecklist = () => {
    setChecklist({
      floorProtectiveClothUsed: true,
      cradleBracketsSecured: true,
      remoteTested: true,
      leveled: true,
      ironedPleated: true,
      cleaned: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (afterPhotos.length === 0) {
      if (
        !confirm(
          'آیا مایلید بدون عکس اتمام کار گزارش را ثبت کنید؟ (ثبت عکس بعد از نصب برای تایید QC الزامی است)'
        )
      ) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        completionNotes: completionNotes.trim(),
        beforePhotos,
        afterPhotos,
        completionPhotos: afterPhotos, // Maintain backwards compatibility
        handoverChecklist: checklist,
        customerSignature: signature,
        customerSatisfaction: satisfaction,
      });

      try {
        confetti({
          particleCount: 65,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#C1A056', '#212121', '#194840'],
        });
      } catch {
        // Ignore
      }
    } catch (err: any) {
      console.error('Failed to submit completion report:', err);
      setUploadError(
        err.message || 'خطا در ثبت گزارش در صف عملیات دستگاه. فرم باز نگه داشته شد.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Luxury Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-[#C1A056] border border-[#C1A056]/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 id="report-modal-title" className="font-black text-base sm:text-lg text-white">
                ثبت برگه پایان نصب و تحویل QC
              </h3>
              <p className="text-xs text-[#C1A056] line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1A056]"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Multi-step Navigation Pills */}
        <div className="bg-[#FAF7F2] dark:bg-[#151515] px-6 pt-3 pb-2 border-b border-[#E8E4DC] dark:border-[#2D2D2D] flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('PHOTOS')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 min-h-[40px] ${
              activeTab === 'PHOTOS'
                ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-white/80 dark:hover:bg-[#202020]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>1. عکس قبل و بعد</span>
            {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
              <span className="bg-[#C1A056] text-[#212121] text-[10px] w-4 h-4 rounded-full inline-flex items-center justify-center font-mono">
                {toPersianDigits(beforePhotos.length + afterPhotos.length)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CHECKLIST')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 min-h-[40px] ${
              activeTab === 'CHECKLIST'
                ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-white/80 dark:hover:bg-[#202020]'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>2. چک‌لیست تحویل استاندارد</span>
            {Object.values(checklist).every(Boolean) && (
              <span className="text-emerald-500 font-bold">✓</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SIGNATURE')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 min-h-[40px] ${
              activeTab === 'SIGNATURE'
                ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-white/80 dark:hover:bg-[#202020]'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>3. امضای کارفرما</span>
            {signature && <span className="text-emerald-500 font-bold">✓</span>}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {uploadError && (
            <div
              role="alert"
              className="p-3.5 bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* TAB 1: BEFORE & AFTER PHOTOS */}
          {activeTab === 'PHOTOS' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* After Photos (Priority) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>عکس‌های بعد از نصب (پرده و شید نهایی و آماده تحویل):</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    الزامی جهت تایید QC
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {afterPhotos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden border border-emerald-500/40 shadow-sm group"
                    >
                      <CloudImage src={p} alt={`بعد از نصب ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx, 'AFTER')}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition"
                        aria-label="حذف عکس"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-0 inset-x-0 bg-emerald-950/80 text-[8px] text-center text-white py-0.5">
                        بعد از نصب
                      </span>
                    </div>
                  ))}

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer text-emerald-600 dark:text-emerald-400 transition min-h-[80px]">
                    <Camera className="w-6 h-6 mb-1" aria-hidden="true" />
                    <span className="text-[10px] font-bold">عکاسی / آپلود</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'AFTER')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Before Photos */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>عکس‌های قبل از نصب (پنجره خام، کناف و زیرسازی اولیه):</span>
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">اختیاری اما بسیار موثر</span>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {beforePhotos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden border border-amber-500/40 shadow-sm group"
                    >
                      <CloudImage src={p} alt={`قبل از نصب ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx, 'BEFORE')}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition"
                        aria-label="حذف عکس"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-0 inset-x-0 bg-amber-950/80 text-[8px] text-center text-white py-0.5">
                        قبل از نصب
                      </span>
                    </div>
                  ))}

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 border-dashed border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer text-amber-600 dark:text-amber-400 transition min-h-[80px]">
                    <Camera className="w-6 h-6 mb-1" aria-hidden="true" />
                    <span className="text-[10px] font-bold">عکاسی / آپلود</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'BEFORE')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Technician Notes */}
              <div>
                <label htmlFor="completion-notes" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  گزارش و توضیحات تکنسین نصب:
                </label>
                <textarea
                  id="completion-notes"
                  rows={2}
                  placeholder="مثال: نصب تمام لت‌ها با تراز لیزری انجام شد. ریموت تست و به مشتری تحویل شد..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('CHECKLIST')}
                className="w-full py-2.5 bg-[#FAF7F2] dark:bg-[#222222] hover:bg-[#F2ECE1] border border-[#C1A056]/40 text-[#212121] dark:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>مرحله بعد: چک‌لیست تحویل استاندارد</span>
                <span>←</span>
              </button>
            </div>
          )}

          {/* TAB 2: WHITE-GLOVE HANDOVER CHECKLIST */}
          {activeTab === 'CHECKLIST' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h4 className="text-xs font-black text-[#212121] dark:text-white">
                    چک‌لیست استانداردهای طلایی تحویل پرده و شید:
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    تکنسین موظف است قبل از ترک محل، هر 4 مورد زیر را بررسی و تایید نماید.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={selectAllChecklist}
                  className="text-[11px] font-bold text-[#C1A056] hover:underline"
                >
                  تایید همه
                </button>
              </div>

              <div className="space-y-2.5">
                {/* 1. Floor protective cloth */}
                <div
                  onClick={() => toggleChecklistItem('floorProtectiveClothUsed')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition min-h-[52px] select-none ${
                    checklist.floorProtectiveClothUsed
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-[#212121] dark:text-white'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161616] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checklist.floorProtectiveClothUsed}
                    onChange={() => {}}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>پهن کردن آستری محافظ زیر جعبه‌ابزار و نردبان (استاندارد لوکس طلایی)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      آستری پهن شد تا هیچ‌گونه خط و خش روی پارکت یا سنگ لوکس مشتری ایجاد نشود.
                    </p>
                  </div>
                </div>

                {/* 2. Cradle brackets secured */}
                <div
                  onClick={() => toggleChecklistItem('cradleBracketsSecured')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition min-h-[52px] select-none ${
                    checklist.cradleBracketsSecured
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-[#212121] dark:text-white'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161616] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checklist.cradleBracketsSecured}
                    onChange={() => {}}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>مهاربندی کرپی‌های شید و عودت کرپی‌های خالی به وانت لجستیک</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      شیدها با سلامت از کرپی خارج شده و لوازم باربند جمع‌آوری و به راننده تحویل شد.
                    </p>
                  </div>
                </div>

                {/* 3. Remote & Motor test */}
                <div
                  onClick={() => toggleChecklistItem('remoteTested')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition min-h-[52px] select-none ${
                    checklist.remoteTested
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-[#212121] dark:text-white'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161616] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checklist.remoteTested}
                    onChange={() => {}}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تست حرکت روان ریل، موتور هوشمند و کد کردن ریموت کنترل</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      حد بالا و پایین (End-Limit) شید تنظیم شده و حرکت بی‌صدا تایید است.
                    </p>
                  </div>
                </div>

                {/* 2. Leveled & Plumb */}
                <div
                  onClick={() => toggleChecklistItem('leveled')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition min-h-[52px] select-none ${
                    checklist.leveled
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-[#212121] dark:text-white'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161616] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checklist.leveled}
                    onChange={() => {}}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>بررسی تراز و شاقول بودن قاب، پایه‌ها و تقارن لت‌ها</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      پایه‌ها با رولپلاک مناسب محکم شده و هیچ کجی یا فاصله‌ای دیده نمی‌شود.
                    </p>
                  </div>
                </div>

                {/* 3. Ironed & Pleats */}
                <div
                  onClick={() => toggleChecklistItem('ironedPleated')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition min-h-[52px] select-none ${
                    checklist.ironedPleated
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-[#212121] dark:text-white'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161616] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checklist.ironedPleated}
                    onChange={() => {}}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-emerald-600" />
                      <span>مرتب‌سازی چین‌ها، فرم‌دهی پلیسه‌ها و اتوکشی نهایی</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      چروک‌های ناشی از حمل و نقل کاملاً برطرف شده و ایستایی پارچه یکدست است.
                    </p>
                  </div>
                </div>

                {/* 4. Cleanup */}
                <div
                  onClick={() => toggleChecklistItem('cleaned')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition min-h-[52px] select-none ${
                    checklist.cleaned
                      ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-[#212121] dark:text-white'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161616] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checklist.cleaned}
                    onChange={() => {}}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>نظافت کامل محیط، جمع‌آوری کارتن‌ها و پاک‌کردن گرد و خاک</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      محل کارفرما بدون هرگونه گرد گچ یا نخ اضافی و کاملاً تمیز تحویل شد.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('PHOTOS')}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold"
                >
                  → بازگشت به عکس‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('SIGNATURE')}
                  className="flex-1 py-2.5 bg-[#FAF7F2] dark:bg-[#222222] hover:bg-[#F2ECE1] border border-[#C1A056]/40 text-[#212121] dark:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <span>مرحله بعد: امضای کارفرما</span>
                  <span>←</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER SIGNATURE & SATISFACTION */}
          {activeTab === 'SIGNATURE' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Satisfaction Stars */}
              <div className="bg-[#FAF7F2] dark:bg-[#202020] p-4 rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D]">
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  میزان رضایت کارفرما از نحوه رفتار، دقت و تمیزی نصب:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSatisfaction(s)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:scale-110 active:scale-95 transition"
                      aria-label={`${s} ستاره از 5 ستاره`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          s <= satisfaction
                            ? 'text-[#C1A056] fill-[#C1A056]'
                            : 'text-slate-300 dark:text-zinc-600'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-[#212121] dark:text-white mr-2">
                    {toPersianDigits(satisfaction)} از 5 ستاره
                  </span>
                </div>
              </div>

              {/* Digital Signature Pad */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-[#C1A056]" />
                    <span>امضای دیجیتال و تاییدیه رسمی کارفرما:</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    {project.customerName}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-zinc-300 bg-white/70 dark:bg-[#181818] p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 mb-2 leading-relaxed">
                  «اینجانب به عنوان کارفرما/نماینده، سلامت ظاهری پارچه‌ها، عملکرد موتور و تجهیزات تحویل‌شده را تایید می‌نمایم.»
                </p>

                <SignaturePad
                  value={signature}
                  onChange={(dataUrl) => setSignature(dataUrl || undefined)}
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('CHECKLIST')}
                className="w-full py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold"
              >
                → بازگشت به چک‌لیست تحویل
              </button>
            </div>
          )}

          {/* Action Footer Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-3 border border-slate-300 dark:border-[#333333] text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-[#252525] transition min-h-[44px] cursor-pointer disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 border border-[#C1A056]/30 active:scale-98 min-h-[44px] cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#C1A056]" />
                  <span>در حال آپلود تصاویر و ارسال...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
                  <span>ارسال رسمی گزارش به QC</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
