import React, { useState, useEffect } from 'react';
import { Project, User, SystemSettings, ProjectStatus } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Calendar, Users, ArrowLeft, Sparkles, AlertOctagon } from 'lucide-react';
import { getUpcomingDays, toPersianDigits } from '../../utils/jalali';

interface Props {
  currentUser: User;
  settings: SystemSettings;
  projects: Project[];
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onUpdateStatus: (projectId: string, from: ProjectStatus, to: ProjectStatus) => void;
  onOpenCertificate?: (project: Project) => void;
  onReportStuck?: (project: Project) => void;
  inFlightTransitions?: Set<string>;
}

export const TechnicianDashboard: React.FC<Props> = ({
  currentUser,
  settings,
  projects,
  onViewProposal,
  onOpenToolChecklist,
  onOpenTicketModal,
  onOpenCompletionModal,
  onUpdateStatus,
  onOpenCertificate,
  onReportStuck,
  inFlightTransitions,
}) => {
  const isLead = currentUser.role === 'LEAD_TECHNICIAN';

  // Helper to check if a project belongs to current user
  const isProjectAssignedToMe = (p: Project) => {
    const techIds = p.assignedTechnicianIds || [];
    return techIds.includes(currentUser.id) || p.leadTechnicianId === currentUser.id;
  };

  const [visibleDays, setVisibleDays] = useState(() =>
    getUpcomingDays(30).slice(0, settings.visibilityWindowDays)
  );

  // Find the first day with assigned jobs or fallback to first visible day
  const defaultDayKey =
    visibleDays.find((day) =>
      projects.some((p) => p.scheduledDate === day.dateKey && isProjectAssignedToMe(p))
    )?.dateKey || visibleDays[0]?.dateKey || '';

  const [selectedDateKey, setSelectedDateKey] = useState<string>(defaultDayKey);
  const [viewScope, setViewScope] = useState<'MY_JOBS' | 'ALL_DAY_JOBS'>('MY_JOBS');

  useEffect(() => {
    const updateDays = () => {
      const freshVisible = getUpcomingDays(30).slice(0, settings.visibilityWindowDays);
      setVisibleDays(freshVisible);
      setSelectedDateKey((prev) => {
        if (freshVisible.some((d) => d.dateKey === prev)) {
          return prev;
        }
        const assignedDay = freshVisible.find((day) =>
          projects.some((p) => p.scheduledDate === day.dateKey && isProjectAssignedToMe(p))
        );
        return assignedDay?.dateKey || freshVisible[0]?.dateKey || '';
      });
    };

    const interval = setInterval(updateDays, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateDays();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [settings.visibilityWindowDays, projects, currentUser.id]);

  const filteredProjects = projects.filter((p) => {
    if (p.scheduledDate !== selectedDateKey) return false;
    if (isLead && viewScope === 'ALL_DAY_JOBS') return true;
    return isProjectAssignedToMe(p);
  });

  // Persistent Open Jobs (In-Flight, Stuck, or QC Rejected) regardless of scheduled date
  const openProjects = projects.filter((p) => {
    if (!isProjectAssignedToMe(p)) return false;
    const isEnRouteOrInProgress = p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS';
    const isStuck = p.status === 'STUCK';
    const isQcRejected = p.qcStatus === 'REJECTED';
    return isEnRouteOrInProgress || isStuck || isQcRejected;
  });

  const selectedDayInfo = visibleDays.find((d) => d.dateKey === selectedDateKey);

  // Find other days that have projects assigned to me
  const otherDayWithProjects = visibleDays.find(
    (d) =>
      d.dateKey !== selectedDateKey &&
      projects.some((p) => p.scheduledDate === d.dateKey && isProjectAssignedToMe(p))
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto safe-bottom-padding">
      {/* Top Welcome Card with Brand Logo & Obsidian/Gold Style */}
      <div className="bg-[#212121] rounded-3xl p-5 text-white shadow-xl relative overflow-hidden border border-[#C1A056]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-2xl bg-white/5 border border-[#C1A056]/40 flex items-center justify-center p-2 shadow-inner">
              <img
                src="./talaei-lion-gold.png"
                alt="نشان گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base sm:text-lg text-white">{currentUser.name}</h2>
              </div>
              <p className="text-xs text-[#C1A056] font-bold mt-0.5">
                {currentUser.role === 'LEAD_TECHNICIAN'
                  ? 'سرپرست اکیپ نصب | گالری طلایی'
                  : 'تکنسین فنی و اجرای مأموریت | گالری طلایی'}
              </p>
            </div>
          </div>

          <div className="bg-white/10 px-3 py-1.5 rounded-2xl text-center border border-white/10">
            <span className="text-[10px] text-[#E8E4DC] block">پنجره دید مجاز</span>
            <span className="font-bold text-xs text-[#C1A056] font-mono">
              {toPersianDigits(settings.visibilityWindowDays)} روز
            </span>
          </div>
        </div>

        {/* Lead Technician Scope Switcher */}
        {isLead && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#C1A056]" />
              <span>دامنه دید سرپرست:</span>
            </span>
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setViewScope('MY_JOBS')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  viewScope === 'MY_JOBS'
                    ? 'bg-[#C1A056] text-[#212121]'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                مأموریت‌های اکیپ من
              </button>
              <button
                type="button"
                onClick={() => setViewScope('ALL_DAY_JOBS')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  viewScope === 'ALL_DAY_JOBS'
                    ? 'bg-[#C1A056] text-[#212121]'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                کل پروژه‌های روز
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Open Jobs Section (Always visible above Day Tabs) */}
      {openProjects.length > 0 && (
        <div className="space-y-3 bg-rose-50/40 dark:bg-rose-950/20 p-4 rounded-3xl border border-rose-200/80 dark:border-rose-900/40">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-black text-rose-800 dark:text-rose-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span>کارهای باز من (در حال اجرا، متوقف یا برگشتی از QC):</span>
            </div>
            <span className="text-[11px] bg-rose-600 text-white px-2.5 py-0.5 rounded-full font-bold font-mono shadow-2xs">
              {toPersianDigits(openProjects.length)} مورد
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {openProjects.map((proj) => (
              <ProjectCard
                key={`open-${proj.id}`}
                project={proj}
                currentUser={currentUser}
                onViewProposal={onViewProposal}
                onOpenToolChecklist={onOpenToolChecklist}
                onOpenTicketModal={onOpenTicketModal}
                onOpenCompletionModal={onOpenCompletionModal}
                onUpdateStatus={onUpdateStatus}
                onOpenCertificate={onOpenCertificate}
                onReportStuck={onReportStuck}
                isTransitioning={inFlightTransitions?.has(proj.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Horizontal Day Tabs (Restricted by Visibility Window) */}
      <div>
        <div className="text-xs font-bold text-[#212121] dark:text-[#F5EFEB] mb-2 px-1 flex items-center justify-between">
          <span>روزهای کاری مجاز:</span>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400">
            (برنامه‌ریزی {toPersianDigits(settings.visibilityWindowDays)} روز آینده)
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar" role="tablist" aria-label="روزهای کاری">
          {visibleDays.map((day) => {
            const isSelected = day.dateKey === selectedDateKey;
            const count = projects.filter(
              (p) =>
                p.scheduledDate === day.dateKey &&
                (viewScope === 'ALL_DAY_JOBS' && isLead ? true : isProjectAssignedToMe(p))
            ).length;

            return (
              <button
                key={day.dateKey}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedDateKey(day.dateKey)}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[80px] min-h-[72px] py-2.5 px-3 rounded-2xl border transition text-center active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-[#212121] dark:bg-[#C1A056] text-[#C1A056] dark:text-[#121212] border-[#C1A056] shadow-sm font-bold'
                    : 'bg-white dark:bg-[#1C1C1C] text-slate-700 dark:text-zinc-300 border-[#E8E4DC] dark:border-[#2D2D2D] hover:border-[#C1A056]/50'
                }`}
              >
                <span className="text-[11px] font-bold">
                  {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                </span>
                <span className="text-base font-black font-mono my-0.5">
                  {toPersianDigits(day.persianDayNum)}
                </span>
                <span className="text-[9px] opacity-80">{day.persianMonthName}</span>

                {count > 0 && (
                  <span
                    className={`mt-1 text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-[#C1A056] dark:bg-[#121212] text-[#212121] dark:text-[#C1A056]'
                        : 'bg-[#FAF7F2] dark:bg-[#252525] text-[#A88738] dark:text-[#C1A056] border border-[#C1A056]/30'
                    }`}
                  >
                    {toPersianDigits(count)} مأموریت
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Projects List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#212121] dark:text-[#F5EFEB]">
            <Calendar className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
            <span>
              مأموریت‌های {selectedDayInfo?.persianDayName} {selectedDayInfo?.persianDayNum}{' '}
              {selectedDayInfo?.persianMonthName}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono font-bold">
            {toPersianDigits(filteredProjects.length)} مأموریت
          </span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-8 text-center border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] dark:bg-[#222222] border border-[#E8E4DC] dark:border-[#333333] flex items-center justify-center mx-auto text-[#C1A056]">
              <Calendar className="w-6 h-6" aria-hidden="true" />
            </div>
            <h4 className="font-bold text-sm text-[#212121] dark:text-white">برای این روز مأموریتی ثبت نشده است</h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              در حال حاضر پروژه‌ای برای این تاریخ در کارتابل شما نیست.
            </p>

            {otherDayWithProjects && (
              <button
                type="button"
                onClick={() => setSelectedDateKey(otherDayWithProjects.dateKey)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#FAF7F2] dark:bg-[#252525] hover:bg-[#F2ECE1] text-[#A88738] dark:text-[#C1A056] border border-[#C1A056]/40 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <span>مشاهده مأموریت‌های {otherDayWithProjects.isToday ? 'امروز' : otherDayWithProjects.dayOffset === 1 ? 'فردا' : otherDayWithProjects.persianDayName}</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          filteredProjects.map((proj) => (
            <ProjectCard
              key={proj.id}
              project={proj}
              currentUser={currentUser}
              onViewProposal={onViewProposal}
              onOpenToolChecklist={onOpenToolChecklist}
              onOpenTicketModal={onOpenTicketModal}
              onOpenCompletionModal={onOpenCompletionModal}
              onUpdateStatus={onUpdateStatus}
              onOpenCertificate={onOpenCertificate}
              onReportStuck={onReportStuck}
              isTransitioning={inFlightTransitions?.has(proj.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
