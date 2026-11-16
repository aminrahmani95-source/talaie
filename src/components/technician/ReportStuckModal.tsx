import React, { useState } from 'react';
import { Project, StuckIncident, StuckCategory } from '../../types';
import { AlertOctagon, X, ShieldAlert, Send, Camera, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { getDisplayName } from '../../utils/technicianName';
import { compressImageFile } from '../../utils/imageCompressor';
import { CloudImage } from '../common/CloudImage';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!description.trim()) {
      setError('لطفاً شرح دقیق مانع یا دلیل توقف کار را یادداشت فرمایید.');
      return;
    }

    if (!completedWork.trim()) {
      setError('لطفاً اقدامات انجام‌شده تا این لحظه را جهت اطلاع اکیپ بعدی بنویسید.');
      return;
    }

    if (!remainingWork.trim()) {
      setError('لطفاً اقدامات باقیمانده را جهت اطلاع اکیپ بعدی بنویسید.');
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-stuck-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-[#151B23] rounded-xl max-w-xl w-full shadow-2xl border border-rose-500/30 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header in Rose & Graphite */}
        <div className="bg-[#0D1117] px-6 py-4 text-[#F0F4F8] flex items-center justify-between border-b border-[#212835]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 id="report-stuck-title" className="font-bold text-base text-[#F0F4F8]">
                اعلام توقف کار و صورت‌جلسه تحویل به اکیپ بعدی
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
            <span>پروژه جهت جلوگیری از فراموشی به کارتابل «نیمه‌کاره‌ها» منتقل می‌شود</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-[#F0F4F8] mb-2">
              علت توقف پروژه: *
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
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
                    className={`w-full text-right p-2 rounded-md text-xs font-medium flex items-center justify-between transition cursor-pointer border ${
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

          {/* Description */}
          <div>
            <label htmlFor="stuck-description" className="block text-xs font-semibold text-[#F0F4F8] mb-1">
              شرح دقیق مانع / علت توقف: *
            </label>
            <textarea
              id="stuck-description"
              rows={2}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError('');
              }}
              placeholder="مثلاً: ابعاد 2 عدد شید سالن مغایرت داشت و باید مجدداً اصلاح شود..."
              className="w-full text-xs p-2.5 rounded-md border border-[#212835] focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-[#0D1117] text-[#F0F4F8] resize-none"
            />
          </div>

          {/* Handover Details for next team */}
          <div className="p-3.5 bg-[#111620] rounded-xl border border-sky-500/30 space-y-3">
            <h4 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <span>📋 اطلاعات تحویل کارگاه به اکیپ بعدی (رفع نیاز به تماس تلفنی)</span>
            </h4>

            <div>
              <label className="block text-[11px] font-semibold text-[#9BA7B6] mb-1">
                1. اقدامات انجام‌شده تا این لحظه: *
              </label>
              <textarea
                rows={2}
                value={completedWork}
                onChange={(e) => setCompletedWork(e.target.value)}
                placeholder="مثال: تمام ریل‌ها و براکت‌های سقفی نصب شد. سیم‌کشی برق 220 ولت انجام و تست شد."
                className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#9BA7B6] mb-1">
                2. کارهای باقیمانده برای اکیپ بعدی: *
              </label>
              <textarea
                rows={2}
                value={remainingWork}
                onChange={(e) => setRemainingWork(e.target.value)}
                placeholder="مثال: فقط آویزان کردن 2 عدد شید اصلاح‌شده، کالیبره کردن لیمیت موتور و کد ریموت."
                className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#9BA7B6] mb-1">
                3. قطعات یا متریال مورد نیاز (جهت تامین انبار):
              </label>
              <input
                type="text"
                value={requiredParts}
                onChange={(e) => setRequiredParts(e.target.value)}
                placeholder="مثال: 2 عدد شید اصلاحی با عرض 2.45 متر + 2 عدد ریموت تک‌کانال"
                className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8]"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-[11px] font-semibold text-[#9BA7B6] mb-1">
                عکس‌های وضعیت فعلی کارگاه و علت توقف:
              </label>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-[#1C232D] hover:bg-[#2D3748] text-[#C5A059] rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-[#C5A059]/30">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handlePhotoUpload}
                    disabled={isProcessingPhotos}
                    className="hidden"
                  />
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isProcessingPhotos ? 'در حال بهینه‌سازی...' : '+ افزودن عکس کارگاه'}</span>
                </label>
                <span className="text-[11px] text-[#637184]">
                  {photos.length > 0 ? `${photos.length} عکس ثبت شد` : 'اختیاری اما توصیه می‌شود'}
                </span>
              </div>
              {photos.length > 0 && (
                <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <div key={i} className="relative w-14 h-14 rounded overflow-hidden border border-[#212835] shrink-0">
                      <CloudImage src={p} alt="وضعیت توقف" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 left-0.5 bg-black/70 text-white rounded-full p-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-rose-400 text-xs font-semibold">{error}</p>}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-md text-xs font-semibold bg-[#1C232D] hover:bg-[#252F3D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isProcessingPhotos}
              className="px-5 py-2 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت توقف و ارسال به نیمه‌کاره‌ها'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
