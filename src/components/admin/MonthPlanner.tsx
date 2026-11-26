import React, { useState, useMemo } from 'react';
import { WarehouseStageBadge } from '../warehouse/WarehouseStageBadge';
import { Portal } from '../ui/Portal';
import { formatProductCounts, projectProductCounts, capacityUnits, bookingProductCounts } from '../../utils/productCounts';
import {
  Project,
  User,
  SystemSettings,
  InstallationTeam,
  ScheduleChangeRequest,
} from '../../types';
import {
  Plus,
  Edit2,
  Settings2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  XCircle,
  Send,
  ArrowRightLeft,
  Wrench,
  Trophy,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { getUpcomingDays, toPersianDigits, localDateKey, formatJalali } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusPill } from '../ui/StatusPill';
import { isProjectScheduledOnDate, getMultiDayProgress, isProjectMultiDay } from '../../utils/multiDay';
import {
  detectScheduleConflicts,
  calculateTeamDayLoad,
  getProjectDailyDurationHours,
  getTeamDailyCapacity,
} from '../../utils/capacity';
import { linkBookingToInstallationProject } from '../../utils/salesCapacity';
import { useSalesBookings } from '../../hooks/useSalesBookings';
import { isBookingAwaitingAssignment } from '../../utils/actionQueue';
import { AssignSalesBookingModal } from './AssignSalesBookingModal';
import { triggerToast } from '../Toast';
import { SalesProjectBooking } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  projects: Project[];
  users: User[];
  teams?: InstallationTeam[];
  currentUser?: User;
  settings: SystemSettings;
  scheduleChangeRequests?: ScheduleChangeRequest[];
  onUpdateSettings?: (settings: SystemSettings) => void;
  onNewProject?: (
    dateKey?: string,
    initialData?: Partial<Project>,
    onCreated?: (project: Project) => void
  ) => void;
  onEditProject?: (project: Project) => void;
  onManageProject: (project: Project) => void;
  onMoveProjectDate?: (projectId: string, newDateKey: string) => void;
  onViewProposal: (project: Project) => void;
  onOpenPreInspection?: (project: Project) => void;
  onProposeScheduleChange?: (
    projectId: string,
    proposedDate: string,
    proposedEndDate?: string,
    proposedTeamId?: string,
    reason?: string
  ) => Promise<void>;
  onReviewScheduleChange?: (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string
  ) => Promise<void>;
}

export const MonthPlanner: React.FC<Props> = ({
  projects,
  users,
  teams = [],
  currentUser,
  settings,
  scheduleChangeRequests = [],
  onNewProject,
  onEditProject,
  onManageProject,
  onViewProposal,
  onOpenPreInspection,
  onProposeScheduleChange,
  onReviewScheduleChange,
}) => {
  const days = useMemo(() => getUpcomingDays(365), []);
  const isCeo = currentUser?.role === 'CEO';
  const isQcManager = currentUser?.role === 'QC_MANAGER';
  const canEditSchedule = !isCeo && Boolean(onNewProject);

  // View modes: '4DAYS' | '7DAYS' | 'TIMELINE' | 'FULL_MONTH'
  const [viewMode, setViewMode] = useState<'4DAYS' | '7DAYS' | 'TIMELINE' | 'FULL_MONTH'>('4DAYS');
  const [startIndex, setStartIndex] = useState(0);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  // Modal states for schedule change proposal and review
  const [proposingProject, setProposingProject] = useState<Project | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedEndDate, setProposedEndDate] = useState('');
  const [proposedTeamId, setProposedTeamId] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  const [reviewingRequest, setReviewingRequest] = useState<ScheduleChangeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Escape closes the planner's dialogs (they previously trapped the page until clicked)
  useEscapeKey(() => {
    setProposingProject(null);
    setReviewingRequest(null);
  }, Boolean(proposingProject || reviewingRequest));

  // استخر رزروهای فروش برای تخصیص به نصاب‌ها
  const [isSalesTrayOpen, setIsSalesTrayOpen] = useState(false);
  const [assigningBooking, setAssigningBooking] = useState<SalesProjectBooking | null>(null);

  // استخراج رزروهای فعال فروش که هنوز به پروژه اجرایی متصل نشده‌اند
  // live list: a booking made on a sales rep's phone appears here without reloading
  const allSalesBookings = useSalesBookings();
  const unassignedSalesBookings = useMemo(
    () => allSalesBookings.filter((b) => isBookingAwaitingAssignment(b, projects)),
    [allSalesBookings, projects],
  );

  const displayedDays = useMemo(() => {
    if (viewMode === '4DAYS') return days.slice(startIndex, startIndex + 4);
    if (viewMode === '7DAYS') return days.slice(startIndex, startIndex + 7);
    if (viewMode === 'TIMELINE') return days.slice(startIndex, startIndex + 5);
    return days.slice(startIndex, startIndex + 30);
  }, [viewMode, startIndex, days]);

  const todayKey = days.find((d) => d.isToday)?.dateKey || localDateKey();

  // Detect schedule conflicts
  const conflicts = useMemo(() => {
    return detectScheduleConflicts(projects, teams, settings);
  }, [projects, teams, settings]);

  const pendingRequests = useMemo(() => {
    return scheduleChangeRequests.filter((r) => r.status === 'PENDING');
  }, [scheduleChangeRequests]);

  // Handles submitting schedule proposal
  const handleOpenProposeModal = (project: Project) => {
    setProposingProject(project);
    setProposedDate(project.scheduledDate || todayKey);
    setProposedEndDate(project.endDate || '');
    setProposedTeamId(project.assignedTeamId || '');
    setChangeReason('');
    setProposalError(null);
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposingProject || !onProposeScheduleChange) return;
    if (changeReason.trim().length < 5) {
      setProposalError('ثبت علت تغییر تاریخ و برنامه (حداقل 5 کاراکتر) الزامی است.');
      return;
    }
    setIsSubmittingProposal(true);
    setProposalError(null);
    try {
      await onProposeScheduleChange(
        proposingProject.id,
        proposedDate,
        proposedEndDate || undefined,
        proposedTeamId || undefined,
        changeReason.trim()
      );
      setProposingProject(null);
    } catch (err: any) {
      setProposalError(err.message || 'خطا در ثبت درخواست تغییر برنامه.');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleExecuteReview = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!reviewingRequest || !onReviewScheduleChange) return;
    setIsSubmittingReview(true);
    try {
      await onReviewScheduleChange(reviewingRequest.id, decision, reviewNotes);
      setReviewingRequest(null);
      setReviewNotes('');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="تقویم نصب"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={[
                { id: 'TIMELINE', label: 'خط سیر اکیپ‌ها' },
                { id: '4DAYS', label: '4 روزه' },
                { id: '7DAYS', label: 'هفتگی' },
                { id: 'FULL_MONTH', label: '30 روزه' },
              ]}
              value={viewMode}
              onChange={(val) => {
                setViewMode(val as any);
                setStartIndex(0);
              }}
              size="sm"
            />

            {(() => {
              const pageSize = viewMode === '4DAYS' ? 4 : viewMode === '7DAYS' ? 7 : viewMode === 'TIMELINE' ? 5 : 30;
              const step = viewMode === 'FULL_MONTH' ? 30 : 1;
              return (
                <div className="flex items-center gap-1 bg-sunken rounded-md p-1 border border-line">
                  <button
                    type="button"
                    disabled={startIndex === 0}
                    onClick={() => setStartIndex((i) => Math.max(0, i - step))}
                    className="p-1.5 hover:bg-raised text-ink-2 hover:text-ink rounded disabled:opacity-30 transition cursor-pointer"
                    title="روزهای قبلی"
                    aria-label="روزهای قبلی"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs px-2 text-brand-ink font-bold tabular-nums">
                    {toPersianDigits(startIndex + 1)} تا{' '}
                    {toPersianDigits(Math.min(days.length, startIndex + pageSize))}
                  </span>
                  <button
                    type="button"
                    disabled={startIndex + pageSize >= days.length}
                    onClick={() =>
                      setStartIndex((i) => Math.min(days.length - pageSize, i + step))
                    }
                    className="p-1.5 hover:bg-raised text-ink-2 hover:text-ink rounded disabled:opacity-30 transition cursor-pointer"
                    title="روزهای بعدی"
                    aria-label="روزهای بعدی"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              );
            })()}

            {isCeo && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>نمای نظارتی برنامه (فقط‌خواندنی — تنظیم برنامه با مدیر QC)</span>
              </div>
            )}

            {canEditSchedule && onNewProject && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNewProject()}
                icon={<Plus className="w-4 h-4" />}
              >
                پروژه جدید
              </Button>
            )}
          </div>
        }
      />

      {/* استخر رزروهای فروش منتظر تخصیص به نصاب‌ها (Sales Intake Tray) */}
      {unassignedSalesBookings.length > 0 && (
        <div className="rounded-xl border border-brand/40 bg-surface p-3 sm:p-4 text-ink">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 text-brand-ink flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-xs sm:text-sm text-ink">رزروهای فروش منتظر تخصیص</h3>
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-brand text-on-brand tabular-nums">
                    {toPersianDigits(unassignedSalesBookings.length)} رزرو فروش
                  </span>
                </div>

              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSalesTrayOpen((prev) => !prev)}
              className="text-xs font-bold text-brand-ink hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              {isSalesTrayOpen ? 'بستن' : 'مشاهده'}
              {isSalesTrayOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {isSalesTrayOpen && (
            <div className="mt-3 pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 @min-[900px]:grid-cols-3 gap-3">
              {unassignedSalesBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-xl bg-canvas border border-line hover:border-brand/60 transition flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs text-ink truncate">{b.customerName}</span>
                      <span className="font-mono text-[12px] font-bold text-brand-ink bg-brand/10 px-1.5 py-0.5 rounded shrink-0">
                        {formatProductCounts(bookingProductCounts(b)) || `${toPersianDigits(b.lathsCount)} لت`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-ink-2 mt-1.5">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-ink-3" />
                        <span className="font-mono">{b.customerPhone}</span>
                      </span>
                      <span>•</span>
                      <span className="truncate">{b.salesRepName}</span>
                    </div>

                    <div className="mt-2 text-[11px] bg-surface p-1.5 rounded border border-line flex items-center justify-between text-ink-2">
                      <span>پیشنهاد اولیه فروش:</span>
                      <span className="font-mono font-bold text-brand-soft">{b.jalaliDate}</span>
                    </div>
                    <div className="mt-1.5 text-[11px]">
                      {(b.proposalImages?.length ?? 0) > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-300 font-bold">
                          📎 پروپوزال ({toPersianDigits(b.proposalImages?.length ?? 0)} عکس)
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">بدون پروپوزال</span>
                      )}
                    </div>
                  </div>

                  {canEditSchedule ? (
                    <button
                      type="button"
                      onClick={() => setAssigningBooking(b)}
                      className="w-full py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-on-brand font-black text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>تخصیص به برنامه نصب</span>
                    </button>
                  ) : (
                    <div className="w-full py-1.5 rounded-lg bg-surface border border-line text-ink-2 text-[12px] font-medium text-center">
                      در انتظار تخصیص توسط مدیر QC
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* بنر تداخلات و هشدارهای برنامه‌ریزی (Conflict & Alerts Banner) */}
      {(conflicts.length > 0 || pendingRequests.length > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-4 transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-amber-300">
                  {conflicts.length > 0 && `${toPersianDigits(conflicts.length)} هشدار برنامه`}
                  {conflicts.length > 0 && pendingRequests.length > 0 && ' | '}
                  {pendingRequests.length > 0 && `${toPersianDigits(pendingRequests.length)} درخواست تغییر زمان‌بندی`}
                </h3>

              </div>
            </div>
            <button
              onClick={() => setIsAlertsOpen((prev) => !prev)}
              className="text-xs font-semibold text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {isAlertsOpen ? 'بستن' : 'مشاهده'}
              {isAlertsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {isAlertsOpen && (
            <div className="mt-3 pt-3 border-t border-amber-500/30 space-y-2">
              {/* تداخلات */}
              {conflicts.map((c) => (
                <div
                  key={c.id}
                  className={`p-2.5 rounded-md text-xs flex items-center justify-between gap-3 ${
                    c.severity === 'ERROR'
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-200 border border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold shrink-0">{c.projectTitle}:</span>
                    <span className="truncate">{c.message}</span>
                  </div>
                  <span className="text-[11px] font-mono shrink-0 opacity-75">{formatJalali(c.dateKey)}</span>
                </div>
              ))}

              {/* درخواست‌های تغییر برنامه */}
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 rounded-md text-xs bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ArrowRightLeft className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="font-bold">{req.projectTitle}:</span>
                    <span className="truncate">
                      درخواست انتقال از {formatJalali(req.previousScheduledDate)} به {formatJalali(req.proposedScheduledDate)} — علت: {req.reason}
                    </span>
                  </div>
                  {isQcManager && (
                    <button
                      onClick={() => setReviewingRequest(req)}
                      className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-[12px] hover:bg-blue-700 transition shrink-0 cursor-pointer"
                    >
                      بررسی و تصمیم
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== VIEW A: TEAM-BASED TIMELINE LANES ===================== */}
      {viewMode === 'TIMELINE' ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface overflow-hidden shadow-none">
            {/* سرستون روزهای خط سیر */}
            <div className="grid grid-cols-6 border-b border-line bg-canvas text-xs font-semibold">
              <div className="p-3 text-ink-2 flex items-center justify-center border-l border-line">
                اکیپ‌های ۲ گانه نصب
              </div>
              {displayedDays.map((d) => (
                <div
                  key={d.dateKey}
                  className={`p-3 text-center border-l last:border-l-0 border-line ${
                    d.isToday ? 'bg-raised text-brand-ink font-bold' : 'text-ink-2'
                  }`}
                >
                  <div className="text-[12px] text-ink-3">{d.persianDayName}</div>
                  <div className="font-bold text-sm text-ink tabular-nums">{d.persianDayNum}</div>
                  <div className="text-[11px] text-brand-ink font-medium">{d.persianMonthName}</div>
                </div>
              ))}
            </div>

            {/* سطرهای مربوط به هر اکیپ */}
            <div className="divide-y divide-line">
              {teams.map((team) => {
                const supUser = users.find((u) => u.id === team.supervisorId);
                const supDisplayName = team.supervisorName
                  ? getDisplayName(team.supervisorName)
                  : supUser
                  ? getDisplayName(supUser.name)
                  : undefined;
                const dynamicTeamName = supDisplayName
                  ? `اکیپ نصب ${supDisplayName}`
                  : team.name;

                return (
                  <div key={team.id} className="grid grid-cols-6 min-h-[140px] items-stretch">
                    {/* ستون عنوان اکیپ */}
                    <div className="p-3 border-l border-line bg-sunken flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-sm text-ink flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-brand-ink" />
                          <span>{dynamicTeamName}</span>
                        </div>
                        <span className="text-[11px] font-mono text-ink-2 px-1.5 py-0.5 rounded bg-raised inline-block mt-1">
                          {team.code}
                        </span>
                      </div>
                      {(() => {
                        const cap = getTeamDailyCapacity(team, settings);
                        return (
                          <div className={`text-[12px] ${cap.configured ? 'text-ink-3' : 'text-amber-400 font-bold'}`}>
                            {cap.configured && cap.capacityHours !== null
                              ? `سقف: ${toPersianDigits(cap.capacityHours)} س/روز`
                              : 'ظرفیت نامشخص ⚠️'}
                          </div>
                        );
                      })()}
                    </div>

                    {/* ستون‌های 5 روزه برای این اکیپ */}
                    {displayedDays.map((day) => {
                      const load = calculateTeamDayLoad(team.id, dynamicTeamName, day.dateKey, projects, team, settings);

                      return (
                        <div
                          key={day.dateKey}
                          className={`p-2 border-l last:border-l-0 border-line flex flex-col justify-between ${
                            load.isOverloaded
                              ? 'bg-rose-500/10'
                              : day.isToday
                              ? 'bg-raised/40'
                              : 'bg-surface'
                          }`}
                        >
                          {/* لیست پروژه‌های منتسب به این اکیپ در این روز */}
                          <div className="space-y-1.5 overflow-y-auto max-h-[160px]">
                            {load.assignedProjects.map((p) => {
                              const multiProg = getMultiDayProgress(p, day.dateKey);
                              const dailyHours = getProjectDailyDurationHours(p, day.dateKey);

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => onManageProject(p)}
                                  className="p-2 rounded-md border border-line bg-sunken hover:border-brand transition cursor-pointer text-xs space-y-1 shadow-none group"
                                >
                                  <div className="flex items-center justify-between text-[12px]">
                                    <span className="font-mono font-bold text-brand-ink">
                                      {p.code}
                                    </span>
                                    <StatusPill status={p.status} qcStatus={p.qcStatus} size="sm" />
                                  </div>
                                  <div className="font-semibold text-ink truncate">
                                    {p.title}
                                  </div>

                                  <div className="flex items-center justify-between text-[11px] text-ink-2 pt-1 border-t border-dashed border-line">
                                    {dailyHours > 0 ? (
                                      <span className="font-semibold text-amber-400 tabular-nums">
                                        {toPersianDigits(dailyHours)} ساعت
                                      </span>
                                    ) : (
                                      <span className="text-rose-400 font-bold bg-rose-500/10 px-1 rounded">
                                        بدون تخمین
                                      </span>
                                    )}

                                    {multiProg ? (
                                      <span className="bg-raised text-brand-ink px-1 rounded font-semibold">
                                        {multiProg.badgeText}
                                      </span>
                                    ) : (
                                      <span className="tabular-nums">{toPersianDigits(capacityUnits(projectProductCounts(p)))} لت</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* دکمه افزودن همیشه هست؛ قبلاً فقط وقتی روز خالی بود دیده می‌شد و مأموریت دوم ثبت نمی‌شد */}
                            {canEditSchedule && onNewProject && (
                              <button
                                type="button"
                                onClick={() =>
                                  onNewProject(day.dateKey, { assignedTeamId: team.id, assignedTeamName: dynamicTeamName })
                                }
                                aria-label={`افزودن مأموریت برای ${dynamicTeamName} در ${day.persianDayName}`}
                                className={`w-full border border-dashed border-line hover:border-brand rounded-md flex items-center justify-center text-ink-3 hover:text-brand-ink text-xs transition cursor-pointer ${
                                  load.assignedProjects.length === 0 ? 'h-12' : 'h-8'
                                }`}
                              >
                                {load.assignedProjects.length === 0 ? '+ تخصیص' : '+ مأموریت دیگر'}
                              </button>
                            )}
                          </div>

                          {/* خلاصه بار کاری این اکیپ در این روز */}
                          <div className="pt-1.5 border-t border-line flex items-center justify-between text-[11px]">
                            <span className="text-ink-3">بار کاری:</span>
                            <span
                              className={`font-mono font-bold tabular-nums ${
                                load.isOverloaded
                                  ? 'text-rose-400 font-bold'
                                  : load.totalWorkloadHours > 0
                                  ? 'text-ink'
                                  : 'text-ink-3'
                              }`}
                            >
                              {load.capacityHours !== null
                                ? `${toPersianDigits(load.totalWorkloadHours)} / ${toPersianDigits(load.capacityHours)} س`
                                : `${toPersianDigits(load.totalWorkloadHours)} س (سقف نامشخص)`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ===================== VIEW B: COLUMN GRID VIEWS (4DAYS, 7DAYS, FULL_MONTH) ===================== */
        <div
          className={`grid gap-3 ${
            viewMode === '4DAYS'
              ? 'grid-cols-1 sm:grid-cols-2 @min-[900px]:grid-cols-4'
              : viewMode === '7DAYS'
              ? 'grid-cols-1 sm:grid-cols-2 @min-[900px]:grid-cols-7'
              : 'grid-cols-1 sm:grid-cols-2 @min-[700px]:grid-cols-3 @min-[900px]:grid-cols-6'
          }`}
        >
          {displayedDays.map((day) => {
            const dayProjects = projects.filter((p) => isProjectScheduledOnDate(p, day.dateKey));
            // bookings the customer asked for on this day that have no team yet: shown in the day
            // itself, so the planner sees the day's demand where he assigns it
            const dayBookings = unassignedSalesBookings.filter((b) => b.requestedDate === day.dateKey);
            const totalWorkload = dayProjects.reduce(
              (sum, p) => sum + getProjectDailyDurationHours(p, day.dateKey),
              0
            );

            return (
              <div
                key={day.dateKey}
                className={`rounded-lg border flex flex-col min-h-[300px] transition-all duration-150 ${
                  day.isToday
                    ? 'border-brand bg-surface shadow-none ring-1 ring-brand/40'
                    : 'border-line bg-surface'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 border-b flex items-center justify-between text-xs ${
                    day.isToday
                      ? 'border-line bg-raised text-brand-ink'
                      : 'border-line bg-canvas text-ink-2'
                  }`}
                >
                  <div>
                    <div className="font-medium text-[12px] text-ink-3">{day.persianDayName}</div>
                    <div className="font-bold text-sm text-ink tabular-nums">
                      {day.persianDayNum}
                    </div>
                  </div>

                  <div className="text-left tabular-nums">
                    <span className="text-[12px] text-brand-ink font-medium block">{day.persianMonthName}</span>
                    {totalWorkload > 0 && (
                      <span className="text-[11px] text-amber-400 font-semibold">
                        {toPersianDigits(totalWorkload.toFixed(1))} س کار
                      </span>
                    )}
                  </div>
                </div>

                {/* Projects in Day */}
                <div className="p-2.5 space-y-2 flex-1 overflow-y-auto">
                  {dayProjects.map((proj) => {
                    const multiProg = getMultiDayProgress(proj, day.dateKey);
                    const durationHours = getProjectDailyDurationHours(proj, day.dateKey);

                    return (
                      <div
                        key={proj.id}
                        className="p-3 space-y-2 rounded-md border border-line bg-sunken hover:border-brand shadow-none transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-xs bg-raised text-brand-soft px-2 py-0.5 rounded">
                            {proj.code}
                          </span>
                          <StatusPill status={proj.status} qcStatus={proj.qcStatus} size="sm" />
                        </div>

                        {/* Special Badges: Force Majeure, Warehouse Ready, Special Tools */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {proj.isForceMajeure && (
                            <span className="text-[11px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-0.5">
                              <span>🔥 فورس‌ماژور</span>
                            </span>
                          )}
                          <WarehouseStageBadge project={proj} size="xs" withPrefix />
                          {proj.specialTools && proj.specialTools.length > 0 && (
                            <span className="text-[11px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                              <Wrench className="w-3 h-3 text-amber-400" />
                              <span>{proj.specialTools.join('، ')}</span>
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold text-xs text-ink leading-snug line-clamp-1">
                            {proj.title}
                          </h4>
                          {proj.customerName && proj.customerName !== proj.title && (
                            <p className="text-xs text-ink-2 line-clamp-1">{proj.customerName}</p>
                          )}
                        </div>

                        {/* اکیپ و بار کاری */}
                        <div className="flex items-center justify-between text-xs text-ink-2 bg-canvas p-1.5 rounded-md border border-line">
                          <span className="font-medium text-ink">
                            {proj.assignedTeamName || 'بدون اکیپ'}
                          </span>
                          {durationHours > 0 ? (
                            <span className="font-semibold text-brand-ink tabular-nums">
                              {toPersianDigits(durationHours)} ساعت
                            </span>
                          ) : (
                            <span className="text-[11px] text-rose-400 font-bold bg-rose-500/10 px-1 rounded">
                              بدون تخمین
                            </span>
                          )}
                        </div>

                        {/* اکشن‌ها */}
                        <div className="flex items-center justify-between pt-1 border-t border-line text-xs">
                          {canEditSchedule && onProposeScheduleChange ? (
                            <button
                              type="button"
                              onClick={() => handleOpenProposeModal(proj)}
                              className="text-brand-ink hover:underline font-semibold text-[12px] flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              تغییر برنامه
                            </button>
                          ) : (
                            <span className="text-[11px] text-ink-3 font-mono">
                              {proj.status === 'COMPLETED' ? 'تکمیل‌شده' : 'مأموریت مصوب'}
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            {canEditSchedule && onEditProject && (
                              <button
                                type="button"
                                onClick={() => onEditProject(proj)}
                                className="p-1.5 text-ink-2 hover:text-ink rounded cursor-pointer"
                                title="ویرایش"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onManageProject(proj)}
                              className="p-1.5 text-ink-2 hover:text-brand-ink rounded cursor-pointer"
                              title="مدیریت کامل"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {dayBookings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!canEditSchedule}
                      onClick={() => setAssigningBooking(b)}
                      title="رزرو فروش بدون اکیپ — برای تخصیص بزنید"
                      className="w-full text-right p-2.5 rounded-md border border-dashed border-sky-500/60 bg-sky-500/5 hover:bg-sky-500/10 transition cursor-pointer disabled:cursor-default"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-ink truncate">{b.customerName}</span>
                        <span className="shrink-0 text-[11px] font-bold text-sky-400">رزرو</span>
                      </div>
                      <div className="text-[11px] text-ink-3 mt-0.5">
                        {formatProductCounts(bookingProductCounts(b)) || `${toPersianDigits(b.lathsCount)} لت`}{b.isSmart ? ' · هوشمند' : ''}
                        {canEditSchedule ? ' · تخصیص اکیپ' : ''}
                      </div>
                    </button>
                  ))}

                  {/* دکمه افزودن همیشه هست (قبلاً بعد از اولین مأموریت روز ناپدید می‌شد) */}
                  {canEditSchedule && onNewProject && (
                    <button
                      type="button"
                      onClick={() => onNewProject(day.dateKey)}
                      aria-label={`افزودن مأموریت برای ${day.persianDayName}`}
                      className={`w-full border border-dashed border-line hover:border-brand rounded-md flex items-center justify-center text-ink-3 hover:text-brand-ink text-xs transition cursor-pointer ${
                        dayProjects.length === 0 && dayBookings.length === 0 ? 'py-5' : 'py-2.5'
                      }`}
                    >
                      {dayProjects.length === 0 && dayBookings.length === 0 ? '+ افزودن مأموریت' : '+ مأموریت دیگر'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== MODAL: PROPOSE SCHEDULE CHANGE ===================== */}
      {proposingProject && (
        <Portal><div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-center items-start bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-surface rounded-lg max-w-md w-full shadow-2xl border border-line overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="bg-canvas px-5 py-4 text-ink flex items-center justify-between border-b border-line">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-ink" />
                <h3 className="font-bold text-sm text-ink">پیشنهاد تغییر تاریخ و زمان‌بندی</h3>
              </div>
              <button
                type="button"
                onClick={() => setProposingProject(null)}
                aria-label="بستن"
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-raised text-ink-2 hover:text-ink transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProposal} className="p-5 space-y-4">
              {proposalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-semibold text-rose-300">
                  {proposalError}
                </div>
              )}

              <div className="text-xs text-ink-2">
                پروژه: <span className="font-bold text-ink">{proposingProject.title}</span> (
                <span className="font-mono">{proposingProject.code}</span>)
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  تاریخ شروع پیشنهادی:
                </label>
                <select
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-brand"
                  required
                >
                  {days.map((d) => (
                    <option key={d.dateKey} value={d.dateKey}>
                      {d.persianDayName} {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                    </option>
                  ))}
                </select>
              </div>

              {isProjectMultiDay(proposingProject) && (
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    تاریخ پایان پیشنهادی (پروژه چندروزه):
                  </label>
                  <select
                    value={proposedEndDate}
                    onChange={(e) => setProposedEndDate(e.target.value)}
                    className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-brand"
                  >
                    <option value="">همان روز (تک روزه)</option>
                    {days
                      .filter((d) => d.dateKey >= proposedDate)
                      .map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.persianDayName} {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  اکیپ نصب پیشنهادی:
                </label>
                <select
                  value={proposedTeamId}
                  onChange={(e) => setProposedTeamId(e.target.value)}
                  className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-brand"
                >
                  <option value="">بدون تغییر اکیپ</option>
                  {teams.map((t) => {
                    const supUser = users.find((u) => u.id === t.supervisorId);
                    const supDisplayName = t.supervisorName
                      ? getDisplayName(t.supervisorName)
                      : supUser
                      ? getDisplayName(supUser.name)
                      : undefined;
                    const displayName = supDisplayName ? `اکیپ نصب ${supDisplayName}` : t.name;
                    return (
                      <option key={t.id} value={t.id}>
                        {displayName} ({t.code})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  علت تغییر برنامه (الزامی جهت تایید مدیر QC):
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="علت ضرورت جابه‌جایی تاریخ یا اکیپ را شرح دهید..."
                  rows={3}
                  className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink focus:outline-none focus:border-brand"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button variant="ghost" size="sm" onClick={() => setProposingProject(null)}>
                  انصراف
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSubmittingProposal || changeReason.trim().length < 5}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  {isSubmittingProposal ? 'در حال ارسال…' : 'ارسال درخواست جهت تایید'}
                </Button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}

      {/* ===================== MODAL: REVIEW SCHEDULE REQUEST (QC MANAGER ONLY) ===================== */}
      {reviewingRequest && isQcManager && (
        <Portal><div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-center items-start bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-surface rounded-lg max-w-md w-full shadow-2xl border border-line overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="bg-canvas px-5 py-4 text-ink flex items-center justify-between border-b border-line">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-brand-ink" />
                <h3 className="font-bold text-sm text-ink">بررسی درخواست تغییر برنامه زمان‌بندی</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingRequest(null)}
                aria-label="بستن"
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-raised text-ink-2 hover:text-ink transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-md bg-sunken border border-line space-y-1.5">
                <div>
                  پروژه: <span className="font-bold text-ink">{reviewingRequest.projectTitle}</span> (
                  <span className="font-mono text-brand-ink">{reviewingRequest.projectCode}</span>)
                </div>
                <div>
                  درخواست‌دهنده: <span className="font-semibold text-ink">{reviewingRequest.requestedByUserName}</span>
                </div>
                <div>
                  تغییر تاریخ: از <span className="font-mono text-ink-2">{reviewingRequest.previousScheduledDate}</span> به{' '}
                  <span className="font-mono font-bold text-brand-ink">{reviewingRequest.proposedScheduledDate}</span>
                </div>
                {reviewingRequest.proposedTeamName && (
                  <div>
                    تغییر اکیپ: به <span className="font-semibold text-ink">{reviewingRequest.proposedTeamName}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-dashed border-line text-ink-2">
                  علت ثبت‌شده: «{reviewingRequest.reason}»
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  یادداشت بررسی مدیر QC:
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="توضیحات تایید یا علت رد درخواست..."
                  rows={2}
                  className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isSubmittingReview}
                  onClick={() => handleExecuteReview('REJECTED')}
                  icon={<XCircle className="w-3.5 h-3.5" />}
                >
                  رد درخواست
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingReview}
                  onClick={() => handleExecuteReview('APPROVED')}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  تایید و اعمال در تقویم
                </Button>
              </div>
            </div>
          </div>
        </div></Portal>
      )}

      {/* مودال تخصیص رزرو فروش به تقویم قطعی نصب */}
      {assigningBooking && onNewProject && (
        <AssignSalesBookingModal
          booking={assigningBooking}
          teams={teams}
          users={users}
          onClose={() => setAssigningBooking(null)}
          onConfirm={(scheduledDate, teamId, teamName) => {
            const booking = assigningBooking;
            const daysCount = Math.max(1, Number(booking.allocatedDaysCount) || 1);
            let endDate: string | undefined;
            if (daysCount > 1) {
              const end = new Date(scheduledDate + 'T00:00:00Z');
              end.setUTCDate(end.getUTCDate() + daysCount - 1);
              endDate = end.toISOString().slice(0, 10);
            }

            // فرم ثبت مأموریت با اطلاعات رزرو پر می‌شود. پیوند رزرو فقط «بعد از» ثبت واقعی
            // پروژه انجام می‌شود؛ اگر فرم بدون ذخیره بسته شود، رزرو در سینی باقی می‌ماند.
            onNewProject(
              scheduledDate,
              {
                title: `پروژه ${booking.customerName}`,
                customerName: booking.customerName,
                customerPhone: booking.customerPhone,
                address: booking.address,
                shadePanels: bookingProductCounts(booking).shade,
                railCount: bookingProductCounts(booking).rail,
                curtainPanels: bookingProductCounts(booking).curtain,
                proposalImages: booking.proposalImages?.length ? booking.proposalImages : undefined,
                mechanismType: booking.isSmart ? 'موتور برقی هوشمند سامفی' : 'مکانیزم دستی استاندارد',
                specialNotes: booking.notes ? `[رزرو فروش]: ${booking.notes}` : undefined,
                salesRepName: booking.salesRepName || undefined,
                assignedTeamId: teamId,
                assignedTeamName: teamName,
                endDate,
                status: 'SCHEDULED',
              },
              (project) => {
                linkBookingToInstallationProject(booking.id, project.id, project.scheduledDate, project.assignedTeamId || teamId);
                triggerToast('success', `رزرو «${booking.customerName}» به برنامه نصب منتقل شد.`);
              }
            );
            setAssigningBooking(null);
          }}
        />
      )}
    </div>
  );
};
