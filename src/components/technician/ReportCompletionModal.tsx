import React, { useState } from 'react';
import { Project } from '../../types';
import { Camera, CheckCircle2, X, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  project: Project;
  onClose: () => void;
  onSubmit: (completionData: {
    completionNotes: string;
    completionPhotos: string[];
    customerSatisfaction?: number;
  }) => void;
}

export const ReportCompletionModal: React.FC<Props> = ({
  project,
  onClose,
  onSubmit,
}) => {
  const [completionNotes, setCompletionNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [satisfaction, setSatisfaction] = useState<number>(5);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (photos.length === 0) {
      if (!confirm('آیا مایلید بدون پیوست عکس اتمام کار گزارش را ثبت کنید؟ (ثبت عکس به تایید سریع‌تر کیوسی کمک می‌کند)')) {
        return;
      }
    }

    try {
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.7 },
      });
    } catch {
      // Ignore
    }

    onSubmit({
      completionNotes: completionNotes.trim(),
      completionPhotos: photos,
      customerSatisfaction: satisfaction,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 text-[#C1A056] rounded-xl border border-white/10">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 id="report-modal-title" className="font-black text-lg text-white">ثبت گزارش اتمام نصب پرده و شید</h3>
              <p className="text-xs text-[#E8E4DC]">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photos Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
              بارگذاری عکس‌های نهایی کار (نمای کامل پرده، شیدها و موتور):
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {photos.map((p, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-300 dark:border-zinc-700 shadow-sm">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow"
                    aria-label="حذف عکس"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 border-dashed border-[#C1A056] bg-emerald-50/30 dark:bg-[#141414] hover:bg-emerald-50 dark:hover:bg-[#202020] cursor-pointer text-[#C1A056] transition">
                <Camera className="w-6 h-6 mb-1 text-[#C1A056]" aria-hidden="true" />
                <span className="text-[10px] font-bold">عکاسی / آپلود</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              مسئول کیوسی این عکس‌ها را بررسی و امتیاز نهایی نصب را ثبت می‌کند.
            </p>
          </div>

          {/* Completion Notes */}
          <div>
            <label htmlFor="completion-notes" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              توضیحات و اظهارات نصاب / سرپرست:
            </label>
            <textarea
              id="completion-notes"
              rows={3}
              placeholder="مثال: نصب تمامی لت‌های شید و پرده با موفقیت انجام شد. ریموت کنترل کد شد و نحوه کار با موتور به کارفرما آموزش داده شد..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          {/* Customer Satisfaction */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] p-4 rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D]">
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              میزان رضایت کارفرما در محل:
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSatisfaction(s)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:scale-110 active:scale-95 transition"
                  aria-label={`${s} ستاره از ۵ ستاره`}
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
                {toPersianDigits(satisfaction)} از ۵ ستاره
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-300 dark:border-[#333333] text-slate-700 dark:text-zinc-300 font-medium rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-[#252525] transition min-h-[44px]"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 border border-[#C1A056]/30 active:scale-98 min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              ارسال نهایی گزارش به کیوسی
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
