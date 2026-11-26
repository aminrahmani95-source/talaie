import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { toPersianDigits, toEnglishDigits } from '../../utils/jalali';
import { type ProductCounts, capacityUnits } from '../../utils/productCounts';

export type { ProductCounts };

export const PRODUCT_LABELS: { key: keyof ProductCounts; label: string; unit: string; hint: string }[] = [
  { key: 'shade', label: 'شید', unit: 'لت', hint: 'تعداد لت شید' },
  { key: 'rail', label: 'ریل', unit: 'عدد', hint: 'تعداد ریل' },
  { key: 'curtain', label: 'پرده', unit: 'لت', hint: 'تعداد لت پرده' },
];

interface Props {
  value: ProductCounts;
  onChange: (next: ProductCounts) => void;
  /** متن زیر جمع (مثلاً توضیح ظرفیت) */
  footnote?: string;
}

/** سه شمارنده‌ی کنار هم برای محصولات گالری: شید، ریل، پرده */
export const ProductCountsInput: React.FC<Props> = ({ value, onChange, footnote }) => {
  const set = (key: keyof ProductCounts, n: number) =>
    onChange({ ...value, [key]: Math.max(0, Math.min(9999, Math.round(n))) });
  const total = capacityUnits(value);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {PRODUCT_LABELS.map(({ key, label, unit, hint }) => (
          <div key={key} className="rounded-xl border border-line-strong/80 bg-canvas p-2 text-center space-y-1.5">
            <div className="text-xs font-bold text-ink">
              {label} <span className="text-[11px] font-normal text-ink-3">({unit})</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => set(key, (value[key] || 0) + 1)}
                aria-label={`افزایش ${hint}`}
                className="w-8 h-8 rounded-lg bg-raised hover:bg-hover text-ink flex items-center justify-center cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                aria-label={hint}
                value={value[key] ? String(value[key]) : ''}
                placeholder="0"
                onChange={(e) => {
                  const digits = toEnglishDigits(e.target.value).replace(/\D/g, '');
                  set(key, digits ? Number(digits) : 0);
                }}
                className="w-full min-w-0 bg-transparent text-center text-base font-black text-ink tabular-nums focus:outline-none"
              />
              <button
                type="button"
                onClick={() => set(key, (value[key] || 0) - 1)}
                aria-label={`کاهش ${hint}`}
                className="w-8 h-8 rounded-lg bg-raised hover:bg-hover text-ink flex items-center justify-center cursor-pointer shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-ink-3">{footnote || 'هر لت شید یا پرده 1 و هر ریل ½ لت از ظرفیت اکیپ می‌گیرد.'}</span>
        <span className="font-black text-brand-ink tabular-nums shrink-0">ظرفیت: {toPersianDigits(total)} لت</span>
      </div>
    </div>
  );
};
