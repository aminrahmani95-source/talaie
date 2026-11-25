import React, { useState } from 'react';
import { X, FileImage } from 'lucide-react';
import type { ProposalImage } from '../../types';
import { compressImageFile } from '../../utils/imageCompressor';
import { getTodayPersianString, toPersianDigits } from '../../utils/jalali';
import { CloudImage } from '../common/CloudImage';
import { PhotoSourceButtons } from '../ui/PhotoSourceButtons';

interface Props {
  images: ProposalImage[];
  onChange: (next: ProposalImage[]) => void;
  required?: boolean;
  error?: boolean;
}

/** آپلود عکس پروپوزال/برگه‌ی سفارش (دوربین یا گالری، با تبدیل HEIC و فشرده‌سازی) */
export const ProposalUploader: React.FC<Props> = ({ images, onChange, required, error }) => {
  const [busy, setBusy] = useState(false);
  const [failMsg, setFailMsg] = useState('');

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setFailMsg('');
    const added: ProposalImage[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await compressImageFile(files[i], 1600, 1600, 0.82);
        added.push({
          id: `prop-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          title: `پروپوزال ${toPersianDigits(images.length + added.length + 1)}`,
          url,
          uploadedAt: getTodayPersianString(),
        });
      } catch (err) {
        setFailMsg(err instanceof Error && err.message ? err.message : 'یکی از عکس‌ها آماده نشد.');
      }
    }
    if (added.length) onChange([...images, ...added]);
    setBusy(false);
    e.target.value = '';
  };

  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        error ? 'border-rose-500/60 bg-rose-500/5' : 'border-line-strong/80 bg-canvas'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
          <FileImage className="w-4 h-4 text-brand-ink" />
          عکس پروپوزال / برگه‌ی سفارش {required && <span className="text-rose-400">*</span>}
        </span>
        {images.length > 0 && (
          <span className="text-[12px] text-emerald-600 dark:text-emerald-300 font-bold">
            {toPersianDigits(images.length)} عکس
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PhotoSourceButtons onChange={handleFiles} busy={busy} />
        {images.map((img) => (
          <div key={img.id} className="relative w-14 h-16 rounded-md overflow-hidden border border-line">
            <CloudImage src={img.url} alt={img.title} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((x) => x.id !== img.id))}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center"
              aria-label="حذف عکس پروپوزال"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      {failMsg && <p className="text-[12px] text-rose-500 font-semibold">{failMsg}</p>}
      {required && images.length === 0 && (
        <p className="text-[12px] text-ink-3">نصاب نقشه و جزئیات سفارش را از همین عکس می‌بیند.</p>
      )}
    </div>
  );
};
