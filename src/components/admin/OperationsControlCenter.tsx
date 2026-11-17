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
  Phone,
  Plus,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Percent,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString, localDateKey } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { isProjectMultiDay, isProjectScheduledOnDate } from '../../utils/multiDay';
import { computeSlaMetrics } from '../../utils/sla';
import { isAwaitingQc } from '../../utils/qcWorkflow';

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
  const [activeSubTab, setActiveSubTab] = useState<'ACTIONS' | 'ANALYTICS'>('ACTIONS');
  const [activeUrgentCategory, setActiveUrgentCategory] = useState<'ALL' | 'STUCK' | 'INCOMING' | 'QC'>('ALL');
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);

  const isQcManager = currentUser.role === 'QC_MANAGER';
  const todayKey = useMemo(() => localDateKey(new Date()), []);
  const todayPersian = useMemo(() => getTodayPersianString(), []);

  // ================= 1. صف نیازمند اقدام فوری (ACTION INBOX) =================

  // 1. الف: پروژه‌های متوقف و موانع بحرانی کارگاه
  const stuckProjects = useMemo(() => {
    return projects.filter((p) => p.status === 'STUCK');
  }, [projects]);

  const blockingTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'OPEN' && t.isBlocking);
  }, [tickets]);

  // 1. ب: پروژه‌های نیازمند تعیین اکیپ یا تاریخ زمان‌بندی
  const incomingProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        !isAwaitingQc(p) &&
        (p.status === 'MEASUREMENT_PENDING' ||
          (!p.assignedTeamId && p.status !== 'COMPLETED' && p.status !== 'CANCELLED') ||
          (!p.scheduledDate && p.status !== 'COMPLETED' && p.status !== 'CANCELLED'))
    );
  }, [projects]);

  // 1. ج: پروژه‌های در انتظار بررسی و تایید کیفی QC (هماهنگ با شمارنده اعلان‌ها و میز QC)
  const pendingQcProjects = useMemo(() => {
    return projects.filter(isAwaitingQc);
  }, [projects]);

  // مجموع فوریت‌ها
  const totalUrgentCount =
    stuckProjects.length + blockingTickets.length + incomingProjects.length + pendingQcProjects.length;

  // ================= 2. وضعیت زنده 4 اکیپ نصب در امروز =================
  const liveTeams = useMemo(() => {
    // اطمینان از وجود 4 اکیپ
    const targetTeams: InstallationTeamWithMembers[] = teamsWithMembers && teamsWithMembers.length > 0
      ? teamsWithMembers
      : [
          { id: 'TEAM_1', name: 'اکیپ نصب 1 (نقدعلیان)', code: 'TEAM_1', supervisorId: 'u-lead-1', supervisor: { id: 'u-lead-1', name: 'فرخ نقدعلیان', role: 'LEAD_TECHNICIAN', phone: '09121111111', active: true }, technicians: [], totalMembers: 1, createdAt: '', updatedAt: '' },
          { id: 'TEAM_2', name: 'اکیپ نصب 2 (مرادی)', code: 'TEAM_2', supervisor: { id: 'u-lead-2', name: 'علیرضا مرادی', role: 'LEAD_TECHNICIAN', phone: '09122222222', active: true }, technicians: [], totalMembers: 1, createdAt: '', updatedAt: '' },
          { id: 'TEAM_3', name: 'اکیپ نصب 3 (سهرابی)', code: 'TEAM_3', supervisor: { id: 'u-lead-3', name: 'مهدی سهرابی', role: 'LEAD_TECHNICIAN', phone: '09123333333', active: true }, technicians: [], totalMembers: 1, createdAt: '', updatedAt: '' },
          { id: 'TEAM_4', name: 'اکیپ نصب 4 (رحمانی)', code: 'TEAM_4', supervisor: { id: 'u-lead-4', name: 'حسین رحمانی', role: 'LEAD_TECHNICIAN', phone: '09124444444', active: true }, technicians: [], totalMembers: 1, createdAt: '', updatedAt: '' },
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
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* ================= هدر میز کار عملیاتی ================= */}
      <div className="rounded-xl bg-[#151B23] border border-[#212835] p-5 sm:p-6 text-[#F0F4F8] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#C5A059] text-[#0D1117]">
                {isQcManager ? 'میز کار عملیاتی مدیر فنی و QC' : 'میز هماهنگی و زمان‌بندی عملیات'}
              </span>
              <span className="text-xs text-[#9BA7B6] font-medium">{todayPersian}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#F0F4F8] tracking-tight text-balance">
              صف اقدام و فرماندهی عملیات اجرایی
            </h1>
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              {totalUrgentCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30 tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  {toPersianDigits(totalUrgentCount)} موضوع نیازمند تصمیم و اقدام شماست
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  تمام امور کارگاهی و پروژه‌ها در وضعیت پایدار هستند
                </span>
              )}
            </div>
          </div>

          {/* کلیدهای اقدام فوری */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onNewProject && (
              <button
                type="button"
                onClick={onNewProject}
                className="px-3.5 py-2 rounded-lg bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] font-black text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[38px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                ثبت پروژه جدید
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigateTab('planner')}
              className="px-3.5 py-2 rounded-lg bg-[#1C232D] hover:bg-[#252F3D] text-[#F0F4F8] font-bold text-xs transition flex items-center gap-1.5 border border-[#2D3748] cursor-pointer min-h-[38px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
            >
              <Calendar className="w-4 h-4 text-[#C5A059]" />
              تقویم 4 روزه
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('registry')}
              className="px-3.5 py-2 rounded-lg bg-[#1C232D] hover:bg-[#252F3D] text-[#F0F4F8] font-bold text-xs transition flex items-center gap-1.5 border border-[#2D3748] cursor-pointer min-h-[38px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              شناسنامه پروژه‌ها
            </button>
          </div>
        </div>
      </div>

      {/* ================= تب‌بار بین صف اقدام و تحلیل آماری ================= */}
      <div className="flex items-center justify-between border-b border-[#212835] pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('ACTIONS')}
            aria-selected={activeSubTab === 'ACTIONS'}
            role="tab"
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 min-h-[36px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
              activeSubTab === 'ACTIONS'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-xs'
                : 'bg-[#151B23] text-[#9BA7B6] hover:text-[#F0F4F8] border border-[#212835]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>صف اقدام و دیده‌بانی روز</span>
            {totalUrgentCount > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeSubTab === 'ACTIONS'
                    ? 'bg-[#0D1117] text-[#C5A059]'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {toPersianDigits(totalUrgentCount)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('ANALYTICS')}
            aria-selected={activeSubTab === 'ANALYTICS'}
            role="tab"
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 min-h-[36px] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
              activeSubTab === 'ANALYTICS'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-xs'
                : 'bg-[#151B23] text-[#9BA7B6] hover:text-[#F0F4F8] border border-[#212835]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>گزارش آماری و هوش عملیاتی</span>
          </button>
        </div>

        <span className="text-[11px] text-[#9BA7B6] hidden sm:inline">
          {activeSubTab === 'ACTIONS'
            ? 'اولویت‌های نیازمند اقدام + وضعیت زنده اکیپ‌ها'
            : 'کیفیت، رعایت SLA و راندمان اکیپ‌ها'}
        </span>
      </div>

      {activeSubTab === 'ACTIONS' ? (
        <>
          {/* ================= بخش 1: نیازمند اقدام فوری من (ACTION INBOX) ================= */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-[#F0F4F8] flex items-center gap-2 text-balance">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                  </span>
                  نیازمند اقدام فوری من
                </h2>
                <p className="text-xs text-[#9BA7B6] mt-0.5 text-pretty">
                  پروژه‌های متوقف، ورودی‌های بلاتکلیف فروش و پروژه‌های آماده تایید نهایی QC
                </p>
              </div>

              {/* فیلتر دسته‌بندی کارتابل */}
              <div className="flex items-center gap-1.5 bg-[#111620] p-1 rounded-lg border border-[#212835] tabular-nums">
                <button
                  type="button"
                  onClick={() => setActiveUrgentCategory('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059] ${
                    activeUrgentCategory === 'ALL'
                      ? 'bg-[#C5A059] text-[#0D1117]'
                      : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
                  }`}
                >
                  همه ({toPersianDigits(totalUrgentCount)})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUrgentCategory('STUCK')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 ${
                    activeUrgentCategory === 'STUCK'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-400 hover:text-rose-300'
                  }`}
                >
                  🔴 متوقف ({toPersianDigits(stuckProjects.length + blockingTickets.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUrgentCategory('INCOMING')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
                    activeUrgentCategory === 'INCOMING'
                      ? 'bg-amber-500 text-[#0D1117]'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  🟡 ورودی جدید ({toPersianDigits(incomingProjects.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUrgentCategory('QC')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 ${
                    activeUrgentCategory === 'QC'
                      ? 'bg-purple-600 text-white'
                      : 'text-purple-400 hover:text-purple-300'
                  }`}
                >
                  🟣 تایید QC ({toPersianDigits(pendingQcProjects.length)})
                </button>
              </div>
            </div>

            {/* محتوای صف اقدام */}
            <div className="space-y-3">
              {/* 1. الف: پروژه‌های متوقف و موانع کارگاهی */}
              {(activeUrgentCategory === 'ALL' || activeUrgentCategory === 'STUCK') &&
                stuckProjects.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-[#161214] border border-rose-500/40 text-xs shadow-sm hover:border-rose-500/70 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider">
                            توقف عملیات
                          </span>
                          <span className="font-mono text-[11px] text-rose-400 font-bold">
                            {p.code}
                          </span>
                          <span className="text-xs font-bold text-[#F0F4F8] truncate">
                            {p.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#9BA7B6] mt-2">
                          <span>کارفرما: <strong className="text-[#F0F4F8]">{p.customerName}</strong></span>
                          {p.customerPhone && (
                            <a
                              href={`tel:${p.customerPhone}`}
                              className="text-rose-400 hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              {p.customerPhone}
                            </a>
                          )}
                          {p.address && (
                            <span className="flex items-center gap-1 text-[#637184] truncate max-w-xs">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {p.address}
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">علت توقف کارگاه: </span>
                            <span>
                              {p.stuckIncident?.description ||
                                (p.stuckIncidents && p.stuckIncidents[0]?.description) ||
                                'کسری یراق‌آلات یا نقایص فنی محل نصب'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* دکمه اقدام روی کارت */}
                      <div className="flex shrink-0 justify-end items-center">
                        <button
                          type="button"
                          onClick={() => onOpenProject(p)}
                          className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          بررسی و رفع توقف
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* تیکت‌های مسدودکننده (Blocking Tickets) */}
              {(activeUrgentCategory === 'ALL' || activeUrgentCategory === 'STUCK') &&
                blockingTickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-[#161214] border border-rose-500/40 text-xs shadow-sm hover:border-rose-500/70 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="grow min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                            تیکت مسدودکننده
                          </span>
                          {(t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote)) && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-600 text-white flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              ارجاع به انبار ({t.assignedUserName || 'انبار'})
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-rose-400 font-bold">{t.projectCode}</span>
                          <span className="text-xs font-bold text-[#F0F4F8]">{t.projectTitle}</span>
                        </div>
                        <p className="text-rose-200/90 text-xs mt-2">
                          {t.blockingReason || t.description}
                        </p>
                        {t.referralNote && (
                          <p className="text-purple-300 text-[11px] mt-1 bg-purple-950/40 p-2 rounded border border-purple-500/30">
                            دستور اقدام به انبار: {t.referralNote}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote)) && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('materials')}
                            className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 shadow-xs"
                          >
                            <Package className="w-3.5 h-3.5" />
                            اقدام در لجستیک
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onNavigateTab('tickets')}
                          className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          رسیدگی در مرکز تیکت
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* 1. ب: پروژه‌های نیازمند تعیین اکیپ یا تاریخ زمان‌بندی */}
              {(activeUrgentCategory === 'ALL' || activeUrgentCategory === 'INCOMING') &&
                incomingProjects.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-[#14171E] border border-amber-500/30 text-xs shadow-sm hover:border-amber-500/60 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-[#0D1117]">
                            ورودی جدید فروش
                          </span>
                          <span className="font-mono text-[11px] text-amber-400 font-bold">
                            {p.code}
                          </span>
                          <span className="text-xs font-bold text-[#F0F4F8] truncate">
                            {p.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#9BA7B6] mt-2">
                          <span>کارفرما: <strong className="text-[#F0F4F8]">{p.customerName}</strong></span>
                          {p.customerPhone && (
                            <a
                              href={`tel:${p.customerPhone}`}
                              aria-label={`تماس با کارفرما: ${p.customerName}`}
                              className="text-[#C5A059] hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span className="tabular-nums" dir="ltr">{p.customerPhone}</span>
                            </a>
                          )}
                          <span>ثبت‌شده توسط: <strong className="text-[#F0F4F8]">{p.salesRepName || 'واحد فروش'}</strong></span>
                          <span>
                            حجم اقلام: <strong className="text-[#C5A059] tabular-nums">{toPersianDigits((p.shadePanels || 0) + (p.curtainPanels || 0))} لت</strong>
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-[#9BA7B6]">
                          وضعیت تحویل فنی / اندازه‌گیری 2:
                          {p.technicalHandover?.isHandoverComplete ? (
                            <span className="text-emerald-400 font-bold mr-1">تایید فنی نهایی شده (آماده نصب)</span>
                          ) : (
                            <span className="text-amber-400 mr-1">در انتظار تکمیل اندازه‌گیری دوم</span>
                          )}
                        </div>
                      </div>

                      {/* دکمه اقدام روی کارت */}
                      <div className="flex shrink-0 justify-end items-center">
                        <button
                          type="button"
                          onClick={() => onOpenProject(p)}
                          className="px-3.5 py-2 rounded-lg bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                        >
                          تخصیص اکیپ و تاریخ
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* 1. ج: پروژه‌های اتمام‌یافته در انتظار تایید QC */}
              {(activeUrgentCategory === 'ALL' || activeUrgentCategory === 'QC') &&
                pendingQcProjects.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-[#15131C] border border-purple-500/40 text-xs shadow-sm hover:border-purple-500/70 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-600 text-white">
                            در انتظار تایید کیفی QC
                          </span>
                          <span className="font-mono text-[11px] text-purple-400 font-bold">
                            {p.code}
                          </span>
                          <span className="text-xs font-bold text-[#F0F4F8] truncate">
                            {p.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#9BA7B6] mt-2">
                          <span>کارفرما: <strong className="text-[#F0F4F8]">{p.customerName}</strong></span>
                          <span>اکیپ نصب: <strong className="text-purple-300">{p.assignedTeamId || 'اکیپ فنی'}</strong></span>
                          {p.customerSatisfaction && (
                            <span className="flex items-center gap-1 text-amber-400 font-bold tabular-nums">
                              <Star className="w-3 h-3 fill-amber-400" />
                              رضایت کارفرما: {toPersianDigits(p.customerSatisfaction)} از 5
                            </span>
                          )}
                          {p.customerSignature && (
                            <span className="text-emerald-400 font-medium">✓ امضای تحویل ثبت شده</span>
                          )}
                        </div>

                        <p className="mt-1.5 text-[11px] text-[#9BA7B6] text-pretty">
                          عملیات نصب پایان یافته و منتظر ارزیابی استانداردهای کیفی جهت صدور شناسنامه گارانتی است.
                        </p>
                      </div>

                      {/* دکمه اقدام روی کارت */}
                      <div className="flex shrink-0 justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenQcProject) {
                              onOpenQcProject(p);
                            } else {
                              onNavigateTab('qc');
                            }
                          }}
                          className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          بررسی در میز QC
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenProject(p)}
                          className="px-3 py-2 rounded-lg bg-[#1C232D] hover:bg-[#252F3D] text-[#9BA7B6] hover:text-[#F0F4F8] font-bold text-xs transition border border-[#2D3748] cursor-pointer active:scale-95"
                        >
                          پرونده کامل
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* حالت بدون فوریت */}
              {totalUrgentCount === 0 && (
                <div className="p-8 text-center text-[#637184] space-y-2 border border-dashed border-[#212835] rounded-xl bg-[#111620]/50">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-[#F0F4F8]">
                    خدا قوت! هیچ پروژه متوقف، ورودی بلاتکلیف یا مورد فوری وجود ندارد
                  </p>
                  <p className="text-xs text-[#637184]">
                    تمامی اکیپ‌ها در مسیر اجرای ماموریت‌های امروز هستند و جریان کار روان است.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ================= بخش 2: تخته زنده 4 اکیپ نصب در امروز ================= */}
          <section className="space-y-4 pt-4 border-t border-[#212835]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-[#F0F4F8] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C5A059]" />
                  وضعیت زنده 4 اکیپ نصب در امروز
                </h2>
                <p className="text-xs text-[#9BA7B6] mt-0.5">
                  پروژه جاری هر اکیپ، سرپرست، و وضعیت تحویل متریال از انبار
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('planner')}
                className="text-xs font-bold text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
              >
                باز کردن تقویم 4 روزه
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {liveTeams.map(({ team, activeProject, status, isWarehouseReady, packedBy, technicians }) => {
                const statusBadge = {
                  ON_MISSION: {
                    label: 'در حال نصب',
                    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold animate-pulse',
                  },
                  STANDBY: {
                    label: 'برنامه‌ریزی‌شده',
                    cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30 font-semibold',
                  },
                  AVAILABLE: {
                    label: 'آزاد و در دسترس',
                    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold',
                  },
                  STUCK: {
                    label: 'کارگاه متوقف',
                    cls: 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-black',
                  },
                }[status];

                const warehouseBadge = isWarehouseReady
                  ? {
                      label: `بارگیری کامل انبار ✅${packedBy ? ` (${packedBy})` : ''}`,
                      cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    }
                  : {
                      label: 'در انتظار آماده‌سازی انبار ⏳',
                      cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                    };

                return (
                  <div
                    key={team.id}
                    className={`rounded-xl bg-[#151B23] border p-4 flex flex-col justify-between shadow-sm transition ${
                      status === 'STUCK'
                        ? 'border-rose-500/50 shadow-rose-950/20'
                        : status === 'ON_MISSION'
                        ? 'border-amber-500/40'
                        : 'border-[#212835]'
                    }`}
                  >
                    <div>
                      {/* سربرگ اکیپ */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h3 className="font-bold text-sm text-[#F0F4F8]">
                            {team.supervisorName
                              ? `اکیپ نصب ${getDisplayName(team.supervisorName)}`
                              : team.name}
                          </h3>
                          <p className="text-xs text-[#9BA7B6] mt-0.5">
                            سرپرست: {team.supervisorName || 'تعیین نشده'}
                          </p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* ماموریت امروز */}
                      <div className="mb-3">
                        <div className="text-[11px] font-semibold text-[#637184] mb-1.5">
                          ماموریت امروز:
                        </div>
                        {activeProject ? (
                          <div className="p-2.5 rounded-lg bg-[#111620] border border-[#212835] space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-[#F0F4F8]">
                              <span className="truncate">{activeProject.title}</span>
                              <span className="font-mono text-[10px] text-[#C5A059] shrink-0">
                                {activeProject.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#9BA7B6] flex items-center justify-between">
                              <span>کارفرما: {activeProject.customerName}</span>
                              {isProjectMultiDay(activeProject) && (
                                <span className="text-teal-400 font-bold text-[10px] bg-teal-500/10 px-1.5 py-0.2 rounded">
                                  چندروزه
                                </span>
                              )}
                            </div>
                            {activeProject.address && (
                              <p className="text-[10px] text-[#637184] truncate">
                                📍 {activeProject.address}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-[#111620] border border-dashed border-[#212835] text-center text-xs text-[#637184]">
                            بدون ماموریت برای امروز
                          </div>
                        )}
                      </div>

                      {/* گیت انبار */}
                      {activeProject && (
                        <div className="mb-3">
                          <div className="text-[10px] font-semibold text-[#637184] mb-1">
                            وضعیت بار و قطعات انبار:
                          </div>
                          <div className={`p-1.5 rounded text-[11px] font-medium border text-center ${warehouseBadge.cls}`}>
                            {warehouseBadge.label}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* دکمه‌های عملیات اکیپ */}
                    <div className="pt-3 border-t border-[#212835] flex items-center gap-2">
                      {activeProject ? (
                        <button
                          type="button"
                          onClick={() => onOpenProject(activeProject)}
                          className="w-full py-1.5 rounded-lg bg-[#1C232D] hover:bg-[#252F3D] text-[#C5A059] hover:text-[#D4AF37] text-xs font-bold transition flex items-center justify-center gap-1 border border-[#C5A059]/30 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                        >
                          مشاهده پرونده پروژه
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('planner')}
                          className="w-full py-1.5 rounded-lg bg-[#1C232D] hover:bg-[#252F3D] text-[#9BA7B6] hover:text-[#F0F4F8] text-xs font-semibold transition border border-[#212835] cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                        >
                          تخصیص ماموریت در تقویم
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ================= بخش 3: دسترسی‌های سریع و نبض روزانه ================= */}
          <section className="pt-4 border-t border-[#212835]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#151B23] border border-[#212835]">
                <div className="flex items-center justify-between text-[#9BA7B6] text-xs mb-1">
                  <span>پروژه‌های فعال امروز</span>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-black text-[#F0F4F8] tabular-nums">
                  {toPersianDigits(activeSitesCount)} کارگاه
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#151B23] border border-[#212835]">
                <div className="flex items-center justify-between text-[#9BA7B6] text-xs mb-1">
                  <span>پروژه‌های تایید نهایی QC</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 tabular-nums">
                  {toPersianDigits(approvedQcCount)} پروژه
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#151B23] border border-[#212835]">
                <div className="flex items-center justify-between text-[#9BA7B6] text-xs mb-1">
                  <span>تعهد 72 ساعته SLA</span>
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-xl font-black text-blue-400 tabular-nums">
                  {toPersianDigits(slaMetrics.onTimeRate)}٪ رعایت
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#151B23] border border-[#212835]">
                <div className="flex items-center justify-between text-[#9BA7B6] text-xs mb-1">
                  <span>رضایت کارفرمایان</span>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                </div>
                <div className="text-xl font-black text-[#F0F4F8] tabular-nums">
                  {avgSatisfaction > 0 ? `${toPersianDigits(avgSatisfaction)} از 5` : '—'}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* ================= نمای گزارش آماری و هوش عملیاتی (ANALYTICS) ================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-5 rounded-xl bg-[#151B23] border border-[#212835] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#F0F4F8] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#C5A059]" />
                  شاخص‌های عملکردی و هوش تجاری واحد فنی
                </h3>
                <p className="text-xs text-[#9BA7B6] mt-0.5">
                  گزارش رسمی جهت ارائه در جلسات مدیریتی و ارزیابی کیفیت کار تکنسین‌ها
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('ACTIONS')}
                className="text-xs font-bold text-[#C5A059] hover:underline cursor-pointer"
              >
                بازگشت به صف اقدام روزمره
              </button>
            </div>

            {/* کارت‌های خلاصه KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-lg bg-[#111620] border border-[#212835]">
                <span className="text-[11px] text-[#9BA7B6] block mb-1">کل پروژه‌های ثبت‌شده</span>
                <span className="text-xl font-bold text-[#F0F4F8] tabular-nums">
                  {toPersianDigits(projects.length)}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#111620] border border-[#212835]">
                <span className="text-[11px] text-[#9BA7B6] block mb-1">حل تیکت‌ها در موعد SLA</span>
                <span className="text-xl font-bold text-emerald-400 tabular-nums">
                  {toPersianDigits(slaMetrics.onTimeRate)}٪
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#111620] border border-[#212835]">
                <span className="text-[11px] text-[#9BA7B6] block mb-1">تیکت‌های بحرانی باقیمانده</span>
                <span className="text-xl font-bold text-rose-400 tabular-nums">
                  {toPersianDigits(slaMetrics.openOverdue)}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#111620] border border-[#212835]">
                <span className="text-[11px] text-[#9BA7B6] block mb-1">متریال تحویل‌شده به کارگاه</span>
                <span className="text-xl font-bold text-[#C5A059] tabular-nums">
                  {toPersianDigits(
                    materialRequests.filter((r) => r.status === 'DELIVERED_CONFIRMED').length
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
