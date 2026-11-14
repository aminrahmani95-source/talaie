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
} from 'lucide-react';
import { getUpcomingDays, toPersianDigits, localDateKey } from '../../utils/jalali';
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
  const days = getUpcomingDays(30);
  const isQcManager = currentUser?.role === 'QC_MANAGER';

  // View modes: '4DAYS' | '7DAYS' | 'TIMELINE' | 'FULL_MONTH'
  const [viewMode, setViewMode] = useState<'4DAYS' | '7DAYS' | 'TIMELINE' | 'FULL_MONTH'>('TIMELINE');
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
    return days;
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
      setProposalError('ثبت علت تغییر تاریخ و برنامه (حداقل ۵ کاراکتر) الزامی است.');
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
        title="برنامه‌ریزی و ظرفیت ۴ اکیپ"
        subtitle="مدیریت بار کاری، خطوط زمانی و تخصیص ماموریت‌ها"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={[
                { id: 'TIMELINE', label: 'خط سیر اکیپ‌ها' },
                { id: '4DAYS', label: '۴ روزه' },
                { id: '7DAYS', label: 'هفتگی' },
                { id: 'FULL_MONTH', label: '۳۰ روزه' },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as any)}
              size="sm"
            />

            {(viewMode === '4DAYS' || viewMode === '7DAYS' || viewMode === 'TIMELINE') && (
              <div className="flex items-center gap-1 bg-[#FAF7F2] dark:bg-[#1A1A1A] rounded-xl p-1 border border-[#E2DDD4] dark:border-[#2C2C2C]">
                <button
                  type="button"
                  disabled={startIndex === 0}
                  onClick={() => setStartIndex((i) => Math.max(0, i - 1))}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg disabled:opacity-30 transition cursor-pointer"
                  title="روزهای قبلی"
                  aria-label="روزهای قبلی"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 text-[#8E6F27] dark:text-[#E5CA8F] font-bold">
                  {toPersianDigits(startIndex + 1)} تا{' '}
                  {toPersianDigits(
                    Math.min(
                      days.length,
                      startIndex + (viewMode === '4DAYS' ? 4 : viewMode === '7DAYS' ? 7 : 5)
                    )
                  )}
                </span>
                <button
                  type="button"
                  disabled={startIndex + (viewMode === '4DAYS' ? 4 : viewMode === '7DAYS' ? 7 : 5) >= days.length}
                  onClick={() =>
                    setStartIndex((i) =>
                      Math.min(
                        days.length - (viewMode === '4DAYS' ? 4 : viewMode === '7DAYS' ? 7 : 5),
                        i + 1
                      )
                    )
                  }
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg disabled:opacity-30 transition cursor-pointer"
                  title="روزهای بعدی"
                  aria-label="روزهای بعدی"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

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
        <div className="rounded-2xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/20 p-4 transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-300">
                  {conflicts.length > 0 && `${toPersianDigits(conflicts.length)} مورد تداخل و خطای ظرفیت`}
                  {conflicts.length > 0 && pendingRequests.length > 0 && ' | '}
                  {pendingRequests.length > 0 && `${toPersianDigits(pendingRequests.length)} درخواست تغییر زمان‌بندی`}
                </h3>
                <p className="text-[11px] text-amber-800 dark:text-amber-400">
                  تخصیص‌های متداخل یا بیش از ظرفیت اکیپ‌ها شناسایی شده است.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAlertsOpen((prev) => !prev)}
              className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {isAlertsOpen ? 'بستن لیست' : 'مشاهده جزئیات'}
              {isAlertsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {isAlertsOpen && (
            <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/60 space-y-2">
              {/* تداخلات */}
              {conflicts.map((c) => (
                <div
                  key={c.id}
                  className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-3 ${
                    c.severity === 'ERROR'
                      ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold shrink-0">{c.projectTitle}:</span>
                    <span className="truncate">{c.message}</span>
                  </div>
                  <span className="text-[10px] font-mono shrink-0 opacity-75">{c.dateKey}</span>
                </div>
              ))}

              {/* درخواست‌های تغییر برنامه */}
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 rounded-xl text-xs bg-blue-500/10 text-blue-900 dark:text-blue-300 border border-blue-500/30 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ArrowRightLeft className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold">{req.projectTitle}:</span>
                    <span className="truncate">
                      درخواست انتقال از {req.previousScheduledDate} به {req.proposedScheduledDate} — علت: {req.reason}
                    </span>
                  </div>
                  {isQcManager && (
                    <button
                      onClick={() => setReviewingRequest(req)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition shrink-0 cursor-pointer"
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
          <div className="rounded-2xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] overflow-hidden shadow-sm">
            {/* سرستون روزهای خط سیر */}
            <div className="grid grid-cols-6 border-b border-[#E2DDD4] dark:border-[#2C2C2C] bg-[#FAF7F2] dark:bg-[#141414] text-xs font-bold">
              <div className="p-3 text-neutral-500 flex items-center justify-center border-l border-[#E2DDD4] dark:border-[#2C2C2C]">
                اکیپ‌های ۴ گانه نصب
              </div>
              {displayedDays.map((d) => (
                <div
                  key={d.dateKey}
                  className={`p-3 text-center border-l last:border-l-0 border-[#E2DDD4] dark:border-[#2C2C2C] ${
                    d.isToday ? 'bg-[#C1A056]/15 text-[#8E6F27] dark:text-[#E5CA8F]' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="text-[11px] text-neutral-400">{d.persianDayName}</div>
                  <div className="font-black text-sm">{d.persianDayNum}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">{d.dateKey.slice(5)}</div>
                </div>
              ))}
            </div>

            {/* سطرهای مربوط به هر اکیپ */}
            <div className="divide-y divide-[#E2DDD4] dark:divide-[#2C2C2C]">
              {teams.map((team) => {
                return (
                  <div key={team.id} className="grid grid-cols-6 min-h-[140px] items-stretch">
                    {/* ستون عنوان اکیپ */}
                    <div className="p-3 border-l border-[#E2DDD4] dark:border-[#2C2C2C] bg-[#FAF8F5]/60 dark:bg-[#161616]/60 flex flex-col justify-between">
                      <div>
                        <div className="font-black text-sm text-[#212121] dark:text-white flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-[#C1A056]" />
                          <span>{team.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 px-1 py-0.5 rounded bg-black/5 dark:bg-white/5 inline-block mt-1">
                          {team.code}
                        </span>
                      </div>
                      {(() => {
                        const cap = getTeamDailyCapacity(team, settings);
                        return (
                          <div className={`text-[11px] ${cap.configured ? 'text-neutral-400' : 'text-amber-600 dark:text-amber-400 font-bold'}`}>
                            {cap.configured && cap.capacityHours !== null
                              ? `سقف: ${toPersianDigits(cap.capacityHours)} س/روز`
                              : 'ظرفیت نامشخص ⚠️'}
                          </div>
                        );
                      })()}
                    </div>

                    {/* ستون‌های ۵ روزه برای این اکیپ */}
                    {displayedDays.map((day) => {
                      const load = calculateTeamDayLoad(team.id, team.name, day.dateKey, projects, team, settings);

                      return (
                        <div
                          key={day.dateKey}
                          className={`p-2 border-l last:border-l-0 border-[#E2DDD4] dark:border-[#2C2C2C] flex flex-col justify-between ${
                            load.isOverloaded
                              ? 'bg-rose-500/5'
                              : day.isToday
                              ? 'bg-[#C1A056]/5'
                              : 'bg-white dark:bg-[#1A1A1A]'
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
                                  className="p-2 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-[#FAF8F5] dark:bg-[#181818] hover:border-[#C1A056] transition cursor-pointer text-xs space-y-1 shadow-2xs group"
                                >
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-mono font-black text-[#8E6F27] dark:text-[#E5CA8F]">
                                      {p.code}
                                    </span>
                                    <StatusPill status={p.status} qcStatus={p.qcStatus} size="sm" />
                                  </div>
                                  <div className="font-bold text-[#181818] dark:text-[#F5F3EF] truncate">
                                    {p.title}
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-dashed border-neutral-200 dark:border-neutral-800">
                                    {dailyHours > 0 ? (
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {toPersianDigits(dailyHours)} ساعت
                                      </span>
                                    ) : (
                                      <span className="text-rose-600 font-bold bg-rose-500/10 px-1 rounded">
                                        بدون تخمین
                                      </span>
                                    )}

                                    {multiProg ? (
                                      <span className="bg-[#C1A056]/20 text-[#8E6F27] dark:text-[#E5CA8F] px-1 rounded font-bold">
                                        {multiProg.badgeText}
                                      </span>
                                    ) : (
                                      <span>{toPersianDigits(p.shadePanels + p.curtainPanels)} لت</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {load.assignedProjects.length === 0 && (
                              <button
                                onClick={() => onNewProject(day.dateKey)}
                                className="w-full h-14 border border-dashed border-neutral-300 dark:border-neutral-800 hover:border-[#C1A056] rounded-xl flex items-center justify-center text-neutral-400 hover:text-[#C1A056] text-xs transition cursor-pointer"
                              >
                                + تخصیص
                              </button>
                            )}
                          </div>

                          {/* خلاصه بار کاری این اکیپ در این روز */}
                          <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[10px]">
                            <span className="text-neutral-400">بار کاری:</span>
                            <span
                              className={`font-mono font-bold ${
                                load.isOverloaded
                                  ? 'text-rose-600 font-black'
                                  : load.totalWorkloadHours > 0
                                  ? 'text-neutral-700 dark:text-neutral-300'
                                  : 'text-neutral-400'
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
                className={`rounded-2xl border flex flex-col min-h-[300px] transition-all duration-150 ${
                  day.isToday
                    ? 'border-[#C1A056] bg-[#C1A056]/5 shadow-sm'
                    : 'border-[#E2DDD4] dark:border-[#2C2C2C] bg-[#FAF7F2] dark:bg-[#161616]'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 border-b flex items-center justify-between text-xs ${
                    day.isToday
                      ? 'border-[#C1A056]/40 bg-[#C1A056]/10 text-[#8E6F27] dark:text-[#E5CA8F]'
                      : 'border-[#E2DDD4] dark:border-[#262626] text-[#69655F] dark:text-[#9E988D]'
                  }`}
                >
                  <div>
                    <div className="font-bold">{day.persianDayName}</div>
                    <div className="font-black text-sm text-[#181818] dark:text-white">
                      {day.persianDayNum}
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-[11px] block">{day.dateKey.slice(5)}</span>
                    {totalWorkload > 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
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
                        className="p-3 space-y-2 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] hover:border-[#C1A056] shadow-2xs transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-black text-xs bg-[#212121] text-[#E5CA8F] px-2 py-0.5 rounded-md">
                            {proj.code}
                          </span>
                          <StatusPill status={proj.status} qcStatus={proj.qcStatus} size="sm" />
                        </div>

                        <div>
                          <h4 className="font-bold text-xs text-[#181818] dark:text-[#F5F3EF] leading-snug line-clamp-1">
                            {proj.title}
                          </h4>
                          <p className="text-xs text-neutral-500 line-clamp-1">{proj.customerName}</p>
                        </div>

                        {/* اکیپ و بار کاری */}
                        <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/60 p-1.5 rounded-lg">
                          <span className="font-bold text-neutral-700 dark:text-neutral-300">
                            {proj.assignedTeamName || 'بدون اکیپ'}
                          </span>
                          {durationHours > 0 ? (
                            <span className="font-bold text-[#8E6F27] dark:text-[#E5CA8F]">
                              {toPersianDigits(durationHours)} ساعت
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-500/10 px-1 rounded">
                              بدون تخمین
                            </span>
                          )}
                        </div>

                        {/* اکشن‌ها */}
                        <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                          <button
                            type="button"
                            onClick={() => handleOpenProposeModal(proj)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            تغییر برنامه
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditProject(proj)}
                              className="p-1.5 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded-lg cursor-pointer"
                              title="ویرایش"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onManageProject(proj)}
                              className="p-1.5 text-neutral-400 hover:text-[#C1A056] rounded-lg cursor-pointer"
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
                      className="w-full py-6 border border-dashed border-neutral-300 dark:border-neutral-800 hover:border-[#C1A056] rounded-xl flex items-center justify-center text-neutral-400 hover:text-[#C1A056] text-xs transition cursor-pointer"
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
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-md w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#212121] px-5 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#C1A056]" />
                <h3 className="font-black text-sm text-white">پیشنهاد تغییر تاریخ و زمان‌بندی</h3>
              </div>
              <button
                type="button"
                onClick={() => setProposingProject(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProposal} className="p-5 space-y-4">
              {proposalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {proposalError}
                </div>
              )}

              <div className="text-xs text-neutral-500">
                پروژه: <span className="font-bold text-[#212121] dark:text-white">{proposingProject.title}</span> (
                <span className="font-mono">{proposingProject.code}</span>)
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  تاریخ شروع پیشنهادی:
                </label>
                <select
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-xs text-[#212121] dark:text-white"
                  required
                >
                  {days.map((d) => (
                    <option key={d.dateKey} value={d.dateKey}>
                      {d.persianDayName} {d.persianDayNum} ({d.dateKey})
                    </option>
                  ))}
                </select>
              </div>

              {isProjectMultiDay(proposingProject) && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    تاریخ پایان پیشنهادی (پروژه چندروزه):
                  </label>
                  <select
                    value={proposedEndDate}
                    onChange={(e) => setProposedEndDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-xs text-[#212121] dark:text-white"
                  >
                    <option value="">همان روز (تک روزه)</option>
                    {days
                      .filter((d) => d.dateKey >= proposedDate)
                      .map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.persianDayName} {d.persianDayNum} ({d.dateKey})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  اکیپ نصب پیشنهادی:
                </label>
                <select
                  value={proposedTeamId}
                  onChange={(e) => setProposedTeamId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-xs text-[#212121] dark:text-white"
                >
                  <option value="">بدون تغییر اکیپ</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  علت تغییر برنامه (الزامی جهت تایید مدیر QC):
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="علت ضرورت جابه‌جایی تاریخ یا اکیپ را شرح دهید..."
                  rows={3}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-xs text-[#212121] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C1A056]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
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
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-md w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#212121] px-5 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#C1A056]" />
                <h3 className="font-black text-sm text-white">بررسی درخواست تغییر برنامه زمان‌بندی</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingRequest(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div>
                  پروژه: <span className="font-bold">{reviewingRequest.projectTitle}</span> (
                  <span className="font-mono">{reviewingRequest.projectCode}</span>)
                </div>
                <div>
                  درخواست‌دهنده: <span className="font-bold">{reviewingRequest.requestedByUserName}</span>
                </div>
                <div>
                  تغییر تاریخ: از <span className="font-mono">{reviewingRequest.previousScheduledDate}</span> به{' '}
                  <span className="font-mono font-bold text-blue-600">{reviewingRequest.proposedScheduledDate}</span>
                </div>
                {reviewingRequest.proposedTeamName && (
                  <div>
                    تغییر اکیپ: به <span className="font-bold">{reviewingRequest.proposedTeamName}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-dashed border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                  علت ثبت‌شده: «{reviewingRequest.reason}»
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  یادداشت بررسی مدیر QC:
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="توضیحات تایید یا علت رد درخواست..."
                  rows={2}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-xs text-[#212121] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
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
