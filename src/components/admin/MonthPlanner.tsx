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
  FileText,
  Ruler,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getUpcomingDays, toPersianDigits, formatJalali } from '../../utils/jalali';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusPill } from '../ui/StatusPill';
import { Avatar } from '../ui/Avatar';
import { getDisplayName } from '../../utils/technicianName';
import { isProjectScheduledOnDate, getMultiDayProgress } from '../../utils/multiDay';

interface Props {
  projects: Project[];
  users: User[];
  settings: SystemSettings;
  onUpdateSettings?: (settings: SystemSettings) => void;
  onNewProject: (dateKey?: string) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onMoveProjectDate?: (projectId: string, newDateKey: string) => void;
  onViewProposal: (project: Project) => void;
  onOpenPreInspection?: (project: Project) => void;
}

export const MonthPlanner: React.FC<Props> = ({
  projects,
  users,
  settings,
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
  const [isAlertsOpen, setIsAlertsOpen] = useState(true);

  const displayedDays =
    viewMode === '4DAYS' ? days.slice(startIndex, startIndex + 4) : days;

  const todayKey = days.find((d) => d.isToday)?.dateKey || new Date().toISOString().slice(0, 10);

  // Overdue, Stuck, or QC Rejected projects that need immediate attention
  const overdueOrReturnedProjects = projects.filter((p) => {
    const isEnRouteOrInProgress = p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS';
    const isStuck = p.status === 'STUCK';
    const isQcRejected = p.qcStatus === 'REJECTED';
    const isOverduePaused = p.status === 'PAUSED' && todayKey > (p.endDate || p.scheduledDate);
    return isEnRouteOrInProgress || isStuck || isQcRejected || isOverduePaused;
  });

  const getUser = (id?: string) => {
    if (!id) return undefined;
    return users.find((u) => u.id === id);
  };

  const getUserName = (id?: string) => {
    const u = getUser(id);
    return getDisplayName(u?.name);
  };

  return (
    <div className="space-y-5">
      {/* Page Header (Clean, responsive, no giant hero card) */}
      <PageHeader
        title="برنامه زمان‌بندی"
        subtitle="مأموریت‌های ۳۰ روز آینده"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={[
                { id: '4DAYS', label: 'نمای ۴ روزه' },
                { id: 'FULL_MONTH', label: '۳۰ روز کامل' },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as '4DAYS' | 'FULL_MONTH')}
              size="sm"
            />

            {viewMode === '4DAYS' && (
              <div className="hidden sm:flex items-center gap-1 bg-[#FAF7F2] dark:bg-[#1A1A1A] rounded-xl p-1 border border-[#E2DDD4] dark:border-[#2C2C2C]">
                <button
                  type="button"
                  disabled={startIndex === 0}
                  onClick={() => setStartIndex((i) => Math.max(0, i - 1))}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg disabled:opacity-30 transition cursor-pointer"
                  title="روزهای قبلی"
                  aria-label="روزهای قبلی"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 text-[#8E6F27] dark:text-[#E5CA8F] font-bold">
                  {toPersianDigits(startIndex + 1)} تا {toPersianDigits(startIndex + 4)}
                </span>
                <button
                  type="button"
                  disabled={startIndex + 4 >= days.length}
                  onClick={() => setStartIndex((i) => Math.min(days.length - 4, i + 1))}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg disabled:opacity-30 transition cursor-pointer"
                  title="روزهای بعدی"
                  aria-label="روزهای بعدی"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => onNewProject()}
              icon={<Plus className="w-4 h-4" />}
            >
              مأموریت جدید
            </Button>
          </div>
        }
      />

      {/* Overdue / Returned Projects Collapsible Alert Strip */}
      {overdueOrReturnedProjects.length > 0 && (
        <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900/50 rounded-2xl p-3.5 space-y-3 transition-all">
          <button
            type="button"
            onClick={() => setIsAlertsOpen((prev) => !prev)}
            className="w-full flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-black text-xs sm:text-sm">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              <span>پروژه‌های نیازمند پیگیری فوری (معوق، متوقف یا برگشتی):</span>
              <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold">
                {toPersianDigits(overdueOrReturnedProjects.length)}
              </span>
            </div>
            <div className="text-rose-700 dark:text-rose-400 p-1">
              {isAlertsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isAlertsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
              {overdueOrReturnedProjects.map((proj) => {
                const isStuck = proj.status === 'STUCK';
                const isRejected = proj.qcStatus === 'REJECTED';
                const multiDayProgress = getMultiDayProgress(proj);
                return (
                  <div
                    key={`overdue-${proj.id}`}
                    className="bg-white dark:bg-[#1A1A1A] p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-2xs space-y-2 text-right relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-[#8E6F27] dark:text-[#E5CA8F]">
                          {proj.code}
                        </span>
                        {multiDayProgress && (
                          <span className="text-xs bg-[#C1A056]/20 text-[#8E6F27] dark:text-[#E5CA8F] font-bold px-1.5 py-0.5 rounded-md">
                            {multiDayProgress.badgeText}
                          </span>
                        )}
                      </div>
                      <StatusPill status={proj.status} qcStatus={proj.qcStatus} size="sm" />
                    </div>

                    <div>
                      <h5 className="font-bold text-xs text-[#181818] dark:text-white line-clamp-1">
                        {proj.title}
                      </h5>
                      <p className="text-xs text-[#69655F] dark:text-[#9E988D] mt-0.5">
                        {proj.customerName} | {formatJalali(proj.scheduledDate, 'بدون تاریخ')}
                      </p>
                    </div>

                    {isRejected && proj.qcNotes && (
                      <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded-lg line-clamp-2">
                        علت بازگشت: {proj.qcNotes}
                      </div>
                    )}

                    <div className="pt-1 flex items-center justify-end gap-1.5 border-t border-[#E2DDD4] dark:border-[#2C2C2C]">
                      <button
                        type="button"
                        onClick={() => onEditProject(proj)}
                        className="px-3 py-2 min-h-[44px] text-xs font-bold rounded-lg bg-[#FAF7F2] dark:bg-[#252525] text-[#8E6F27] dark:text-[#E5CA8F] hover:bg-[#EFEBE4] transition cursor-pointer flex items-center justify-center"
                      >
                        ویرایش و زمان‌بندی
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grid of Days */}
      <div
        className={`grid gap-4 ${
          viewMode === '4DAYS'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'
        }`}
      >
        {displayedDays.map((day) => {
          const dayProjects = projects.filter((p) => isProjectScheduledOnDate(p, day.dateKey));
          const isVisibleToTechnicians = day.dayOffset < settings.visibilityWindowDays;
          const isEmpty = dayProjects.length === 0;

          if (isEmpty) {
            return (
              <React.Fragment key={day.dateKey}>
                {/* Mobile Empty Day: single thin row max 48px (h-12) */}
                <div
                  className={`md:hidden h-12 max-h-12 flex items-center justify-between px-3 rounded-2xl border transition shadow-2xs ${
                    day.isToday
                      ? 'bg-white dark:bg-[#1A1A1A] border-[#C1A056] ring-2 ring-[#C1A056]/30'
                      : isVisibleToTechnicians
                      ? 'bg-white dark:bg-[#1A1A1A] border-[#E2DDD4] dark:border-[#2C2C2C]'
                      : 'bg-[#FAF7F2]/60 dark:bg-[#141414]/60 border-dashed border-[#D2CCC0] dark:border-[#262626] opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-xs text-[#181818] dark:text-[#F5F3EF]">
                      {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                    </span>
                    <span className="text-xs opacity-80 text-[#69655F] dark:text-[#9E988D]">
                      {day.persianDayNum} {day.persianMonthName}
                    </span>
                    <span className="text-xs text-[#8A857D] dark:text-[#807B72] mr-2">
                      بدون مأموریت
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNewProject(day.dateKey)}
                    className="w-11 h-11 flex items-center justify-center text-[#8E6F27] dark:text-[#E5CA8F] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition cursor-pointer shrink-0"
                    title="افزودن مأموریت به این روز"
                    aria-label={`افزودن مأموریت به روز ${day.persianDayName}`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Desktop Empty Day: standard column card */}
                <div
                  className={`hidden md:flex flex-col rounded-2xl border transition shadow-2xs overflow-hidden ${
                    day.isToday
                      ? 'bg-white dark:bg-[#1A1A1A] border-[#C1A056] ring-2 ring-[#C1A056]/30'
                      : isVisibleToTechnicians
                      ? 'bg-white dark:bg-[#1A1A1A] border-[#E2DDD4] dark:border-[#2C2C2C]'
                      : 'bg-[#FAF7F2]/60 dark:bg-[#141414]/60 border-dashed border-[#D2CCC0] dark:border-[#262626] opacity-90'
                  }`}
                >
                  <div
                    className={`p-3 border-b flex items-center justify-between ${
                      day.isToday
                        ? 'bg-[#212121] text-[#E5CA8F] border-[#C1A056]'
                        : isVisibleToTechnicians
                        ? 'bg-[#FAF7F2] dark:bg-[#202020] text-[#181818] dark:text-[#F5F3EF] border-[#E2DDD4] dark:border-[#2C2C2C]'
                        : 'bg-[#EFEBE4] dark:bg-[#181818] text-[#69655F] dark:text-[#9E988D] border-[#D2CCC0] dark:border-[#262626]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm">
                        {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                      </span>
                      <span className="text-xs opacity-80">
                        {day.persianDayNum} {day.persianMonthName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          isVisibleToTechnicians
                            ? day.isToday
                              ? 'bg-[#C1A056] text-[#212121]'
                              : 'bg-[#C1A056]/20 text-[#8E6F27] dark:text-[#E5CA8F]'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isVisibleToTechnicians ? 'دید تکنسین' : 'مخفی'}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => onNewProject(day.dateKey)}
                        className="w-11 h-11 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
                        title="افزودن مأموریت به این روز"
                        aria-label={`افزودن مأموریت به روز ${day.persianDayName}`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2 flex-1 overflow-y-auto min-h-[100px]">
                    <div className="flex items-center justify-between py-3 px-3 text-[#69655F] dark:text-[#9E988D] text-xs">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 opacity-50" />
                        <span>بدون مأموریت</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNewProject(day.dateKey)}
                        className="text-[#8E6F27] dark:text-[#E5CA8F] hover:underline font-bold text-xs cursor-pointer min-h-[44px] flex items-center"
                      >
                        + افزودن
                      </button>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          }

          return (
            <div
              key={day.dateKey}
              className={`flex flex-col rounded-2xl border transition shadow-2xs overflow-hidden ${
                day.isToday
                  ? 'bg-white dark:bg-[#1A1A1A] border-[#C1A056] ring-2 ring-[#C1A056]/30'
                  : isVisibleToTechnicians
                  ? 'bg-white dark:bg-[#1A1A1A] border-[#E2DDD4] dark:border-[#2C2C2C]'
                  : 'bg-[#FAF7F2]/60 dark:bg-[#141414]/60 border-dashed border-[#D2CCC0] dark:border-[#262626] opacity-90'
              }`}
            >
              {/* Day Column Header */}
              <div
                className={`p-3 border-b flex items-center justify-between ${
                  day.isToday
                    ? 'bg-[#212121] text-[#E5CA8F] border-[#C1A056]'
                    : isVisibleToTechnicians
                    ? 'bg-[#FAF7F2] dark:bg-[#202020] text-[#181818] dark:text-[#F5F3EF] border-[#E2DDD4] dark:border-[#2C2C2C]'
                    : 'bg-[#EFEBE4] dark:bg-[#181818] text-[#69655F] dark:text-[#9E988D] border-[#D2CCC0] dark:border-[#262626]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm">
                    {day.isToday ? 'امروز' : day.dayOffset === 1 ? 'فردا' : day.persianDayName}
                  </span>
                  <span className="text-xs opacity-80">
                    {day.persianDayNum} {day.persianMonthName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                      isVisibleToTechnicians
                        ? day.isToday
                          ? 'bg-[#C1A056] text-[#212121]'
                          : 'bg-[#C1A056]/20 text-[#8E6F27] dark:text-[#E5CA8F]'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>{isVisibleToTechnicians ? 'دید تکنسین' : 'مخفی'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onNewProject(day.dateKey)}
                    className="w-11 h-11 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
                    title="افزودن مأموریت به این روز"
                    aria-label={`افزودن مأموریت به روز ${day.persianDayName}`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Projects List */}
              <div className="p-2.5 space-y-2 flex-1 overflow-y-auto min-h-[100px]">
                {dayProjects.map((proj) => {
                  const leadUser = getUser(proj.leadTechnicianId);
                  const leadName = getUserName(proj.leadTechnicianId);
                  const multiDayProgress = getMultiDayProgress(proj);

                  return (
                    <div
                      key={proj.id}
                      className="p-3 space-y-2 rounded-xl transition-all duration-150 border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] hover:border-[#C1A056] shadow-2xs"
                    >
                      {/* Status & Code */}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs bg-[#212121] text-[#E5CA8F] px-2 py-0.5 rounded-md">
                            {proj.code}
                          </span>
                          {multiDayProgress && (
                            <span className="text-xs bg-[#C1A056]/20 text-[#8E6F27] dark:text-[#E5CA8F] font-bold px-1.5 py-0.5 rounded-md">
                              {multiDayProgress.badgeText}
                            </span>
                          )}
                        </div>
                        <StatusPill status={proj.status} qcStatus={proj.qcStatus} size="sm" />
                      </div>

                      {/* Title & Customer */}
                      <div>
                        <h4 className="font-bold text-xs text-[#181818] dark:text-[#F5F3EF] leading-snug line-clamp-1">
                          {proj.title}
                        </h4>
                        <p className="text-xs text-[#69655F] dark:text-[#9E988D] mt-0.5 line-clamp-1">
                          {proj.customerName}
                        </p>
                      </div>

                      {/* Summary Pill: Time + Panels + Team Lead */}
                      <div className="flex items-center gap-2 text-xs text-[#4A4742] dark:text-[#BDB8AF] bg-[#FAF7F2] dark:bg-[#141414] p-1.5 px-2 rounded-lg border border-[#E2DDD4] dark:border-[#282828] justify-between">
                        <div className="flex items-center gap-1 font-mono font-bold">
                          <Clock className="w-3 h-3 text-[#8E6F27] dark:text-[#E5CA8F]" />
                          <span>{toPersianDigits(proj.scheduledTime)}</span>
                        </div>
                        <span>•</span>
                        <span className="font-bold text-[#8E6F27] dark:text-[#E5CA8F]">
                          {toPersianDigits(proj.shadePanels + proj.curtainPanels)} لت
                        </span>
                        <span>•</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <Avatar name={leadName || 'سرپرست'} id={leadUser?.id} size="sm" />
                          <span className="truncate max-w-[70px]">{leadName || 'سرپرست'}</span>
                        </div>
                      </div>

                      {/* Pre-Inspection if needed */}
                      {onOpenPreInspection &&
                        (proj.status === 'MEASUREMENT_PENDING' || proj.status === 'SCHEDULED') && (
                          <div>
                            {proj.preInspection ? (
                              <button
                                type="button"
                                onClick={() => onOpenPreInspection(proj)}
                                className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer min-h-[44px] ${
                                  proj.preInspection.status === 'APPROVED'
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                <span className="flex items-center gap-1">
                                  <Ruler className="w-3.5 h-3.5 text-[#C1A056]" />
                                  <span>{proj.preInspection.status === 'APPROVED' ? 'بستر تایید شد' : 'بستر نیازمند اصلاح'}</span>
                                </span>
                                <span className="text-xs underline">مشاهده</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenPreInspection(proj)}
                                className="w-full py-1.5 px-2 rounded-lg text-xs font-bold bg-[#FAF7F2] dark:bg-[#141414] hover:bg-[#EFEBE4] dark:hover:bg-[#202020] text-[#8E6F27] dark:text-[#E5CA8F] border border-dashed border-[#C1A056]/50 flex items-center justify-center gap-1 transition cursor-pointer min-h-[44px]"
                              >
                                <Ruler className="w-3.5 h-3.5 text-[#C1A056]" />
                                <span>کارشناسی فضا و متراژ دوم</span>
                              </button>
                            )}
                          </div>
                        )}

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#E2DDD4] dark:border-[#2C2C2C] text-xs">
                        {proj.proposalImages && proj.proposalImages.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => onViewProposal(proj)}
                            className="text-[#8E6F27] dark:text-[#E5CA8F] hover:underline font-bold flex items-center gap-1 text-xs cursor-pointer min-h-[44px]"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>پروپوزال</span>
                          </button>
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditProject(proj)}
                            className="w-11 h-11 flex items-center justify-center text-[#69655F] dark:text-[#9E988D] hover:text-[#181818] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition cursor-pointer"
                            title="ویرایش مأموریت"
                            aria-label={`ویرایش مأموریت ${proj.title}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`آیا از حذف مأموریت ${proj.title} اطمینان دارید؟`)) {
                                onDeleteProject(proj.id);
                              }
                            }}
                            className="w-11 h-11 flex items-center justify-center text-[#69655F] dark:text-[#9E988D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                            title="حذف مأموریت"
                            aria-label={`حذف مأموریت ${proj.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
