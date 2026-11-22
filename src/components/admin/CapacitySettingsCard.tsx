import React, { useEffect, useState } from 'react';
import { Minus, Plus, Users, Layers, Lock } from 'lucide-react';
import type { SystemSettings } from '../../types';
import { SALES_CAPACITY_LIMITS, normalizeSalesCapacityConfig } from '../../utils/salesCapacity';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  settings: SystemSettings;
  /** فقط مدیر QC مجاز به تغییر ظرفیت است؛ بقیه فقط مقدار فعلی را می‌بینند */
  canEdit: boolean;
  onSave: (next: SystemSettings) => void;
  /** تعداد اکیپ‌هایی که در «پرسنل و اکیپ‌ها» تعریف شده‌اند */
  definedTeamCount?: number;
}

interface StepperProps {
  id: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (n: number) => void;
}

const Stepper: React.FC<StepperProps> = ({ id, label, unit, icon, value, min, max, disabled, onChange }) => (
  <div className="rounded-xl bg-sunken border border-line p-3">
    <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-bold text-ink-2 mb-2">
      {icon}
      {label}
    </label>
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`کم کردن ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="w-11 h-11 shrink-0 rounded-lg bg-raised hover:bg-hover border border-line-strong text-ink flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Minus className="w-4 h-4" />
      </button>
      <div className="flex-1 flex items-baseline justify-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
          }}
          className="w-16 text-center text-2xl font-black tabular-nums bg-transparent text-ink outline-none disabled:opacity-70"
        />
        <span className="text-xs font-bold text-ink-3">{unit}</span>
      </div>
      <button
        type="button"
        aria-label={`افزودن ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className="w-11 h-11 shrink-0 rounded-lg bg-raised hover:bg-hover border border-line-strong text-ink flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  </div>
);

/**
 * تنظیم ظرفیت روزانه نصب: تعداد اکیپ × لت هر اکیپ = سقف کل روزانه.
 * همین اعداد مبنای تقویم ظرفیت فروش و پیشنهاد تخصیص اکیپ‌ها هستند.
 */
export const CapacitySettingsCard: React.FC<Props> = ({ settings, canEdit, onSave, definedTeamCount }) => {
  const saved = normalizeSalesCapacityConfig({
    teamCount: settings.installationTeamCount,
    lathsPerTeam: settings.lathsPerTeamPerDay,
  });
  const [teamCount, setTeamCount] = useState(saved.teamCount);
  const [lathsPerTeam, setLathsPerTeam] = useState(saved.lathsPerTeam);

  // اگر تنظیمات از سرور یا دستگاه دیگری تغییر کرد، فرم هم به‌روز شود
  useEffect(() => {
    setTeamCount(saved.teamCount);
    setLathsPerTeam(saved.lathsPerTeam);
  }, [saved.teamCount, saved.lathsPerTeam]);

  const dirty = teamCount !== saved.teamCount || lathsPerTeam !== saved.lathsPerTeam;
  const total = teamCount * lathsPerTeam;

  return (
    <section className="bg-surface rounded-2xl p-4 sm:p-6 border border-line space-y-4" aria-labelledby="capacity-settings-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="capacity-settings-title" className="font-bold text-sm text-ink flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-ink" aria-hidden="true" />
            ظرفیت روزانه نصب
          </h3>
          <p className="text-xs text-ink-3 mt-1">مبنای تقویم فروش و تخصیص خودکار اکیپ‌ها به رزروها.</p>
        </div>
        {!canEdit && (
          <span className="flex items-center gap-1 text-xs font-bold text-ink-3 bg-raised px-2 py-1 rounded-lg shrink-0">
            <Lock className="w-3.5 h-3.5" />
            فقط مدیر QC
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stepper
          id="capacity-team-count"
          label="تعداد اکیپ"
          unit="اکیپ"
          icon={<Users className="w-3.5 h-3.5" />}
          value={teamCount}
          min={SALES_CAPACITY_LIMITS.minTeams}
          max={SALES_CAPACITY_LIMITS.maxTeams}
          disabled={!canEdit}
          onChange={setTeamCount}
        />
        <Stepper
          id="capacity-laths-per-team"
          label="ظرفیت هر اکیپ در روز"
          unit="لت"
          icon={<Layers className="w-3.5 h-3.5" />}
          value={lathsPerTeam}
          min={SALES_CAPACITY_LIMITS.minLaths}
          max={SALES_CAPACITY_LIMITS.maxLaths}
          disabled={!canEdit}
          onChange={setLathsPerTeam}
        />
        <div className="rounded-xl bg-brand/10 border border-brand/30 p-3 flex flex-col justify-between" aria-live="polite">
          <span className="text-xs font-bold text-ink-2">ظرفیت کل روزانه</span>
          <span className="text-3xl font-black tabular-nums text-brand-ink mt-1">
            {toPersianDigits(total)} <span className="text-sm">لت</span>
          </span>
          <span className="text-[12px] text-ink-3 mt-1">
            {toPersianDigits(teamCount)} اکیپ × {toPersianDigits(lathsPerTeam)} لت
          </span>
        </div>
      </div>

      {definedTeamCount !== undefined && definedTeamCount > 0 && definedTeamCount !== teamCount && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <span>
            در بخش «پرسنل و اکیپ‌ها» {toPersianDigits(definedTeamCount)} اکیپ تعریف شده، ولی ظرفیت با{' '}
            {toPersianDigits(teamCount)} اکیپ حساب می‌شود.
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() =>
                setTeamCount(
                  Math.min(SALES_CAPACITY_LIMITS.maxTeams, Math.max(SALES_CAPACITY_LIMITS.minTeams, definedTeamCount)),
                )
              }
              className="font-black underline underline-offset-2 cursor-pointer"
            >
              هماهنگ کن
            </button>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setTeamCount(saved.teamCount);
                setLathsPerTeam(saved.lathsPerTeam);
              }}
              className="px-3 py-2 text-xs font-bold text-ink-2 hover:text-ink cursor-pointer"
            >
              انصراف
            </button>
          )}
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onSave({ ...settings, installationTeamCount: teamCount, lathsPerTeamPerDay: lathsPerTeam })}
            className="px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand min-h-[44px]"
          >
            ذخیره ظرفیت
          </button>
        </div>
      )}
    </section>
  );
};
