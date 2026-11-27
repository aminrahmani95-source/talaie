import React, { useState } from 'react';
import { Users, UserCog, Power } from 'lucide-react';
import type { InstallationTeamWithMembers, User } from '../../types';
import { getDisplayName } from '../../utils/technicianName';
import { toPersianDigits } from '../../utils/jalali';

/**
 * «اکیپ‌ها و مسئول برنامه‌ریزی» (فقط مدیر QC):
 * برای هر اکیپ تعیین می‌شود برنامه‌ریزی‌اش با مدیران QC است یا با کدام هماهنگ‌کننده، و فعال است یا نه.
 * هماهنگ‌کننده فقط اکیپ‌هایی را که این‌جا به او سپرده شده می‌بیند (utils/coordinatorScope، مایگریشن ۰۲۸).
 * اکیپ غیرفعال در برنامه‌ریزی، فرم پروژه و تخصیص رزرو پیشنهاد نمی‌شود؛ پروژه‌های قبلی‌اش سر جایشان می‌مانند.
 */
export const TeamAssignmentCard: React.FC<{
  teams: InstallationTeamWithMembers[];
  coordinators: User[];
  onUpdate: (teamId: string, patch: { coordinatorId?: string | null; active?: boolean }) => Promise<boolean>;
}> = ({ teams, coordinators, onUpdate }) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (teamId: string, patch: { coordinatorId?: string | null; active?: boolean }) => {
    setBusyId(teamId);
    try {
      await onUpdate(teamId, patch);
    } finally {
      setBusyId(null);
    }
  };

  const ownerName = (id?: string | null) => {
    if (!id) return 'مدیران QC';
    const u = coordinators.find((c) => c.id === id);
    return u ? getDisplayName(u.name) : 'هماهنگ‌کننده (غیرفعال یا حذف‌شده)';
  };

  return (
    <div className="bg-surface rounded-3xl p-6 border border-line shadow-xs space-y-4">
      <div className="space-y-1">
        <h3 className="font-extrabold text-sm text-ink flex items-center gap-2">
          <UserCog className="w-5 h-5 text-brand-ink" aria-hidden="true" />
          اکیپ‌ها و مسئول برنامه‌ریزی
        </h3>
        <p className="text-xs text-ink-3 leading-6">
          برای هر اکیپ مشخص کنید برنامه‌ریزی و QC آن با شما (مدیران QC) است یا با یک هماهنگ‌کننده. هماهنگ‌کننده فقط اکیپ‌هایی
          را که این‌جا به او می‌دهید، و پروژه‌های همان اکیپ‌ها را، می‌بیند. اکیپ غیرفعال در برنامه‌ریزی پیشنهاد نمی‌شود.
          اعضای هر اکیپ را در «پرسنل و اکیپ‌ها» تغییر دهید.
        </p>
        {coordinators.length === 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
            هنوز کاربری با نقش «هماهنگ‌کننده» ندارید؛ همه‌ی اکیپ‌ها با مدیران QC است.
          </p>
        )}
      </div>

      {teams.length === 0 ? (
        <p className="text-xs text-ink-3">هنوز اکیپی تعریف نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => {
            const active = t.active !== false;
            const busy = busyId === t.id;
            const members = [
              ...(t.supervisor ? [`${getDisplayName(t.supervisor.name)} (سرپرست)`] : []),
              ...t.technicians.map((u) => getDisplayName(u.name)),
            ];
            return (
              <li
                key={t.id}
                className={`rounded-xl border p-3 space-y-2.5 ${active ? 'border-line bg-sunken/50' : 'border-dashed border-line bg-sunken/20 opacity-80'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-ink flex items-center gap-2">
                      <Users className="w-4 h-4 text-ink-3" aria-hidden="true" />
                      <span className="truncate">{t.name}</span>
                      {!active && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-raised text-ink-3 border border-line">
                          غیرفعال
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-2 mt-0.5">
                      {members.length ? `${toPersianDigits(members.length)} نفر: ${members.join('، ')}` : 'بدون عضو'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(t.id, { active: !active })}
                    aria-pressed={active}
                    className={`min-h-[40px] px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border cursor-pointer disabled:opacity-60 transition ${
                      active
                        ? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                        : 'border-line text-ink-2 bg-surface hover:bg-raised'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" aria-hidden="true" />
                    {active ? 'فعال' : 'غیرفعال — فعال کن'}
                  </button>
                </div>

                <label className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-ink-2">برنامه‌ریزی و QC با:</span>
                  <select
                    value={t.coordinatorId || ''}
                    disabled={busy}
                    onChange={(e) => run(t.id, { coordinatorId: e.target.value || null })}
                    className="min-h-[40px] flex-1 min-w-[12rem] rounded-md border border-line bg-canvas px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">مدیران QC</option>
                    {coordinators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {getDisplayName(c.name)} (هماهنگ‌کننده)
                      </option>
                    ))}
                    {t.coordinatorId && !coordinators.some((c) => c.id === t.coordinatorId) && (
                      <option value={t.coordinatorId}>{ownerName(t.coordinatorId)}</option>
                    )}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
