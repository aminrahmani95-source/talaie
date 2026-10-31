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
  AlertTriangle,
  Upload,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits } from '../../utils/jalali';
import { compressImageFile } from '../../utils/imageCompressor';
import { SignaturePad } from '../SignaturePad';
import { CloudImage } from '../common/CloudImage';
import { Button } from '../ui/Button';

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

  // Handover checklist states (defaults to false per standard QC requirements)
  const [checklist, setChecklist] = useState<HandoverChecklist>(
    project.handoverChecklist || {
      floorProtectiveClothUsed: false,
      cradleBracketsSecured: false,
      remoteTested: false,
      leveled: false,
      ironedPleated: false,
      cleaned: false,
    }
  );
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>(
    (project.handoverChecklist as any)?.handoverChecklistNotes ||
    project.handoverChecklistNotes ||
    {}
  );

  // Signature & satisfaction states
  const [signature, setSignature] = useState<string | undefined>(project.customerSignature);
  const [satisfaction, setSatisfaction] = useState<number | undefined>(project.customerSatisfaction);
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
    if (isSubmitting) return;
    setUploadError('');

    const CHECKLIST_FIELDS: { key: keyof HandoverChecklist; label: string }[] = [
      { key: 'floorProtectiveClothUsed', label: 'استفاده از آستری محافظ کف' },
      { key: 'cradleBracketsSecured', label: 'مهاربندی کرپی‌ها و عودت به وانت' },
      { key: 'remoteTested', label: 'تست حرکت روان ریل، موتور و ریموت' },
      { key: 'leveled', label: 'بررسی تراز و شاقول بودن لت‌ها و قاب' },
      { key: 'ironedPleated', label: 'مرتب‌سازی چین‌ها و اتوکشی نهایی' },
      { key: 'cleaned', label: 'نظافت کامل محل و جمع‌آوری ضایعات' },
    ];

    for (const item of CHECKLIST_FIELDS) {
      if (!checklist[item.key] && !checklistNotes[item.key]?.trim()) {
        setUploadError(`لطفاً آیتم «${item.label}» را تایید فرمایید یا علت عدم اجرای آن را بنویسید.`);
        setActiveTab('CHECKLIST');
        return;
      }
    }

    if (!satisfaction) {
      setUploadError('لطفاً میزان رضایت کارفرما از نصب را مشخص نمایید (الزامی).');
      setActiveTab('SIGNATURE');
      return;
    }

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
        completionPhotos: afterPhotos,
        handoverChecklist: {
          ...checklist,
          handoverChecklistNotes: checklistNotes,
        },
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
      setUploadError(err.message || 'خطا در ثبت گزارش. لطفاً مجدداً تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#E2DDD4] dark:border-[#2C2C2C] flex flex-col max-h-[92vh] my-4">
        {/* Header */}
        <div className="bg-[#212121] px-5 py-3.5 text-white flex items-center justify-between border-b border-[#C1A056]/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 text-[#C1A056] border border-[#C1A056]/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="report-modal-title" className="font-bold text-sm sm:text-base text-white">
                ثبت اتمام نصب و تحویل QC
              </h3>
              <p className="text-xs text-[#E5CA8F] line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Progress Indicators */}
        <div className="bg-[#FAF7F2] dark:bg-[#141414] px-4 py-2 border-b border-[#E2DDD4] dark:border-[#2C2C2C] flex items-center justify-between gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('PHOTOS')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition min-h-[44px] cursor-pointer ${
              activeTab === 'PHOTOS'
                ? 'bg-[#212121] text-[#E5CA8F] shadow-xs'
                : 'text-[#69655F] dark:text-[#9E988D] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>۱. عکس‌ها</span>
            {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
              <span className="bg-[#C1A056] text-[#212121] text-[10px] w-4 h-4 rounded-full inline-flex items-center justify-center font-mono font-bold">
                {toPersianDigits(beforePhotos.length + afterPhotos.length)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CHECKLIST')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition min-h-[44px] cursor-pointer ${
              activeTab === 'CHECKLIST'
                ? 'bg-[#212121] text-[#E5CA8F] shadow-xs'
                : 'text-[#69655F] dark:text-[#9E988D] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>۲. چک‌لیست</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SIGNATURE')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition min-h-[44px] cursor-pointer ${
              activeTab === 'SIGNATURE'
                ? 'bg-[#212121] text-[#E5CA8F] shadow-xs'
                : 'text-[#69655F] dark:text-[#9E988D] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>۳. امضا</span>
            {signature && <span className="text-emerald-500 font-bold">✓</span>}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {uploadError && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* TAB 1: PHOTOS */}
          {activeTab === 'PHOTOS' && (
            <div className="space-y-4">
              {/* After Photos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#181818] dark:text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>عکس‌های بعد از نصب (پرده و شید نهایی):</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    الزامی برای QC
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {afterPhotos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-xl overflow-hidden border border-emerald-500/40 shadow-2xs group"
                    >
                      <CloudImage src={p} alt={`بعد از نصب ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx, 'AFTER')}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition cursor-pointer"
                        aria-label="حذف عکس"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Camera Button */}
                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer text-emerald-700 dark:text-emerald-400 transition min-h-[80px]">
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">دوربین</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'AFTER')}
                      className="hidden"
                    />
                  </label>

                  {/* Gallery Button */}
                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-[#69655F] dark:text-[#9E988D] transition min-h-[80px]">
                    <Upload className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[10px] font-bold">گالری</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePhotoUpload(e, 'AFTER')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Before Photos */}
              <div className="space-y-2 pt-2 border-t border-[#E2DDD4] dark:border-[#2C2C2C]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#181818] dark:text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>عکس‌های قبل از نصب (پنجره خام و زیرسازی):</span>
                  </label>
                  <span className="text-[10px] text-[#69655F] dark:text-[#9E988D]">اختیاری</span>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {beforePhotos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-xl overflow-hidden border border-amber-500/40 shadow-2xs group"
                    >
                      <CloudImage src={p} alt={`قبل از نصب ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx, 'BEFORE')}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition cursor-pointer"
                        aria-label="حذف عکس"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer text-amber-700 dark:text-amber-400 transition min-h-[80px]">
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">دوربین</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'BEFORE')}
                      className="hidden"
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-[#69655F] dark:text-[#9E988D] transition min-h-[80px]">
                    <Upload className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[10px] font-bold">گالری</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePhotoUpload(e, 'BEFORE')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Technician Notes */}
              <div>
                <label htmlFor="completion-notes" className="block text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  توضیحات تکنسین نصب:
                </label>
                <textarea
                  id="completion-notes"
                  rows={2}
                  placeholder="مثال: تمام لت‌ها تراز شد و موتور تست گردید..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                />
              </div>

              <Button
                variant="secondary"
                size="md"
                onClick={() => setActiveTab('CHECKLIST')}
                className="w-full"
              >
                مرحله بعد: چک‌لیست تحویل ←
              </Button>
            </div>
          )}

          {/* TAB 2: CHECKLIST */}
          {activeTab === 'CHECKLIST' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#181818] dark:text-white">
                  چک‌لیست استانداردهای تحویل (۶ مورد):
                </span>
                <button
                  type="button"
                  onClick={selectAllChecklist}
                  className="text-xs font-bold text-[#8E6F27] dark:text-[#E5CA8F] hover:underline cursor-pointer"
                >
                  تایید همه
                </button>
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'floorProtectiveClothUsed' as const,
                    title: 'پهن کردن آستری محافظ کف (استاندارد لوکس)',
                    desc: 'زیر جعبه‌ابزار و نردبان برای عدم خش افتادن کف',
                    icon: Sparkles,
                  },
                  {
                    key: 'cradleBracketsSecured' as const,
                    title: 'مهاربندی کرپی‌ها و عودت به وانت لجستیک',
                    desc: 'کرپی‌های خالی و لوازم باربند جمع‌آوری شد',
                    icon: CheckCircle2,
                  },
                  {
                    key: 'remoteTested' as const,
                    title: 'تست حرکت روان ریل، موتور و ریموت کنترل',
                    desc: 'حد بالا و پایین (End-Limit) شید تنظیم شد',
                    icon: SlidersHorizontal,
                  },
                  {
                    key: 'leveled' as const,
                    title: 'بررسی تراز و شاقول بودن قاب و پایه‌ها',
                    desc: 'پایه‌ها با رولپلاک محکم شده و شاقول است',
                    icon: Sparkles,
                  },
                  {
                    key: 'ironedPleated' as const,
                    title: 'مرتب‌سازی چین‌ها و اتوکشی نهایی پلیسه‌ها',
                    desc: 'چروک‌های حمل و نقل برطرف شده است',
                    icon: Flame,
                  },
                  {
                    key: 'cleaned' as const,
                    title: 'نظافت کامل محیط و جمع‌آوری ضایعات',
                    desc: 'بدون هرگونه گرد گچ یا نخ اضافی و کاملاً تمیز',
                    icon: CheckCircle2,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isChecked = checklist[item.key];
                  return (
                    <div
                      key={item.key}
                      className={`p-3 rounded-xl border transition ${
                        isChecked
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414]'
                      }`}
                    >
                      <div
                        onClick={() => toggleChecklistItem(item.key)}
                        className="flex items-start gap-2.5 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5 accent-emerald-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold flex items-center gap-1.5 text-[#181818] dark:text-[#F5F3EF]">
                            <Icon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{item.title}</span>
                          </div>
                          <p className="text-[10px] text-[#69655F] dark:text-[#9E988D] mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      {!isChecked && (
                        <div className="mt-2 pt-2 border-t border-[#E2DDD4] dark:border-[#2C2C2C]" onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1">
                            علت عدم اجرا (الزامی):
                          </label>
                          <input
                            type="text"
                            value={checklistNotes[item.key] || ''}
                            onChange={(e) =>
                              setChecklistNotes((prev) => ({ ...prev, [item.key]: e.target.value }))
                            }
                            placeholder="دلیل عدم انجام این بند..."
                            className="w-full text-xs p-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-500/5 text-[#181818] dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setActiveTab('PHOTOS')}
                  className="flex-1"
                >
                  بازگشت به عکس‌ها
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setActiveTab('SIGNATURE')}
                  className="flex-1"
                >
                  مرحله بعد: امضا ←
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: SIGNATURE & SATISFACTION */}
          {activeTab === 'SIGNATURE' && (
            <div className="space-y-4">
              {/* Satisfaction Stars */}
              <div className="bg-[#FAF7F2] dark:bg-[#141414] p-3.5 rounded-2xl border border-[#E2DDD4] dark:border-[#2C2C2C]">
                <label className="block text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF] mb-1.5">
                  میزان رضایت کارفرما از نصب:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSatisfaction(s)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:scale-110 active:scale-95 transition cursor-pointer"
                      aria-label={`${s} ستاره`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          satisfaction && s <= satisfaction
                            ? 'text-[#C1A056] fill-[#C1A056]'
                            : 'text-zinc-300 dark:text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                  {satisfaction ? (
                    <span className="text-xs font-bold text-[#181818] dark:text-white mr-2 font-mono">
                      {toPersianDigits(satisfaction)} از 5
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mr-2">
                      (الزامی - انتخاب نشده)
                    </span>
                  )}
                </div>
              </div>

              {/* Digital Signature Pad */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-[#181818] dark:text-white flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
                    <span>امضای دیجیتال کارفرما:</span>
                  </label>
                  <span className="text-[11px] text-[#69655F] dark:text-[#9E988D]">
                    {project.customerName}
                  </span>
                </div>

                <p className="text-[11px] text-[#69655F] dark:text-[#9E988D] bg-[#FAF7F2] dark:bg-[#141414] p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] mb-2 leading-relaxed">
                  «اینجانب سلامت ظاهری، ابعاد، عملکرد موتور و تحویل شید/پرده را تایید می‌نمایم.»
                </p>

                <SignaturePad
                  value={signature}
                  onChange={(dataUrl) => setSignature(dataUrl || undefined)}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('CHECKLIST')}
                className="w-full"
              >
                بازگشت به چک‌لیست تحویل
              </Button>
            </div>
          )}
        </form>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-[#E2DDD4] dark:border-[#2C2C2C] bg-[#FAF7F2] dark:bg-[#181818] flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1"
          >
            انصراف
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="flex-1"
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            ارسال رسمی گزارش به QC
          </Button>
        </div>
      </div>
    </div>
  );
};
