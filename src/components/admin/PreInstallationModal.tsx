import React, { useState } from 'react';
import { triggerToast } from '../Toast';
import { Project, SiteReadinessInspection, SiteReadinessItem, SiteChecklistState, User } from '../../types';
import {
  Ruler,
  CheckCircle2,
  AlertTriangle,
  X,
  Camera,
  Trash2,
  Calendar,
  Ticket as TicketIcon,
  Video,
  MapPin,
  MinusCircle,
} from 'lucide-react';
import { getUpcomingDays, toPersianDigits } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { compressImageFile } from '../../utils/imageCompressor';
import { PhotoSourceButtons } from '../ui/PhotoSourceButtons';
import { CloudImage } from '../common/CloudImage';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  project: Project;
  currentUser?: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveInspection: (inspection: SiteReadinessInspection, newScheduledDate?: string) => Promise<void> | void;
  onCreateTicket?: (ticketData: { projectId: string; title: string; description: string }) => void;
}

const DEFAULT_ITEMS: {
  id: string;
  title: string;
  category: 'CEILING_DRYWALL' | 'ELECTRICAL' | 'ACCESS_SPACE' | 'CUSTOM';
  description: string;
}[] = [
  {
    id: 'drywall',
    title: '1. استحکام سقف کاذب، قوطی‌کشی کناف و مهاربندی وزن',
    category: 'CEILING_DRYWALL',
    description: 'زیرسازی آهن جهت مهاربندی وزن شید و ریل پرده چک شد و تحمل بار استاندارد را دارد.',
  },
  {
    id: 'electrical',
    title: '2. انشعاب و کابل‌کشی برق 220 ولت موتورهای برقی (سامفی)',
    category: 'ELECTRICAL',
    description: 'سیم‌کشی فاز و نول در محل مناسب قرار دارد و ولتاژ برق جهت تست نهایی وصل است.',
  },
  {
    id: 'accessibility',
    title: '3. تخلیه فضا، دسترسی درگاه‌ها و امکان استقرار نردبان/داربست',
    category: 'ACCESS_SPACE',
    description: 'محیط عاری از نخاله و ضایعات است و تردد کارگران مانع اجرای عملیات نصب نیست.',
  },
  {
    id: 'finishing',
    title: '4. اتمام کارهای مرطوب، رنگ‌آمیزی و کف‌سازی نهایی',
    category: 'CUSTOM',
    description: 'نقاشی و کف‌سازی محیط تمام شده و رطوبت یا گرد و خاک به پارچه‌ها آسیب نمی‌زند.',
  },
  {
    id: 'openings',
    title: '5. عدم تغییر فرم و ابعاد درگاه‌ها نسبت به طراحی اولیه',
    category: 'CUSTOM',
    description: 'بازشوها، دستگیره‌ها و لبه‌های پنجره هیچ تداخل فیزیکی با مسیر حرکت پرده ندارند.',
  },
];

export const PreInstallationModal: React.FC<Props> = ({
  project,
  currentUser,
  isOpen,
  onClose,
  onSaveInspection,
  onCreateTicket,
}) => {
  useEscapeKey(onClose, isOpen);
  const existing = project.siteReadiness;
  const days = getUpcomingDays(180);

  const [inspectionType, setInspectionType] = useState<'IN_PERSON' | 'REMOTE'>(
    existing?.inspectionType || 'IN_PERSON'
  );

  // Initialize checklist items (no automatic approval defaults)
  const [items, setItems] = useState<SiteReadinessItem[]>(() => {
    if (existing?.items && existing.items.length > 0) {
      return existing.items;
    }
    return DEFAULT_ITEMS.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      state: '' as any, // Not selected initially - user must explicitly verify
      notes: '',
    }));
  });

  const [photos, setPhotos] = useState<string[]>(
    existing?.photos || []
  );
  const [generalNotes, setGeneralNotes] = useState(existing?.generalNotes || '');
  const [postponeDate, setPostponeDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStateChange = (id: string, state: SiteChecklistState) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, state } : item))
    );
  };

  const handleNotesChange = (id: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.75);
        setPhotos((prev) => [...prev, compressed]);
      } catch (err) {
        console.warn('Failed to compress site readiness photo:', err);
        triggerToast('error', err instanceof Error && err.message ? err.message : 'این عکس آماده نشد؛ دوباره امتحان کنید.');
      }
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const hasUnselectedItems = items.some((item) => !item.state);
  const hasDetectedIssues = items.some((item) => item.state === 'ISSUE_DETECTED');
  const isReady = !hasUnselectedItems && !hasDetectedIssues;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (hasUnselectedItems) {
      setFormError('لطفاً وضعیت تمام 5 بند بازبینی بستر نصب را مشخص کنید (هیچ بندی نباید بدون بررسی بماند).');
      return;
    }

    const inspection: SiteReadinessInspection = {
      inspectionType,
      inspectedAt: new Date().toISOString(),
      inspectedBy: getDisplayName(currentUser?.name) || 'کارشناس فنی و بازدید',
      status: isReady ? 'PASSED' : 'ACTION_REQUIRED',
      isReady,
      items,
      photos,
      generalNotes: generalNotes.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      await onSaveInspection(
        inspection,
        !isReady && postponeDate ? postponeDate : undefined
      );
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت برگه بازبینی بستر نصب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-center items-start bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-surface rounded-lg max-w-xl w-full shadow-2xl border border-line-strong overflow-hidden my-auto transition-all animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-canvas px-5 py-4 text-ink flex items-center justify-between border-b-2 border-brand shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center text-brand-ink border border-brand/30">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-ink">
                برگه بازبینی و آمادگی فیزیکی بستر نصب
              </h3>
              <p className="text-xs text-brand-ink font-bold line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 text-ink transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto grow">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Inspection Type Selector */}
          <div>
            <label className="block text-xs font-bold text-ink mb-2">
              نوع بازبینی بستر پروژه:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInspectionType('IN_PERSON')}
                className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  inspectionType === 'IN_PERSON'
                    ? 'border-brand bg-raised text-brand-ink ring-2 ring-brand/30 '
                    : 'border-line text-ink-2'
                }`}
              >
                <MapPin className="w-4 h-4 text-brand-ink" />
                <span>بازدید حضوری در محل پروژه</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectionType('REMOTE')}
                className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  inspectionType === 'REMOTE'
                    ? 'border-brand bg-raised text-brand-ink ring-2 ring-brand/30 '
                    : 'border-line text-ink-2'
                }`}
              >
                <Video className="w-4 h-4 text-brand-ink" />
                <span>بازبینی از راه دور (عکس / ویدئو)</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-ink-2 leading-relaxed bg-raised p-3 rounded-lg border border-line-strong">
            جهت جلوگیری از مأموریت ناموفق و هزینه‌های اکیپ، وضعیت فیزیکی هر بند را بررسی و تعیین وضعیت کنید. پروژه تنها در صورت تأیید کلیه بندهای کاربردی قابل اعزام اکیپ خواهد بود.
          </p>

          {/* 3-State Checklist Items */}
          <div className="space-y-3">
            {DEFAULT_ITEMS.map((itemMeta) => {
              const item = items.find((c) => c.id === itemMeta.id) || {
                id: itemMeta.id,
                title: itemMeta.title,
                category: itemMeta.category,
                state: '' as any,
                notes: '',
              };

              return (
                <div
                  key={itemMeta.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    item.state === 'CONFIRMED'
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : item.state === 'ISSUE_DETECTED'
                      ? 'border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/20'
                      : item.state === 'NOT_APPLICABLE'
                      ? 'border-line-strong bg-raised/40'
                      : 'border-line-strong bg-sunken'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-ink block">
                        {itemMeta.title}
                      </span>
                      <span className="text-[12px] text-ink-2 block leading-relaxed">
                        {itemMeta.description}
                      </span>
                    </div>

                    {/* 3-State Radio Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleStateChange(itemMeta.id, 'CONFIRMED')}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                          item.state === 'CONFIRMED'
                            ? 'bg-emerald-600 text-white '
                            : 'bg-surface border border-line text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تأیید</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStateChange(itemMeta.id, 'ISSUE_DETECTED')}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                          item.state === 'ISSUE_DETECTED'
                            ? 'bg-rose-600 text-white '
                            : 'bg-surface border border-line text-rose-700 dark:text-rose-400 hover:bg-rose-50'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>نقص / مانع</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStateChange(itemMeta.id, 'NOT_APPLICABLE')}
                        className={`px-2 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                          item.state === 'NOT_APPLICABLE'
                            ? 'bg-zinc-600 text-ink '
                            : 'bg-surface border border-line text-ink-2 hover:bg-zinc-50'
                        }`}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>فاقد موضوعیت</span>
                      </button>
                    </div>
                  </div>

                  {/* Note input if issue detected */}
                  {item.state === 'ISSUE_DETECTED' && (
                    <div className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-900/40 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-bold text-rose-800 dark:text-rose-300">
                          شرح نقص یا مانع شناسایی‌شده:
                        </label>
                        {onCreateTicket && (
                          <button
                            type="button"
                            onClick={() =>
                              onCreateTicket({
                                projectId: project.id,
                                title: `نقص بستر پروژه: ${itemMeta.title}`,
                                description: item.notes || itemMeta.description,
                              })
                            }
                            className="text-[12px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:underline"
                          >
                            <TicketIcon className="w-3 h-3" />
                            <span>ثبت تیکت پیگیری</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="مثال: کابل برق به درگاه پنجره غربی کشیده نشده است یا کناف نیاز به شاسی‌کشی مجدد دارد."
                        value={item.notes || ''}
                        onChange={(e) => handleNotesChange(itemMeta.id, e.target.value)}
                        className="w-full text-xs p-2.5 rounded-md border border-rose-300 dark:border-rose-800 bg-surface text-ink"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-brand-ink" />
                <span>تصاویر و مستندات میدانی وضعیت بستر ({photos.length}):</span>
              </label>
<PhotoSourceButtons onChange={handlePhotoUpload} />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-md overflow-hidden border border-line bg-raised"
                  >
                    <CloudImage
                      src={photo}
                      alt={`مستند ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overall Readiness Outcome */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-ink mb-2">
              نتیجه نهایی کارشناسی آمادگی بستر نصب:
            </label>
            <div className={`p-4 rounded-lg border flex items-center justify-between gap-3 ${
              isReady
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                : 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-2.5">
                {isReady ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">
                    {isReady
                      ? 'بستر پروژه کاملاً آماده نصب و اعزام اکیپ است'
                      : 'بستر پروژه دارای نقص/مانع است — نصب موکول می‌شود'}
                  </h4>
                  <p className="text-[12px] opacity-80 mt-0.5">
                    {isReady
                      ? 'تمامی بندهای استاندارد فنی تایید شدند و مانعی برای اعزام وجود ندارد.'
                      : 'تا زمان رفع نقص و آماده‌سازی بستر توسط مشتری یا کارگاه، اعزام اکیپ متوقف می‌ماند.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Postpone date picker if not ready */}
          {!isReady && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 p-3 rounded-lg space-y-1.5">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>تاریخ پیشنهادی جهت موکول شدن مأموریت (انتخاب از تقویم شمسی):</span>
              </label>
              <select
                value={postponeDate}
                onChange={(e) => setPostponeDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-amber-300 dark:border-amber-700 bg-surface text-ink font-bold"
              >
                <option value="">انتخاب تاریخ موکول‌شدن (اختیاری)...</option>
                {days.map((d) => (
                  <option key={d.dateKey} value={d.dateKey}>
                    {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} -{' '}
                    {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* General Notes */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">
              توضیحات و جمع‌بندی کارشناس بازبینی:
            </label>
            <textarea
              rows={2}
              placeholder="مثال: کارفرما کارهای کناف را تمام کرده و پریزهای برق نصب شده‌اند؛ هیچ تداخلی با سایر پیمانکاران وجود ندارد."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full text-xs p-3 rounded-md border border-line bg-surface text-ink"
            />
          </div>

          {/* Submit & Cancel Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-line-strong">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-3 rounded-md border border-line text-ink text-xs font-bold hover:bg-slate-50 hover:bg-raised disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-canvas hover:bg-hover text-brand-ink font-black rounded-md text-xs transition border border-brand/30 shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'در حال ثبت...' : 'ثبت برگه بازبینی بستر نصب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
