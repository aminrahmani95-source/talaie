import React, { useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { gregorianToJalali, PERSIAN_MONTH_NAMES, localDateKey } from '../../utils/jalali';
import { scheduleDayLabel } from '../../utils/multiDay';
import { isSalesWorkingDay } from '../../utils/salesCapacity';

/** عنوان ستون‌های هفته از شنبه */
const WEEK_HEAD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fromKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
}

/** ستون هفته‌ی ایرانی (شنبه = 0 … جمعه = 6) */
function weekCol(key: string): number {
  return (fromKey(key).getUTCDay() + 1) % 7;
}

function jalaliParts(key: string) {
  const d = fromKey(key);
  const { jy, jm, jd } = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return { jy, jm, jd };
}


/**
 * انتخاب روزهای اجرای غیرپشت‌سرهم روی یک تقویم هفتگی (شنبه تا جمعه).
 * روز جمعه و روزهای غیرکاری کم‌رنگ‌اند ولی قابل انتخاب‌اند (گاهی کار جمعه هم لازم است).
 */
export const ScheduleDaysPicker: React.FC<{
  value: string[];
  onChange: (days: string[]) => void;
  /** تعداد هفته‌هایی که اول نشان داده می‌شود */
  weeks?: number;
}> = ({ value, onChange, weeks = 6 }) => {
  const todayKey = localDateKey();
  const [extraWeeks, setExtraWeeks] = useState(0);
  const selected = useMemo(() => new Set(value), [value]);

  const cells = useMemo(() => {
    const first = value.length && value[0] < todayKey ? value[0] : todayKey;
    const start = addDays(first, -weekCol(first)); // شنبه‌ی همان هفته
    const last = value.length ? value[value.length - 1] : todayKey;
    const minEnd = addDays(start, (weeks + extraWeeks) * 7 - 1);
    const lastWeekEnd = addDays(last, 6 - weekCol(last));
    const end = lastWeekEnd > minEnd ? lastWeekEnd : minEnd;
    const out: string[] = [];
    for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
    return out;
  }, [value, todayKey, weeks, extraWeeks]);

  const toggle = (key: string) => {
    const next = new Set(value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next].sort());
  };

  return (
    <div className="rounded-xl border border-line bg-canvas p-2 sm:p-3 space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-3">
        {WEEK_HEAD.map((h, i) => (
          <div key={h} className={i === 6 ? 'text-rose-500/70' : ''}>
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="روزهای اجرا">
        {cells.map((key, idx) => {
          const { jm, jd } = jalaliParts(key);
          const isSel = selected.has(key);
          const isPast = key < todayKey;
          const working = isSalesWorkingDay(key);
          const showMonth = jd === 1 || idx === 0 || (key === todayKey && !isSel);
          return (
            <button
              key={key}
              type="button"
              disabled={isPast && !isSel}
              onClick={() => toggle(key)}
              aria-pressed={isSel}
              aria-label={scheduleDayLabel(key)}
              title={scheduleDayLabel(key)}
              className={`relative min-h-[44px] rounded-lg border text-xs font-bold flex flex-col items-center justify-center leading-tight transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                isSel
                  ? 'bg-brand text-on-brand border-brand shadow-sm'
                  : working
                  ? 'bg-surface text-ink border-line hover:border-brand/60'
                  : 'bg-sunken text-ink-3 border-transparent hover:border-line'
              } ${key === todayKey && !isSel ? 'ring-1 ring-brand/60' : ''}`}
            >
              <span className="tabular-nums">{jd}</span>
              {showMonth && (
                <span className={`text-[9px] font-medium ${isSel ? 'text-on-brand/80' : 'text-ink-3'}`}>
                  {PERSIAN_MONTH_NAMES[jm - 1]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setExtraWeeks((w) => w + 4)}
          className="min-h-[36px] px-2 text-xs font-bold text-brand-ink hover:underline flex items-center gap-1 cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          هفته‌های بعد
        </button>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="min-h-[36px] px-2 text-xs font-bold text-ink-3 hover:text-ink flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            پاک کردن انتخاب‌ها
          </button>
        )}
      </div>
    </div>
  );
};
