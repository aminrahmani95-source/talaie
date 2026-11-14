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
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Users,
  ShieldCheck,
  ChevronLeft,
  Flame,
  AlertCircle,
  FileText,
  Layers,
  BarChart3,
  Star,
  Package,
  TrendingUp,
  Percent,
  Wrench,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString, localDateKey } from '../../utils/jalali';
import { isProjectMultiDay, isProjectScheduledOnDate } from '../../utils/multiDay';
import { buildTeamOperationalStatuses, detectScheduleConflicts } from '../../utils/capacity';
import { computeSlaMetrics } from '../../utils/sla';

export interface OperationsControlCenterProps {
  currentUser: User;
  projects: Project[];
  users: User[];
  tickets: Ticket[];
  teamsWithMembers: InstallationTeamWithMembers[];
  scheduleChangeRequests: ScheduleChangeRequest[];
  materialRequests?: MaterialRequest[];
  settings?: SystemSettings | null;
  onNavigateTab: (tab: 'planner' | 'technicians' | 'tickets' | 'qc' | 'stuck') => void;
  onOpenProject: (project: Project) => void;
  onOpenScheduleRequests?: () => void;
  onReviewScheduleRequest?: (request: ScheduleChangeRequest) => void;
}

export const OperationsControlCenter: React.FC<OperationsControlCenterProps> = ({
  currentUser,
  projects,
  users: _users,
  tickets,
  teamsWithMembers,
  scheduleChangeRequests,
  materialRequests = [],
  settings,
  onNavigateTab,
  onOpenProject,
  onOpenScheduleRequests,
  onReviewScheduleRequest,
}) => {
  const [activeSubView, setActiveSubView] = useState<'LIVE' | 'ANALYTICS'>('LIVE');
  const isQcManager = currentUser.role === 'QC_MANAGER';
  const todayKey = useMemo(() => localDateKey(new Date()), []);
  const todayPersian = useMemo(() => getTodayPersianString(), []);

  // ۱. شاخص‌های چرخه عمر پروژه‌ها
  const projectMetrics = useMemo(() => {
    let readyToSchedule = 0; // دارای تاییدیه‌های تولید و انبار اما بدون تاریخ
    let scheduled = 0;
    let inProgress = 0;
    let multiDayActive = 0;
    let overdueProjects = 0;
    let awaitingQc = 0;
    let completed = 0;

    for (const p of projects) {
      if (p.status === 'MEASUREMENT_PENDING') {
        if (p.technicalHandover?.isHandoverComplete) {
          readyToSchedule++;
        }
      } else if (p.status === 'SCHEDULED') {
        scheduled++;
        if (p.scheduledDate && p.scheduledDate < todayKey) {
          overdueProjects++;
        }
      } else if (p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS' || p.status === 'PAUSED') {
        inProgress++;
        if (isProjectMultiDay(p)) {
          multiDayActive++;
        }
        if (p.endDate && p.endDate < todayKey) {
          overdueProjects++;
        }
      } else if (p.status === 'COMPLETED') {
        if (p.qcStatus === 'PENDING' || p.qcStatus === 'NOT_STARTED') {
          awaitingQc++;
        } else if (p.qcStatus === 'APPROVED') {
          completed++;
        }
      }
    }

    return {
      readyToSchedule,
      scheduled,
      inProgress,
      multiDayActive,
      overdueProjects,
      awaitingQc,
      completed,
    };
  }, [projects, todayKey]);

  // ۲. وضعیت عملیاتی ۴ اکیپ نصب
  const teamStatuses = useMemo(() => {
    return buildTeamOperationalStatuses(
      teamsWithMembers,
      projects,
      todayKey,
      settings
    );
  }, [teamsWithMembers, projects, todayKey, settings]);

  // ۳. شاخص‌های تیکت و SLA هفتاد و دو ساعته
  const slaMetrics = useMemo(() => {
    return computeSlaMetrics(tickets);
  }, [tickets]);

  // ۴. تداخلات برنامه‌ریزی
  const conflicts = useMemo(() => {
    const rawTeams = teamsWithMembers.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      dailyCapacityHours: t.dailyCapacityHours,
      workingDays: t.workingDays,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    return detectScheduleConflicts(projects, rawTeams, settings);
  }, [projects, teamsWithMembers, settings]);

  // ۵. تیکت‌های مسدودکننده (Blocking)
  const blockingTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'OPEN' && t.isBlocking);
  }, [tickets]);

  // ۶. درخواست‌های در انتظار تغییر برنامه
  const pendingScheduleRequests = useMemo(() => {
    return scheduleChangeRequests.filter((r) => r.status === 'PENDING');
  }, [scheduleChangeRequests]);

  // ۷. گزارش‌های روزانه مفقود (پروژه‌های چندروزه فعال که امروز لاگ ثبت نکرده‌اند)
  const missingDailyLogs = useMemo(() => {
    return projects.filter((p) => {
      if (!isProjectMultiDay(p)) return false;
      if (p.status !== 'IN_PROGRESS' && p.status !== 'PAUSED') return false;
      if (!isProjectScheduledOnDate(p, todayKey)) return false;
      const logsToday = (p.dailyLogs || []).filter((l) => l.date === todayKey);
      return logsToday.length === 0;
    });
  }, [projects, todayKey]);

  // ۸. شاخص‌های تحلیلی و هوش عملیاتی فاز P4 (Operational Intelligence & Analytics)
  const analytics = useMemo(() => {
    // الف) کنترل کیفیت
    const inspectedProjects = projects.filter(
      (p) => p.qcStatus === 'APPROVED' || (p.qcInspections && p.qcInspections.length > 0)
    );
    const approvedProjects = projects.filter((p) => p.qcStatus === 'APPROVED');
    const scoredProjects = approvedProjects.filter((p) => p.qcScore && p.qcScore > 0);
    const avgQcScore =
      scoredProjects.length > 0
        ? scoredProjects.reduce((sum, p) => sum + (p.qcScore || 0), 0) / scoredProjects.length
        : 0;

    // نرخ قبولی نوبت اول (First-Time Pass Rate)
    const firstTimePassCount = projects.filter((p) => {
      if (!p.qcInspections || p.qcInspections.length === 0) return false;
      return p.qcInspections[0].result === 'PASS';
    }).length;
    const firstTimePassRate =
      inspectedProjects.length > 0
        ? Math.round((firstTimePassCount / inspectedProjects.length) * 100)
        : 0;

    // فراوانی عیوب بر حسب دسته‌بندی
    const defectCounts: Record<string, number> = {
      LEVELING: 0,
      FABRIC: 0,
      MOTOR_REMOTE: 0,
      HARDWARE: 0,
      CLEANLINESS: 0,
      DAMAGE: 0,
      OTHER: 0,
    };
    let totalDefectsCount = 0;
    let resolvedDefectsCount = 0;

    for (const p of projects) {
      for (const d of p.qcDefects || []) {
        totalDefectsCount++;
        const cat = d.category || 'OTHER';
        defectCounts[cat] = (defectCounts[cat] || 0) + 1;
        if (d.status === 'RESOLVED' || d.status === 'VERIFIED') {
          resolvedDefectsCount++;
        }
      }
    }

    // ب) حجم کار و لت‌های نصب‌شده
    let totalShadePanels = 0;
    let totalCurtainPanels = 0;
    for (const p of projects) {
      if (p.status === 'COMPLETED') {
        totalShadePanels += p.shadePanels || 0;
        totalCurtainPanels += p.curtainPanels || 0;
      }
    }

    // راندمان ۴ اکیپ نصب
    const teamOutputs = teamsWithMembers.map((team) => {
      const teamProjects = projects.filter(
        (p) => p.assignedTeamId === team.id && p.status === 'COMPLETED'
      );
      const teamShades = teamProjects.reduce((sum, p) => sum + (p.shadePanels || 0), 0);
      const teamCurtains = teamProjects.reduce((sum, p) => sum + (p.curtainPanels || 0), 0);
      return {
        teamId: team.id,
        teamName: team.name,
        supervisorName: team.supervisor?.name || 'تعیین‌نشده',
        completedProjectsCount: teamProjects.length,
        totalShades: teamShades,
        totalCurtains: teamCurtains,
        totalPanels: teamShades + teamCurtains,
      };
    });

    // ج) رضایت کارفرما
    const ratedProjects = projects.filter(
      (p) => p.customerSatisfaction && p.customerSatisfaction > 0
    );
    const avgSatisfaction =
      ratedProjects.length > 0
        ? ratedProjects.reduce((sum, p) => sum + (p.customerSatisfaction || 0), 0) /
          ratedProjects.length
        : 0;
    const signedProjectsCount = projects.filter((p) => Boolean(p.customerSignature)).length;
    const unavailableExemptCount = projects.filter(
      (p) =>
        p.handoverSigneeType === 'UNAVAILABLE_EXEMPT' ||
        p.customerAcceptance?.status === 'UNAVAILABLE'
    ).length;

    // د) لجستیک متریال
    const totalMaterials = materialRequests.length;
    const deliveredMaterials = materialRequests.filter(
      (r) => r.status === 'DELIVERED_CONFIRMED'
    ).length;
    const inTransitMaterials = materialRequests.filter(
      (r) => r.status === 'DISPATCHED' || r.status === 'PARTIALLY_DISPATCHED'
    ).length;

    return {
      inspectedProjectsCount: inspectedProjects.length,
      approvedProjectsCount: approvedProjects.length,
      avgQcScore: Number(avgQcScore.toFixed(1)),
      firstTimePassRate,
      defectCounts,
      totalDefectsCount,
      resolvedDefectsCount,
      totalShadePanels,
      totalCurtainPanels,
      totalPanels: totalShadePanels + totalCurtainPanels,
      teamOutputs,
      avgSatisfaction: Number(avgSatisfaction.toFixed(1)),
      ratedProjectsCount: ratedProjects.length,
      signedProjectsCount,
      unavailableExemptCount,
      totalMaterials,
      deliveredMaterials,
      inTransitMaterials,
    };
  }, [projects, teamsWithMembers, materialRequests]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* هدر کنترل سنتر */}
      <div className="rounded-3xl bg-gradient-to-l from-[#212121] via-[#1A1A1A] to-[#141414] border-2 border-[#C1A056]/30 p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C1A056]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#C1A056] text-[#141414]">
                {isQcManager ? 'مرکز فرماندهی مدیریت QC' : 'میز هماهنگی و زمان‌بندی فنی'}
              </span>
              <span className="text-xs text-[#E5CA8F] font-semibold">{todayPersian}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              مرکز کنترل و پایش عملیات فنی
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              دیده‌بانی لحظه‌ای ماموریت‌های ۴ اکیپ نصب، کنترل تعهدات زمانی ۷۲ ساعته SLA، و مانیتورینگ بلادرنگ پروژه‌ها
            </p>
          </div>

          {/* کلیدهای دسترسی سریع اصلی */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('planner')}
              className="px-3.5 py-2 rounded-xl bg-[#C1A056] hover:bg-[#D4B56A] text-[#141414] font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Calendar className="w-4 h-4" />
              تقویم و برنامه‌ریزی
            </button>
            <button
              onClick={() => onNavigateTab('tickets')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition flex items-center gap-1.5 border border-white/15 cursor-pointer"
            >
              <AlertCircle className="w-4 h-4 text-amber-400" />
              مرکز تیکت و SLA
              {slaMetrics.openOverdue > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {toPersianDigits(slaMetrics.openOverdue)}
                </span>
              )}
            </button>
            {isQcManager && (
              <button
                onClick={() => onNavigateTab('qc')}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition flex items-center gap-1.5 border border-white/15 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#C1A056]" />
                میز تایید QC
                {projectMetrics.awaitingQc > 0 && (
                  <span className="bg-[#C1A056] text-[#141414] text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {toPersianDigits(projectMetrics.awaitingQc)}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* سوییچر نمای زنده / گزارش‌های تحلیلی P4 */}
      <div className="flex items-center justify-between border-b border-[#E2DDD4] dark:border-[#2C2C2C] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('LIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'LIVE'
                ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#141414] shadow-sm'
                : 'bg-white dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white border border-[#E2DDD4] dark:border-[#2C2C2C]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>مرکز دیده‌بانی زنده عملیات</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('ANALYTICS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'ANALYTICS'
                ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#141414] shadow-sm'
                : 'bg-white dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white border border-[#E2DDD4] dark:border-[#2C2C2C]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>داشبورد تحلیلی و آماری (P4 Analytics)</span>
          </button>
        </div>

        <span className="text-xs text-neutral-500 hidden sm:inline">
          {activeSubView === 'LIVE' ? 'دید لحظه‌ای اکیپ‌ها و هشدارها' : 'تحلیل کیفی، راندمان و هوش تجاری'}
        </span>
      </div>

      {activeSubView === 'LIVE' ? (
        <>
          {/* ۱. کارت‌های پایش عملیاتی کلی (Operational Overview) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#212121] dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#C1A056]" />
            نمای کلی چرخه عملیات دپارتمان فنی
          </h2>
          <span className="text-xs text-neutral-500">
            مجموع {toPersianDigits(projects.length)} پروژه ثبت‌شده
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3">
          {/* آماده زمان‌بندی (گیت تایید شده) */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] hover:border-[#C1A056] transition cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">آماده زمان‌بندی</span>
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#212121] dark:text-white">
              {toPersianDigits(projectMetrics.readyToSchedule)}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">گیت تحویل انبار تایید</p>
          </div>

          {/* زمان‌بندی‌شده */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] hover:border-[#C1A056] transition cursor-pointer shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">زمان‌بندی‌شده</span>
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#212121] dark:text-white">
              {toPersianDigits(projectMetrics.scheduled)}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">در انتظار تاریخ اجرا</p>
          </div>

          {/* در حال نصب امروز */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] hover:border-[#C1A056] transition cursor-pointer shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">در حال نصب</span>
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {toPersianDigits(projectMetrics.inProgress)}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">اکیپ‌ها مستقر در محل</p>
          </div>

          {/* پروژه‌های چندروزه فعال */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] hover:border-[#C1A056] transition cursor-pointer shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">چندروزه فعال</span>
              <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400">
              {toPersianDigits(projectMetrics.multiDayActive)}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">عملیات متوالی چند روزه</p>
          </div>

          {/* پروژه‌های تاخیردار / بحرانی */}
          <div
            onClick={() => onNavigateTab('planner')}
            className={`p-3.5 rounded-2xl border transition cursor-pointer shadow-sm ${
              projectMetrics.overdueProjects > 0
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-white dark:bg-[#1A1A1A] border-[#E8E4DC] dark:border-[#2D2D2D]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">دارای تاخیر</span>
              <div className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {toPersianDigits(projectMetrics.overdueProjects)}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">عبور از تاریخ مقرر</p>
          </div>

          {/* در انتظار تایید QC */}
          <div
            onClick={() => onNavigateTab('qc')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] hover:border-[#C1A056] transition cursor-pointer shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">در انتظار QC</span>
              <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
              {toPersianDigits(projectMetrics.awaitingQc)}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">نصب پایان‌یافته</p>
          </div>

          {/* تایید شده نهایی */}
          <div
            onClick={() => onNavigateTab('qc')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] hover:border-[#C1A056] transition cursor-pointer shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">تایید نهایی QC</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {toPersianDigits(projectMetrics.completed)}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">مهر تایید کیفی</p>
          </div>
        </div>
      </section>

      {/* ۲. بخش نظارت بر ۴ اکیپ نصب (Team Overview) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[#212121] dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C1A056]" />
              ظرفیت، ماموریت و بار کاری ۴ اکیپ نصب
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              وضعیت استقرار، حجم کار اختصاص‌یافته و ظرفیت در دسترس هر اکیپ در تاریخ امروز
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('technicians')}
            className="text-xs font-bold text-[#C1A056] hover:underline flex items-center gap-1 cursor-pointer"
          >
            مدیریت ترکیب اکیپ‌ها
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {teamStatuses.map((ts) => {
            const statusConfig = {
              AVAILABLE: {
                label: 'در دسترس و آماده',
                badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
              },
              ON_MISSION: {
                label: 'در حال اجرای ماموریت',
                badgeCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse',
              },
              STANDBY: {
                label: 'برنامه‌ریزی‌شده / آماده‌باش',
                badgeCls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
              },
              OVERLOADED: {
                label: 'تراکم بیش از ظرفیت',
                badgeCls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-black',
              },
              UNCONFIGURED: {
                label: 'ظرفیت نامشخص',
                badgeCls: 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30 font-bold',
              },
            }[ts.status] || {
              label: 'نامشخص',
              badgeCls: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
            };

            const loadPercentage =
              ts.maxCapacityHours && ts.maxCapacityHours > 0
                ? Math.min(100, Math.round((ts.currentWorkloadHours / ts.maxCapacityHours) * 100))
                : 0;

            return (
              <div
                key={ts.team.id}
                className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] p-4 flex flex-col justify-between shadow-sm relative overflow-hidden"
              >
                <div>
                  {/* سربرگ اکیپ */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[#212121] dark:text-white">
                          {ts.team.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                          {ts.team.code}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        سرپرست: {ts.supervisor ? ts.supervisor.name : 'فاقد سرپرست'}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusConfig.badgeCls}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* اعضای اکیپ */}
                  <div className="flex items-center gap-1.5 mb-3 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/60 p-2 rounded-xl">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      تکنسین‌ها ({toPersianDigits(ts.technicians.length)} نفر):
                    </span>
                    <span className="truncate">
                      {ts.technicians.length > 0
                        ? ts.technicians.map((t) => t.name).join('، ')
                        : 'بدون تکنسین'}
                    </span>
                  </div>

                  {/* ماموریت جاری */}
                  <div className="mb-3">
                    <div className="text-[11px] font-bold text-neutral-400 mb-1">ماموریت امروز:</div>
                    {ts.currentMission ? (
                      <div className="p-2.5 rounded-xl border border-[#C1A056]/30 bg-[#FAF8F5] dark:bg-[#161616]">
                        <div className="flex items-center justify-between text-xs font-bold text-[#212121] dark:text-white">
                          <span className="truncate">{ts.currentMission.projectTitle}</span>
                          <span className="font-mono text-[#C1A056] shrink-0 text-[11px]">
                            {ts.currentMission.projectCode}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                          <span>{ts.currentMission.customerName}</span>
                          {ts.currentMission.isMultiDay && (
                            <span className="text-teal-600 font-bold text-[10px] bg-teal-500/10 px-1 rounded">
                              پروژه چندروزه
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-400 italic p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 text-center">
                        هیچ پروژه‌ای برای امروز اختصاص نیافته
                      </div>
                    )}
                  </div>
                </div>

                {/* گیج بار کاری روزانه */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-neutral-600 dark:text-neutral-300">
                      بار کاری امروز:
                    </span>
                    <span className="font-mono font-black text-[#212121] dark:text-white">
                      {ts.maxCapacityHours !== null
                        ? `${toPersianDigits(ts.currentWorkloadHours)} / ${toPersianDigits(ts.maxCapacityHours)} ساعت`
                        : `${toPersianDigits(ts.currentWorkloadHours)} ساعت (سقف نامشخص)`}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        loadPercentage > 100
                          ? 'bg-rose-500'
                          : loadPercentage > 75
                          ? 'bg-amber-500'
                          : 'bg-[#C1A056]'
                      }`}
                      style={{ width: `${loadPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
                    <span>ظرفیت باقیمانده:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {ts.remainingCapacityHours !== null
                        ? `${toPersianDigits(ts.remainingCapacityHours)} ساعت آزاد`
                        : 'نامشخص'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ۳. بخش هشدارها و فوریت‌های عملیاتی (Issues & Alerts) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* پنل شاخص‌های انضباط و رعایت ۷۲ ساعت SLA */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#212121] dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                پایش زمان پاسخ و تعهد ۷۲ ساعته (SLA)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                تعهد سازمانی حل کلیه موانع فنی ظرف حداکثر ۷۲ ساعت از زمان گزارش
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('tickets')}
              className="text-xs font-bold text-[#C1A056] hover:underline flex items-center gap-1 cursor-pointer"
            >
              مشاهده تیکت‌ها
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* کارت‌های خلاصه نرخ رعایت SLA */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 text-center">
              <span className="text-[10px] text-neutral-500 block mb-1">درصد رعایت موعد مقرر</span>
              <span
                className={`text-xl font-black ${
                  slaMetrics.onTimeRate >= 80 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {toPersianDigits(slaMetrics.onTimeRate)}٪
              </span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 text-center">
              <span className="text-[10px] text-neutral-500 block mb-1">میانگین زمان حل</span>
              <span className="text-xl font-black text-[#212121] dark:text-white">
                {toPersianDigits(slaMetrics.averageResolutionHours)} ساعت
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 block mb-1">تیکت‌های تاخیردار</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                {toPersianDigits(slaMetrics.openOverdue)}
              </span>
            </div>
          </div>

          {/* تفکیک تیکت‌ها به وضعیت ۴ گانه */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/40">
              <span className="text-neutral-600 dark:text-neutral-300">در جریان (زیر ۷۲ ساعت):</span>
              <span className="font-bold text-amber-600">{toPersianDigits(slaMetrics.openInSla)} مورد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/10">
              <span className="font-bold text-rose-700 dark:text-rose-400">بحرانی باز (بیش از ۷۲ ساعت):</span>
              <span className="font-black text-rose-700 dark:text-rose-400">{toPersianDigits(slaMetrics.openOverdue)} مورد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10">
              <span className="text-emerald-700 dark:text-emerald-400">حل شده در موعد مقرر:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{toPersianDigits(slaMetrics.resolvedInSla)} مورد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/10">
              <span className="text-purple-700 dark:text-purple-400">حل شده با تاخیر:</span>
              <span className="font-bold text-purple-700 dark:text-purple-400">{toPersianDigits(slaMetrics.resolvedOverdue)} مورد</span>
            </div>
          </div>
        </div>

        {/* پنل هشدارها و نیازمند اقدام فوری */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#212121] dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              هشدارهای عملیاتی و موارد نیازمند اقدام فوری
            </h3>
            <span className="text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600">
              {toPersianDigits(
                conflicts.length +
                  blockingTickets.length +
                  pendingScheduleRequests.length +
                  missingDailyLogs.length
              )}{' '}
              هشدار
            </span>
          </div>

          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
            {/* ۱. تیکت‌های متوقف‌کننده کار (Blocking) */}
            {blockingTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => onNavigateTab('tickets')}
                className="p-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-xs flex items-start gap-2.5 cursor-pointer hover:bg-rose-100/70 transition"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-rose-900 dark:text-rose-300">
                      توقف عملیات نصب: {t.projectTitle}
                    </span>
                    <span className="font-mono text-[10px] text-rose-600 font-bold">{t.projectCode}</span>
                  </div>
                  <p className="text-rose-800 dark:text-rose-400 text-[11px] mt-1 line-clamp-1">
                    علت توقف: {t.blockingReason || t.description}
                  </p>
                </div>
              </div>
            ))}

            {/* ۲. درخواست‌های تغییر زمان‌بندی در انتظار تایید */}
            {pendingScheduleRequests.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  if (onReviewScheduleRequest) onReviewScheduleRequest(r);
                  else if (onOpenScheduleRequests) onOpenScheduleRequests();
                }}
                className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 text-xs flex items-start gap-2.5 cursor-pointer hover:bg-blue-100/70 transition"
              >
                <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 dark:text-blue-300">
                      درخواست تغییر تاریخ: {r.projectTitle}
                    </span>
                    <span className="text-[10px] bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.2 rounded font-bold">
                      {isQcManager ? 'نیازمند تایید شما' : 'در انتظار تایید QC'}
                    </span>
                  </div>
                  <p className="text-blue-800 dark:text-blue-400 text-[11px] mt-1">
                    از {r.previousScheduledDate} به {r.proposedScheduledDate} — علت: {r.reason}
                  </p>
                </div>
              </div>
            ))}

            {/* ۳. گزارش‌های روزانه مفقود */}
            {missingDailyLogs.map((p) => (
              <div
                key={p.id}
                onClick={() => onOpenProject(p)}
                className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-xs flex items-start gap-2.5 cursor-pointer hover:bg-amber-100/70 transition"
              >
                <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 dark:text-amber-300">
                      عدم ثبت گزارش روزانه: {p.title}
                    </span>
                    <span className="font-mono text-[10px] text-amber-600 font-bold">{p.code}</span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-400 text-[11px] mt-0.5">
                    پروژه چندروزه فعال است اما هنوز گزارش پیشرفت کاری امروز برای آن ثبت نشده است.
                  </p>
                </div>
              </div>
            ))}

            {/* ۴. تداخلات برنامه‌ریزی تقویم */}
            {conflicts.map((c) => (
              <div
                key={c.id}
                onClick={() => onNavigateTab('planner')}
                className={`p-3 rounded-xl text-xs flex items-start gap-2.5 cursor-pointer transition ${
                  c.severity === 'ERROR'
                    ? 'border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300'
                    : 'border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{c.projectTitle}</span>
                    <span className="font-mono text-[10px] opacity-75">{c.projectCode}</span>
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90">{c.message}</p>
                </div>
              </div>
            ))}

            {blockingTickets.length === 0 &&
              pendingScheduleRequests.length === 0 &&
              missingDailyLogs.length === 0 &&
              conflicts.length === 0 && (
                <div className="p-8 text-center text-neutral-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    هیچ هشدار یا مانع بحرانی در عملیات فنی وجود ندارد
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    کلیه ماموریت‌ها و تعهدات زمانی در شرایط استاندارد هستند.
                  </p>
                </div>
              )}
          </div>
        </div>
      </section>
        </>
      ) : (
        /* ================= ANALYTICS & OPERATIONAL INTELLIGENCE (P4) ================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* ۱. کارت‌های شاخص‌های کلیدی عملکرد (Top KPI Ribbon) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* میانگین نمره کیفی QC */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-500 text-[11px] font-bold">
                <span>میانگین نمره QC</span>
                <Star className="w-4 h-4 text-[#C1A056] fill-[#C1A056]" />
              </div>
              <div className="text-2xl font-black text-[#212121] dark:text-white flex items-baseline gap-1">
                <span>{toPersianDigits(analytics.avgQcScore || '—')}</span>
                <span className="text-xs text-neutral-400 font-normal">از ۵</span>
              </div>
              <p className="text-[10px] text-neutral-400">
                بر مبنای {toPersianDigits(analytics.approvedProjectsCount)} پروژه تاییدشده
              </p>
            </div>

            {/* نرخ قبولی بار اول */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-500 text-[11px] font-bold">
                <span>قبولی نوبت اول</span>
                <Percent className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                %{toPersianDigits(analytics.firstTimePassRate)}
              </div>
              <p className="text-[10px] text-neutral-400">بدون بازکاری و اصلاح کارگاهی</p>
            </div>

            {/* کل پنل‌های نصب‌شده */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-500 text-[11px] font-bold">
                <span>مجموع لت‌های نصب‌شده</span>
                <Layers className="w-4 h-4 text-[#C1A056]" />
              </div>
              <div className="text-2xl font-black text-[#212121] dark:text-white">
                {toPersianDigits(analytics.totalPanels)} <span className="text-xs font-normal">لت</span>
              </div>
              <p className="text-[10px] text-neutral-400">
                {toPersianDigits(analytics.totalShadePanels)} شید • {toPersianDigits(analytics.totalCurtainPanels)} پرده
              </p>
            </div>

            {/* تعهد زمانی SLA */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-500 text-[11px] font-bold">
                <span>نرخ رعایت SLA</span>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                %{toPersianDigits(slaMetrics.onTimeRate)}
              </div>
              <p className="text-[10px] text-neutral-400">حل تیکت‌ها زیر ۷۲ ساعت</p>
            </div>

            {/* رضایت کارفرما */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-500 text-[11px] font-bold">
                <span>رضایت کارفرمایان</span>
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 flex items-baseline gap-1">
                <span>{toPersianDigits(analytics.avgSatisfaction || '—')}</span>
                <span className="text-xs text-neutral-400 font-normal">از ۵ ستاره</span>
              </div>
              <p className="text-[10px] text-neutral-400">
                {toPersianDigits(analytics.signedProjectsCount)} امضای دیجیتال
              </p>
            </div>
          </div>

          {/* ۲. تحلیل عدم‌انطباق‌ها و عیوب کیفی QC (Defect Breakdown) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm text-[#212121] dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C1A056]" />
                    <span>تحلیل عیوب و عدم‌انطباق‌های کیفی بازرسی (QC Defects)</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    تفکیک فراوانی اشکالات ثبت‌شده در نوبت‌های بازرسی به تفکیک دسته فنی
                  </p>
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-neutral-500">مجموع عیوب: </span>
                  <span className="text-xs font-black text-[#212121] dark:text-white font-mono">
                    {toPersianDigits(analytics.totalDefectsCount)}
                  </span>
                </div>
              </div>

              {analytics.totalDefectsCount > 0 ? (
                <div className="space-y-3 pt-1">
                  {[
                    { key: 'LEVELING', label: 'تراز و شاقول بودن قاب و پایه‌ها', color: 'bg-blue-500' },
                    { key: 'FABRIC', label: 'پارچه، والان، چین‌ها و اتوکشی', color: 'bg-purple-500' },
                    { key: 'MOTOR_REMOTE', label: 'موتور، سیم‌کشی و ریموت کنترل', color: 'bg-amber-500' },
                    { key: 'HARDWARE', label: 'یراق‌آلات، بست‌ها و اتصالات کرپی', color: 'bg-rose-500' },
                    { key: 'CLEANLINESS', label: 'نظافت محیط و جمع‌آوری ضایعات', color: 'bg-emerald-500' },
                    { key: 'DAMAGE', label: 'آسیب فیزیکی، خراشیدگی یا شکستگی', color: 'bg-red-600' },
                    { key: 'OTHER', label: 'سایر موارد فنی', color: 'bg-neutral-500' },
                  ].map((cat) => {
                    const count = analytics.defectCounts[cat.key] || 0;
                    const pct =
                      analytics.totalDefectsCount > 0
                        ? Math.round((count / analytics.totalDefectsCount) * 100)
                        : 0;
                    return (
                      <div key={cat.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                            {cat.label}
                          </span>
                          <span className="font-mono text-neutral-500 dark:text-neutral-400 text-[11px]">
                            {toPersianDigits(count)} مورد ({toPersianDigits(pct)}٪)
                          </span>
                        </div>
                        <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`${cat.color} h-full transition-all duration-300 rounded-full`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-400 space-y-1.5 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    هیچ عدم‌انطباق یا نقصی ثبت نشده است
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    تمام پروژه‌ها با رعایت استانداردهای گالری طلایی تایید شده‌اند.
                  </p>
                </div>
              )}
            </div>

            {/* ۳. راندمان و خروجی ۴ اکیپ نصب (Team Performance & Output) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-4">
              <div>
                <h3 className="font-black text-sm text-[#212121] dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C1A056]" />
                  <span>راندمان و حجم کار تحویلی ۴ اکیپ نصب</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  تعداد پروژه‌های تکمیل‌شده و حجم لت‌های نصب‌شده توسط هر اکیپ
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {analytics.teamOutputs.map((team) => (
                  <div
                    key={team.teamId}
                    className="p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-[#212121] dark:text-white">
                          {team.teamName}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          (سرپرست: {team.supervisorName})
                        </span>
                      </div>
                      <span className="text-xs font-black text-[#C1A056] font-mono">
                        {toPersianDigits(team.completedProjectsCount)} پروژه تکمیل
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-neutral-200 dark:border-neutral-800/60">
                      <div>
                        <span className="text-[10px] text-neutral-400 block">شید</span>
                        <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {toPersianDigits(team.totalShades)} لت
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block">پرده</span>
                        <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {toPersianDigits(team.totalCurtains)} لت
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block">مجموع پنل‌ها</span>
                        <span className="font-mono font-bold text-[#C1A056]">
                          {toPersianDigits(team.totalPanels)} لت
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ۴. کارت‌های لجستیک متریال و تجربه مشتریان */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* لجستیک و تامین متریال */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-3">
              <h3 className="font-black text-sm text-[#212121] dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600" />
                <span>گزارش لجستیک و تامین متریال سر کارگاه (P2.3)</span>
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                ارسال و تحویل قطعات و یراق‌آلات اضطراری جهت جلوگیری از توقف عملیات نصب.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] text-purple-700 dark:text-purple-300 block mb-0.5">
                    کل درخواست‌ها
                  </span>
                  <span className="text-lg font-black text-purple-800 dark:text-purple-200">
                    {toPersianDigits(analytics.totalMaterials)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 block mb-0.5">
                    در مسیر پیک
                  </span>
                  <span className="text-lg font-black text-amber-800 dark:text-amber-200">
                    {toPersianDigits(analytics.inTransitMaterials)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block mb-0.5">
                    تحویل تاییدشده
                  </span>
                  <span className="text-lg font-black text-emerald-800 dark:text-emerald-200">
                    {toPersianDigits(analytics.deliveredMaterials)}
                  </span>
                </div>
              </div>
            </div>

            {/* تجربه و پذیرش کارفرما */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-3">
              <h3 className="font-black text-sm text-[#212121] dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-[#C1A056]" />
                <span>پذیرش و رضایت‌مندی کارفرمایان (P3)</span>
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                وضعیت مستندسازی تحویل فیزیکی، امضای دیجیتال و معافیت‌های مستند عدم حضور کارفرما.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block mb-0.5">
                    امضای حضوری
                  </span>
                  <span className="text-lg font-black text-emerald-800 dark:text-emerald-200">
                    {toPersianDigits(analytics.signedProjectsCount)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 block mb-0.5">
                    معافیت عدم حضور
                  </span>
                  <span className="text-lg font-black text-amber-800 dark:text-amber-200">
                    {toPersianDigits(analytics.unavailableExemptCount)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] text-blue-700 dark:text-blue-300 block mb-0.5">
                    میانگین رضایت
                  </span>
                  <span className="text-lg font-black text-blue-800 dark:text-blue-200">
                    {toPersianDigits(analytics.avgSatisfaction || '—')} <span className="text-[10px]">/۵</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
