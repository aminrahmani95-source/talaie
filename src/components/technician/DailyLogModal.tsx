import React, { useState } from 'react';
import { Project } from '../../types';
import {
  X,
  Camera,
  Upload,
  AlertTriangle,
  Loader2,
  Moon,
} from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import { CloudImage } from '../common/CloudImage';
import { Button } from '../ui/Button';

interface Props {
  isOpen: boolean;
  project: Project;
  onClose: () => void;
  onSubmit: (data: { note: string; photos: string[] }) => Promise<void>;
}

export const DailyLogModal: React.FC<Props> = ({
  isOpen,
  project,
  onClose,
  onSubmit,
}) => {
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.75);
        setPhotos((prev) => [...prev, compressed]);
      } catch (err) {
        console.warn('Image compression failed:', err);
      }
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('ثبت توضیحات گزارش کار امروز الزامی است.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({ note: note.trim(), photos });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ثبت گزارش کار.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full shadow-2xl border border-[#E2DDD4] dark:border-[#2C2C2C] overflow-hidden my-6 transition-all">
        {/* Header */}
        <div className="bg-[#212121] px-5 py-4 text-white flex items-center justify-between border-b border-[#C1A056]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white">
                پایان کار امروز (توقف موقت)
              </h3>
              <p className="text-xs text-[#E5CA8F] mt-0.5">
                <span className="font-mono">{project.code}</span> • {project.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
            با ثبت این گزارش، ساعت کارکرد امروز بسته شده و وضعیت پروژه به «نیمه‌کاره — ادامه روز بعد» تغییر می‌یابد. چک‌لیست نهایی و امضای کارفرما در روز پایان پروژه انجام خواهد شد.
          </div>

          {/* Daily Work Note (Required) */}
          <div>
            <label
              htmlFor="daily-log-note"
              className="block text-xs font-bold text-[#181818] dark:text-white mb-1"
            >
              گزارش کار امروز (الزامی):
            </label>
            <textarea
              id="daily-log-note"
              rows={3}
              placeholder="مثال: قاب‌ها و ریل‌های سالن اصلی نصب و تراز شد؛ لت‌های خواب‌ها برای فردا ماند..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white leading-relaxed"
            />
          </div>

          {/* Photos (Optional) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#181818] dark:text-white">
                عکس‌های پیشرفت کار امروز (اختیاری):
              </label>
              <span className="text-xs text-[#69655F] dark:text-[#9E988D]">
                {photos.length} عکس انتخاب شده
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5 items-center">
              {photos.map((p, idx) => (
                <div
                  key={idx}
                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-indigo-500/40 shadow-2xs group"
                >
                  <CloudImage src={p} alt={`عکس پیشرفت ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition cursor-pointer"
                    aria-label="حذف عکس"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-indigo-500/50 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer text-indigo-700 dark:text-indigo-400 transition min-h-[80px]">
                <Camera className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">دوربین</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-[#69655F] dark:text-[#9E988D] transition min-h-[80px]">
                <Upload className="w-5 h-5 mb-1 text-slate-400" />
                <span className="text-xs font-bold">گالری</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center gap-2">
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
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-1" />
                  <span>در حال ثبت...</span>
                </>
              ) : (
                'ثبت پایان کار امروز'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
