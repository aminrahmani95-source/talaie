import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, Camera, Copy, RefreshCw, Send, Smartphone, UploadCloud, ChevronDown } from 'lucide-react';
import type { Project } from '../../types';
import { SupabaseSyncService, type ClientErrorReport } from '../../utils/supabase';
import {
  contextLabel,
  detailsLine,
  deviceSummary,
  errorGroup,
  explainError,
  reportsToText,
  summarizeByUser,
  type ErrorGroup,
} from '../../utils/clientErrors';
import { formatJalaliDateTime, toPersianDigits } from '../../utils/jalali';
import { getUserRoleLabel } from '../../utils/roleLabels';
import { Button, EmptyState, SegmentedControl, triggerToast } from '../ui';

type Range = '1D' | '7D' | '30D';
const RANGE_DAYS: Record<Range, number> = { '1D': 1, '7D': 7, '30D': 30 };

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; rows: ClientErrorReport[] }
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

const GROUP_ICON: Record<ErrorGroup, React.ReactNode> = {
  PHOTO: <Camera className="w-4 h-4" />,
  SYNC: <UploadCloud className="w-4 h-4" />,
  OTHER: <Bug className="w-4 h-4" />,
};

/**
 * «خطاهای برنامه»: خطاهایی که روی گوشی سرپرست‌ها و بقیه رخ داده (آپلود عکس، ارسال تغییرات،
 * آماده‌سازی عکس) و خودکار به سرور گزارش شده‌اند. مدیر بدون گرفتن عکس از صفحه‌ی گوشی
 * می‌بیند چه کسی، کجا و چرا به خطا خورده است.
 */
export const ClientErrorsPanel: React.FC<{
  projects: Project[];
  onManageProject?: (project: Project) => void;
}> = ({ projects, onManageProject }) => {
  const [range, setRange] = useState<Range>('7D');
  const [group, setGroup] = useState<'ALL' | ErrorGroup>('ALL');
  const [userKey, setUserKey] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const since = new Date(Date.now() - RANGE_DAYS[range] * 24 * 3600 * 1000).toISOString();
    const res = await SupabaseSyncService.listClientErrorReports(since);
    setState(res);
  }, [range]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectLabel = useCallback(
    (id: string) => {
      const p = projectsById.get(id);
      if (!p) return id;
      const code = (p as any).code || (p as any).projectCode || '';
      const title = (p as any).title || (p as any).customerName || '';
      return [code, title].filter(Boolean).join(' · ') || id;
    },
    [projectsById]
  );

  const rows = useMemo(() => (state.status === 'ok' ? state.rows : []), [state]);
  const users = useMemo(() => summarizeByUser(rows), [rows]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (group === 'ALL' || errorGroup(r.context) === group) &&
          (!userKey || (r.user_id || r.user_name || '?') === userKey)
      ),
    [rows, group, userKey]
  );
  const groupCounts = useMemo(() => {
    const c: Record<ErrorGroup, number> = { PHOTO: 0, SYNC: 0, OTHER: 0 };
    for (const r of rows) c[errorGroup(r.context)] += 1;
    return c;
  }, [rows]);

  const copyAll = async () => {
    const text = reportsToText(filtered, projectLabel);
    try {
      await navigator.clipboard.writeText(text);
      triggerToast('success', `${toPersianDigits(filtered.length)} گزارش کپی شد؛ می‌توانید برای پشتیبانی بفرستید.`);
    } catch {
      triggerToast('error', 'کپی ممکن نشد. از روی صفحه انتخاب و کپی کنید.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-brand" />
              خطاهای گوشی‌ها
            </h2>
            <p className="text-xs text-ink-2 mt-1 leading-6">
              هر خطای آپلود عکس یا ارسال اطلاعات روی گوشی سرپرست‌ها و همکاران، خودکار این‌جا ثبت می‌شود.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={() => setNonce((n) => n + 1)}>
              به‌روزرسانی
            </Button>
            {filtered.length > 0 && (
              <Button variant="secondary" size="sm" icon={<Copy className="w-4 h-4" />} onClick={copyAll}>
                کپی برای پشتیبانی
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <SegmentedControl<Range>
            size="sm"
            ariaLabel="بازه‌ی زمانی"
            value={range}
            onChange={(v) => setRange(v)}
            options={[
              { value: '1D', label: '24 ساعت' },
              { value: '7D', label: '7 روز' },
              { value: '30D', label: '30 روز' },
            ]}
          />
          <SegmentedControl<'ALL' | ErrorGroup>
            size="sm"
            ariaLabel="نوع خطا"
            value={group}
            onChange={(v) => setGroup(v)}
            options={[
              { value: 'ALL', label: 'همه', count: rows.length || undefined },
              { value: 'PHOTO', label: 'عکس', count: groupCounts.PHOTO || undefined },
              { value: 'SYNC', label: 'ارسال اطلاعات', count: groupCounts.SYNC || undefined },
              { value: 'OTHER', label: 'سایر', count: groupCounts.OTHER || undefined },
            ]}
          />
        </div>

        {users.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {users.map((u) => {
              const active = userKey === u.key;
              return (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => setUserKey(active ? null : u.key)}
                  className={`min-h-[36px] px-3 rounded-full border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    active ? 'bg-brand text-white border-brand' : 'bg-sunken text-ink border-line hover:border-line-strong'
                  }`}
                >
                  <span>{u.name}</span>
                  <span className={active ? 'text-white/80' : 'text-ink-3'}>{u.role}</span>
                  <span
                    className={`min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center tabular-nums ${
                      active ? 'bg-white/25' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {toPersianDigits(u.count)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {state.status === 'loading' && (
        <div className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-ink-2">در حال دریافت گزارش‌ها…</div>
      )}

      {state.status === 'unavailable' && (
        <EmptyState
          icon={<Send className="w-6 h-6" />}
          title="گزارش خودکار خطا هنوز روی سرور فعال نشده"
          description="فایل supabase/migrations/026_client_error_reports.sql را یک بار در Supabase ← SQL Editor اجرا کنید. خطاهایی که تا آن موقع رخ بدهد در گوشی‌ها نگه داشته می‌شود و بعد فرستاده می‌شود."
        />
      )}

      {state.status === 'failed' && (
        <EmptyState
          icon={<Bug className="w-6 h-6" />}
          title="دریافت گزارش‌ها ممکن نشد"
          description={state.message}
          action={{ label: 'تلاش دوباره', onClick: () => setNonce((n) => n + 1) }}
        />
      )}

      {state.status === 'ok' && filtered.length === 0 && (
        <EmptyState
          icon={<Smartphone className="w-6 h-6" />}
          title="خطایی ثبت نشده"
          description="در این بازه هیچ گوشی‌ای خطای آپلود یا ارسال گزارش نکرده است."
        />
      )}

      {state.status === 'ok' && filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((r) => {
            const open = openId === r.id;
            const g = errorGroup(r.context);
            const why = explainError(r);
            const project = r.project_id ? projectsById.get(r.project_id) : undefined;
            const line = detailsLine(r.details);
            return (
              <li key={r.id} className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.id)}
                  aria-expanded={open}
                  className="w-full text-right p-3 sm:p-4 flex items-start gap-3 cursor-pointer hover:bg-sunken/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span
                    className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                      g === 'PHOTO'
                        ? 'bg-rose-500/10 text-rose-600'
                        : g === 'SYNC'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-sunken text-ink-2'
                    }`}
                  >
                    {GROUP_ICON[g]}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <span className="font-extrabold text-ink">{r.user_name || 'نامشخص'}</span>
                      <span className="text-xs text-ink-3">{getUserRoleLabel(r.user_role || undefined)}</span>
                      <span className="text-xs font-bold text-ink-2">· {contextLabel(r.context)}</span>
                    </span>
                    {r.project_id && <span className="block text-xs text-ink-2 truncate">پروژه: {projectLabel(r.project_id)}</span>}
                    <span dir="auto" className="block text-sm text-ink break-words leading-6 text-start">{r.message}</span>
                    {why && <span className="block text-xs text-brand leading-6">{why}</span>}
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-3 tabular-nums">
                      <span>{formatJalaliDateTime(r.occurred_at || r.created_at)}</span>
                      <span>{deviceSummary(r.user_agent)}</span>
                      {line && <span>{line}</span>}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-ink-3 mt-1 transition ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="border-t border-line bg-sunken/50 p-3 sm:p-4 space-y-2 text-xs">
                    <div className="text-ink-2">
                      کد بخش: <span dir="ltr" className="font-mono">{r.context}</span> · نسخه‌ی برنامه:{' '}
                      <span dir="ltr" className="font-mono">{r.app_version || '?'}</span>
                    </div>
                    <pre dir="ltr" className="text-left whitespace-pre-wrap break-all font-mono text-[11px] text-ink-2 bg-surface border border-line rounded-lg p-2 max-h-60 overflow-auto">
                      {JSON.stringify({ details: r.details, userAgent: r.user_agent }, null, 2)}
                    </pre>
                    {project && onManageProject && (
                      <Button variant="secondary" size="sm" onClick={() => onManageProject(project)}>
                        باز کردن پروژه
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
