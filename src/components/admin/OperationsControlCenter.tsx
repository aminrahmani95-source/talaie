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
    // پروژه‌های دارای سابقه بازرسی رسمی (جامعه آماری دقیق جهت سنجش نرخ قبولی)
    const inspectedProjects = projects.filter(
      (p) => p.qcInspections && p.qcInspections.length > 0
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
      <div className="rounded-lg bg-[#151B23] border border-[#212835] p-5 sm:p-6 text-[#F0F4F8] shadow-none relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#C5A059] text-[#0D1117]">
                {isQcManager ? 'مرکز فرماندهی مدیریت QC' : 'میز هماهنگی و زمان‌بندی فنی'}
              </span>
              <span className="text-xs text-[#C5A059] font-medium">{todayPersian}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#F0F4F8] tracking-tight">
              مرکز کنترل و پایش عملیات فنی
            </h1>
            <p className="text-xs text-[#9BA7B6] mt-1 max-w-xl">
              دیده‌بانی لحظه‌ای ماموریت‌های ۴ اکیپ نصب، کنترل تعهدات زمانی ۷۲ ساعته SLA، و مانیتورینگ بلادرنگ پروژه‌ها
            </p>
          </div>

          {/* کلیدهای دسترسی سریع اصلی */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('planner')}
              className="px-3.5 py-2 rounded-md bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] font-bold text-xs transition flex items-center gap-1.5 cursor-pointer min-h-[38px]"
            >
              <Calendar className="w-4 h-4" />
              تقویم و برنامه‌ریزی
            </button>
            <button
              onClick={() => onNavigateTab('tickets')}
              className="px-3.5 py-2 rounded-md bg-[#1C232D] hover:bg-[#252F3D] text-[#F0F4F8] font-semibold text-xs transition flex items-center gap-1.5 border border-[#2D3748] cursor-pointer min-h-[38px]"
            >
              <AlertCircle className="w-4 h-4 text-amber-400" />
              مرکز تیکت و SLA
              {slaMetrics.openOverdue > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded animate-pulse tabular-nums">
                  {toPersianDigits(slaMetrics.openOverdue)}
                </span>
              )}
            </button>
            {isQcManager && (
              <button
                onClick={() => onNavigateTab('qc')}
                className="px-3.5 py-2 rounded-md bg-[#1C232D] hover:bg-[#252F3D] text-[#F0F4F8] font-semibold text-xs transition flex items-center gap-1.5 border border-[#2D3748] cursor-pointer min-h-[38px]"
              >
                <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                میز تایید QC
                {projectMetrics.awaitingQc > 0 && (
                  <span className="bg-[#C5A059] text-[#0D1117] text-[10px] font-bold px-1.5 py-0.2 rounded tabular-nums">
                    {toPersianDigits(projectMetrics.awaitingQc)}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* سوییچر نمای زنده / گزارش‌های تحلیلی P4 */}
      <div className="flex items-center justify-between border-b border-[#212835] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('LIVE')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
              activeSubView === 'LIVE'
                ? 'bg-[#C5A059] text-[#0D1117] font-bold shadow-xs'
                : 'bg-[#151B23] text-[#9BA7B6] hover:text-[#F0F4F8] border border-[#212835]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>مرکز دیده‌بانی زنده عملیات</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('ANALYTICS')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
              activeSubView === 'ANALYTICS'
                ? 'bg-[#C5A059] text-[#0D1117] font-bold shadow-xs'
                : 'bg-[#151B23] text-[#9BA7B6] hover:text-[#F0F4F8] border border-[#212835]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>داشبورد تحلیلی و آماری (P4 Analytics)</span>
          </button>
        </div>

        <span className="text-xs text-[#637184] hidden sm:inline">
          {activeSubView === 'LIVE' ? 'دید لحظه‌ای اکیپ‌ها و هشدارها' : 'تحلیل کیفی، راندمان و هوش تجاری'}
        </span>
      </div>

      {activeSubView === 'LIVE' ? (
        <>
          {/* ۱. کارت‌های پایش عملیاتی کلی (Operational Overview) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#F0F4F8] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#C5A059]" />
            نمای کلی چرخه عملیات دپارتمان فنی
          </h2>
          <span className="text-xs text-[#9BA7B6] tabular-nums">
            مجموع {toPersianDigits(projects.length)} پروژه ثبت‌شده
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3">
          {/* آماده زمان‌بندی (گیت تایید شده) */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-lg bg-[#151B23] border border-[#212835] hover:border-[#2D3748] transition cursor-pointer shadow-none group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#9BA7B6]">آماده زمان‌بندی</span>
              <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#F0F4F8] tabular-nums">
              {toPersianDigits(projectMetrics.readyToSchedule)}
            </div>
            <p className="text-[10px] text-[#637184] mt-1 line-clamp-1">گیت تحویل انبار تایید</p>
          </div>

          {/* زمان‌بندی‌شده */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-lg bg-[#151B23] border border-[#212835] hover:border-[#2D3748] transition cursor-pointer shadow-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#9BA7B6]">زمان‌بندی‌شده</span>
              <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#F0F4F8] tabular-nums">
              {toPersianDigits(projectMetrics.scheduled)}
            </div>
            <p className="text-[10px] text-[#637184] mt-1 line-clamp-1">در انتظار تاریخ اجرا</p>
          </div>

          {/* در حال نصب امروز */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-lg bg-[#151B23] border border-[#212835] hover:border-[#2D3748] transition cursor-pointer shadow-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#9BA7B6]">در حال نصب</span>
              <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-400 tabular-nums">
              {toPersianDigits(projectMetrics.inProgress)}
            </div>
            <p className="text-[10px] text-[#637184] mt-1 line-clamp-1">اکیپ‌ها مستقر در محل</p>
          </div>

          {/* پروژه‌های چندروزه فعال */}
          <div
            onClick={() => onNavigateTab('planner')}
            className="p-3.5 rounded-lg bg-[#151B23] border border-[#212835] hover:border-[#2D3748] transition cursor-pointer shadow-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#9BA7B6]">چندروزه فعال</span>
              <div className="w-6 h-6 rounded-md bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-teal-400 tabular-nums">
              {toPersianDigits(projectMetrics.multiDayActive)}
            </div>
            <p className="text-[10px] text-[#637184] mt-1 line-clamp-1">عملیات متوالی چند روزه</p>
          </div>

          {/* پروژه‌های تاخیردار / بحرانی */}
          <div
            onClick={() => onNavigateTab('planner')}
            className={`p-3.5 rounded-lg border transition cursor-pointer shadow-none ${
              projectMetrics.overdueProjects > 0
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-[#151B23] border-[#212835] hover:border-[#2D3748]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-rose-400">دارای تاخیر</span>
              <div className="w-6 h-6 rounded-md bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-rose-400 tabular-nums">
              {toPersianDigits(projectMetrics.overdueProjects)}
            </div>
            <p className="text-[10px] text-[#637184] mt-1 line-clamp-1">عبور از تاریخ مقرر</p>
          </div>

          {/* در انتظار تایید QC */}
          <div
            onClick={() => onNavigateTab('qc')}
            className="p-3.5 rounded-lg bg-[#151B23] border border-[#212835] hover:border-[#2D3748] transition cursor-pointer shadow-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#9BA7B6]">در انتظار QC</span>
              <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-purple-400 tabular-nums">
              {toPersianDigits(projectMetrics.awaitingQc)}
            </div>
            <p className="text-[10px] text-[#637184] mt-1 line-clamp-1">نصب پایان‌یافته</p>
          </div>

          {/* تایید شده نهایی */}
          <div
            onClick={() => onNavigateTab('qc')}
            className="p-3.5 rounded-lg bg-[#151B23] border border-[#212835] hover:border-[#2D3748] transition cursor-pointer shadow-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#9BA7B6]">تایید نهایی QC</span>
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">
              {toPersianDigits(projectMetrics.completed)}
            </div>
            <p className="text-[10px] text-[#637184] mt-1 line-clamp-1">مهر تایید کیفی</p>
          </div>
        </div>
      </section>

      {/* ۲. بخش نظارت بر ۴ اکیپ نصب (Team Overview) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#F0F4F8] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C5A059]" />
              ظرفیت، ماموریت و بار کاری ۴ اکیپ نصب
            </h2>
            <p className="text-xs text-[#9BA7B6] mt-0.5">
              وضعیت استقرار، حجم کار اختصاص‌یافته و ظرفیت در دسترس هر اکیپ در تاریخ امروز
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('technicians')}
            className="text-xs font-semibold text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
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
                badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
              },
              ON_MISSION: {
                label: 'در حال اجرای ماموریت',
                badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse',
              },
              STANDBY: {
                label: 'برنامه‌ریزی‌شده / آماده‌باش',
                badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
              },
              OVERLOADED: {
                label: 'تراکم بیش از ظرفیت',
                badgeCls: 'bg-rose-500/15 text-rose-300 border-rose-500/40 font-bold',
              },
              UNCONFIGURED: {
                label: 'ظرفیت نامشخص',
                badgeCls: 'bg-neutral-500/15 text-[#9BA7B6] border-neutral-500/30 font-medium',
              },
            }[ts.status] || {
              label: 'نامشخص',
              badgeCls: 'bg-neutral-500/10 text-[#637184] border-neutral-500/20',
            };

            const loadPercentage =
              ts.maxCapacityHours && ts.maxCapacityHours > 0
                ? Math.min(100, Math.round((ts.currentWorkloadHours / ts.maxCapacityHours) * 100))
                : 0;

            return (
              <div
                key={ts.team.id}
                className="bg-[#151B23] rounded-lg border border-[#212835] p-4 flex flex-col justify-between shadow-none relative overflow-hidden"
              >
                <div>
                  {/* سربرگ اکیپ */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#F0F4F8]">
                          {ts.team.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1C232D] text-[#9BA7B6]">
                          {ts.team.code}
                        </span>
                      </div>
                      <p className="text-xs text-[#9BA7B6] mt-0.5">
                        سرپرست: {ts.supervisor ? ts.supervisor.name : 'فاقد سرپرست'}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusConfig.badgeCls}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* اعضای اکیپ */}
                  <div className="flex items-center gap-1.5 mb-3 text-xs text-[#9BA7B6] bg-[#111620] p-2 rounded-md border border-[#212835]">
                    <span className="font-semibold text-[#F0F4F8]">
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
                    <div className="text-[11px] font-medium text-[#637184] mb-1">ماموریت امروز:</div>
                    {ts.currentMission ? (
                      <div className="p-2.5 rounded-md border border-[#C5A059]/30 bg-[#111620]">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#F0F4F8]">
                          <span className="truncate">{ts.currentMission.projectTitle}</span>
                          <span className="font-mono text-[#C5A059] shrink-0 text-[11px]">
                            {ts.currentMission.projectCode}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#9BA7B6] mt-1">
                          <span>{ts.currentMission.customerName}</span>
                          {ts.currentMission.isMultiDay && (
                            <span className="text-teal-400 font-bold text-[10px] bg-teal-500/10 px-1 rounded">
                              پروژه چندروزه
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#637184] italic p-2.5 rounded-md bg-[#111620] border border-[#212835] text-center">
                        هیچ پروژه‌ای برای امروز اختصاص نیافته
                      </div>
                    )}
                  </div>
                </div>

                {/* گیج بار کاری روزانه */}
                <div className="pt-2 border-t border-[#212835]">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-[#9BA7B6]">
                      بار کاری امروز:
                    </span>
                    <span className="font-mono font-bold text-[#F0F4F8] tabular-nums">
                      {ts.maxCapacityHours !== null
                        ? `${toPersianDigits(ts.currentWorkloadHours)} / ${toPersianDigits(ts.maxCapacityHours)} ساعت`
                        : `${toPersianDigits(ts.currentWorkloadHours)} ساعت (سقف نامشخص)`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded bg-[#1C232D] overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-300 ${
                        loadPercentage > 100
                          ? 'bg-rose-500'
                          : loadPercentage > 75
                          ? 'bg-amber-500'
                          : 'bg-[#C5A059]'
                      }`}
                      style={{ width: `${loadPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#637184] mt-1">
                    <span>ظرفیت باقیمانده:</span>
                    <span className="font-semibold text-emerald-400 tabular-nums">
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
        <div className="bg-[#151B23] rounded-lg border border-[#212835] p-5 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#F0F4F8] flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                پایش زمان پاسخ و تعهد ۷۲ ساعته (SLA)
              </h3>
              <p className="text-xs text-[#9BA7B6] mt-0.5">
                تعهد سازمانی حل کلیه موانع فنی ظرف حداکثر ۷۲ ساعت از زمان گزارش
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('tickets')}
              className="text-xs font-semibold text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
            >
              مشاهده تیکت‌ها
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* کارت‌های خلاصه نرخ رعایت SLA */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-md bg-[#111620] border border-[#212835] text-center">
              <span className="text-[10px] text-[#9BA7B6] block mb-1">درصد رعایت موعد مقرر</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  slaMetrics.onTimeRate >= 80 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {toPersianDigits(slaMetrics.onTimeRate)}٪
              </span>
            </div>

            <div className="p-3 rounded-md bg-[#111620] border border-[#212835] text-center">
              <span className="text-[10px] text-[#9BA7B6] block mb-1">میانگین زمان حل</span>
              <span className="text-xl font-bold text-[#F0F4F8] tabular-nums">
                {toPersianDigits(slaMetrics.averageResolutionHours)} ساعت
              </span>
            </div>

            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-center">
              <span className="text-[10px] text-rose-300 block mb-1">تیکت‌های تاخیردار</span>
              <span className="text-xl font-bold text-rose-400 tabular-nums">
                {toPersianDigits(slaMetrics.openOverdue)}
              </span>
            </div>
          </div>

          {/* تفکیک تیکت‌ها به وضعیت ۴ گانه */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-md bg-[#111620] border border-[#212835]">
              <span className="text-[#9BA7B6]">در جریان (زیر ۷۲ ساعت):</span>
              <span className="font-semibold text-amber-400 tabular-nums">{toPersianDigits(slaMetrics.openInSla)} مورد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-rose-500/10 border border-rose-500/20">
              <span className="font-bold text-rose-300">بحرانی باز (بیش از ۷۲ ساعت):</span>
              <span className="font-bold text-rose-400 tabular-nums">{toPersianDigits(slaMetrics.openOverdue)} مورد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-300">حل شده در موعد مقرر:</span>
              <span className="font-semibold text-emerald-400 tabular-nums">{toPersianDigits(slaMetrics.resolvedInSla)} مورد</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-purple-500/10 border border-purple-500/20">
              <span className="text-purple-300">حل شده با تاخیر:</span>
              <span className="font-semibold text-purple-400 tabular-nums">{toPersianDigits(slaMetrics.resolvedOverdue)} مورد</span>
            </div>
          </div>
        </div>

        {/* پنل هشدارها و نیازمند اقدام فوری */}
        <div className="bg-[#151B23] rounded-lg border border-[#212835] p-5 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F0F4F8] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              هشدارهای عملیاتی و موارد نیازمند اقدام فوری
            </h3>
            <span className="text-xs font-mono font-bold bg-[#1C232D] px-2 py-0.5 rounded text-[#C5A059] tabular-nums">
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
                className="p-3 rounded-md border border-rose-500/30 bg-[#1F1315] text-xs flex items-start gap-2.5 cursor-pointer hover:bg-rose-950/40 transition"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300">
                      توقف عملیات نصب: {t.projectTitle}
                    </span>
                    <span className="font-mono text-[10px] text-rose-400 font-bold">{t.projectCode}</span>
                  </div>
                  <p className="text-rose-300/80 text-[11px] mt-1 line-clamp-1">
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
                className="p-3 rounded-md border border-blue-500/30 bg-[#121D2F] text-xs flex items-start gap-2.5 cursor-pointer hover:bg-blue-950/40 transition"
              >
                <Calendar className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-300">
                      درخواست تغییر تاریخ: {r.projectTitle}
                    </span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-bold">
                      {isQcManager ? 'نیازمند تایید شما' : 'در انتظار تایید QC'}
                    </span>
                  </div>
                  <p className="text-blue-300/80 text-[11px] mt-1">
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
                className="p-3 rounded-md border border-amber-500/30 bg-[#241A0E] text-xs flex items-start gap-2.5 cursor-pointer hover:bg-amber-950/40 transition"
              >
                <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">
                      عدم ثبت گزارش روزانه: {p.title}
                    </span>
                    <span className="font-mono text-[10px] text-amber-400 font-bold">{p.code}</span>
                  </div>
                  <p className="text-amber-300/80 text-[11px] mt-0.5">
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
                className={`p-3 rounded-md text-xs flex items-start gap-2.5 cursor-pointer transition ${
                  c.severity === 'ERROR'
                    ? 'border border-rose-500/30 bg-[#1F1315] text-rose-300'
                    : 'border border-amber-500/30 bg-[#241A0E] text-amber-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="grow min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.projectTitle}</span>
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
                <div className="p-8 text-center text-[#637184] space-y-2 border border-dashed border-[#212835] rounded-md">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-semibold text-[#F0F4F8]">
                    هیچ هشدار یا مانع بحرانی در عملیات فنی وجود ندارد
                  </p>
                  <p className="text-[11px] text-[#637184]">
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
            <div className="p-4 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-1">
              <div className="flex items-center justify-between text-[#9BA7B6] text-[11px] font-semibold">
                <span>میانگین نمره QC</span>
                <Star className="w-4 h-4 text-[#C5A059] fill-[#C5A059]" />
              </div>
              <div className="text-2xl font-bold text-[#F0F4F8] flex items-baseline gap-1 tabular-nums">
                <span>{toPersianDigits(analytics.avgQcScore || '—')}</span>
                <span className="text-xs text-[#637184] font-normal">از ۵</span>
              </div>
              <p className="text-[10px] text-[#637184] tabular-nums">
                بر مبنای {toPersianDigits(analytics.approvedProjectsCount)} پروژه تاییدشده
              </p>
            </div>

            {/* نرخ قبولی بار اول */}
            <div className="p-4 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-1">
              <div className="flex items-center justify-between text-[#9BA7B6] text-[11px] font-semibold">
                <span>قبولی نوبت اول</span>
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                %{toPersianDigits(analytics.firstTimePassRate)}
              </div>
              <p className="text-[10px] text-[#637184] tabular-nums">
                بر مبنای {toPersianDigits(analytics.inspectedProjectsCount)} پروژه بازرسی‌شده
              </p>
            </div>

            {/* کل پنل‌های نصب‌شده */}
            <div className="p-4 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-1">
              <div className="flex items-center justify-between text-[#9BA7B6] text-[11px] font-semibold">
                <span>مجموع لت‌های نصب‌شده</span>
                <Layers className="w-4 h-4 text-[#C5A059]" />
              </div>
              <div className="text-2xl font-bold text-[#F0F4F8] tabular-nums">
                {toPersianDigits(analytics.totalPanels)} <span className="text-xs font-normal">لت</span>
              </div>
              <p className="text-[10px] text-[#637184] tabular-nums">
                {toPersianDigits(analytics.totalShadePanels)} شید • {toPersianDigits(analytics.totalCurtainPanels)} پرده
              </p>
            </div>

            {/* تعهد زمانی SLA */}
            <div className="p-4 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-1">
              <div className="flex items-center justify-between text-[#9BA7B6] text-[11px] font-semibold">
                <span>نرخ رعایت SLA</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400 tabular-nums">
                %{toPersianDigits(slaMetrics.onTimeRate)}
              </div>
              <p className="text-[10px] text-[#637184]">حل تیکت‌ها زیر ۷۲ ساعت</p>
            </div>

            {/* رضایت کارفرما */}
            <div className="p-4 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-1">
              <div className="flex items-center justify-between text-[#9BA7B6] text-[11px] font-semibold">
                <span>رضایت کارفرمایان</span>
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 flex items-baseline gap-1 tabular-nums">
                <span>{toPersianDigits(analytics.avgSatisfaction || '—')}</span>
                <span className="text-xs text-[#637184] font-normal">از ۵ ستاره</span>
              </div>
              <p className="text-[10px] text-[#637184] tabular-nums">
                {toPersianDigits(analytics.signedProjectsCount)} امضای دیجیتال
              </p>
            </div>
          </div>

          {/* ۲. تحلیل عدم‌انطباق‌ها و عیوب کیفی QC (Defect Breakdown) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#F0F4F8] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                    <span>تحلیل عیوب و عدم‌انطباق‌های کیفی بازرسی (QC Defects)</span>
                  </h3>
                  <p className="text-xs text-[#9BA7B6] mt-0.5">
                    تفکیک فراوانی اشکالات ثبت‌شده در نوبت‌های بازرسی به تفکیک دسته فنی
                  </p>
                </div>
                <div className="text-left">
                  <span className="text-xs font-semibold text-[#9BA7B6]">مجموع عیوب: </span>
                  <span className="text-xs font-bold text-[#F0F4F8] font-mono tabular-nums">
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
                          <span className="text-[#F0F4F8] font-medium">
                            {cat.label}
                          </span>
                          <span className="font-mono text-[#9BA7B6] text-[11px] tabular-nums">
                            {toPersianDigits(count)} مورد ({toPersianDigits(pct)}٪)
                          </span>
                        </div>
                        <div className="w-full bg-[#1C232D] h-1.5 rounded overflow-hidden">
                          <div
                            className={`${cat.color} h-full transition-all duration-300 rounded`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-[#637184] space-y-1.5 border border-dashed border-[#212835] rounded-md">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-semibold text-[#F0F4F8]">
                    هیچ عدم‌انطباق یا نقصی ثبت نشده است
                  </p>
                  <p className="text-[11px] text-[#637184]">
                    تمام پروژه‌ها با رعایت استانداردهای گالری طلایی تایید شده‌اند.
                  </p>
                </div>
              )}
            </div>

            {/* ۳. راندمان و خروجی ۴ اکیپ نصب (Team Performance & Output) */}
            <div className="p-5 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[#F0F4F8] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C5A059]" />
                  <span>راندمان و حجم کار تحویلی ۴ اکیپ نصب</span>
                </h3>
                <p className="text-xs text-[#9BA7B6] mt-0.5">
                  تعداد پروژه‌های تکمیل‌شده و حجم لت‌های نصب‌شده توسط هر اکیپ
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {analytics.teamOutputs.map((team) => (
                  <div
                    key={team.teamId}
                    className="p-3.5 rounded-md border border-[#212835] bg-[#111620] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#F0F4F8]">
                          {team.teamName}
                        </span>
                        <span className="text-[10px] text-[#637184]">
                          (سرپرست: {team.supervisorName})
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#C5A059] font-mono tabular-nums">
                        {toPersianDigits(team.completedProjectsCount)} پروژه تکمیل
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-[#212835]">
                      <div>
                        <span className="text-[10px] text-[#637184] block">شید</span>
                        <span className="font-mono font-semibold text-[#F0F4F8] tabular-nums">
                          {toPersianDigits(team.totalShades)} لت
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#637184] block">پرده</span>
                        <span className="font-mono font-semibold text-[#F0F4F8] tabular-nums">
                          {toPersianDigits(team.totalCurtains)} لت
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#637184] block">مجموع پنل‌ها</span>
                        <span className="font-mono font-bold text-[#C5A059] tabular-nums">
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
            <div className="p-5 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-3">
              <h3 className="font-bold text-sm text-[#F0F4F8] flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                <span>گزارش لجستیک و تامین متریال سر کارگاه (P2.3)</span>
              </h3>
              <p className="text-xs text-[#9BA7B6] leading-relaxed">
                ارسال و تحویل قطعات و یراق‌آلات اضطراری جهت جلوگیری از توقف عملیات نصب.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-3 rounded-md bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] text-purple-300 block mb-0.5">
                    کل درخواست‌ها
                  </span>
                  <span className="text-lg font-bold text-purple-200 tabular-nums">
                    {toPersianDigits(analytics.totalMaterials)}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] text-amber-300 block mb-0.5">
                    در مسیر پیک
                  </span>
                  <span className="text-lg font-bold text-amber-200 tabular-nums">
                    {toPersianDigits(analytics.inTransitMaterials)}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-300 block mb-0.5">
                    تحویل تاییدشده
                  </span>
                  <span className="text-lg font-bold text-emerald-200 tabular-nums">
                    {toPersianDigits(analytics.deliveredMaterials)}
                  </span>
                </div>
              </div>
            </div>

            {/* تجربه و پذیرش کارفرما */}
            <div className="p-5 rounded-lg bg-[#151B23] border border-[#212835] shadow-none space-y-3">
              <h3 className="font-bold text-sm text-[#F0F4F8] flex items-center gap-2">
                <Star className="w-4 h-4 text-[#C5A059]" />
                <span>پذیرش و رضایت‌مندی کارفرمایان (P3)</span>
              </h3>
              <p className="text-xs text-[#9BA7B6] leading-relaxed">
                وضعیت مستندسازی تحویل فیزیکی، امضای دیجیتال و معافیت‌های مستند عدم حضور کارفرما.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-300 block mb-0.5">
                    امضای حضوری
                  </span>
                  <span className="text-lg font-bold text-emerald-200 tabular-nums">
                    {toPersianDigits(analytics.signedProjectsCount)}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] text-amber-300 block mb-0.5">
                    معافیت عدم حضور
                  </span>
                  <span className="text-lg font-bold text-amber-200 tabular-nums">
                    {toPersianDigits(analytics.unavailableExemptCount)}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] text-blue-300 block mb-0.5">
                    میانگین رضایت
                  </span>
                  <span className="text-lg font-bold text-blue-200 tabular-nums">
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
