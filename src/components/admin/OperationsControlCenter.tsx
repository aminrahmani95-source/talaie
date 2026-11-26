import React, { useMemo, useState } from 'react';
import { formatProductCounts, projectProductCounts, bookingProductCounts } from '../../utils/productCounts';
import {
  Project,
  User,
  Ticket,
  InstallationTeamWithMembers,
  ScheduleChangeRequest,
  SystemSettings,
  MaterialRequest,
  SalesProjectBooking,
} from '../../types';
import { ManagerTab } from '../navigation/BottomNav';
import { CheckCircle2, Users, ChevronLeft, Package, Phone, Plus, CalendarClock, Clock } from 'lucide-react';
import { toPersianDigits, getTodayPersianString, formatJalali } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { isProjectMultiDay, isProjectScheduledOnDate } from '../../utils/multiDay';
import { getHandoverEvidence } from '../../utils/qcWorkflow';
import {
  ACTION_GROUP,
  buildActionQueue,
  isBookingAwaitingAssignment,
  isBookingDueSoon,
  type ActionGroup,
  type ActionItem,
  type ActionKind,
} from '../../utils/actionQueue';
import { getWarehouseStage, warehouseAlert } from '../../utils/warehouseStatus';
import { WarehouseStageBadge } from '../warehouse/WarehouseStageBadge';
import { addDaysToKey } from '../../utils/warehouseLists';
import { missingBeforeDispatch, qcWaitingDays, stuckSla } from '../../utils/nextStep';
import { STUCK_CATEGORY_LABELS, stuckIncidentsOf } from '../../utils/projectsReport';
import { useToday } from '../../hooks/useToday';

const ACTION_META: Record<ActionKind, { label: string; chip: string; stripe: string; button: string }> = {
  STUCK: { label: 'توقف کار', chip: 'bg-rose-600 text-white', stripe: 'border-r-rose-500', button: 'bg-rose-600 hover:bg-rose-500 text-white' },
  TICKET: { label: 'تیکت باز', chip: 'bg-amber-500/20 text-amber-700 dark:text-amber-300', stripe: 'border-r-amber-500', button: 'bg-raised hover:bg-hover text-ink border border-line-strong' },
  QC: { label: 'منتظر QC', chip: 'bg-purple-600 text-white', stripe: 'border-r-purple-500', button: 'bg-purple-600 hover:bg-purple-500 text-white' },
  OVERDUE: { label: 'عقب‌افتاده', chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', stripe: 'border-r-rose-400', button: 'bg-brand hover:bg-brand-hover text-on-brand' },
  INCOMING: { label: 'منتظر برنامه', chip: 'bg-amber-500 text-on-brand', stripe: 'border-r-brand', button: 'bg-brand hover:bg-brand-hover text-on-brand' },
  BOOKING: { label: 'رزرو فروش', chip: 'bg-sky-600 text-white', stripe: 'border-r-sky-500', button: 'bg-brand hover:bg-brand-hover text-on-brand' },
};

const GROUP_META: Record<ActionGroup, { label: string; chipLabel: string }> = {
  ISSUES: { label: 'موانع: توقف و تیکت', chipLabel: 'موانع' },
  QC: { label: 'منتظر بررسی QC', chipLabel: 'QC' },
  PLAN: { label: 'منتظر برنامه‌ریزی', chipLabel: 'منتظر برنامه' },
};
const GROUP_ORDER: ActionGroup[] = ['ISSUES', 'QC', 'PLAN'];

const TEAM_STATUS = {
  ON_MISSION: { label: 'در حال نصب', dot: 'bg-amber-500 animate-pulse', text: 'text-amber-600 dark:text-amber-400' },
  STANDBY: { label: 'برنامه دارد', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  AVAILABLE: { label: 'آزاد', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  STUCK: { label: 'متوقف', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
} as const;

export interface OperationsControlCenterProps {
  currentUser: User;
  projects: Project[];
  users: User[];
  tickets: Ticket[];
  teamsWithMembers: InstallationTeamWithMembers[];
  scheduleChangeRequests: ScheduleChangeRequest[];
  materialRequests?: MaterialRequest[];
  /** sales bookings (so bookings waiting for a team show up in the action queue) */
  salesBookings?: SalesProjectBooking[];
  settings?: SystemSettings | null;
  onNavigateTab: (tab: ManagerTab) => void;
  /** برگه‌ی مدیریت پروژه */
  onOpenProject: (project: Project) => void;
  onOpenQcProject?: (project: Project) => void;
  /** «رفع توقف» / «رسیدگی»: صفحه‌ی توقف و تیکت با همین پروژه */
  onOpenIssue?: (tab: 'stuck' | 'tickets', projectId?: string | null) => void;
  /** «تخصیص اکیپ و تاریخ»: فرم ویرایش پروژه */
  onEditProject?: (project: Project) => void;
  onOpenScheduleRequests?: () => void;
  /** «تخصیص در تقویم»: تقویم با فرم تخصیص همین رزرو */
  onOpenBooking?: (bookingId: string) => void;
  onNewProject?: () => void;
}

type Filter = 'ALL' | ActionGroup;

/**
 * پیشخوان مدیر: یک صف اقدام (هر پروژه یک ردیف) به ترتیب فوریت، و کنارش اکیپ‌های امروز و فردا
 * و هشدارهای انبار. هر دکمه دقیقاً همان کاری را باز می‌کند که رویش نوشته شده.
 */
export const OperationsControlCenter: React.FC<OperationsControlCenterProps> = ({
  currentUser,
  projects,
  tickets,
  teamsWithMembers,
  scheduleChangeRequests = [],
  salesBookings = [],
  onNavigateTab,
  onOpenProject,
  onOpenQcProject,
  onOpenIssue,
  onEditProject,
  onOpenScheduleRequests,
  onOpenBooking,
  onNewProject,
}) => {
  const [filter, setFilter] = useState<Filter>('ALL');
  const todayKey = useToday();
  const tomorrowKey = addDaysToKey(todayKey, 1);
  const todayPersian = useMemo(() => getTodayPersianString(), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const roleLabel =
    currentUser.role === 'QC_MANAGER' ? 'مدیر فنی و QC' : currentUser.role === 'CEO' ? 'مدیرعامل' : 'هماهنگی عملیات';

  // ---------------------------------------------------------------- صف اقدام
  const actionQueue = useMemo(() => buildActionQueue(projects, tickets, salesBookings), [projects, tickets, salesBookings, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupCounts = useMemo(() => {
    const c: Record<ActionGroup, number> = { ISSUES: 0, QC: 0, PLAN: 0 };
    for (const i of actionQueue) c[ACTION_GROUP[i.kind]]++;
    return c;
  }, [actionQueue]);
  const pendingScheduleRequests = scheduleChangeRequests.filter((r) => r.status === 'PENDING').length;
  const laterBookings = useMemo(
    () => salesBookings.filter((b) => isBookingAwaitingAssignment(b, projects) && !isBookingDueSoon(b)),
    [salesBookings, projects]
  );

  // داخل هر گروه: عقب‌افتاده‌ترین اول
  const sortedQueue = useMemo(() => {
    const urgency = (i: ActionItem): number => {
      const p = i.project;
      if (i.kind === 'STUCK' && p) return stuckSla(p)?.hoursLeft ?? 999;
      if (i.kind === 'QC' && p) return -(qcWaitingDays(p, todayKey) ?? 0);
      if (i.kind === 'TICKET') return i.tickets[0]?.isBlocking ? -1 : 0;
      return 0;
    };
    return GROUP_ORDER.flatMap((g) =>
      actionQueue
        .filter((i) => ACTION_GROUP[i.kind] === g)
        .map((i, idx) => ({ i, idx, u: urgency(i) }))
        .sort((a, b) => a.u - b.u || a.idx - b.idx)
        .map((x) => x.i)
    );
  }, [actionQueue, todayKey]);
  const visibleQueue = filter === 'ALL' ? sortedQueue : sortedQueue.filter((i) => ACTION_GROUP[i.kind] === filter);

  // ---------------------------------------------------------------- اکیپ‌ها امروز و فردا
  const liveTeams = useMemo(() => {
    const targetTeams: InstallationTeamWithMembers[] =
      teamsWithMembers && teamsWithMembers.length > 0
        ? teamsWithMembers
        : [
            { id: 'TEAM_1', name: 'اکیپ نصب ۱', code: 'TEAM_1', technicians: [], totalMembers: 0, createdAt: '', updatedAt: '' },
            { id: 'TEAM_2', name: 'اکیپ نصب ۲', code: 'TEAM_2', technicians: [], totalMembers: 0, createdAt: '', updatedAt: '' },
          ];
    const rank = (p: Project) =>
      p.status === 'STUCK' ? 0 : p.status === 'IN_PROGRESS' || p.status === 'EN_ROUTE' ? 1 : p.status === 'PAUSED' ? 2 : 3;

    return targetTeams.map((team) => {
      const open = projects.filter(
        (p) => p.assignedTeamId === team.id && p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
      );
      const today = open
        .filter(
          (p) =>
            p.scheduledDate === todayKey ||
            isProjectScheduledOnDate(p, todayKey) ||
            p.status === 'IN_PROGRESS' ||
            p.status === 'EN_ROUTE' ||
            p.status === 'STUCK'
        )
        .sort((a, b) => rank(a) - rank(b));
      const tomorrow = open.filter((p) => p.scheduledDate === tomorrowKey || isProjectScheduledOnDate(p, tomorrowKey));
      const activeProject = today[0] || null;
      const status: keyof typeof TEAM_STATUS = !activeProject
        ? 'AVAILABLE'
        : activeProject.status === 'STUCK'
          ? 'STUCK'
          : activeProject.status === 'IN_PROGRESS' || activeProject.status === 'EN_ROUTE'
            ? 'ON_MISSION'
            : 'STANDBY';
      const teamName = team.supervisorName ? `اکیپ ${getDisplayName(team.supervisorName)}` : team.name;
      return { team, teamName, activeProject, todayCount: today.length, tomorrow, status };
    });
  }, [teamsWithMembers, projects, todayKey, tomorrowKey]);

  const warehouseAlerts = useMemo(
    () =>
      projects
        .map((p) => ({ p, alert: warehouseAlert(p, todayKey) }))
        .filter((x) => x.alert.level)
        .sort(
          (a, b) =>
            (a.alert.level === 'urgent' ? 0 : 1) - (b.alert.level === 'urgent' ? 0 : 1) ||
            String(a.p.scheduledDate || '9999').localeCompare(String(b.p.scheduledDate || '9999'))
        ),
    [projects, todayKey]
  );

  // ---------------------------------------------------------------- یک ردیف صف
  const renderRow = (item: ActionItem) => {
    const p = item.project;
    const meta = ACTION_META[item.kind];
    const b = item.booking;
    const code = p?.code || item.tickets[0]?.projectCode || '';
    const title = p?.title || item.tickets[0]?.projectTitle || b?.customerName || '';
    const phone = item.kind === 'BOOKING' ? b?.customerPhone : p?.customerPhone;
    const isWarehouse = item.tickets.some((t) => t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote));

    let detail: React.ReactNode = null;
    let timing: { text: string; tone: string } | null = null;
    let primary: { label: string; onClick: () => void } = { label: 'باز کردن', onClick: () => p && onOpenProject(p) };

    if (item.kind === 'STUCK' && p) {
      const list = stuckIncidentsOf(p);
      const inc = list[list.length - 1];
      detail = (
        <>
          {inc ? STUCK_CATEGORY_LABELS[inc.category] || 'توقف' : 'توقف'}
          {inc?.description ? `: ${inc.description}` : ''}
          {item.tickets.length > 0 && <span className="text-ink-3"> · {toPersianDigits(item.tickets.length)} تیکت مرتبط</span>}
        </>
      );
      const sla = stuckSla(p);
      if (sla) {
        timing = {
          text: sla.text,
          tone: sla.overdue ? 'text-rose-600 dark:text-rose-300' : sla.hoursLeft < 24 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-3',
        };
      }
      primary = { label: 'رفع توقف', onClick: () => (onOpenIssue ? onOpenIssue('stuck', p.id) : onNavigateTab('stuck')) };
    } else if (item.kind === 'TICKET') {
      const first = item.tickets[0];
      detail = (
        <>
          {first?.blockingReason || first?.description}
          {item.tickets.length > 1 && <span className="text-ink-3"> · {toPersianDigits(item.tickets.length - 1)} تیکت دیگر</span>}
        </>
      );
      if (first?.isBlocking) timing = { text: 'مسدودکننده‌ی کار', tone: 'text-rose-600 dark:text-rose-300' };
      primary = {
        label: 'رسیدگی',
        onClick: () => (onOpenIssue ? onOpenIssue('tickets', first?.projectId) : onNavigateTab('tickets')),
      };
    } else if (item.kind === 'QC' && p) {
      const ev = getHandoverEvidence(p);
      const ok = ev.exempt || (ev.hasPhotos && ev.hasAcceptance);
      detail = (
        <>
          {p.assignedTeamName || 'اکیپ نامشخص'} ·{' '}
          <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}>
            {ok ? 'عکس و امضا ثبت شده' : [!ev.hasPhotos && 'بدون عکس', !ev.hasAcceptance && 'بدون امضا'].filter(Boolean).join(' و ')}
          </span>
        </>
      );
      const days = qcWaitingDays(p, todayKey);
      if (days !== null) {
        timing = {
          text: days === 0 ? 'امروز تمام شد' : `${toPersianDigits(days)} روز منتظر QC`,
          tone: days >= 3 ? 'text-rose-600 dark:text-rose-300' : days >= 1 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-3',
        };
      }
      primary = { label: 'بررسی QC', onClick: () => (onOpenQcProject ? onOpenQcProject(p) : onNavigateTab('qc')) };
    } else if (item.kind === 'OVERDUE' && p) {
      detail = (
        <>
          {p.assignedTeamName || 'بدون اکیپ'} · {formatProductCounts(projectProductCounts(p)) || '—'}
        </>
      );
      timing = { text: `تاریخ ${formatJalali(p.scheduledDate)} گذشته و کار شروع نشده`, tone: 'text-rose-600 dark:text-rose-300' };
      primary = { label: 'برنامه‌ریزی دوباره', onClick: () => (onEditProject ? onEditProject(p) : onOpenProject(p)) };
    } else if (item.kind === 'BOOKING' && b) {
      detail = (
        <>
          {formatProductCounts(bookingProductCounts(b)) || `${toPersianDigits(b.lathsCount)} لت`}
          {b.isSmart ? ' · هوشمند' : ''}
          {b.salesRepName ? ` · فروش: ${b.salesRepName}` : ''}
        </>
      );
      if (b.jalaliDate || b.requestedDate) {
        timing = {
          text: `درخواست برای ${b.jalaliDate ? toPersianDigits(b.jalaliDate) : formatJalali(b.requestedDate)}`,
          tone: 'text-ink-3',
        };
      }
      primary = { label: 'تخصیص در تقویم', onClick: () => (onOpenBooking ? onOpenBooking(b.id) : onNavigateTab('planner')) };
    } else if (item.kind === 'INCOMING' && p) {
      const missing = missingBeforeDispatch(p);
      const onlyWarehouse = missing.length === 1 && missing[0] === 'ورود کالا به انبار';
      detail = (
        <>
          {formatProductCounts(projectProductCounts(p)) || '—'}
          {p.salesRepName ? ` · ${p.salesRepName}` : ''}
        </>
      );
      if (missing.length) timing = { text: `مانده: ${missing.join('، ')}`, tone: 'text-amber-700 dark:text-amber-300' };
      primary = onlyWarehouse
        ? { label: 'پرونده', onClick: () => onOpenProject(p) }
        : { label: 'تخصیص اکیپ و تاریخ', onClick: () => (onEditProject ? onEditProject(p) : onOpenProject(p)) };
    }

    const body = (
      <>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-black ${meta.chip}`}>
            {item.kind === 'TICKET' && item.tickets[0]?.isBlocking ? 'تیکت مسدودکننده' : meta.label}
          </span>
          {isWarehouse && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center gap-1">
              <Package className="w-3 h-3" aria-hidden="true" />
              در دست انبار
            </span>
          )}
          {code && <span className="font-mono text-[12px] text-ink-3">{code}</span>}
          <span className="text-sm font-bold text-ink truncate">{title}</span>
        </div>
        {detail && <p className="text-xs text-ink-2 mt-1 line-clamp-2">{detail}</p>}
        {timing && (
          <p className={`text-[12px] font-bold mt-1 flex items-center gap-1 ${timing.tone}`}>
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {timing.text}
          </p>
        )}
      </>
    );

    return (
      <div
        key={item.key}
        className={`rounded-xl bg-surface border border-line border-r-4 ${meta.stripe} p-3 flex flex-col @min-[560px]:flex-row @min-[560px]:items-center gap-2.5 @min-[560px]:gap-3`}
      >
        {p ? (
          <button
            type="button"
            onClick={() => onOpenProject(p)}
            className="min-w-0 grow text-right cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`پرونده‌ی ${code} ${title}`}
          >
            {body}
          </button>
        ) : (
          <div className="min-w-0 grow">{body}</div>
        )}

        <div className="flex items-center gap-2 shrink-0 self-end @min-[560px]:self-auto">
          {phone && (
            <a
              href={`tel:${phone}`}
              aria-label={`تماس با ${p?.customerName || b?.customerName || 'کارفرما'}`}
              className="w-11 h-11 rounded-lg border border-line text-ink-2 hover:text-ink hover:bg-raised flex items-center justify-center"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={primary.onClick}
            className={`px-3.5 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer active:scale-95 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${meta.button}`}
          >
            {primary.label}
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  const chips: Array<{ key: Filter; label: string; count: number; on: string }> = [
    { key: 'ALL', label: 'همه', count: actionQueue.length, on: 'bg-brand text-on-brand' },
    { key: 'ISSUES', label: GROUP_META.ISSUES.chipLabel, count: groupCounts.ISSUES, on: 'bg-rose-600 text-white' },
    { key: 'QC', label: GROUP_META.QC.chipLabel, count: groupCounts.QC, on: 'bg-purple-600 text-white' },
    { key: 'PLAN', label: GROUP_META.PLAN.chipLabel, count: groupCounts.PLAN, on: 'bg-amber-500 text-black' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* سربرگ */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3 tabular-nums">
            {todayPersian} · {roleLabel}
          </p>
          <h1 className="text-lg sm:text-xl font-black text-ink tracking-tight mt-0.5">پیشخوان</h1>
        </div>
        {onNewProject && (
          <button
            type="button"
            onClick={() => onNewProject()}
            className="shrink-0 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-on-brand font-black text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[44px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            پروژه جدید
          </button>
        )}
      </header>

      {pendingScheduleRequests > 0 && onOpenScheduleRequests && (
        <button
          type="button"
          onClick={onOpenScheduleRequests}
          className="w-full rounded-xl bg-surface border border-line border-r-4 border-r-sky-500 p-3 flex items-center justify-between gap-3 text-right cursor-pointer hover:bg-raised min-h-[48px]"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <CalendarClock className="w-4 h-4 text-sky-500" aria-hidden="true" />
            {toPersianDigits(pendingScheduleRequests)} درخواست تغییر برنامه منتظر بررسی
          </span>
          <span className="text-xs font-bold text-brand-ink flex items-center gap-1 shrink-0">
            تقویم
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
        </button>
      )}

      <div className="grid grid-cols-1 @min-[900px]:grid-cols-3 gap-4 items-start">
        {/* ================= صف اقدام ================= */}
        <section className="@min-[900px]:col-span-2 space-y-3" aria-label="صف اقدام">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={filter === c.key}
                onClick={() => setFilter(c.key)}
                className={`shrink-0 min-h-[40px] px-3 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  filter === c.key ? c.on : 'bg-surface border border-line text-ink-2 hover:text-ink'
                }`}
              >
                {c.label}
                <span
                  className={`min-w-5 h-5 px-1 rounded-full text-[11px] tabular-nums flex items-center justify-center ${
                    filter === c.key ? 'bg-black/15' : c.count > 0 && c.key === 'ISSUES' ? 'bg-rose-600 text-white' : 'bg-sunken'
                  }`}
                >
                  {toPersianDigits(c.count)}
                </span>
              </button>
            ))}
          </div>

          {visibleQueue.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-line bg-sunken/50">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <p className="text-sm font-bold text-ink">
                {actionQueue.length === 0 ? 'همه‌چیز روی روال است؛ کار فوری‌ای نیست.' : 'در این دسته موردی نیست.'}
              </p>
            </div>
          ) : filter === 'ALL' ? (
            GROUP_ORDER.filter((g) => groupCounts[g] > 0).map((g) => (
              <div key={g} className="space-y-2">
                <h2 className="text-xs font-black text-ink-2 px-1 flex items-center justify-between">
                  <span>{GROUP_META[g].label}</span>
                  <span className="text-ink-3 font-bold tabular-nums">{toPersianDigits(groupCounts[g])}</span>
                </h2>
                {visibleQueue.filter((i) => ACTION_GROUP[i.kind] === g).map(renderRow)}
              </div>
            ))
          ) : (
            <div className="space-y-2">{visibleQueue.map(renderRow)}</div>
          )}

          {laterBookings.length > 0 && (filter === 'ALL' || filter === 'PLAN') && (
            <button
              type="button"
              onClick={() => onNavigateTab('planner')}
              className="w-full rounded-xl border border-dashed border-line p-3 flex items-center justify-between gap-3 text-right cursor-pointer hover:bg-raised min-h-[48px]"
            >
              <span className="text-xs font-bold text-ink-2">
                {toPersianDigits(laterBookings.length)} رزرو فروش برای روزهای بعد در تقویم منتظر تخصیص است
              </span>
              <ChevronLeft className="w-4 h-4 text-ink-3 shrink-0" aria-hidden="true" />
            </button>
          )}
        </section>

        {/* ================= ستون کناری: امروز و فردا، انبار ================= */}
        <aside className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-ink" />
                اکیپ‌ها امروز و فردا
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('planner')}
                className="text-xs font-bold text-brand-ink hover:underline flex items-center gap-1 cursor-pointer min-h-[40px] px-1"
              >
                تقویم
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="rounded-xl bg-surface border border-line divide-y divide-line">
              {liveTeams.map(({ team, teamName, activeProject, todayCount, tomorrow, status }) => {
                const st = TEAM_STATUS[status];
                return (
                  <div key={team.id} className="p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} aria-hidden="true" />
                      <span className="text-sm font-bold text-ink">{teamName}</span>
                      <span className={`text-[11px] font-bold ${st.text}`}>{st.label}</span>
                    </div>
                    {activeProject ? (
                      <button
                        type="button"
                        onClick={() => onOpenProject(activeProject)}
                        className="w-full text-right text-xs text-ink-2 rounded-md hover:bg-raised px-1 -mx-1 py-1 cursor-pointer min-h-[36px]"
                      >
                        <span className="font-mono text-ink-3">{activeProject.code}</span> · {activeProject.title}
                        {isProjectMultiDay(activeProject) && <span className="text-teal-600 dark:text-teal-400"> · چندروزه</span>}
                        {todayCount > 1 && <span className="text-ink-3"> · +{toPersianDigits(todayCount - 1)} کار دیگر</span>}
                        {getWarehouseStage(activeProject) !== 'NONE' && (
                          <WarehouseStageBadge project={activeProject} size="xs" withPrefix className="mr-1.5 align-middle" />
                        )}
                      </button>
                    ) : (
                      <p className="text-xs text-ink-3">امروز کاری ندارد.</p>
                    )}
                    <p className="text-[12px] text-ink-3">
                      فردا:{' '}
                      {tomorrow.length === 0 ? (
                        'کاری ندارد'
                      ) : (
                        <>
                          {tomorrow.map((t) => t.code).join('، ')}
                          {tomorrow.some((t) => {
                            const s = getWarehouseStage(t);
                            return s === 'AWAITING' || s === 'PARTIAL';
                          }) && <span className="text-rose-600 dark:text-rose-300 font-bold"> · کالا نرسیده</span>}
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {warehouseAlerts.length > 0 && (
            <section className="rounded-xl bg-surface border border-line border-r-4 border-r-amber-500 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-black text-ink">
                  <Package className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  {toPersianDigits(warehouseAlerts.length)} هشدار انبار
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateTab('materials')}
                  className="text-xs font-bold text-brand-ink hover:underline flex items-center gap-1 cursor-pointer min-h-[40px] px-1"
                >
                  انبار
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <ul className="space-y-1">
                {warehouseAlerts.slice(0, 5).map(({ p, alert }) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOpenProject(p)}
                      className="w-full text-right text-xs rounded-lg px-2 py-1.5 hover:bg-raised cursor-pointer min-h-[40px] space-y-0.5"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${alert.level === 'urgent' ? 'bg-rose-500' : 'bg-amber-500'}`}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-ink-3 shrink-0">{p.code}</span>
                        <span className="font-bold text-ink truncate">{p.title}</span>
                        {p.scheduledDate && <span className="text-ink-3 shrink-0 mr-auto">{formatJalali(p.scheduledDate)}</span>}
                      </span>
                      <span
                        className={`block pr-4 ${
                          alert.level === 'urgent' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {alert.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};
