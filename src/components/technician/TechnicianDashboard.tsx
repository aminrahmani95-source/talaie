import React, { useState } from 'react';
import { Project, User, SystemSettings } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Calendar, Clock, CheckCircle2, AlertCircle, Sparkles, Wrench } from 'lucide-react';
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
}) => {
  // Only show days within the QC Manager's configured Visibility Window
  const allDays = getUpcomingDays(30);
  const visibleDays = allDays.slice(0, settings.visibilityWindowDays);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    visibleDays[0]?.dateKey || ''
  );

  // Projects assigned to this user on the selected date
  const assignedProjects = projects.filter(
    (p) =>
      p.scheduledDate === selectedDateKey &&
      p.assignedTechnicianIds.includes(currentUser.id)
  );

  const selectedDayInfo = visibleDays.find((d) => d.dateKey === selectedDateKey);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Top Welcome Card */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
              {currentUser.avatar || '🔧'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base sm:text-lg">{currentUser.name}</h2>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                {currentUser.role === 'LEAD_TECHNICIAN'
                  ? 'سرپرست اکیپ نصب پرده و شید'
                  : 'تکنسین فنی و اجرای مأموریت'}
              </p>
            </div>
          </div>

          <div className="bg-white/10 px-3 py-1 rounded-xl text-center backdrop-blur-xs">
            <span className="text-[10px] text-blue-200 block">پنجره مجاز</span>
            <span className="font-bold text-xs font-mono">
              {toPersianDigits(settings.visibilityWindowDays)} روز
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Day Tabs (Restricted by Visibility Window) */}
      <div>
        <div className="text-xs font-bold text-slate-700 mb-2 px-1 flex items-center justify-between">
          <span>روزهای کاری مجاز:</span>
          <span className="text-[11px] text-slate-500">
            (برنامه‌ریزی {toPersianDigits(settings.visibilityWindowDays)} روز آینده)
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
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
                onClick={() => setSelectedDateKey(day.dateKey)}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[76px] py-2.5 px-3 rounded-2xl border transition text-center ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
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
                        ? 'bg-white text-blue-700'
                        : 'bg-blue-100 text-blue-800'
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
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>
              مأموریت‌های {selectedDayInfo?.persianDayName} {selectedDayInfo?.persianDayNum}{' '}
              {selectedDayInfo?.persianMonthName}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {toPersianDigits(assignedProjects.length)} مأموریت
          </span>
        </div>

        {assignedProjects.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-800">برای این روز مأموریتی ثبت نشده است</h4>
            <p className="text-xs text-slate-500">
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
            />
          ))
        )}
      </div>
    </div>
  );
};
