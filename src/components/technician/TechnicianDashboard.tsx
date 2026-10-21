import React, { useState } from 'react';
import { Project, User, SystemSettings } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Calendar } from 'lucide-react';
import { getUpcomingDays, toPersianDigits } from '../../utils/jalali';

interface Props {
  currentUser: User;
  settings: SystemSettings;
  projects: Project[];
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onUpdateStatus: (projectId: string, newStatus: Project['status']) => void;
  onOpenCertificate?: (project: Project) => void;
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
}) => {
  const allDays = getUpcomingDays(30);
  const visibleDays = allDays.slice(0, settings.visibilityWindowDays);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    visibleDays[0]?.dateKey || ''
  );

  const assignedProjects = projects.filter(
    (p) =>
      p.scheduledDate === selectedDateKey &&
      p.assignedTechnicianIds.includes(currentUser.id)
  );

  const selectedDayInfo = visibleDays.find((d) => d.dateKey === selectedDateKey);

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
            <span className="text-[10px] text-[#E8E4DC] block">پنجره مجاز</span>
            <span className="font-bold text-xs text-[#C1A056] font-mono">
              {toPersianDigits(settings.visibilityWindowDays)} روز
            </span>
          </div>
        </div>
      </div>

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
                p.assignedTechnicianIds.includes(currentUser.id)
            ).length;

            return (
              <button
                key={day.dateKey}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedDateKey(day.dateKey)}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[80px] min-h-[72px] py-2.5 px-3 rounded-2xl border transition text-center active:scale-95 ${
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
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
            {toPersianDigits(assignedProjects.length)} مأموریت
          </span>
        </div>

        {assignedProjects.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-10 text-center border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] dark:bg-[#222222] border border-[#E8E4DC] dark:border-[#333333] flex items-center justify-center mx-auto text-[#C1A056]">
              <Calendar className="w-6 h-6" aria-hidden="true" />
            </div>
            <h4 className="font-bold text-sm text-[#212121] dark:text-white">برای این روز مأموریتی ثبت نشده است</h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              در حال حاضر برنامه‌ای برای شما تعریف نشده است یا مأموریت‌های روزهای بعد هنوز توسط مدیر کیوسی باز نشده‌اند.
            </p>
          </div>
        ) : (
          assignedProjects.map((proj) => (
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
            />
          ))
        )}
      </div>
    </div>
  );
};
