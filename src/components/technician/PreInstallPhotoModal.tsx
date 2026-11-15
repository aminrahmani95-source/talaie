import React, { useState } from 'react';
import { Camera, X, CheckCircle2, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import { Project } from '../../types';
import { CloudImage } from '../common/CloudImage';

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
  const [photos, setPhotos] = useState<string[]>(project.beforePhotos || []);
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
      <div className="bg-[#151B23] rounded-xl max-w-lg w-full shadow-2xl border border-[#C5A059]/40 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0D1117] px-5 py-4 border-b border-[#212835] flex items-center justify-between text-[#F0F4F8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 id="pre-install-title" className="font-black text-sm sm:text-base text-[#F0F4F8]">
                گیت الزامی: عکس‌های قبل از نصب
              </h3>
              <p className="text-xs text-[#9BA7B6] mt-0.5">
                <span className="font-mono text-[#C5A059]">{project.code}</span> • {project.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9BA7B6] hover:text-white hover:bg-[#1C232D] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions Banner */}
        <div className="bg-[#C5A059]/10 border-b border-[#C5A059]/20 p-3.5 flex items-start gap-2.5 text-xs text-[#E5CA8F]">
          <AlertTriangle className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            لطفاً پیش از دست زدن به ابزار یا باز کردن بسته‌بندی‌ها، چند عکس شفاف از محل نصب (قاب پنجره، سقف کاذب، قرنیزها و کلید/پریزها) بارگذاری کنید. 
            <span className="font-bold text-white block mt-0.5">تا پیش از بارگذاری عکس، دکمه «شروع نصب» قفل خواهد بود.</span>
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Upload Button */}
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#2D3748] hover:border-[#C5A059] rounded-xl p-6 bg-[#0D1117] cursor-pointer transition text-center group">
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileChange}
              disabled={isProcessing || isSubmitting}
              className="hidden"
            />
            {isProcessing ? (
              <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#1C232D] text-[#C5A059] group-hover:bg-[#C5A059]/20 flex items-center justify-center transition">
                <Upload className="w-6 h-6" />
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#F0F4F8] group-hover:text-[#C5A059] transition">
                عکاسی با دوربین یا انتخاب از گالری
              </p>
              <p className="text-[11px] text-[#637184] mt-0.5">
                تصاویر به صورت هوشمند و بدون افت کیفیت فشرده می‌شوند
              </p>
            </div>
          </label>

          {/* Photo Thumbnails */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#9BA7B6]">
                <span>تصاویر ثبت‌شده ({photos.length} مورد):</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 bg-[#0D1117] rounded-lg border border-[#212835]">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-[#212835] group">
                    <CloudImage src={url} alt={`پیش‌نصب ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition shadow-md"
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
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#212835]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[#1C232D] hover:bg-[#252F3D] text-[#9BA7B6] hover:text-[#F0F4F8] transition"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={photos.length === 0 || isSubmitting || isProcessing}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-lg text-xs font-black bg-[#C5A059] hover:bg-[#D4AF37] disabled:opacity-40 disabled:hover:bg-[#C5A059] text-[#0D1117] flex items-center gap-2 transition shadow-lg shadow-[#C5A059]/20 cursor-pointer"
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
