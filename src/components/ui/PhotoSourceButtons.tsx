import React from 'react';
import { Camera, Images, Loader2 } from 'lucide-react';

interface Props {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  busy?: boolean;
  /** large = دو کاشی بزرگ (فرم‌های اصلی عکس)، small = دو دکمه‌ی کوچک کنار هم */
  size?: 'large' | 'small';
  cameraLabel?: string;
  galleryLabel?: string;
}

/**
 * دو مسیر جدا برای عکس: «دوربین» و «گالری».
 * در اندروید 14 به بعد، input بدون `capture` فقط انتخابگر گالری را باز می‌کند و گزینه‌ی دوربین ندارد؛
 * و input با `capture` در بعضی گوشی‌ها گالری را نشان نمی‌دهد. برای همین هر دو را جدا می‌گذاریم.
 */
export const PhotoSourceButtons: React.FC<Props> = ({
  onChange,
  disabled = false,
  busy = false,
  size = 'small',
  cameraLabel = 'دوربین',
  galleryLabel = 'گالری',
}) => {
  const off = disabled || busy;
  if (size === 'large') {
    const tile = `flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-center transition select-none ${
      off ? 'opacity-60 cursor-wait border-line' : 'cursor-pointer border-line-strong hover:border-brand bg-canvas'
    }`;
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <label className={tile}>
          <input type="file" accept="image/*" capture="environment" onChange={onChange} disabled={off} className="hidden" />
          {busy ? <Loader2 className="w-7 h-7 text-brand-ink animate-spin" /> : <Camera className="w-7 h-7 text-brand-ink" />}
          <span className="text-sm font-bold text-ink">{cameraLabel}</span>
        </label>
        <label className={tile}>
          <input type="file" accept="image/*" multiple onChange={onChange} disabled={off} className="hidden" />
          {busy ? <Loader2 className="w-7 h-7 text-brand-ink animate-spin" /> : <Images className="w-7 h-7 text-brand-ink" />}
          <span className="text-sm font-bold text-ink">{galleryLabel}</span>
        </label>
      </div>
    );
  }

  const btn = `px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-brand/30 bg-raised text-brand-ink transition select-none ${
    off ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-hover'
  }`;
  return (
    <div className="flex items-center gap-2">
      <label className={btn}>
        <input type="file" accept="image/*" capture="environment" onChange={onChange} disabled={off} className="hidden" />
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        <span>{cameraLabel}</span>
      </label>
      <label className={btn}>
        <input type="file" accept="image/*" multiple onChange={onChange} disabled={off} className="hidden" />
        <Images className="w-4 h-4" />
        <span>{galleryLabel}</span>
      </label>
    </div>
  );
};
