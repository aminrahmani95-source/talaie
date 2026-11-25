import React, { useState, useMemo } from 'react';
import { triggerToast } from '../Toast';
import { Project, HandoverChecklist, HandoverSigneeType, User, ExceptionalCompletionDetails } from '../../types';
import {
  Camera,
  CheckCircle2,
  X,
  Star,
  Sparkles,
  SlidersHorizontal,
  Flame,
  ShieldCheck,
  PenTool,
  AlertTriangle,
  Upload,
  UserCheck,
  Building,
  UserX,
  Phone,
  Info,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits } from '../../utils/jalali';
import { compressImageFile } from '../../utils/imageCompressor';
import { SignaturePad } from '../SignaturePad';
import { CloudImage } from '../common/CloudImage';
import { Button } from '../ui/Button';
import { calculateActivityProgress, getIncompleteActivitiesSummary } from '../../utils/planProgress';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export interface CompletionSubmitData {
  completionNotes: string;
  beforePhotos: string[];
  afterPhotos: string[];
  completionPhotos: string[];
  handoverChecklist: HandoverChecklist;
  handoverSigneeType: HandoverSigneeType;
  customerSignature?: string;
  customerSatisfaction?: number;
  representativeName?: string;
  representativeRole?: string;
  representativePhone?: string;
  unavailabilityReason?: string;
  unavailabilityPhotos?: string[];
  isExceptionalCompletion?: boolean;
  exceptionalCompletionDetails?: ExceptionalCompletionDetails;
}

interface Props {
  project: Project;
  currentUser?: User;
  onClose: () => void;
  onSubmit: (completionData: CompletionSubmitData) => void;
}

export const ReportCompletionModal: React.FC<Props> = ({
  project,
  currentUser,
  onClose,
  onSubmit,
}) => {
  useEscapeKey(onClose);
  const [activeTab, setActiveTab] = useState<'PHOTOS' | 'CHECKLIST' | 'SIGNATURE'>('PHOTOS');

  // Photo states
  const [beforePhotos, setBeforePhotos] = useState<string[]>(project.beforePhotos || []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(
    project.afterPhotos || project.completionPhotos || []
  );

  // Handover checklist states
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

  // Handover signee type & details (Task 4)
  const [signeeType, setSigneeType] = useState<HandoverSigneeType>(
    project.handoverSigneeType || 'RESIDENTIAL_CUSTOMER'
  );
  const [representativeName, setRepresentativeName] = useState(project.representativeName || '');
  const [representativeRole, setRepresentativeRole] = useState(project.representativeRole || 'مهندس ناظر');
  const [representativePhone, setRepresentativePhone] = useState(project.representativePhone || '');
  const [unavailabilityReason, setUnavailabilityReason] = useState(project.unavailabilityReason || '');
  const [unavailabilityPhotos, setUnavailabilityPhotos] = useState<string[]>(
    project.unavailabilityPhotos || []
  );

  // Signature & optional satisfaction states
  const [signature, setSignature] = useState<string | undefined>(project.customerSignature);
  const [satisfaction, setSatisfaction] = useState<number | undefined>(project.customerSatisfaction);
  const [completionNotes, setCompletionNotes] = useState(project.completionNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Plan verification for single-visit and multi-day completion (P2.1)
  const activityProgress = useMemo(() => calculateActivityProgress(project), [project]);
  const incompleteReport = useMemo(() => getIncompleteActivitiesSummary(project), [project]);
  const [completionMode, setCompletionMode] = useState<'FULL_COMPLETED_TODAY' | 'EXCEPTIONAL_PARTIAL'>(
    'FULL_COMPLETED_TODAY'
  );
  const [exceptionalReason, setExceptionalReason] = useState('');
  const [confirmFinishedToday, setConfirmFinishedToday] = useState(
    !incompleteReport.hasIncomplete
  );

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
        triggerToast('error', err instanceof Error && err.message ? err.message : 'این عکس آماده نشد؛ دوباره امتحان کنید.');
      }
    }
    e.target.value = '';
  };

  const handleUnavailabilityPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.75);
        setUnavailabilityPhotos((prev) => [...prev, compressed]);
      } catch (err) {
        console.warn('Unavailability image compression failed:', err);
        triggerToast('error', err instanceof Error && err.message ? err.message : 'این عکس آماده نشد؛ دوباره امتحان کنید.');
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

    // Validated in the order of the tabs, and each error opens the tab it belongs to.
    // QC cannot approve a job without after-photos and a signature (or documented
    // customer absence), so those are required here instead of failing later at QC.
    if (afterPhotos.length === 0) {
      setUploadError('حداقل یک عکس «بعد از نصب» لازم است؛ بدون عکس، QC نمی‌تواند کار را تایید کند.');
      setActiveTab('PHOTOS');
      return;
    }

    // بررسی اتمام کامل اقلام طرح یا ثبت اتمام استثنایی با کسری اقلام (P2.1)
    if (incompleteReport.hasIncomplete) {
      if (completionMode === 'EXCEPTIONAL_PARTIAL') {
        if (exceptionalReason.trim().length < 10) {
          setUploadError('برای ثبت اتمام استثنایی با کسری اقلام، درج علت مستند (حداقل 10 کاراکتر) الزامی است.');
          setActiveTab('PHOTOS');
          return;
        }
      } else {
        if (!confirmFinishedToday) {
          setUploadError(
            `پروژه دارای ${toPersianDigits(incompleteReport.totalRemainingUnits)} واحد کار باقیمانده نسبت به طرح مصوب است. لطفاً تایید فرمایید که این اقلام امروز نصب شدند، یا گزینه «اتمام استثنایی با کسری اقلام» را انتخاب نمایید.`
          );
          setActiveTab('PHOTOS');
          return;
        }
      }
    }

    for (const item of CHECKLIST_FIELDS) {
      if (!checklist[item.key] && !checklistNotes[item.key]?.trim()) {
        setUploadError(`لطفاً آیتم «${item.label}» را تایید فرمایید یا علت عدم اجرای آن را بنویسید.`);
        setActiveTab('CHECKLIST');
        return;
      }
    }

    // Role-specific signee validations
    if (signeeType === 'CONSTRUCTION_REPRESENTATIVE') {
      if (!representativeName.trim()) {
        setUploadError('لطفاً نام نماینده کارگاه / مهندس ناظر را وارد نمایید.');
        setActiveTab('SIGNATURE');
        return;
      }
      if (!representativePhone.trim()) {
        setUploadError('لطفاً شماره تماس نماینده کارگاه را وارد نمایید.');
        setActiveTab('SIGNATURE');
        return;
      }
    }

    if (signeeType === 'UNAVAILABLE_EXEMPT') {
      if (!unavailabilityReason.trim()) {
        setUploadError('لطفاً شرایط و دلیل عدم حضور کارفرما را مستند نمایید.');
        setActiveTab('SIGNATURE');
        return;
      }
    }

    if (signeeType !== 'UNAVAILABLE_EXEMPT' && !signature) {
      setUploadError('امضای تحویل‌گیرنده ثبت نشده است. اگر کارفرما حضور ندارد، گزینه «عدم حضور کارفرما» را انتخاب و دلیلش را بنویسید.');
      setActiveTab('SIGNATURE');
      return;
    }

    setIsSubmitting(true);

    try {
      const isExceptional = incompleteReport.hasIncomplete && completionMode === 'EXCEPTIONAL_PARTIAL';
      const exceptionalDetails: ExceptionalCompletionDetails | undefined = isExceptional
        ? {
            hasIncompleteActivities: true,
            remainingActivities: incompleteReport.remainingItems,
            documentedReason: exceptionalReason.trim(),
            confirmedBySupervisor: currentUser?.name || 'سرپرست اکیپ',
            confirmedAt: new Date().toISOString(),
          }
        : undefined;

      const finalCompletionNotes = isExceptional
        ? `${completionNotes.trim() ? `${completionNotes.trim()}\n` : ''}[اتمام استثنایی با کسری اقلام: ${exceptionalReason.trim()}]`
        : completionNotes.trim();

      await onSubmit({
        completionNotes: finalCompletionNotes,
        beforePhotos,
        afterPhotos,
        completionPhotos: afterPhotos,
        handoverChecklist: {
          ...checklist,
          handoverChecklistNotes: checklistNotes,
        },
        handoverSigneeType: signeeType,
        customerSignature: signeeType !== 'UNAVAILABLE_EXEMPT' ? signature : undefined,
        customerSatisfaction: satisfaction,
        representativeName: signeeType === 'CONSTRUCTION_REPRESENTATIVE' ? representativeName.trim() : undefined,
        representativeRole: signeeType === 'CONSTRUCTION_REPRESENTATIVE' ? representativeRole.trim() : undefined,
        representativePhone: signeeType === 'CONSTRUCTION_REPRESENTATIVE' ? representativePhone.trim() : undefined,
        unavailabilityReason: signeeType === 'UNAVAILABLE_EXEMPT' ? unavailabilityReason.trim() : undefined,
        unavailabilityPhotos: signeeType === 'UNAVAILABLE_EXEMPT' ? unavailabilityPhotos : undefined,
        isExceptionalCompletion: isExceptional,
        exceptionalCompletionDetails: exceptionalDetails,
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
      <div className="bg-surface rounded-lg max-w-lg w-full overflow-hidden shadow-2xl border border-line flex flex-col max-h-[92vh] my-4">
        {/* Header */}
        <div className="bg-canvas px-5 py-3.5 text-ink flex items-center justify-between border-b border-line shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-raised text-brand-ink border border-brand/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 id="report-modal-title" className="font-bold text-sm sm:text-base text-ink">
                ثبت اتمام نصب و تحویل QC
              </h3>
              <p className="text-xs text-brand-ink line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-raised text-ink-2 hover:text-ink transition cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 border-b border-line bg-canvas text-xs font-semibold text-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('PHOTOS')}
            className={`py-3 transition border-b-2 cursor-pointer ${
              activeTab === 'PHOTOS'
                ? 'border-brand text-brand-ink bg-surface'
                : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            1. عکس‌های کار ({toPersianDigits(beforePhotos.length + afterPhotos.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CHECKLIST')}
            className={`py-3 transition border-b-2 cursor-pointer ${
              activeTab === 'CHECKLIST'
                ? 'border-brand text-brand-ink bg-surface'
                : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            2. چک‌لیست تحویل
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SIGNATURE')}
            className={`py-3 transition border-b-2 cursor-pointer ${
              activeTab === 'SIGNATURE'
                ? 'border-brand text-brand-ink bg-surface'
                : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            3. تحویل و امضا
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
          {uploadError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Original Plan & Completed Items Verification (P2.1) */}
          <div className="p-3.5 rounded-lg bg-sunken border border-line space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-ink" />
                <span>بررسی تطبیق طرح اولیه و نصب نهایی:</span>
              </span>
              <span
                className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
                  !incompleteReport.hasIncomplete
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {!incompleteReport.hasIncomplete
                  ? 'تمام اقلام نصب شده'
                  : `${toPersianDigits(incompleteReport.totalRemainingUnits)} واحد کار باقیمانده`}
              </span>
            </div>

            {activityProgress.map((act) => (
              <div
                key={act.activityId}
                className="flex items-center justify-between text-xs py-1 border-b border-dashed border-line last:border-0"
              >
                <div>
                  <span className="font-medium text-ink">{act.title}</span>
                  <span className="text-[12px] text-ink-2 mr-1.5 font-mono tabular-nums">
                    (طرح: {toPersianDigits(act.effectivePlannedQuantity)} {act.unit})
                  </span>
                </div>
                <div className="text-left font-mono tabular-nums">
                  <span className="text-ink-2">
                    {toPersianDigits(act.totalCompletedQuantity)} نصب‌شده
                  </span>
                  {act.remainingQuantity > 0 && (
                    <span className="text-amber-400 font-bold mr-1.5">
                      ({toPersianDigits(act.remainingQuantity)} مانده)
                    </span>
                  )}
                </div>
              </div>
            ))}

            {incompleteReport.hasIncomplete && (
              <div className="pt-2.5 border-t border-line space-y-2.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>تعیین تکلیف اقلام باقیمانده برای اتمام پروژه:</span>
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-2 p-2.5 rounded-md border border-line bg-surface cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="completionMode"
                      checked={completionMode === 'FULL_COMPLETED_TODAY'}
                      onChange={() => setCompletionMode('FULL_COMPLETED_TODAY')}
                      className="mt-0.5 accent-brand"
                    />
                    <div className="space-y-1 flex-1">
                      <span className="font-semibold text-ink block">
                        1. تمام اقلام باقیمانده امروز به طور کامل نصب شدند
                      </span>
                      <p className="text-[12px] text-ink-2">
                        کار نصب 100٪ تکمیل شده است و هیچ موردی ناتمام باقی نمانده است.
                      </p>
                      {completionMode === 'FULL_COMPLETED_TODAY' && (
                        <label className="flex items-center gap-1.5 mt-2 pt-2 border-t border-dashed border-line cursor-pointer text-[12px] text-emerald-400 font-medium">
                          <input
                            type="checkbox"
                            checked={confirmFinishedToday}
                            onChange={(e) => setConfirmFinishedToday(e.target.checked)}
                            className="rounded text-brand-ink focus:ring-brand"
                          />
                          <span>اقرار و تایید می‌نمایم که تمام لت‌های باقیمانده در محل نصب شدند.</span>
                        </label>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2.5 rounded-md border border-rose-500/30 bg-rose-500/10 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="completionMode"
                      checked={completionMode === 'EXCEPTIONAL_PARTIAL'}
                      onChange={() => setCompletionMode('EXCEPTIONAL_PARTIAL')}
                      className="mt-0.5 accent-rose-500"
                    />
                    <div className="space-y-1.5 flex-1">
                      <span className="font-semibold text-rose-300 block">
                        2. اتمام استثنایی با کسری اقلام اجرایی (تحویل ناقص پروژه)
                      </span>
                      <p className="text-[12px] text-rose-400">
                        به دلیل موانع کناف، عدم آمادگی بستر ساختمانی یا دستور کارفرما، اقلام فوق نصب نشدند و با تایید سرپرست پرونده بسته می‌شود.
                      </p>
                      {completionMode === 'EXCEPTIONAL_PARTIAL' && (
                        <div className="space-y-1 pt-1">
                          <label className="block text-[12px] font-semibold text-rose-300">
                            علت مستند عدم اجرای اقلام باقیمانده (الزامی - حداقل 10 کاراکتر):
                          </label>
                          <textarea
                            rows={2}
                            value={exceptionalReason}
                            onChange={(e) => setExceptionalReason(e.target.value)}
                            placeholder="مثال: کناف سقف اتاق خواب مستر تکمیل نبوده و کارفرما تحویل اقلام بدون نصب را پذیرفت"
                            className="w-full text-xs p-2 rounded-md border border-rose-500/40 bg-canvas text-ink leading-relaxed focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* TAB 1: PHOTOS */}
          {activeTab === 'PHOTOS' && (
            <div className="space-y-4">
              {/* After Photos */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>عکس‌های اتمام نصب (بعد از کار) — الزامی:</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {afterPhotos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative w-20 h-20 rounded-md overflow-hidden border border-line group"
                    >
                      <CloudImage src={photo} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index, 'AFTER')}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-md border border-dashed border-brand/60 bg-brand/5 hover:bg-brand/10 cursor-pointer text-brand-ink transition min-h-[80px]">
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-xs font-semibold">دوربین</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'AFTER')}
                      className="hidden"
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-md border border-dashed border-line-strong bg-sunken hover:bg-raised cursor-pointer text-ink-2 hover:text-ink transition min-h-[80px]">
                    <Upload className="w-5 h-5 mb-1 text-ink-3" />
                    <span className="text-xs font-semibold">گالری</span>
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
              <div className="pt-3 border-t border-line">
                <label className="block text-xs font-medium text-ink-2 mb-1.5 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-ink-3" />
                  <span>عکس‌های قبل از شروع کار (اختیاری):</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {beforePhotos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative w-20 h-20 rounded-md overflow-hidden border border-line group"
                    >
                      <CloudImage src={photo} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index, 'BEFORE')}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-md border border-dashed border-line-strong bg-sunken hover:bg-raised cursor-pointer text-ink-2 hover:text-ink transition min-h-[80px]">
                    <Camera className="w-5 h-5 mb-1 text-ink-3" />
                    <span className="text-xs font-semibold">دوربین</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'BEFORE')}
                      className="hidden"
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-md border border-dashed border-line-strong bg-sunken hover:bg-raised cursor-pointer text-ink-2 hover:text-ink transition min-h-[80px]">
                    <Upload className="w-5 h-5 mb-1 text-ink-3" />
                    <span className="text-xs font-semibold">گالری</span>
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
                <label htmlFor="completion-notes" className="block text-xs font-medium text-ink-2 mb-1">
                  توضیحات تکنسین نصب:
                </label>
                <textarea
                  id="completion-notes"
                  rows={2}
                  placeholder="مثال: تمام لت‌ها تراز شد و موتور تست گردید..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border border-line bg-canvas text-ink focus:border-brand"
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
                <span className="text-xs font-bold text-ink">
                  چک‌لیست استانداردهای تحویل (6 مورد):
                </span>
                <button
                  type="button"
                  onClick={selectAllChecklist}
                  className="text-xs font-medium text-brand-ink hover:underline cursor-pointer"
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
                      className={`p-3 rounded-md border transition ${
                        isChecked
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-line bg-sunken'
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
                          className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 mt-0.5 accent-emerald-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-semibold flex items-center gap-1.5 text-ink">
                            <Icon className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{item.title}</span>
                          </div>
                          <p className="text-[12px] text-ink-2 mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      {!isChecked && (
                        <div className="mt-2 pt-2 border-t border-line" onClick={(e) => e.stopPropagation()}>
                          <label className="block text-xs font-medium text-amber-400 mb-1">
                            علت عدم اجرا (الزامی):
                          </label>
                          <input
                            type="text"
                            value={checklistNotes[item.key] || ''}
                            onChange={(e) =>
                              setChecklistNotes((prev) => ({ ...prev, [item.key]: e.target.value }))
                            }
                            placeholder="دلیل عدم انجام این بند..."
                            className="w-full text-xs p-2 rounded-md border border-amber-500/30 bg-canvas text-ink"
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
                  مرحله بعد: تحویل و امضا ←
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: SIGNATURE & HANDOVER TYPE (Task 4) */}
          {activeTab === 'SIGNATURE' && (
            <div className="space-y-4">
              {/* Signee Type Segmented Selector */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  طرف تحویل‌گیرنده کارگاه / پروژه:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'RESIDENTIAL_CUSTOMER', label: 'مشتری مسکونی', icon: UserCheck },
                    { id: 'CONSTRUCTION_REPRESENTATIVE', label: 'نماینده کارگاه / ناظر', icon: Building },
                    { id: 'UNAVAILABLE_EXEMPT', label: 'عدم حضور کارفرما', icon: UserX },
                  ].map((opt) => {
                    const isSelected = signeeType === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSigneeType(opt.id as HandoverSigneeType)}
                        className={`p-2.5 rounded-md border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'border-brand bg-raised text-brand-soft font-bold'
                            : 'border-line bg-sunken text-ink-2 hover:bg-raised hover:text-ink'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[12px] leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-form 1: RESIDENTIAL CUSTOMER */}
              {signeeType === 'RESIDENTIAL_CUSTOMER' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-md bg-sunken border border-line text-xs">
                    <span className="font-semibold block text-ink">
                      تحویل مستقیم به مشتری: {project.customerName}
                    </span>
                    <span className="text-[12px] text-ink-2 block mt-0.5">
                      شماره تماس ثبت‌شده: {project.customerPhone}
                    </span>
                  </div>

                  {/* Legal Disclaimer Box */}
                  <div className="p-3 rounded-lg bg-brand/10 border border-brand/30 text-xs text-brand-soft space-y-1">
                    <span className="font-bold text-ink block">متن رسمی و حقوقی تاییدیه تحویل کارفرما:</span>
                    <p className="leading-relaxed text-[12px] text-brand-soft">
                      «اینجانب کارفرما، صحت عملکرد و سلامت کامل پرده‌ها و شیدها، کالیبراسیون مکانیزم‌ها، و همچنین نظافت و عدم وجود هرگونه خسارت به محیط کارگاه/ساختمان را تحویل گرفته و تایید می‌نمایم.»
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-brand-ink" />
                      امضای دیجیتال کارفرما روی صفحه:
                    </label>
                    <SignaturePad
                      value={signature}
                      onChange={(dataUrl) => setSignature(dataUrl || undefined)}
                    />
                  </div>

                  {/* Optional Satisfaction Rating */}
                  <div className="p-3 rounded-md bg-sunken border border-line space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-ink-2">
                        میزان رضایت کارفرما (اختیاری):
                      </label>
                      {satisfaction && (
                        <button
                          type="button"
                          onClick={() => setSatisfaction(undefined)}
                          className="text-[11px] text-ink-3 hover:text-ink-2 hover:underline"
                        >
                          پاک کردن
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSatisfaction(s)}
                          className="min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-md hover:bg-raised transition cursor-pointer"
                          aria-label={`${s} ستاره`}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              satisfaction && s <= satisfaction
                                ? 'text-brand-ink fill-brand'
                                : 'text-ink-3'
                            }`}
                          />
                        </button>
                      ))}
                      {satisfaction && (
                        <span className="text-xs font-semibold text-brand-soft mr-2 tabular-nums">
                          {toPersianDigits(satisfaction)} از 5 ستاره
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-form 2: CONSTRUCTION REPRESENTATIVE */}
              {signeeType === 'CONSTRUCTION_REPRESENTATIVE' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">
                        نام نماینده کارگاه (الزامی):
                      </label>
                      <input
                        type="text"
                        value={representativeName}
                        onChange={(e) => setRepresentativeName(e.target.value)}
                        placeholder="مثال: مهندس راد"
                        className="w-full text-xs p-2.5 rounded-md border border-line bg-canvas text-ink focus:border-brand"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">
                        سمت در پروژه:
                      </label>
                      <input
                        type="text"
                        value={representativeRole}
                        onChange={(e) => setRepresentativeRole(e.target.value)}
                        placeholder="مثال: ناظر مقیم / سرپرست کارگاه"
                        className="w-full text-xs p-2.5 rounded-md border border-line bg-canvas text-ink focus:border-brand"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-ink-3" />
                      شماره تماس نماینده (الزامی):
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={representativePhone}
                      onChange={(e) => setRepresentativePhone(e.target.value)}
                      placeholder="0912..."
                      className="w-full text-xs p-2.5 rounded-md border border-line bg-canvas text-ink text-left font-mono focus:border-brand"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-brand-ink" />
                      امضای نماینده کارگاه:
                    </label>
                    <SignaturePad
                      value={signature}
                      onChange={(dataUrl) => setSignature(dataUrl || undefined)}
                    />
                  </div>

                  {/* Optional Satisfaction */}
                  <div className="p-3 rounded-md bg-sunken border border-line space-y-1.5">
                    <label className="text-xs font-medium text-ink-2 block">
                      ارزیابی کیفی نماینده (اختیاری):
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSatisfaction(s)}
                          className="min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-md hover:bg-raised transition cursor-pointer"
                          aria-label={`${s} ستاره`}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              satisfaction && s <= satisfaction
                                ? 'text-brand-ink fill-brand'
                                : 'text-ink-3'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-form 3: UNAVAILABLE EXEMPT */}
              {signeeType === 'UNAVAILABLE_EXEMPT' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 leading-relaxed">
                      <span className="font-bold block">معافیت مستند عدم حضور کارفرما</span>
                      <p className="text-[12px] text-amber-400">
                        در صورت عدم حضور کارفرما یا اتمام کار پس از ساعات اداری، با شرح مستند دلایل و الصاق تصویر درب بسته یا پیامک هماهنگی، گزارش بدون امضا ثبت شده و توسط مدیر QC ارزیابی خواهد شد.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1">
                      علت عدم امکان اخذ امضا و شرایط ترک کارگاه (الزامی):
                    </label>
                    <textarea
                      rows={3}
                      value={unavailabilityReason}
                      onChange={(e) => setUnavailabilityReason(e.target.value)}
                      placeholder="مثال: کارفرما طبق تماس تلفنی ساعت 18 امکان حضور نداشتند و هماهنگ شد کلید به نگهبانی تحویل گردد..."
                      className="w-full text-xs p-3 rounded-md border border-line bg-canvas text-ink leading-relaxed focus:border-brand"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-2 mb-1">
                      مدارک تصویری ترک ایمن کارگاه (عکس کلید، درب قفل‌شده یا پیامک):
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {unavailabilityPhotos.map((photo, index) => (
                        <div
                          key={index}
                          className="relative w-16 h-16 rounded-md overflow-hidden border border-line"
                        >
                          <CloudImage src={photo} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() =>
                              setUnavailabilityPhotos((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <label className="flex flex-col items-center justify-center w-16 h-16 rounded-md border border-dashed border-line-strong bg-sunken hover:bg-raised cursor-pointer text-ink-2 hover:text-ink transition">
                        <Camera className="w-4 h-4 mb-0.5 text-brand-ink" />
                        <span className="text-[11px] font-semibold">دوربین</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleUnavailabilityPhotoUpload}
                          className="hidden"
                        />
                      </label>

                      <label className="flex flex-col items-center justify-center w-16 h-16 rounded-md border border-dashed border-line-strong bg-sunken hover:bg-raised cursor-pointer text-ink-2 hover:text-ink transition">
                        <Upload className="w-4 h-4 mb-0.5 text-brand-ink" />
                        <span className="text-[11px] font-semibold">گالری</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleUnavailabilityPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

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
        <div className="p-4 border-t border-line bg-canvas flex items-center gap-3 shrink-0">
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
