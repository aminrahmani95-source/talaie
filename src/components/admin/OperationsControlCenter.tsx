import React, { useState, useMemo } from 'react';
import {
  Project,
  User,
  Ticket,
  InstallationTeamWithMembers,
  ScheduleChangeRequest,
  SystemSettings,
  MaterialRequest,
} from '../../types';
import { ManagerTab } from '../navigation/BottomNav';
import {
  Activity,
  CheckCircle2,
  Users,
  ChevronLeft,
  Flame,
  FileText,
  BarChart3,
  Star,
  Package,
  Phone,
  Plus,
  Search,
  Lock,
  Printer,
  FileCheck2,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString, localDateKey, formatJalali } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { isProjectMultiDay, isProjectScheduledOnDate } from '../../utils/multiDay';
import { computeSlaMetrics } from '../../utils/sla';
import { getHandoverEvidence } from '../../utils/qcWorkflow';
import { buildActionQueue, type ActionKind } from '../../utils/actionQueue';
import { ProjectDossierModal } from '../ceo/ProjectDossierModal';
import { ProjectPassportPrint } from '../common/ProjectPassportPrint';
import { triggerToast } from '../Toast';

const ACTION_META: Record<ActionKind, { label: string; chip: string; stripe: string; button: string }> = {
  STUCK: { label: 'توقف کار', chip: 'bg-rose-600 text-white', stripe: 'border-r-rose-500', button: 'bg-rose-600 hover:bg-rose-500 text-white' },
  TICKET: { label: 'تیکت باز', chip: 'bg-amber-500/20 text-amber-600 dark:text-amber-300', stripe: 'border-r-amber-500', button: 'bg-raised hover:bg-hover text-ink border border-line-strong' },
  QC: { label: 'منتظر QC', chip: 'bg-purple-600 text-white', stripe: 'border-r-purple-500', button: 'bg-purple-600 hover:bg-purple-500 text-white' },
  INCOMING: { label: 'کار جدید', chip: 'bg-amber-500 text-on-brand', stripe: 'border-r-brand', button: 'bg-brand hover:bg-brand-hover text-on-brand' },
};

const TEAM_STATUS = {
  ON_MISSION: { label: 'در حال نصب', dot: 'bg-amber-500 animate-pulse', text: 'text-amber-500' },
  STANDBY: { label: 'برنامه دارد', dot: 'bg-blue-500', text: 'text-blue-500' },
  AVAILABLE: { label: 'آزاد', dot: 'bg-emerald-500', text: 'text-emerald-500' },
  STUCK: { label: 'متوقف', dot: 'bg-rose-500', text: 'text-rose-500' },
} as const;

export interface OperationsControlCenterProps {
  currentUser: User;
  projects: Project[];
  users: User[];
  tickets: Ticket[];
  teamsWithMembers: InstallationTeamWithMembers[];
  scheduleChangeRequests: ScheduleChangeRequest[];
  materialRequests?: MaterialRequest[];
  settings?: SystemSettings | null;
  onNavigateTab: (tab: ManagerTab) => void;
  onOpenProject: (project: Project) => void;
  onOpenQcProject?: (project: Project) => void;
  onOpenScheduleRequests?: () => void;
  onReviewScheduleRequest?: (request: ScheduleChangeRequest) => void;
  onNewProject?: () => void;
}

export const OperationsControlCenter: React.FC<OperationsControlCenterProps> = ({
  currentUser,
  projects,
  users: _users,
  tickets,
  teamsWithMembers,
  scheduleChangeRequests: _scheduleChangeRequests,
  materialRequests = [],
  settings: _settings,
  onNavigateTab,
  onOpenProject,
  onOpenQcProject,
  onOpenScheduleRequests: _onOpenScheduleRequests,
  onReviewScheduleRequest: _onReviewScheduleRequest,
  onNewProject,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ACTIONS' | 'REGISTRY' | 'ANALYTICS'>('ACTIONS');
  const [activeUrgentCategory, setActiveUrgentCategory] = useState<'ALL' | 'STUCK' | 'INCOMING' | 'QC'>('ALL');

  // استیت‌های جستجو و فیلتر بخش شناسنامه و سوابق پروژه‌ها
  const [searchQuery, setSearchQuery] = useState('');
  const [registryStatusFilter, setRegistryStatusFilter] = useState<'ALL' | 'APPROVED' | 'IN_PROGRESS' | 'SCHEDULED' | 'STUCK'>('ALL');
  const [dossierProject, setDossierProject] = useState<Project | null>(null);
  const [printingProject, setPrintingProject] = useState<Project | null>(null);

  const handlePrintCertificate = (project: Project) => {
    const isQcApproved = project.status === 'COMPLETED' && project.qcStatus === 'APPROVED';
    if (!isQcApproved) {
      triggerToast(
        'warning',
        'چاپ شناسنامه رسمی منحصراً پس از اتمام کامل پروژه و صدور تأییدیه نهایی کنترل کیفی (QC) مجاز می‌باشد.'
      );
      return;
    }
    setPrintingProject(project);
  };

  // پروژه‌های فیلترشده در تب شناسنامه و آرشیو
  const filteredRegistryProjects = useMemo(() => {
    return projects.filter((p) => {
      if (registryStatusFilter === 'APPROVED' && !(p.status === 'COMPLETED' && p.qcStatus === 'APPROVED')) {
        return false;
      }
      if (registryStatusFilter === 'IN_PROGRESS' && p.status !== 'IN_PROGRESS' && p.status !== 'EN_ROUTE') {
        return false;
      }
      if (registryStatusFilter === 'SCHEDULED' && p.status !== 'SCHEDULED' && p.status !== 'MEASUREMENT_PENDING') {
        return false;
      }
      if (registryStatusFilter === 'STUCK' && p.status !== 'STUCK') {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchCustomer = (p.customerName || '').toLowerCase().includes(q);
        const matchCode = (p.code || '').toLowerCase().includes(q);
        const matchAddress = (p.address || '').toLowerCase().includes(q);
        const matchTeam = (p.assignedTeamName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCustomer && !matchCode && !matchAddress && !matchTeam) {
          return false;
        }
      }

      return true;
    });
  }, [projects, registryStatusFilter, searchQuery]);

  const isQcManager = currentUser.role === 'QC_MANAGER';
  const isCeo = currentUser.role === 'CEO';
  const todayKey = useMemo(() => localDateKey(new Date()), []);
  const todayPersian = useMemo(() => getTodayPersianString(), []);

  // ================= 1. صف نیازمند اقدام فوری (ACTION INBOX) =================

  // یک صف واحد، هر پروژه یک ردیف (همان منبعی که نشان منوی «پیشخوان» را می‌شمارد)
  const actionQueue = useMemo(() => buildActionQueue(projects, tickets), [projects, tickets]);
  const queueCounts = useMemo(() => {
    const c: Record<ActionKind, number> = { STUCK: 0, TICKET: 0, QC: 0, INCOMING: 0 };
    for (const i of actionQueue) c[i.kind]++;
    return c;
  }, [actionQueue]);
  const visibleQueue = useMemo(
    () =>
      actionQueue.filter((i) =>
        activeUrgentCategory === 'ALL'
          ? true
          : activeUrgentCategory === 'STUCK'
          ? i.kind === 'STUCK' || i.kind === 'TICKET'
          : i.kind === activeUrgentCategory,
      ),
    [actionQueue, activeUrgentCategory],
  );

  // ================= 2. وضعیت زنده ۲ اکیپ نصب در امروز =================
  const liveTeams = useMemo(() => {
    // اطمینان از وجود ۲ اکیپ
    const targetTeams: InstallationTeamWithMembers[] = teamsWithMembers && teamsWithMembers.length > 0
      ? teamsWithMembers
      : [
          { id: 'TEAM_1', name: 'اکیپ نصب ۱', code: 'TEAM_1', technicians: [], totalMembers: 0, createdAt: '', updatedAt: '' },
          { id: 'TEAM_2', name: 'اکیپ نصب ۲', code: 'TEAM_2', technicians: [], totalMembers: 0, createdAt: '', updatedAt: '' },
        ];

    return targetTeams.map((team) => {
      // پروژه‌های این اکیپ برای امروز
      const teamProjects = projects.filter((p) => {
        if (p.assignedTeamId !== team.id) return false;
        if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
        return (
          p.scheduledDate === todayKey ||
          isProjectScheduledOnDate(p, todayKey) ||
          p.status === 'IN_PROGRESS' ||
          p.status === 'EN_ROUTE'
        );
      });

      const activeProject = teamProjects[0] || null;

      let status: 'ON_MISSION' | 'STANDBY' | 'AVAILABLE' | 'STUCK' = 'AVAILABLE';
      if (activeProject) {
        if (activeProject.status === 'STUCK') {
          status = 'STUCK';
        } else if (activeProject.status === 'IN_PROGRESS' || activeProject.status === 'EN_ROUTE') {
          status = 'ON_MISSION';
        } else {
          status = 'STANDBY';
        }
      }

      const isWarehouseReady = Boolean(activeProject?.warehousePrep?.isPackedAndReady);
      const packedBy = activeProject?.warehousePrep?.packedByUserName;

      return {
        team,
        activeProject,
        status,
        isWarehouseReady,
        packedBy,
        technicians: team.technicians || [],
      };
    });
  }, [teamsWithMembers, projects, todayKey]);

  // ================= 3. شاخص‌های آماری و کلان =================
  const slaMetrics = useMemo(() => computeSlaMetrics(tickets), [tickets]);

  const approvedQcCount = useMemo(() => {
    return projects.filter((p) => p.qcStatus === 'APPROVED').length;
  }, [projects]);

  const activeSitesCount = useMemo(() => {
    return projects.filter((p) => p.status === 'IN_PROGRESS' || p.status === 'EN_ROUTE').length;
  }, [projects]);

  const ratedProjects = useMemo(() => {
    return projects.filter((p) => p.customerSatisfaction && p.customerSatisfaction > 0);
  }, [projects]);

  const avgSatisfaction = useMemo(() => {
    if (ratedProjects.length === 0) return 0;
    const sum = ratedProjects.reduce((acc, p) => acc + (p.customerSatisfaction || 0), 0);
    return Number((sum / ratedProjects.length).toFixed(1));
  }, [ratedProjects]);

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 animate-in fade-in duration-200">
      {/* ================= سربرگ فشرده ================= */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3 tabular-nums">
            {todayPersian} · {isQcManager ? 'مدیر فنی و QC' : isCeo ? 'مدیرعامل' : 'هماهنگی عملیات'}
          </p>
          <h1 className="text-lg sm:text-xl font-black text-ink tracking-tight mt-0.5">پیشخوان عملیات</h1>
        </div>
        {onNewProject && (
          <button
            type="button"
            onClick={onNewProject}
            className="shrink-0 px-3.5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand font-black text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[40px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            پروژه جدید
          </button>
        )}
      </header>

      {/* ================= نبض روز: کاشی‌ها همان فیلترهای صف اقدام‌اند ================= */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { key: 'ALL' as const, label: 'نیازمند اقدام', value: actionQueue.length, tone: actionQueue.length > 0 ? 'text-rose-400' : 'text-emerald-400', ring: 'ring-brand' },
          { key: 'STUCK' as const, label: 'توقف و تیکت', value: queueCounts.STUCK + queueCounts.TICKET, tone: 'text-rose-400', ring: 'ring-rose-500' },
          { key: 'QC' as const, label: 'منتظر QC', value: queueCounts.QC, tone: 'text-purple-400', ring: 'ring-purple-500' },
          { key: 'INCOMING' as const, label: 'کار جدید', value: queueCounts.INCOMING, tone: 'text-amber-400', ring: 'ring-amber-500' },
        ].map((tile) => {
          const isActive = activeSubTab === 'ACTIONS' && activeUrgentCategory === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setActiveSubTab('ACTIONS');
                setActiveUrgentCategory(tile.key);
              }}
              className={`text-right p-2.5 sm:p-3.5 rounded-xl bg-surface border transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                isActive ? `border-transparent ring-2 ${tile.ring}` : 'border-line hover:border-line-strong'
              }`}
            >
              <div className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${tile.value > 0 ? tile.tone : 'text-ink-3'}`}>
                {toPersianDigits(tile.value)}
              </div>
              <div className="text-[12px] sm:text-xs font-bold text-ink-2 mt-1.5 leading-tight">{tile.label}</div>
            </button>
          );
        })}
      </div>

      {/* ================= تب‌ها ================= */}
      <div role="tablist" className="flex items-center gap-1 p-1 rounded-xl bg-sunken border border-line w-full sm:w-auto sm:inline-flex">
        {(
          [
            { key: 'ACTIONS' as const, label: 'صف اقدام', icon: Activity, show: true },
            { key: 'REGISTRY' as const, label: 'شناسنامه پروژه‌ها', icon: FileText, show: isCeo },
            { key: 'ANALYTICS' as const, label: 'گزارش‌ها', icon: BarChart3, show: true },
          ]
        )
          .filter((t) => t.show)
          .map((t) => {
            const Icon = t.icon;
            const selected = activeSubTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveSubTab(t.key)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  selected ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${selected ? 'text-brand-ink' : ''}`} />
                {t.label}
              </button>
            );
          })}
      </div>

      {activeSubTab === 'ACTIONS' ? (
        <>
          {/* ================= صف اقدام: هر پروژه یک ردیف، یک دکمه‌ی اصلی ================= */}
          <section className="space-y-2" aria-label="صف اقدام">
            {visibleQueue.map((item) => {
              const p = item.project;
              const meta = ACTION_META[item.kind];
              const isWarehouse = item.tickets.some((t) => t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote));
              const code = p?.code || item.tickets[0]?.projectCode || '';
              const title = p?.title || item.tickets[0]?.projectTitle || '';
              const phone = item.kind === 'STUCK' || item.kind === 'INCOMING' ? p?.customerPhone : undefined;

              const stuckReason = (
                p?.stuckIncident?.description ||
                p?.stuckIncidents?.[p.stuckIncidents.length - 1]?.description ||
                ''
              ).trim();
              const extraTickets = item.tickets.filter((t) => {
                const d = (t.description || '').trim();
                return d && !(stuckReason && (stuckReason.includes(d) || d.includes(stuckReason)));
              });

              let detail: React.ReactNode = null;
              let primary: { label: string; onClick: () => void } = { label: 'باز کردن', onClick: () => p && onOpenProject(p) };

              if (item.kind === 'STUCK' && p) {
                detail = <>علت: {stuckReason || 'علت توقف ثبت نشده'}</>;
                primary = { label: 'رفع توقف', onClick: () => onOpenProject(p) };
              } else if (item.kind === 'TICKET') {
                const first = item.tickets[0];
                detail = (
                  <>
                    {first?.blockingReason || first?.description}
                    {item.tickets.length > 1 && (
                      <span className="text-ink-3"> · {toPersianDigits(item.tickets.length - 1)} تیکت دیگر</span>
                    )}
                  </>
                );
                primary = { label: 'رسیدگی', onClick: () => onNavigateTab('tickets') };
              } else if (item.kind === 'QC' && p) {
                const ev = getHandoverEvidence(p);
                const ok = ev.exempt || (ev.hasPhotos && ev.hasAcceptance);
                detail = (
                  <>
                    {p.assignedTeamName || 'اکیپ نامشخص'} ·{' '}
                    <span className={ok ? 'text-emerald-500' : 'text-amber-500'}>
                      {ok
                        ? 'عکس و امضا ثبت شده'
                        : [!ev.hasPhotos && 'بدون عکس', !ev.hasAcceptance && 'بدون امضا'].filter(Boolean).join(' و ')}
                    </span>
                  </>
                );
                primary = {
                  label: 'بررسی QC',
                  onClick: () => (onOpenQcProject ? onOpenQcProject(p) : onNavigateTab('qc')),
                };
              } else if (item.kind === 'INCOMING' && p) {
                const missing = [
                  !p.assignedTeamId && 'اکیپ',
                  !p.scheduledDate && 'تاریخ',
                  !p.technicalHandover?.isHandoverComplete && 'اندازه‌گیری دوم',
                ].filter(Boolean);
                detail = (
                  <>
                    {toPersianDigits((p.shadePanels || 0) + (p.curtainPanels || 0))} لت
                    {p.salesRepName ? ` · ${p.salesRepName}` : ''}
                    {missing.length > 0 && <span className="text-amber-500"> · مانده: {missing.join('، ')}</span>}
                  </>
                );
                primary = { label: 'تخصیص اکیپ و تاریخ', onClick: () => onOpenProject(p) };
              }

              return (
                <div
                  key={item.key}
                  className={`rounded-xl bg-surface border border-line border-r-4 ${meta.stripe} p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4`}
                >
                  <div className="min-w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-black ${meta.chip}`}>
                        {item.kind === 'TICKET' && item.tickets[0]?.isBlocking ? 'تیکت مسدودکننده' : meta.label}
                      </span>
                      {isWarehouse && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/15 text-purple-400 flex items-center gap-1">
                          <Package className="w-3 h-3" aria-hidden="true" />
                          در دست انبار
                        </span>
                      )}
                      <span className="font-mono text-[12px] text-ink-3">{code}</span>
                      <span className="text-sm font-bold text-ink truncate">{title}</span>
                    </div>
                    {detail && <p className="text-xs text-ink-2 mt-1 line-clamp-2">{detail}</p>}
                    {/* tickets that only repeat the stop reason are not listed again */}
                    {item.kind === 'STUCK' && extraTickets.length > 0 && (
                      <p className="text-[12px] text-ink-3 mt-1 truncate">
                        تیکت باز: {extraTickets.map((t) => t.description).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        aria-label={`تماس با ${p?.customerName || 'کارفرما'}`}
                        className="w-9 h-9 rounded-lg border border-line text-ink-2 hover:text-ink hover:bg-raised flex items-center justify-center"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {isWarehouse && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('materials')}
                        className="px-3 py-2 rounded-lg border border-line text-ink-2 hover:text-ink hover:bg-raised text-xs font-bold cursor-pointer min-h-[36px]"
                      >
                        انبار
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={primary.onClick}
                      className={`px-3.5 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer active:scale-95 min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${meta.button}`}
                    >
                      {primary.label}
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}

            {visibleQueue.length === 0 && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-line bg-sunken/50">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <p className="text-sm font-bold text-ink">
                  {actionQueue.length === 0 ? 'همه‌چیز روی روال است؛ مورد فوری‌ای وجود ندارد.' : 'در این دسته موردی نیست.'}
                </p>
              </div>
            )}
          </section>

          {/* ================= اکیپ‌ها امروز: هر اکیپ یک ردیف ================= */}
          <section className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-ink" />
                اکیپ‌ها امروز
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('planner')}
                className="text-xs font-bold text-brand-ink hover:underline flex items-center gap-1 cursor-pointer"
              >
                تقویم
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="rounded-xl bg-surface border border-line divide-y divide-line">
              {liveTeams.map(({ team, activeProject, status, isWarehouseReady }) => {
                const st = TEAM_STATUS[status];
                const teamName = team.supervisorName ? `اکیپ ${getDisplayName(team.supervisorName)}` : team.name;
                return (
                  <div key={team.id} className="p-3 flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} aria-hidden="true" />
                    <div className="min-w-0 grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-ink">{teamName}</span>
                        <span className={`text-[11px] font-bold ${st.text}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-ink-2 mt-0.5 truncate">
                        {activeProject ? (
                          <>
                            <span className="font-mono text-ink-3">{activeProject.code}</span> · {activeProject.title}
                            {isProjectMultiDay(activeProject) && <span className="text-teal-500"> · چندروزه</span>}
                            <span className={isWarehouseReady ? 'text-emerald-500' : 'text-amber-500'}>
                              {' '}· {isWarehouseReady ? 'بار آماده ✓' : 'بار آماده نیست'}
                            </span>
                          </>
                        ) : (
                          'بدون مأموریت برای امروز'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => (activeProject ? onOpenProject(activeProject) : onNavigateTab('planner'))}
                      className="shrink-0 px-3 py-2 rounded-lg border border-line text-xs font-bold text-ink-2 hover:text-ink hover:bg-raised cursor-pointer min-h-[36px]"
                    >
                      {activeProject ? 'پرونده' : 'تخصیص'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : activeSubTab === 'REGISTRY' ? (
        !isCeo ? (
          <div className="bg-surface border border-rose-500/30 rounded-2xl p-8 text-center text-rose-400 space-y-2">
            <p className="font-bold">دسترسی غیرمجاز</p>
            <p className="text-xs text-ink-2">
              مشاهده شناسنامه رسمی و سوابق پروژه‌ها منحصراً در اختیار مدیرعامل (CEO) می‌باشد.
            </p>
          </div>
        ) : (
          /* ================= نمای شناسنامه و سوابق جامع پروژه‌ها (MASTER REGISTRY) ================= */
          <div className="space-y-5 animate-in fade-in duration-200">
          {/* باکس جستجو و فیلترها */}
          <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-line space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-ink-3 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی سریع پروژه، نام کارفرما، کد رهگیری، نشانی یا اکیپ نصب..."
                  className="w-full bg-canvas text-ink border border-line rounded-xl pr-10 pl-4 py-2.5 text-xs placeholder:text-ink-3 focus:outline-none focus:border-brand transition shadow-inner"
                />
              </div>

              {/* فیلتر وضعیت */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'APPROVED', 'IN_PROGRESS', 'SCHEDULED', 'STUCK'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setRegistryStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      registryStatusFilter === st
                        ? 'bg-brand text-on-brand'
                        : 'bg-canvas text-ink-2 hover:text-ink border border-line'
                    }`}
                  >
                    {st === 'ALL' && 'همه پروژه‌ها'}
                    {st === 'APPROVED' && 'تایید کیفی QC'}
                    {st === 'IN_PROGRESS' && 'در حال نصب'}
                    {st === 'SCHEDULED' && 'برنامه‌ریزی‌شده'}
                    {st === 'STUCK' && 'متوقف در کارگاه'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* لیست کارت‌های پروژه‌ها */}
          {filteredRegistryProjects.length === 0 ? (
            <div className="bg-surface rounded-2xl p-12 text-center border border-line text-xs text-ink-2 space-y-2">
              <FileCheck2 className="w-8 h-8 text-ink-3 mx-auto opacity-50" />
              <h4 className="font-bold text-ink">پروژه‌ای مطابق با فیلتر انتخابی یافت نشد</h4>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredRegistryProjects.map((p) => {
                const isApproved = p.status === 'COMPLETED' && p.qcStatus === 'APPROVED';
                const isStuck = p.status === 'STUCK';
                const isInProgress = p.status === 'IN_PROGRESS' || p.status === 'EN_ROUTE';

                return (
                  <div
                    key={p.id}
                    className={`bg-surface rounded-2xl p-4 sm:p-5 border transition space-y-3.5 ${
                      isApproved
                        ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : isStuck
                        ? 'border-rose-500/50'
                        : isInProgress
                        ? 'border-brand/50'
                        : 'border-line'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-line pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line-strong px-2.5 py-0.5 rounded">
                            {p.code}
                          </span>
                          {p.isForceMajeure && (
                            <span className="flex items-center gap-1 text-[12px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded border border-rose-500/30">
                              <Flame className="w-3 h-3 text-rose-400" />
                              فورس‌ماژور
                            </span>
                          )}
                          <span className="text-xs text-ink-2 font-bold">
                            تاریخ نصب: {formatJalali(p.scheduledDate)}
                          </span>
                          {p.assignedTeamName && (
                            <span className="text-xs text-brand-ink font-bold">
                              • {p.assignedTeamName}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-ink mt-1">{p.title}</h3>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                          isApproved
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : isStuck
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : isInProgress
                            ? 'bg-brand/15 text-brand-ink border-brand/30'
                            : 'bg-raised text-ink-2 border-line-strong'
                        }`}>
                          {isApproved ? 'تایید نهایی QC ✅' :
                           isStuck ? 'متوقف در کارگاه ⚠️' :
                           isInProgress ? 'در حال اجرا' : 'زمان‌بندی‌شده'}
                        </span>

                        <button
                          type="button"
                          onClick={() => setDossierProject(p)}
                          className="px-3.5 py-1.5 bg-raised hover:bg-hover text-ink hover:text-brand-ink border border-line-strong rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-brand-ink" />
                          <span>پرونده ۳۶۰°</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintCertificate(p)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer ${
                            isApproved
                              ? 'bg-brand hover:bg-brand-hover text-on-brand'
                              : 'bg-raised hover:bg-hover text-ink-2 border border-line-strong'
                          }`}
                        >
                          {isApproved ? (
                            <Printer className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span>شناسنامه A4</span>
                        </button>
                      </div>
                    </div>

                    {/* مشخصات کارفرما و اقلام */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-canvas p-2.5 rounded-xl border border-line space-y-1">
                        <span className="text-ink-3 font-bold block">کارفرما و نشانی:</span>
                        <p className="font-bold text-ink">{p.customerName}</p>
                        <p className="text-ink-2 font-mono">{p.customerPhone || 'بدون شماره'}</p>
                        <p className="text-ink-2 line-clamp-1">{p.address}</p>
                      </div>

                      <div className="bg-canvas p-2.5 rounded-xl border border-line space-y-1">
                        <span className="text-ink-3 font-bold block">مشخصات فنی و مقادیر:</span>
                        <p className="font-bold text-brand-ink">
                          {p.shadePanels > 0 && `${toPersianDigits(p.shadePanels)} لت شید`}
                          {p.shadePanels > 0 && p.curtainPanels > 0 && ' • '}
                          {p.curtainPanels > 0 && `${toPersianDigits(p.curtainPanels)} لت پرده`}
                        </p>
                        <p className="text-ink-2">{p.mechanismType || 'مکانیزم استاندارد'}</p>
                      </div>

                      <div className="bg-canvas p-2.5 rounded-xl border border-line space-y-1">
                        <span className="text-ink-3 font-bold block">کیفیت و امتیاز:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                (p.qcScore || 5) >= s ? 'text-brand-ink fill-brand' : 'text-ink-3'
                              }`}
                            />
                          ))}
                          <span className="font-bold text-ink mr-1">
                            {toPersianDigits(p.qcScore || 5)} از 5
                          </span>
                        </div>
                        {p.customerSatisfaction && (
                          <p className="text-ink-2">رضایت مشتری: {toPersianDigits(p.customerSatisfaction)} ستاره</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )
      ) : (
        /* ================= نمای گزارش آماری و هوش عملیاتی (ANALYTICS) ================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-5 rounded-xl bg-surface border border-line space-y-4">
            <h3 className="text-sm font-black text-ink flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-ink" />
              شاخص‌های عملکرد
            </h3>

            {/* کارت‌های خلاصه KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-lg bg-sunken border border-line">
                <span className="text-[12px] text-ink-2 block mb-1">کارگاه‌های فعال امروز</span>
                <span className="text-xl font-bold text-ink tabular-nums">{toPersianDigits(activeSitesCount)}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-sunken border border-line">
                <span className="text-[12px] text-ink-2 block mb-1">تایید نهایی QC</span>
                <span className="text-xl font-bold text-emerald-400 tabular-nums">{toPersianDigits(approvedQcCount)}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-sunken border border-line">
                <span className="text-[12px] text-ink-2 block mb-1">رضایت کارفرمایان</span>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {avgSatisfaction > 0 ? `${toPersianDigits(avgSatisfaction)} از ۵` : '—'}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-sunken border border-line">
                <span className="text-[12px] text-ink-2 block mb-1">کل پروژه‌های ثبت‌شده</span>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {toPersianDigits(projects.length)}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-sunken border border-line">
                <span className="text-[12px] text-ink-2 block mb-1">حل تیکت‌ها در موعد SLA</span>
                <span className="text-xl font-bold text-emerald-400 tabular-nums">
                  {toPersianDigits(slaMetrics.onTimeRate)}٪
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-sunken border border-line">
                <span className="text-[12px] text-ink-2 block mb-1">تیکت‌های بحرانی باقیمانده</span>
                <span className="text-xl font-bold text-rose-400 tabular-nums">
                  {toPersianDigits(slaMetrics.openOverdue)}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-sunken border border-line">
                <span className="text-[12px] text-ink-2 block mb-1">متریال تحویل‌شده به کارگاه</span>
                <span className="text-xl font-bold text-brand-ink tabular-nums">
                  {toPersianDigits(
                    materialRequests.filter((r) => r.status === 'DELIVERED_CONFIRMED').length
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال مشاهده پرونده و سوابق جامع ۳۶۰ درجه */}
      {dossierProject && (
        <ProjectDossierModal
          project={dossierProject}
          users={_users}
          onClose={() => setDossierProject(null)}
          onPrintCertificate={() => handlePrintCertificate(dossierProject)}
        />
      )}

      {/* مودال چاپ شناسنامه رسمی */}
      {printingProject && (
        <ProjectPassportPrint
          project={printingProject}
          onClose={() => setPrintingProject(null)}
        />
      )}
    </div>
  );
};
