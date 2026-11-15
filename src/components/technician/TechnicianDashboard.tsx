import React, { useState, useEffect } from 'react';
import { Project, User, SystemSettings, ProjectStatus, MaterialRequest } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Calendar, Users, WifiOff, AlertOctagon } from 'lucide-react';
import { getUpcomingDays, toPersianDigits, getTodayPersianString } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { isProjectScheduledOnDate } from '../../utils/multiDay';

interface Props {
  currentUser: User;
  settings: SystemSettings;
  projects: Project[];
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onOpenDailyLogModal?: (project: Project) => void;
  onUpdateStatus: (projectId: string, from: ProjectStatus, to: ProjectStatus) => void;
  onSavePreInstallPhotosAndStart?: (projectId: string, photos: string[]) => Promise<void> | void;
  onOpenCertificate?: (project: Project) => void;
  onReportStuck?: (project: Project) => void;
  onConfirmTransfer?: (project: Project) => void;
  materialRequests?: MaterialRequest[];
  onOpenMaterialModal?: (project: Project) => void;
  onConfirmMaterialReceipt?: (request: MaterialRequest, dispatchId: string) => void;
  onResolveDefect?: (projectId: string, defectId: string, resolutionNotes: string, photos?: string[]) => void;
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
  onOpenDailyLogModal,
  onUpdateStatus,
  onSavePreInstallPhotosAndStart,
  onOpenCertificate,
  onReportStuck,
  onConfirmTransfer,
  materialRequests = [],
  onOpenMaterialModal,
  onConfirmMaterialReceipt,
  onResolveDefect,
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
      projects.some((p) => isProjectScheduledOnDate(p, day.dateKey) && isProjectAssignedToMe(p))
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
          projects.some((p) => isProjectScheduledOnDate(p, day.dateKey) && isProjectAssignedToMe(p))
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

  // PRIORITY JOBS: In-Flight, Stuck, Paused, or QC Rejected that need immediate attention
  const openProjects = projects.filter((p) => {
    if (!isProjectAssignedToMe(p)) return false;
    const isEnRouteOrInProgress = p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS';
    const isStuck = p.status === 'STUCK';
    const isPaused = p.status === 'PAUSED';
    const isQcRejected = p.qcStatus === 'REJECTED';
    const hasUnresolvedDefects = Boolean(
      p.qcDefects && p.qcDefects.some((d) => d.status !== 'RESOLVED' && d.status !== 'VERIFIED')
    );
    return isEnRouteOrInProgress || isStuck || isPaused || isQcRejected || hasUnresolvedDefects;
  });

  // OPEN PROJECT IDS for deduplication so no job ever appears twice!
  const openProjectIds = new Set(openProjects.map((p) => p.id));

  // TODAY'S JOBS (for greeting summary)
  const todayKey = visibleDays.find((d) => d.isToday)?.dateKey;
  const todayProjectsCount = todayKey
    ? projects.filter(
        (p) => isProjectScheduledOnDate(p, todayKey) && isProjectAssignedToMe(p)
      ).length
    : 0;

  // SCHEDULED JOBS for selected date (strictly excluding open projects already displayed above)
  const filteredScheduledProjects = projects.filter((p) => {
    if (!isProjectScheduledOnDate(p, selectedDateKey)) return false;
    // DEDUPLICATION: if already shown in priority open projects, skip here!
    if (openProjectIds.has(p.id)) return false;
    if (isLead && viewScope === 'ALL_DAY_JOBS') return true;
    return isProjectAssignedToMe(p);
  });

  const selectedDayInfo = visibleDays.find((d) => d.dateKey === selectedDateKey);

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-12">
      {/* Technician Greeting Header (Industrial dark surface, clean hierarchy) */}
      <div className="bg-[#151B23] rounded-lg p-4 sm:p-5 text-[#F0F4F8] border border-[#212835] flex items-center justify-between">
        <div>
          <div className="text-xs text-[#C5A059] font-medium tracking-wide">
            {getTodayPersianString()}
          </div>
          <h2 className="font-bold text-base sm:text-lg text-[#F0F4F8] mt-0.5">
            سلام، {getDisplayName(currentUser.name)}
          </h2>
          <div className="text-xs text-[#9BA7B6] mt-0.5">
            {todayProjectsCount > 0 ? (
              <span className="text-[#E5CA8F] font-semibold">
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
            <span className="text-[11px] text-[#637184]">نمایش:</span>
            <div className="flex items-center gap-1 bg-[#0D1117] p-1 rounded-md border border-[#212835] text-xs">
              <button
                type="button"
                onClick={() => setViewScope('MY_JOBS')}
                className={`min-h-[36px] min-w-[36px] px-3 py-1.5 rounded font-semibold transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] active:scale-95 ${
                  viewScope === 'MY_JOBS'
                    ? 'bg-[#C5A059] text-[#0D1117]'
                    : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
                }`}
              >
                اکیپ من
              </button>
              <button
                type="button"
                onClick={() => setViewScope('ALL_DAY_JOBS')}
                className={`min-h-[36px] min-w-[36px] px-3 py-1.5 rounded font-semibold transition cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] active:scale-95 ${
                  viewScope === 'ALL_DAY_JOBS'
                    ? 'bg-[#C5A059] text-[#0D1117]'
                    : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
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
        <div className="space-y-3 bg-[#1F1315] p-3.5 sm:p-4 rounded-lg border border-rose-500/30">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>کارهای فعال و نیازمند پیگیری:</span>
            </div>
            <span className="text-xs bg-rose-600/90 text-white px-2 py-0.5 rounded font-bold tabular-nums">
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
                onOpenDailyLogModal={onOpenDailyLogModal}
                onUpdateStatus={onUpdateStatus}
                onSavePreInstallPhotosAndStart={onSavePreInstallPhotosAndStart}
                onOpenCertificate={onOpenCertificate}
                onReportStuck={onReportStuck}
                onConfirmTransfer={onConfirmTransfer}
                materialRequests={materialRequests}
                onOpenMaterialModal={onOpenMaterialModal}
                onConfirmMaterialReceipt={onConfirmMaterialReceipt}
                onResolveDefect={onResolveDefect}
                isTransitioning={inFlightTransitions?.has(proj.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Horizontal Day Tabs */}
      <div>
        <div className="text-xs font-semibold text-[#F0F4F8] mb-2 px-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>برنامه روزهای کاری:</span>
          </span>
          <span className="text-xs text-[#9BA7B6] tabular-nums">
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
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[72px] min-h-[64px] py-2 px-2.5 rounded-md border transition text-center active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                  isSelected
                    ? 'bg-[#1C232D] text-[#E5CA8F] border-[#C5A059] ring-1 ring-[#C5A059]/40 font-bold'
                    : 'bg-[#151B23] text-[#9BA7B6] border-[#212835] hover:border-[#2D3748] hover:text-[#F0F4F8]'
                }`}
              >
                <span className="text-xs font-medium">
                  {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                </span>
                <span className="text-sm font-bold my-0.5 tabular-nums">
                  {toPersianDigits(day.persianDayNum)}
                </span>
                <span className="text-[11px] opacity-75">{day.persianMonthName}</span>

                {count > 0 && (
                  <span
                    className={`mt-1 text-[11px] px-1.5 py-0.2 rounded font-bold tabular-nums ${
                      isSelected
                        ? 'bg-[#C5A059] text-[#0D1117]'
                        : 'bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/30'
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
          <div className="text-xs font-semibold text-[#F0F4F8]">
            مأموریت‌های {selectedDayInfo?.persianDayName} {selectedDayInfo?.persianDayNum}{' '}
            {selectedDayInfo?.persianMonthName}:
          </div>
          <span className="text-xs text-[#9BA7B6] font-medium tabular-nums">
            {toPersianDigits(filteredScheduledProjects.length)} مأموریت
          </span>
        </div>

        {filteredScheduledProjects.length === 0 ? (
          <div className="bg-[#151B23] rounded-lg p-6 text-center border border-[#212835] space-y-1">
            <h4 className="font-semibold text-xs sm:text-sm text-[#F0F4F8]">
              مأموریتی برای این روز برنامه‌ریزی نشده است
            </h4>
            <p className="text-xs text-[#9BA7B6]">
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
              onOpenDailyLogModal={onOpenDailyLogModal}
              onUpdateStatus={onUpdateStatus}
              onSavePreInstallPhotosAndStart={onSavePreInstallPhotosAndStart}
              onOpenCertificate={onOpenCertificate}
              onReportStuck={onReportStuck}
              onConfirmTransfer={onConfirmTransfer}
              materialRequests={materialRequests}
              onOpenMaterialModal={onOpenMaterialModal}
              onConfirmMaterialReceipt={onConfirmMaterialReceipt}
              onResolveDefect={onResolveDefect}
              isTransitioning={inFlightTransitions?.has(proj.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
