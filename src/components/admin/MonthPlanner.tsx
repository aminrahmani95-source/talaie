import React, { useState } from 'react';
import { Project, User, SystemSettings } from '../../types';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Eye,
  Sliders,
  MapPin,
  Sparkles,
  Layers,
  Wrench,
  FileText,
  UserCheck,
  CheckCircle2,
  ArrowRightLeft,
} from 'lucide-react';
import { getUpcomingDays, toPersianDigits } from '../../utils/jalali';

interface Props {
  projects: Project[];
  users: User[];
  settings: SystemSettings;
  onUpdateSettings: (settings: SystemSettings) => void;
  onNewProject: (dateKey?: string) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onMoveProjectDate: (projectId: string, newDateKey: string) => void;
  onViewProposal: (project: Project) => void;
}

export const MonthPlanner: React.FC<Props> = ({
  projects,
  users,
  settings,
  onUpdateSettings,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onMoveProjectDate,
  onViewProposal,
}) => {
  const days = getUpcomingDays(30);

  // View mode: '4DAYS' | 'FULL_MONTH'
  const [viewMode, setViewMode] = useState<'4DAYS' | 'FULL_MONTH'>('4DAYS');
  const [startIndex, setStartIndex] = useState(0);

  // Visibility slider handler
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onUpdateSettings({ ...settings, visibilityWindowDays: val });
  };

  // Determine which days to display in the grid
  const displayedDays =
    viewMode === '4DAYS'
      ? days.slice(startIndex, startIndex + 4)
      : days;

  const getUserName = (id?: string) => {
    if (!id) return '';
    return users.find((u) => u.id === id)?.name.split(' (')[0] || '';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Visibility Window & Controls */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <h2 className="text-lg sm:text-xl font-black">
                تقویم برنامه‌ریزی ماهانه مأموریت‌های نصب
              </h2>
            </div>
            <p className="text-xs text-blue-200 mt-1">
              شما به عنوان مدیر کیوسی می‌توانید برنامه‌ریزی ۳۰ روز آینده را مدیریت کنید و مشخص کنید تکنسین‌ها تا چند روز آینده را ببینند.
            </p>
          </div>

          {/* Visibility Window Controller */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 sm:p-4 w-full lg:w-auto shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 font-bold">
                <Eye className="w-4 h-4 text-amber-400" />
                <span>پنجره دید تکنسین‌ها:</span>
              </div>
              <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black font-mono">
                {toPersianDigits(settings.visibilityWindowDays)} روز آینده
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-blue-200">۱ روز</span>
              <input
                type="range"
                min="1"
                max="14"
                value={settings.visibilityWindowDays}
                onChange={handleSliderChange}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-white/20 rounded-lg"
              />
              <span className="text-[10px] text-blue-200">۱۴ روز</span>
            </div>
            <div className="text-[10px] text-amber-200/90 text-center">
              (پروژه‌های بعد از {toPersianDigits(settings.visibilityWindowDays)} روز برای تکنسین‌ها مخفی است)
            </div>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('4DAYS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === '4DAYS'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              نمای ۴ ستونه (کانبان عملیاتی)
            </button>
            <button
              onClick={() => setViewMode('FULL_MONTH')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'FULL_MONTH'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              نمای کامل ۳۰ روز آینده
            </button>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === '4DAYS' && (
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
                <button
                  disabled={startIndex === 0}
                  onClick={() => setStartIndex((i) => Math.max(0, i - 1))}
                  className="p-1 hover:bg-white/20 rounded-lg disabled:opacity-30 transition"
                  title="روزهای قبلی"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 font-mono">
                  روز {toPersianDigits(startIndex + 1)} تا {toPersianDigits(startIndex + 4)}
                </span>
                <button
                  disabled={startIndex + 4 >= days.length}
                  onClick={() => setStartIndex((i) => Math.min(days.length - 4, i + 1))}
                  className="p-1 hover:bg-white/20 rounded-lg disabled:opacity-30 transition"
                  title="روزهای بعدی"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => onNewProject()}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت پروژه و مأموریت جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kanban / Calendar Columns Grid */}
      <div
        className={`grid gap-4 ${
          viewMode === '4DAYS'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'
        }`}
      >
        {displayedDays.map((day) => {
          const dayProjects = projects.filter((p) => p.scheduledDate === day.dateKey);
          const isVisibleToTechnicians = day.dayOffset < settings.visibilityWindowDays;

          return (
            <div
              key={day.dateKey}
              className={`flex flex-col rounded-3xl border transition shadow-xs ${
                day.isToday
                  ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                  : isVisibleToTechnicians
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-50/80 border-dashed border-slate-300 opacity-90'
              }`}
            >
              {/* Day Column Header */}
              <div
                className={`p-3.5 rounded-t-3xl border-b ${
                  day.isToday
                    ? 'bg-blue-600 text-white'
                    : isVisibleToTechnicians
                    ? 'bg-slate-100/80 text-slate-800'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">
                      {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                    </span>
                    <span className="text-xs opacity-90">
                      {day.persianDayNum} {day.persianMonthName}
                    </span>
                  </div>

                  {/* Technician visibility pill */}
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                      isVisibleToTechnicians
                        ? day.isToday
                          ? 'bg-blue-800/80 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-300 text-slate-700'
                    }`}
                    title={
                      isVisibleToTechnicians
                        ? 'تکنسین‌ها این روز را در گوشی خود می‌بینند'
                        : 'این روز هنوز برای تکنسین‌ها باز نشده است'
                    }
                  >
                    <Eye className="w-2.5 h-2.5" />
                    <span>{isVisibleToTechnicians ? 'دید تکنسین' : 'مخفی'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10 text-[11px]">
                  <span>
                    {toPersianDigits(dayProjects.length)} مأموریت ثبت‌شده
                  </span>
                  <button
                    onClick={() => onNewProject(day.dateKey)}
                    className="p-1 hover:bg-black/10 rounded-lg transition"
                    title="افزودن مأموریت به این روز"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Projects List in this Day */}
              <div className="p-3 space-y-3 flex-1 overflow-y-auto min-h-[160px]">
                {dayProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5 text-slate-300" />
                    </div>
                    <span className="text-xs font-medium">مأموریتی نیست</span>
                    <button
                      onClick={() => onNewProject(day.dateKey)}
                      className="mt-2 text-[11px] text-blue-600 hover:text-blue-800 font-bold"
                    >
                      + افزودن مأموریت
                    </button>
                  </div>
                ) : (
                  dayProjects.map((proj) => {
                    const leadName = getUserName(proj.leadTechnicianId);
                    const teamCount = proj.assignedTechnicianIds.length;

                    return (
                      <div
                        key={proj.id}
                        className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-sm hover:shadow-md transition space-y-2.5 relative group"
                      >
                        {/* Status & Code */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {proj.code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              proj.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : proj.status === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : proj.status === 'EN_ROUTE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {proj.status === 'COMPLETED'
                              ? 'اتمام نصب'
                              : proj.status === 'IN_PROGRESS'
                              ? 'در حال نصب'
                              : proj.status === 'EN_ROUTE'
                              ? 'در مسیر'
                              : 'برنامه‌ریزی'}
                          </span>
                        </div>

                        {/* Title & Customer */}
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 leading-tight">
                            {proj.title}
                          </h4>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                            <Clock className="w-3 h-3 text-blue-500" />
                            <span>ساعت {toPersianDigits(proj.scheduledTime)}</span>
                          </div>
                        </div>

                        {/* Technical Spec: Panels */}
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                          {proj.shadePanels > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                              {toPersianDigits(proj.shadePanels)} لت شید
                            </span>
                          )}
                          {proj.curtainPanels > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                              {toPersianDigits(proj.curtainPanels)} لت پرده
                            </span>
                          )}
                        </div>

                        {/* Team & Lead */}
                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 text-[11px]">
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="font-semibold flex items-center gap-1">
                              <span className="text-amber-500">⭐</span> {leadName || 'سرپرست'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              ({toPersianDigits(teamCount)} نفر اکیپ)
                            </span>
                          </div>
                        </div>

                        {/* Tools Pill */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-slate-400" />
                            {proj.isFullTools ? (
                              <span className="text-emerald-700 font-bold">فول ابزار</span>
                            ) : (
                              <span>{toPersianDigits(proj.toolsRequired.length)} ابزار</span>
                            )}
                          </span>

                          {proj.proposalImages && proj.proposalImages.length > 0 && (
                            <button
                              onClick={() => onViewProposal(proj)}
                              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 text-[10px]"
                            >
                              <FileText className="w-3 h-3" />
                              <span>پروپوزال</span>
                            </button>
                          )}
                        </div>

                        {/* Action buttons on card hover */}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100">
                          <button
                            onClick={() => onEditProject(proj)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="ویرایش پروژه"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`آیا از حذف مأموریت ${proj.title} اطمینان دارید؟`)) {
                                onDeleteProject(proj.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="حذف پروژه"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
