import React, { useState } from 'react';
import { Project, StuckIncident, StuckCategory } from '../../types';
import { X, Send } from 'lucide-react';
import { getDisplayName } from '../../utils/technicianName';
import { compressImageFile } from '../../utils/imageCompressor';
import { PhotoSourceButtons } from '../ui/PhotoSourceButtons';
import { CloudImage } from '../common/CloudImage';
import { Sheet } from '../ui/Sheet';

interface Props {
  project: Project;
  isOpen: boolean;
  reporterName: string;
  onClose: () => void;
  onSubmit: (incident: StuckIncident, handoverPayload?: any) => void;
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
  const [completedWork, setCompletedWork] = useState('');
  const [remainingWork, setRemainingWork] = useState('');
  const [requiredParts, setRequiredParts] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const requestClose = () => {
    if (isSubmitting) return;
    const dirty = description.trim() || completedWork.trim() || remainingWork.trim() || requiredParts.trim() || photos.length > 0;
    if (dirty && !window.confirm('اعلام توقف ثبت نشده است. بدون ثبت بسته شود؟')) return;
    onClose();
  };

  const focusField = (id: string) => document.getElementById(id)?.focus();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPhotos(true);
    setError('');
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImageFile(files[i], {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.8,
        });
        newUrls.push(compressed);
      }
      setPhotos((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      setError(err.message || 'خطا در فشرده‌سازی عکس‌ها.');
    } finally {
      setIsProcessingPhotos(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;

    if (!description.trim()) {
      setError('بنویسید چرا کار متوقف شد.');
      focusField('stuck-description');
      return;
    }

    if (!completedWork.trim()) {
      setError('بنویسید تا اینجا چه کارهایی انجام شد.');
      focusField('stuck-completed');
      return;
    }

    if (!remainingWork.trim()) {
      setError('بنویسید چه کارهایی باقی مانده است.');
      focusField('stuck-remaining');
      return;
    }

    const incident: StuckIncident = {
      id: `stuck-${Date.now()}`,
      stuckAt: new Date().toISOString(),
      category,
      description: description.trim(),
      reportedBy: getDisplayName(reporterName) || 'تکنسین نصب',
      photos,
      targetMaxHours: 72,
      resolutionStatus: 'OPEN',
      previousStatus: project.status,
    };

    const handoverPayload = {
      fromTeamId: project.assignedTeamId || '',
      fromTeamName: project.assignedTeamName || 'اکیپ قبلی',
      reportedByUserId: '',
      reportedByUserName: getDisplayName(reporterName) || 'سرپرست قبلی',
      stoppedAt: new Date().toISOString(),
      reason: description.trim(),
      completedWork: completedWork.trim(),
      remainingWork: remainingWork.trim(),
      requiredParts: requiredParts.trim() || undefined,
      photos,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(incident, handoverPayload);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت توقف پروژه.');
      setIsSubmitting(false);
    }
  };

  const fieldCls =
    'w-full text-sm p-2.5 rounded-md border border-line bg-canvas text-ink resize-none focus:outline-none focus:border-rose-500';

  return (
    <Sheet
      isOpen
      onClose={requestClose}
      title="اعلام توقف کار"
      subtitle={`${project.code} • ${project.title}`}
      size="lg"
      footer={
        <div className="space-y-2">
          {error && (
            <p role="alert" className="text-rose-600 dark:text-rose-300 text-xs font-bold">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={requestClose}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-md text-sm font-semibold bg-raised hover:bg-hover text-ink-2 hover:text-ink transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              form="report-stuck-form"
              disabled={isSubmitting || isProcessingPhotos}
              className="flex-[2] min-h-[44px] px-4 py-2 rounded-md text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت توقف'}</span>
            </button>
          </div>
        </div>
      }
    >
      <form id="report-stuck-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-[12px] leading-6 text-rose-700 dark:text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-md p-2.5">
          پروژه به «نیمه‌کاره‌ها» می‌رود و مدیر فنی پیگیری می‌کند. آنچه اینجا می‌نویسید به اکیپی که کار را ادامه می‌دهد نشان داده می‌شود، پس دیگر لازم نیست تلفنی توضیح بدهید.
        </p>

        {/* Category */}
        <div>
          <span className="block text-xs font-bold text-ink mb-2">
            ۱. علت توقف <span className="text-rose-400">*</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setCategory(cat.key);
                    setError('');
                  }}
                  className={`w-full text-right p-2.5 rounded-md text-xs flex items-center gap-2 transition cursor-pointer border min-h-[44px] ${
                    isSelected
                      ? 'bg-rose-500/15 border-rose-500/60 text-ink font-bold'
                      : 'bg-sunken border-line text-ink-2 hover:border-line-strong hover:text-ink'
                  }`}
                >
                  <span className="text-base shrink-0">{cat.icon}</span>
                  <span className="leading-snug">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="stuck-description" className="block text-xs font-bold text-ink mb-1.5">
            ۲. توضیح مانع <span className="text-rose-400">*</span>
          </label>
          <textarea
            id="stuck-description"
            rows={2}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setError('');
            }}
            placeholder="مثلاً: ابعاد ۲ شید سالن با پنجره نمی‌خواند و باید اصلاح شود."
            className={fieldCls}
          />
        </div>

        {/* Handover Details for next team */}
        <div className="p-3 bg-sunken rounded-lg border border-line space-y-3">
          <span className="text-xs font-bold text-ink block">۳. تحویل به اکیپ بعدی</span>

          <div>
            <label htmlFor="stuck-completed" className="block text-[12px] font-semibold text-ink-2 mb-1">
              تا اینجا چه انجام شد؟ <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="stuck-completed"
              rows={2}
              value={completedWork}
              onChange={(e) => setCompletedWork(e.target.value)}
              placeholder="مثلاً: ریل‌ها و براکت‌ها نصب و برق تست شد."
              className={fieldCls}
            />
          </div>

          <div>
            <label htmlFor="stuck-remaining" className="block text-[12px] font-semibold text-ink-2 mb-1">
              چه کاری مانده است؟ <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="stuck-remaining"
              rows={2}
              value={remainingWork}
              onChange={(e) => setRemainingWork(e.target.value)}
              placeholder="مثلاً: آویزان کردن ۲ شید اصلاحی، تنظیم لیمیت موتور و ریموت."
              className={fieldCls}
            />
          </div>

          <div>
            <label htmlFor="stuck-parts" className="block text-[12px] font-semibold text-ink-2 mb-1">
              قطعه یا متریال لازم (اختیاری)
            </label>
            <input
              id="stuck-parts"
              type="text"
              value={requiredParts}
              onChange={(e) => setRequiredParts(e.target.value)}
              placeholder="مثلاً: ۲ شید اصلاحی عرض ۲.۴۵ + ۲ ریموت تک‌کانال"
              className={fieldCls}
            />
          </div>
        </div>

        {/* Photos */}
        <div>
          <span className="block text-xs font-bold text-ink mb-2">۴. عکس وضعیت فعلی (توصیه می‌شود)</span>
          <div className="flex flex-wrap items-center gap-2">
            <PhotoSourceButtons onChange={handlePhotoUpload} busy={isProcessingPhotos} />
            {photos.map((p, i) => (
              <div key={i} className="relative w-14 h-14 rounded-md overflow-hidden border border-line shrink-0">
                <CloudImage src={p} alt="وضعیت توقف" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 left-0.5 bg-black/70 text-white rounded-full p-1"
                  aria-label="حذف عکس"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Sheet>
  );
};
