import React, { useState, useEffect } from 'react';
import { Project, User, SystemSettings, ProjectStatus } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Calendar, Users, WifiOff, AlertOctagon } from 'lucide-react';
import { getUpcomingDays, toPersianDigits, getTodayPersianString } from '../../utils/jalali';

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

  // PRIORITY JOBS: In-Flight, Stuck, or QC Rejected that need immediate attention
  const openProjects = projects.filter((p) => {
    if (!isProjectAssignedToMe(p)) return false;
    const isEnRouteOrInProgress = p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS';
    const isStuck = p.status === 'STUCK';
    const isQcRejected = p.qcStatus === 'REJECTED';
    return isEnRouteOrInProgress || isStuck || isQcRejected;
  });

  // OPEN PROJECT IDS for deduplication so no job ever appears twice!
  const openProjectIds = new Set(openProjects.map((p) => p.id));

  // TODAY'S JOBS (for greeting summary)
  const todayKey = visibleDays.find((d) => d.isToday)?.dateKey;
  const todayProjectsCount = projects.filter(
    (p) => p.scheduledDate === todayKey && isProjectAssignedToMe(p)
  ).length;

  // SCHEDULED JOBS for selected date (strictly excluding open projects already displayed above)
  const filteredScheduledProjects = projects.filter((p) => {
    if (p.scheduledDate !== selectedDateKey) return false;
    // DEDUPLICATION: if already shown in priority open projects, skip here!
    if (openProjectIds.has(p.id)) return false;
    if (isLead && viewScope === 'ALL_DAY_JOBS') return true;
    return isProjectAssignedToMe(p);
  });

  const selectedDayInfo = visibleDays.find((d) => d.dateKey === selectedDateKey);

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-12">
      {/* Technician Greeting Header (Clean, mobile-first, high contrast) */}
      <div className="bg-[#212121] rounded-2xl p-4 text-white shadow-md border border-[#C1A056]/30 flex items-center justify-between">
        <div>
          <div className="text-xs text-[#E5CA8F] font-bold">
            {getTodayPersianString()}
          </div>
          <h2 className="font-black text-base sm:text-lg text-white mt-0.5">
            سلام، {currentUser.name}
          </h2>
          <div className="text-xs text-[#BDB8AF] mt-0.5">
            {todayProjectsCount > 0 ? (
              <span className="text-[#E5CA8F] font-bold font-mono">
                {toPersianDigits(todayProjectsCount)} مأموریت برای امروز دارید
              </span>
            ) : (
              <span>امروز مأموریت جدیدی ثبت نشده است</span>
            )}
          </div>
        </div>

        {/* Lead Scope Toggle */}
        {isLead && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] text-zinc-400">نمایش:</span>
            <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/10 text-[11px]">
              <button
                type="button"
                onClick={() => setViewScope('MY_JOBS')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  viewScope === 'MY_JOBS'
                    ? 'bg-[#C1A056] text-[#212121]'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                اکیپ من
              </button>
              <button
                type="button"
                onClick={() => setViewScope('ALL_DAY_JOBS')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  viewScope === 'ALL_DAY_JOBS'
                    ? 'bg-[#C1A056] text-[#212121]'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                همه
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PRIORITY JOBS: Open, in-flight, stuck, or QC-rejected jobs (Show FIRST) */}
      {openProjects.length > 0 && (
        <div className="space-y-3 bg-rose-500/10 dark:bg-rose-950/20 p-3.5 rounded-2xl border border-rose-500/30">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-black text-rose-800 dark:text-rose-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span>کارهای فعال و نیازمند پیگیری:</span>
            </div>
            <span className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold font-mono">
              {toPersianDigits(openProjects.length)}
            </span>
          </div>

          <div className="space-y-3">
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

      {/* Horizontal Day Tabs */}
      <div>
        <div className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] mb-2 px-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#8E6F27] dark:text-[#E5CA8F]" />
            <span>برنامه روزهای کاری:</span>
          </span>
          <span className="text-[11px] text-[#69655F] dark:text-[#9E988D] font-mono">
            (پنجره دید {toPersianDigits(settings.visibilityWindowDays)} روز آینده)
          </span>
        </div>

        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
          role="tablist"
          aria-label="روزهای کاری"
        >
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
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[72px] min-h-[64px] py-2 px-2.5 rounded-xl border transition text-center active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-[#212121] text-[#E5CA8F] border-[#C1A056] shadow-xs font-bold ring-1 ring-[#C1A056]/30'
                    : 'bg-white dark:bg-[#1A1A1A] text-[#4A4742] dark:text-[#BDB8AF] border-[#E2DDD4] dark:border-[#2C2C2C] hover:border-[#C1A056]/50'
                }`}
              >
                <span className="text-[11px] font-bold">
                  {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                </span>
                <span className="text-sm font-black font-mono my-0.5">
                  {toPersianDigits(day.persianDayNum)}
                </span>
                <span className="text-[9px] opacity-75">{day.persianMonthName}</span>

                {count > 0 && (
                  <span
                    className={`mt-1 text-[9px] px-1.5 rounded-full font-bold font-mono ${
                      isSelected
                        ? 'bg-[#C1A056] text-[#212121]'
                        : 'bg-[#FAF7F2] dark:bg-[#252525] text-[#8E6F27] dark:text-[#E5CA8F] border border-[#C1A056]/30'
                    }`}
                  >
                    {toPersianDigits(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Scheduled Jobs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF]">
            مأموریت‌های {selectedDayInfo?.persianDayName} {selectedDayInfo?.persianDayNum}{' '}
            {selectedDayInfo?.persianMonthName}:
          </div>
          <span className="text-xs text-[#69655F] dark:text-[#9E988D] font-mono font-bold">
            {toPersianDigits(filteredScheduledProjects.length)} مأموریت
          </span>
        </div>

        {filteredScheduledProjects.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 text-center border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs space-y-1">
            <h4 className="font-bold text-xs sm:text-sm text-[#181818] dark:text-white">
              مأموریتی برای این روز برنامه‌ریزی نشده است
            </h4>
            <p className="text-[11px] text-[#69655F] dark:text-[#9E988D]">
              پروژه‌های باز و در حال اجرای شما در بالای صفحه نمایش داده شده‌اند.
            </p>
          </div>
        ) : (
          filteredScheduledProjects.map((proj) => (
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
