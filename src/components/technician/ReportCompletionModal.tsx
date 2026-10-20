import React, { useState } from 'react';
import { Project } from '../../types';
import { Camera, CheckCircle2, X, Upload, Star } from 'lucide-react';
import confetti from 'canvas-confetti';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#E8E4DC] my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 text-[#C1A056] rounded-xl border border-white/10">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">ثبت گزارش اتمام نصب پرده و شید</h3>
              <p className="text-xs text-[#E8E4DC]">{project.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photos Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              بارگذاری عکس‌های نهایی کار (نمای کامل پرده، شیدها و موتور):
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {photos.map((p, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-300 shadow-sm">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer text-emerald-700 transition">
                <Camera className="w-6 h-6 mb-1 text-emerald-600" />
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
            <p className="text-[10px] text-slate-400 mt-1">
              مسئول کیوسی این عکس‌ها را بررسی و امتیاز نهایی نصب را ثبت می‌کند.
            </p>
          </div>

          {/* Completion Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              توضیحات و اظهارات نصاب / سرپرست:
            </label>
            <textarea
              rows={3}
              placeholder="مثال: نصب تمامی لت‌های شید و پرده با موفقیت انجام شد. ریموت کنترل کد شد و نحوه کار با موتور به کارفرما آموزش داده شد..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* Customer Satisfaction Placeholder */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              میزان رضایت کارفرما در محل:
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSatisfaction(s)}
                  className="p-1 hover:scale-110 transition"
                >
                  <Star
                    className={`w-6 h-6 ${
                      s <= satisfaction
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-slate-600 mr-2">
                {satisfaction} از ۵ ستاره
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl text-xs hover:bg-slate-50 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 border border-[#C1A056]/30"
            >
              <CheckCircle2 className="w-4 h-4 text-[#C1A056]" />
              ارسال نهایی گزارش به کیوسی
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
