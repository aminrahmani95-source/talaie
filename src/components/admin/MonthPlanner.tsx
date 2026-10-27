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
  Wrench,
  FileText,
  Ruler,
  AlertOctagon,
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
  onOpenPreInspection?: (project: Project) => void;
}

export const MonthPlanner: React.FC<Props> = ({
  projects,
  users,
  settings,
  onUpdateSettings,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onViewProposal,
  onOpenPreInspection,
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
      {/* Top Banner with talaei.ir Brand Aesthetics (Obsidian & Gold) */}
      <div className="bg-[#212121] rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden border border-[#C1A056]/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C1A056]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">📅</span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                تقویم ماهانه و برنامه‌ریزی دیسپچ گالری طلایی
              </h2>
            </div>
            <p className="text-xs text-[#E8E4DC] mt-1">
              مدیریت زمان‌بندی 30 روز آینده و تنظیم پنجره دید اختصاصی تکنسین‌های نصب
            </p>
          </div>

          {/* Visibility Window Controller in Gold & Charcoal */}
          <div className="bg-white/5 backdrop-blur-md border border-[#C1A056]/30 rounded-2xl p-3 sm:p-4 w-full lg:w-auto shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-white">
                <Eye className="w-4 h-4 text-[#C1A056]" />
                <span>پنجره دید تکنسین‌ها:</span>
              </div>
              <span className="bg-[#C1A056] text-[#212121] px-2.5 py-0.5 rounded-full font-black font-mono">
                {toPersianDigits(settings.visibilityWindowDays)} روز آینده
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#C1A056]">1 روز</span>
              <input
                type="range"
                min="1"
                max="14"
                value={settings.visibilityWindowDays}
                onChange={handleSliderChange}
                className="w-full accent-[#C1A056] cursor-pointer h-2 bg-white/20 rounded-lg"
              />
              <span className="text-[10px] text-[#C1A056]">14 روز</span>
            </div>
            <div className="text-[10px] text-[#E8E4DC]/80 text-center">
              (پروژه‌های بعد از {toPersianDigits(settings.visibilityWindowDays)} روز برای تکنسین‌ها در حالت پیش‌نویس است)
            </div>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('4DAYS')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                viewMode === '4DAYS'
                  ? 'bg-[#C1A056] text-[#212121] shadow-xs'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              نمای 4 ستونه عملیاتی
            </button>
            <button
              onClick={() => setViewMode('FULL_MONTH')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                viewMode === 'FULL_MONTH'
                  ? 'bg-[#C1A056] text-[#212121] shadow-xs'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              نمای کامل 30 روزه
            </button>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === '4DAYS' && (
              <div className="flex items-center gap-1 bg-white/10 rounded-full p-1 border border-white/10">
                <button
                  disabled={startIndex === 0}
                  onClick={() => setStartIndex((i) => Math.max(0, i - 1))}
                  className="p-1 hover:bg-white/20 rounded-full disabled:opacity-30 transition"
                  title="روزهای قبلی"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 font-mono text-[#C1A056]">
                  روز {toPersianDigits(startIndex + 1)} تا {toPersianDigits(startIndex + 4)}
                </span>
                <button
                  disabled={startIndex + 4 >= days.length}
                  onClick={() => setStartIndex((i) => Math.min(days.length - 4, i + 1))}
                  className="p-1 hover:bg-white/20 rounded-full disabled:opacity-30 transition"
                  title="روزهای بعدی"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => onNewProject()}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#A88738] hover:to-[#8E712E] text-white rounded-full text-xs font-black shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت مأموریت جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Columns Grid */}
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
                  ? 'bg-white dark:bg-[#1C1C1C] border-[#C1A056] ring-2 ring-[#C1A056]/30'
                  : isVisibleToTechnicians
                  ? 'bg-white dark:bg-[#1C1C1C] border-[#E8E4DC] dark:border-[#2D2D2D]'
                  : 'bg-[#F5EFEB]/70 dark:bg-[#151515]/70 border-dashed border-[#D7D3CA] dark:border-[#2A2A2A] opacity-90'
              }`}
            >
              {/* Day Column Header */}
              <div
                className={`p-3.5 rounded-t-3xl border-b ${
                  day.isToday
                    ? 'bg-[#212121] text-[#C1A056] border-[#C1A056]'
                    : isVisibleToTechnicians
                    ? 'bg-[#FAF7F2] dark:bg-[#222222] text-[#212121] dark:text-[#F5EFEB] border-[#E8E4DC] dark:border-[#2D2D2D]'
                    : 'bg-[#EAE6DD] dark:bg-[#181818] text-slate-600 dark:text-zinc-400 border-[#D7D3CA] dark:border-[#2A2A2A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">
                      {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                    </span>
                    <span className="text-xs opacity-80">
                      {day.persianDayNum} {day.persianMonthName}
                    </span>
                  </div>

                  {/* Technician visibility pill */}
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                      isVisibleToTechnicians
                        ? day.isToday
                          ? 'bg-[#C1A056] text-[#212121]'
                          : 'bg-[#C1A056]/20 text-[#A88738] dark:text-[#C1A056]'
                        : 'bg-slate-300 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <Eye className="w-2.5 h-2.5" />
                    <span>{isVisibleToTechnicians ? 'دید تکنسین' : 'مخفی'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10 dark:border-white/10 text-[11px]">
                  <span>
                    {toPersianDigits(dayProjects.length)} مأموریت ثبت‌شده
                  </span>
                  <button
                    onClick={() => onNewProject(day.dateKey)}
                    className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition"
                    title="افزودن مأموریت به این روز"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Projects List */}
              <div className="p-3 space-y-3 flex-1 overflow-y-auto min-h-[160px]">
                {dayProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-zinc-500 py-6 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] dark:bg-[#222222] border border-[#E8E4DC] dark:border-[#2D2D2D] flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5 text-[#C1A056]" />
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">مأموریتی نیست</span>
                    <button
                      onClick={() => onNewProject(day.dateKey)}
                      className="mt-2 text-[11px] text-[#C1A056] hover:text-[#A88738] font-bold"
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
                        className="bg-white dark:bg-[#222222] rounded-2xl p-3 border border-[#E8E4DC] dark:border-[#333333] shadow-xs hover:border-[#C1A056]/60 dark:hover:border-[#C1A056]/60 transition space-y-2.5 relative group"
                      >
                        {/* Status & Code */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-slate-600 dark:text-zinc-300 bg-[#FAF7F2] dark:bg-[#181818] border border-[#E8E4DC] dark:border-[#333333] px-1.5 py-0.5 rounded">
                            {proj.code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              proj.status === 'STUCK'
                                ? 'bg-rose-600 text-white animate-pulse shadow-sm font-black'
                                : proj.status === 'MEASUREMENT_PENDING'
                                ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300'
                                : proj.qcStatus === 'APPROVED'
                                ? 'bg-[#194840]/15 text-[#194840] dark:bg-[#194840]/30 dark:text-emerald-400'
                                : (proj.status === 'COMPLETED' || proj.qcStatus === 'PENDING') && proj.qcStatus !== 'REJECTED'
                                ? 'bg-[#C1A056] text-[#212121] shadow-2xs font-black'
                                : proj.qcStatus === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                                : proj.status === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 animate-pulse'
                                : proj.status === 'EN_ROUTE'
                                ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300'
                                : 'bg-[#FAF7F2] text-slate-700 dark:bg-[#181818] dark:text-zinc-300'
                            }`}
                          >
                            {proj.status === 'STUCK'
                              ? '⚠️ استاک (<72h)'
                              : proj.status === 'MEASUREMENT_PENDING'
                              ? '📐 در انتظار کارشناسی/متراژ'
                              : proj.qcStatus === 'APPROVED'
                              ? '✓ تایید QC'
                              : (proj.status === 'COMPLETED' || proj.qcStatus === 'PENDING') && proj.qcStatus !== 'REJECTED'
                              ? '⏳ در انتظار QC'
                              : proj.qcStatus === 'REJECTED'
                              ? '⚠️ نیاز به اصلاح'
                              : proj.status === 'IN_PROGRESS'
                              ? 'در حال نصب'
                              : proj.status === 'EN_ROUTE'
                              ? 'در مسیر'
                              : 'برنامه‌ریزی'}
                          </span>
                        </div>

                        {/* Title & Customer */}
                        <div>
                          <h4 className="font-bold text-xs text-[#212121] dark:text-white leading-tight">
                            {proj.title}
                          </h4>
                          <div className="flex items-center gap-1 text-[11px] text-[#71717A] dark:text-zinc-400 mt-1">
                            <Clock className="w-3 h-3 text-[#C1A056]" />
                            <span>ساعت {toPersianDigits(proj.scheduledTime)}</span>
                          </div>
                        </div>

                        {/* Panels Specs */}
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                          {proj.shadePanels > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#181818] text-[#212121] dark:text-zinc-200 border border-[#E8E4DC] dark:border-[#333333]">
                              {toPersianDigits(proj.shadePanels)} لت شید
                            </span>
                          )}
                          {proj.curtainPanels > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#181818] text-[#C1A056] border border-[#C1A056]/30">
                              {toPersianDigits(proj.curtainPanels)} لت پرده
                            </span>
                          )}
                        </div>

                        {/* Team & Lead */}
                        <div className="bg-[#FAF7F2] dark:bg-[#181818] rounded-xl p-2 border border-[#E8E4DC] dark:border-[#333333] text-[11px]">
                          <div className="flex items-center justify-between text-slate-700 dark:text-zinc-200">
                            <span className="font-semibold flex items-center gap-1">
                              <span className="text-[#C1A056]">⭐</span> {leadName || 'سرپرست'}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                              ({toPersianDigits(teamCount)} نفر)
                            </span>
                          </div>
                        </div>

                        {/* Tools & Proposal */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 pt-1 border-t border-[#E8E4DC] dark:border-[#333333]">
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-[#C1A056]" />
                            {proj.isFullTools ? (
                              <span className="text-[#A88738] dark:text-[#C1A056] font-bold">فول ابزار</span>
                            ) : (
                              <span>{toPersianDigits(proj.toolsRequired.length)} ابزار</span>
                            )}
                          </span>

                          {proj.proposalImages && proj.proposalImages.length > 0 && (
                            <button
                              onClick={() => onViewProposal(proj)}
                              className="text-[#C1A056] hover:text-[#A88738] font-bold flex items-center gap-1 text-[10px]"
                            >
                              <FileText className="w-3 h-3" />
                              <span>پروپوزال</span>
                            </button>
                          )}
                        </div>

                        {/* Pre-Installation Inspection (2nd Measurement / Site space) */}
                        {onOpenPreInspection && (
                          <div className="pt-1 border-t border-[#E8E4DC] dark:border-[#333333]">
                            {proj.preInspection ? (
                              <button
                                onClick={() => onOpenPreInspection(proj)}
                                className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-between transition ${
                                  proj.preInspection.status === 'APPROVED'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                <span className="flex items-center gap-1">
                                  <Ruler className="w-3 h-3 text-[#C1A056]" />
                                  <span>{proj.preInspection.status === 'APPROVED' ? '✓ کارشناسی فضا تایید شد' : '⚠️ بستر فضا نیازمند اصلاح'}</span>
                                </span>
                                <span className="text-[9px] underline">مشاهده</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onOpenPreInspection(proj)}
                                className="w-full py-1.5 px-2 rounded-xl text-[10px] font-bold bg-[#FAF7F2] dark:bg-[#181818] hover:bg-[#F2ECE1] dark:hover:bg-[#252525] text-[#A88738] dark:text-[#C1A056] border border-dashed border-[#C1A056]/50 flex items-center justify-center gap-1 transition"
                              >
                                <Ruler className="w-3 h-3 text-[#C1A056]" />
                                <span>ثبت کارشناسی و اندازه‌گیری دوم فضا</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-[#E8E4DC] dark:border-[#333333]">
                          <button
                            onClick={() => onEditProject(proj)}
                            className="p-1 text-slate-400 dark:text-zinc-400 hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#2A2A2A] rounded-lg transition"
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
                            className="p-1 text-slate-400 dark:text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
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
