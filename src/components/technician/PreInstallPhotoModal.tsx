import React, { useState } from 'react';
import { Camera, X, CheckCircle2, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import { Project } from '../../types';
import { CloudImage } from '../common/CloudImage';
import { toPersianDigits } from '../../utils/jalali';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (photos: string[]) => Promise<void> | void;
}

export const PreInstallPhotoModal: React.FC<Props> = ({
  project,
  isOpen,
  onClose,
  onSubmit,
}) => {
  useEscapeKey(onClose, isOpen);
  // only real photos: an empty entry is a photo still waiting to upload and must not be sent again
  const [photos, setPhotos] = useState<string[]>(() => (project.beforePhotos || []).filter(Boolean));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError('');

    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBase64 = await compressImageFile(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.8,
        });
        newPhotos.push(compressedBase64);
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری یا فشرده‌سازی تصاویر.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      setError('ثبت حداقل یک تصویر از وضعیت پنجره و کناف پیش از شروع نصب الزامی است.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onSubmit(photos);
      onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت تصاویر اولیه.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-install-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-surface rounded-xl max-w-lg w-full shadow-2xl border border-brand/40 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-canvas px-5 py-4 border-b border-line flex items-center justify-between text-ink">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand/15 text-brand-ink border border-brand/30 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 id="pre-install-title" className="font-black text-sm sm:text-base text-ink">
                گیت الزامی: عکس‌های قبل از نصب
              </h3>
              <p className="text-xs text-ink-2 mt-0.5">
                <span className="font-mono text-brand-ink">{project.code}</span> • {project.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-2 hover:text-ink hover:bg-raised transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions Banner */}
        <div className="bg-brand/10 border-b border-brand/20 p-3.5 flex items-start gap-2.5 text-xs text-brand-soft">
          <AlertTriangle className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            لطفاً پیش از دست زدن به ابزار یا باز کردن بسته‌بندی‌ها، چند عکس شفاف از محل نصب (قاب پنجره، سقف کاذب، قرنیزها و کلید/پریزها) بارگذاری کنید. 
            <span className="font-bold text-ink block mt-0.5">تا پیش از بارگذاری عکس، دکمه «شروع نصب» قفل خواهد بود.</span>
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Upload Button */}
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line-strong hover:border-brand rounded-xl p-6 bg-canvas cursor-pointer transition text-center group">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={isProcessing || isSubmitting}
              className="hidden"
            />
            {isProcessing ? (
              <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-raised text-brand-ink group-hover:bg-brand/20 flex items-center justify-center transition">
                <Upload className="w-6 h-6" />
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold text-ink group-hover:text-brand-ink transition">
                عکاسی با دوربین یا انتخاب از گالری
              </p>
              <p className="text-[12px] text-ink-3 mt-0.5">
                تصاویر به صورت هوشمند و بدون افت کیفیت فشرده می‌شوند
              </p>
            </div>
          </label>

          {/* Photo Thumbnails */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink-2">
                <span>تصاویر ثبت‌شده ({toPersianDigits(photos.length)} مورد):</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 bg-canvas rounded-lg border border-line">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-line group">
                    <CloudImage src={url} alt={`پیش‌نصب ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition shadow-md cursor-pointer"
                      title="حذف تصویر"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg font-semibold">
              {error}
            </p>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-raised hover:bg-hover text-ink-2 hover:text-ink transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={photos.length === 0 || isSubmitting || isProcessing}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-lg text-xs font-black bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:hover:bg-brand text-on-brand flex items-center gap-2 transition shadow-lg shadow-brand/20 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تایید عکس‌ها و شروع رسمی نصب</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
