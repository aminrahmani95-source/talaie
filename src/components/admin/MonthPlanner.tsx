import React, { useState, useMemo } from 'react';
import {
  Project,
  User,
  SystemSettings,
  InstallationTeam,
  ScheduleChangeRequest,
} from '../../types';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Settings2,
  ChevronRight,
  ChevronLeft,
  FileText,
  Ruler,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  XCircle,
  Send,
  ArrowRightLeft,
  Wrench,
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

interface Props {
  projects: Project[];
  users: User[];
  teams?: InstallationTeam[];
  currentUser?: User;
  settings: SystemSettings;
  scheduleChangeRequests?: ScheduleChangeRequest[];
  onUpdateSettings?: (settings: SystemSettings) => void;
  onNewProject: (dateKey?: string) => void;
  onEditProject: (project: Project) => void;
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
  const isQcManager = currentUser?.role === 'QC_MANAGER';

  // View modes: '4DAYS' | '7DAYS' | 'TIMELINE' | 'FULL_MONTH'
  const [viewMode, setViewMode] = useState<'4DAYS' | '7DAYS' | 'TIMELINE' | 'FULL_MONTH'>('4DAYS');
  const [startIndex, setStartIndex] = useState(0);
  const [isAlertsOpen, setIsAlertsOpen] = useState(true);

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
        title="برنامه‌ریزی و ظرفیت 4 اکیپ"
        subtitle="مدیریت بار کاری، خطوط زمانی و تخصیص ماموریت‌ها"
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
                <div className="flex items-center gap-1 bg-[#111620] rounded-md p-1 border border-[#212835]">
                  <button
                    type="button"
                    disabled={startIndex === 0}
                    onClick={() => setStartIndex((i) => Math.max(0, i - step))}
                    className="p-1.5 hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] rounded disabled:opacity-30 transition cursor-pointer"
                    title="روزهای قبلی"
                    aria-label="روزهای قبلی"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs px-2 text-[#C5A059] font-bold tabular-nums">
                    {toPersianDigits(startIndex + 1)} تا{' '}
                    {toPersianDigits(Math.min(days.length, startIndex + pageSize))}
                  </span>
                  <button
                    type="button"
                    disabled={startIndex + pageSize >= days.length}
                    onClick={() =>
                      setStartIndex((i) => Math.min(days.length - pageSize, i + step))
                    }
                    className="p-1.5 hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] rounded disabled:opacity-30 transition cursor-pointer"
                    title="روزهای بعدی"
                    aria-label="روزهای بعدی"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              );
            })()}

            <Button
              variant="primary"
              size="sm"
              onClick={() => onNewProject()}
              icon={<Plus className="w-4 h-4" />}
            >
              پروژه جدید
            </Button>
          </div>
        }
      />

      {/* بنر تداخلات و هشدارهای برنامه‌ریزی (Conflict & Alerts Banner) */}
      {(conflicts.length > 0 || pendingRequests.length > 0) && (
        <div className="rounded-lg border border-amber-500/30 bg-[#241A0E] p-4 transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-amber-300">
                  {conflicts.length > 0 && `${toPersianDigits(conflicts.length)} مورد تداخل و خطای ظرفیت`}
                  {conflicts.length > 0 && pendingRequests.length > 0 && ' | '}
                  {pendingRequests.length > 0 && `${toPersianDigits(pendingRequests.length)} درخواست تغییر زمان‌بندی`}
                </h3>
                <p className="text-[11px] text-amber-400/80">
                  تخصیص‌های متداخل یا بیش از ظرفیت اکیپ‌ها شناسایی شده است.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAlertsOpen((prev) => !prev)}
              className="text-xs font-semibold text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {isAlertsOpen ? 'بستن لیست' : 'مشاهده جزئیات'}
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
                  <span className="text-[10px] font-mono shrink-0 opacity-75">{formatJalali(c.dateKey)}</span>
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
                      className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition shrink-0 cursor-pointer"
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
          <div className="rounded-lg border border-[#212835] bg-[#151B23] overflow-hidden shadow-none">
            {/* سرستون روزهای خط سیر */}
            <div className="grid grid-cols-6 border-b border-[#212835] bg-[#0D1117] text-xs font-semibold">
              <div className="p-3 text-[#9BA7B6] flex items-center justify-center border-l border-[#212835]">
                اکیپ‌های 4 گانه نصب
              </div>
              {displayedDays.map((d) => (
                <div
                  key={d.dateKey}
                  className={`p-3 text-center border-l last:border-l-0 border-[#212835] ${
                    d.isToday ? 'bg-[#1C232D] text-[#C5A059] font-bold' : 'text-[#9BA7B6]'
                  }`}
                >
                  <div className="text-[11px] text-[#637184]">{d.persianDayName}</div>
                  <div className="font-bold text-sm text-[#F0F4F8] tabular-nums">{d.persianDayNum}</div>
                  <div className="text-[10px] text-[#C5A059] font-medium">{d.persianMonthName}</div>
                </div>
              ))}
            </div>

            {/* سطرهای مربوط به هر اکیپ */}
            <div className="divide-y divide-[#212835]">
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
                    <div className="p-3 border-l border-[#212835] bg-[#111620] flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-sm text-[#F0F4F8] flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-[#C5A059]" />
                          <span>{dynamicTeamName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#9BA7B6] px-1.5 py-0.5 rounded bg-[#1C232D] inline-block mt-1">
                          {team.code}
                        </span>
                      </div>
                      {(() => {
                        const cap = getTeamDailyCapacity(team, settings);
                        return (
                          <div className={`text-[11px] ${cap.configured ? 'text-[#637184]' : 'text-amber-400 font-bold'}`}>
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
                          className={`p-2 border-l last:border-l-0 border-[#212835] flex flex-col justify-between ${
                            load.isOverloaded
                              ? 'bg-rose-500/10'
                              : day.isToday
                              ? 'bg-[#1C232D]/40'
                              : 'bg-[#151B23]'
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
                                  className="p-2 rounded-md border border-[#212835] bg-[#111620] hover:border-[#C5A059] transition cursor-pointer text-xs space-y-1 shadow-none group"
                                >
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-mono font-bold text-[#C5A059]">
                                      {p.code}
                                    </span>
                                    <StatusPill status={p.status} qcStatus={p.qcStatus} size="sm" />
                                  </div>
                                  <div className="font-semibold text-[#F0F4F8] truncate">
                                    {p.title}
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-[#9BA7B6] pt-1 border-t border-dashed border-[#212835]">
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
                                      <span className="bg-[#1C232D] text-[#C5A059] px-1 rounded font-semibold">
                                        {multiProg.badgeText}
                                      </span>
                                    ) : (
                                      <span className="tabular-nums">{toPersianDigits(p.shadePanels + p.curtainPanels)} لت</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {load.assignedProjects.length === 0 && (
                              <button
                                onClick={() => onNewProject(day.dateKey)}
                                className="w-full h-12 border border-dashed border-[#212835] hover:border-[#C5A059] rounded-md flex items-center justify-center text-[#637184] hover:text-[#C5A059] text-xs transition cursor-pointer"
                              >
                                + تخصیص
                              </button>
                            )}
                          </div>

                          {/* خلاصه بار کاری این اکیپ در این روز */}
                          <div className="pt-1.5 border-t border-[#212835] flex items-center justify-between text-[10px]">
                            <span className="text-[#637184]">بار کاری:</span>
                            <span
                              className={`font-mono font-bold tabular-nums ${
                                load.isOverloaded
                                  ? 'text-rose-400 font-bold'
                                  : load.totalWorkloadHours > 0
                                  ? 'text-[#F0F4F8]'
                                  : 'text-[#637184]'
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
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : viewMode === '7DAYS'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
          }`}
        >
          {displayedDays.map((day) => {
            const dayProjects = projects.filter((p) => isProjectScheduledOnDate(p, day.dateKey));
            const totalWorkload = dayProjects.reduce(
              (sum, p) => sum + getProjectDailyDurationHours(p, day.dateKey),
              0
            );

            return (
              <div
                key={day.dateKey}
                className={`rounded-lg border flex flex-col min-h-[300px] transition-all duration-150 ${
                  day.isToday
                    ? 'border-[#C5A059] bg-[#151B23] shadow-none ring-1 ring-[#C5A059]/40'
                    : 'border-[#212835] bg-[#151B23]'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 border-b flex items-center justify-between text-xs ${
                    day.isToday
                      ? 'border-[#212835] bg-[#1C232D] text-[#C5A059]'
                      : 'border-[#212835] bg-[#0D1117] text-[#9BA7B6]'
                  }`}
                >
                  <div>
                    <div className="font-medium text-[11px] text-[#637184]">{day.persianDayName}</div>
                    <div className="font-bold text-sm text-[#F0F4F8] tabular-nums">
                      {day.persianDayNum}
                    </div>
                  </div>

                  <div className="text-left tabular-nums">
                    <span className="text-[11px] text-[#C5A059] font-medium block">{day.persianMonthName}</span>
                    {totalWorkload > 0 && (
                      <span className="text-[10px] text-amber-400 font-semibold">
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
                        className="p-3 space-y-2 rounded-md border border-[#212835] bg-[#111620] hover:border-[#C5A059] shadow-none transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-xs bg-[#1C232D] text-[#E5CA8F] px-2 py-0.5 rounded">
                            {proj.code}
                          </span>
                          <StatusPill status={proj.status} qcStatus={proj.qcStatus} size="sm" />
                        </div>

                        {/* Special Badges: Force Majeure, Warehouse Ready, Special Tools */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {proj.isForceMajeure && (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-0.5">
                              <span>🔥 فورس‌ماژور</span>
                            </span>
                          )}
                          {proj.warehousePrep?.isPackedAndReady && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>بار آماده ✅</span>
                            </span>
                          )}
                          {proj.specialTools && proj.specialTools.length > 0 && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                              <Wrench className="w-3 h-3 text-amber-400" />
                              <span>{proj.specialTools.join('، ')}</span>
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold text-xs text-[#F0F4F8] leading-snug line-clamp-1">
                            {proj.title}
                          </h4>
                          <p className="text-xs text-[#9BA7B6] line-clamp-1">{proj.customerName}</p>
                        </div>

                        {/* اکیپ و بار کاری */}
                        <div className="flex items-center justify-between text-xs text-[#9BA7B6] bg-[#0D1117] p-1.5 rounded-md border border-[#212835]">
                          <span className="font-medium text-[#F0F4F8]">
                            {proj.assignedTeamName || 'بدون اکیپ'}
                          </span>
                          {durationHours > 0 ? (
                            <span className="font-semibold text-[#C5A059] tabular-nums">
                              {toPersianDigits(durationHours)} ساعت
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1 rounded">
                              بدون تخمین
                            </span>
                          )}
                        </div>

                        {/* اکشن‌ها */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#212835] text-xs">
                          <button
                            type="button"
                            onClick={() => handleOpenProposeModal(proj)}
                            className="text-[#C5A059] hover:underline font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            تغییر برنامه
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditProject(proj)}
                              className="p-1.5 text-[#9BA7B6] hover:text-[#F0F4F8] rounded cursor-pointer"
                              title="ویرایش"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onManageProject(proj)}
                              className="p-1.5 text-[#9BA7B6] hover:text-[#C5A059] rounded cursor-pointer"
                              title="مدیریت کامل"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {dayProjects.length === 0 && (
                    <button
                      onClick={() => onNewProject(day.dateKey)}
                      className="w-full py-5 border border-dashed border-[#212835] hover:border-[#C5A059] rounded-md flex items-center justify-center text-[#637184] hover:text-[#C5A059] text-xs transition cursor-pointer"
                    >
                      + افزودن مأموریت
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
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-[#151B23] rounded-lg max-w-md w-full shadow-2xl border border-[#212835] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#0D1117] px-5 py-4 text-[#F0F4F8] flex items-center justify-between border-b border-[#212835]">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#C5A059]" />
                <h3 className="font-bold text-sm text-[#F0F4F8]">پیشنهاد تغییر تاریخ و زمان‌بندی</h3>
              </div>
              <button
                type="button"
                onClick={() => setProposingProject(null)}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
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

              <div className="text-xs text-[#9BA7B6]">
                پروژه: <span className="font-bold text-[#F0F4F8]">{proposingProject.title}</span> (
                <span className="font-mono">{proposingProject.code}</span>)
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F0F4F8] mb-1">
                  تاریخ شروع پیشنهادی:
                </label>
                <select
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  className="w-full rounded-md border border-[#212835] bg-[#0D1117] px-3 py-2 text-xs text-[#F0F4F8] focus:border-[#C5A059]"
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
                  <label className="block text-xs font-semibold text-[#F0F4F8] mb-1">
                    تاریخ پایان پیشنهادی (پروژه چندروزه):
                  </label>
                  <select
                    value={proposedEndDate}
                    onChange={(e) => setProposedEndDate(e.target.value)}
                    className="w-full rounded-md border border-[#212835] bg-[#0D1117] px-3 py-2 text-xs text-[#F0F4F8] focus:border-[#C5A059]"
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
                <label className="block text-xs font-semibold text-[#F0F4F8] mb-1">
                  اکیپ نصب پیشنهادی:
                </label>
                <select
                  value={proposedTeamId}
                  onChange={(e) => setProposedTeamId(e.target.value)}
                  className="w-full rounded-md border border-[#212835] bg-[#0D1117] px-3 py-2 text-xs text-[#F0F4F8] focus:border-[#C5A059]"
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
                <label className="block text-xs font-semibold text-[#F0F4F8] mb-1">
                  علت تغییر برنامه (الزامی جهت تایید مدیر QC):
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="علت ضرورت جابه‌جایی تاریخ یا اکیپ را شرح دهید..."
                  rows={3}
                  className="w-full rounded-md border border-[#212835] bg-[#0D1117] px-3 py-2 text-xs text-[#F0F4F8] focus:outline-none focus:border-[#C5A059]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
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
        </div>
      )}

      {/* ===================== MODAL: REVIEW SCHEDULE REQUEST (QC MANAGER ONLY) ===================== */}
      {reviewingRequest && isQcManager && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-[#151B23] rounded-lg max-w-md w-full shadow-2xl border border-[#212835] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#0D1117] px-5 py-4 text-[#F0F4F8] flex items-center justify-between border-b border-[#212835]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#C5A059]" />
                <h3 className="font-bold text-sm text-[#F0F4F8]">بررسی درخواست تغییر برنامه زمان‌بندی</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingRequest(null)}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-md bg-[#111620] border border-[#212835] space-y-1.5">
                <div>
                  پروژه: <span className="font-bold text-[#F0F4F8]">{reviewingRequest.projectTitle}</span> (
                  <span className="font-mono text-[#C5A059]">{reviewingRequest.projectCode}</span>)
                </div>
                <div>
                  درخواست‌دهنده: <span className="font-semibold text-[#F0F4F8]">{reviewingRequest.requestedByUserName}</span>
                </div>
                <div>
                  تغییر تاریخ: از <span className="font-mono text-[#9BA7B6]">{reviewingRequest.previousScheduledDate}</span> به{' '}
                  <span className="font-mono font-bold text-[#C5A059]">{reviewingRequest.proposedScheduledDate}</span>
                </div>
                {reviewingRequest.proposedTeamName && (
                  <div>
                    تغییر اکیپ: به <span className="font-semibold text-[#F0F4F8]">{reviewingRequest.proposedTeamName}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-dashed border-[#212835] text-[#9BA7B6]">
                  علت ثبت‌شده: «{reviewingRequest.reason}»
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F0F4F8] mb-1">
                  یادداشت بررسی مدیر QC:
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="توضیحات تایید یا علت رد درخواست..."
                  rows={2}
                  className="w-full rounded-md border border-[#212835] bg-[#0D1117] px-3 py-2 text-xs text-[#F0F4F8] focus:border-[#C5A059]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
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
        </div>
      )}
    </div>
  );
};
