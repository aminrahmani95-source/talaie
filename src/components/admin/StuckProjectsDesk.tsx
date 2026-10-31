import React, { useState } from 'react';
import { Project, StuckIncident, FmeaRootCause, User, ProjectStatus } from '../../types';
import {
  AlertOctagon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  Calendar,
} from 'lucide-react';
import { toPersianDigits, getUpcomingDays, formatJalaliDateTime } from '../../utils/jalali';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusPill } from '../ui/StatusPill';
import { Button } from '../ui/Button';

interface Props {
  projects: Project[];
  currentUser?: User;
  onPatchProject: (id: string, patch: Partial<Project>) => void;
}

export const StuckProjectsDesk: React.FC<Props> = ({ projects, currentUser, onPatchProject }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newScheduledDate, setNewScheduledDate] = useState('');
  const [fmeaRootCause, setFmeaRootCause] = useState<FmeaRootCause>('SUPPLIER_DEFECT');
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const upcomingDays = getUpcomingDays(30);

  const getProjectIncidents = (p: Project): StuckIncident[] => {
    if (p.stuckIncidents && p.stuckIncidents.length > 0) {
      return p.stuckIncidents;
    }
    if (p.stuckIncident) {
      return [p.stuckIncident];
    }
    return [];
  };

  const getLatestIncident = (p: Project): StuckIncident | undefined => {
    const list = getProjectIncidents(p);
    return list.length > 0 ? list[list.length - 1] : undefined;
  };

  const stuckProjects = projects.filter((p) => getProjectIncidents(p).length > 0 || p.status === 'STUCK');

  const filteredProjects = stuckProjects.filter((p) => {
    const latest = getLatestIncident(p);
    const isResolved = p.status !== 'STUCK' && latest?.resolutionStatus === 'RESOLVED';
    if (filter === 'OPEN' && isResolved) return false;
    if (filter === 'RESOLVED' && !isResolved) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || filteredProjects[0];
  const activeIncident = selectedProject ? getLatestIncident(selectedProject) : undefined;

  const getRemainingTime = (incident?: StuckIncident) => {
    if (!incident) return { hours: 72, minutes: 0, isOverdue: false, percent: 100, elapsedHours: 0 };
    const stuckTime = new Date(incident.stuckAt).getTime();
    const now = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : Date.now();
    const elapsedHours = (now - stuckTime) / (1000 * 60 * 60);
    const maxHours = incident.targetMaxHours || 72;
    const remaining = maxHours - elapsedHours;

    return {
      hours: Math.max(0, Math.floor(remaining)),
      minutes: Math.max(0, Math.floor((remaining % 1) * 60)),
      isOverdue: remaining <= 0,
      percent: Math.min(100, Math.max(0, (remaining / maxHours) * 100)),
      elapsedHours: Math.round(elapsedHours),
    };
  };

  const handleResolveStuck = async (project: Project) => {
    if (isResolving) return;
    setResolutionError(null);

    if (!resolutionNote.trim()) {
      setResolutionError('لطفاً اقدام انجام‌شده جهت رفع توقف پروژه را یادداشت کنید.');
      return;
    }

    const incidents = getProjectIncidents(project);
    const lastIndex = incidents.length - 1;
    const baseIncident: StuckIncident =
      lastIndex >= 0 && incidents[lastIndex].resolutionStatus !== 'RESOLVED'
        ? incidents[lastIndex]
        : incidents[lastIndex] || {
            id: `stuck-${Date.now()}`,
            stuckAt: new Date().toISOString(),
            category: 'HARDWARE_SHORTAGE',
            description: 'رفع استاک سر پروژه',
            reportedBy: 'مسئول QC',
            photos: [],
            targetMaxHours: 72,
            resolutionStatus: 'OPEN',
          };

    const resolvedIncident: StuckIncident = {
      ...baseIncident,
      resolutionStatus: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      resolvedBy: currentUser?.name || 'مسئول QC',
      resolutionNote: resolutionNote.trim(),
      rootCause: fmeaRootCause,
    };

    const updatedIncidents =
      lastIndex >= 0 && incidents[lastIndex].resolutionStatus !== 'RESOLVED'
        ? incidents.map((inc, idx) => (idx === lastIndex ? resolvedIncident : inc))
        : [...incidents, resolvedIncident];

    const targetStatus: ProjectStatus =
      resolvedIncident.previousStatus && project.startedAt
        ? resolvedIncident.previousStatus
        : project.startedAt
        ? 'IN_PROGRESS'
        : 'SCHEDULED';

    const patch: Partial<Project> = {
      status: targetStatus,
      stuckIncident: resolvedIncident,
      stuckIncidents: updatedIncidents,
      ...(newScheduledDate ? { scheduledDate: newScheduledDate } : {}),
    };

    setIsResolving(true);
    try {
      await onPatchProject(project.id, patch);
      setResolutionNote('');
      setNewScheduledDate('');
    } catch (err: any) {
      setResolutionError(err.message || 'خطا در رفع استاک پروژه.');
    } finally {
      setIsResolving(false);
    }
  };

  const allIncidents: StuckIncident[] = [];
  projects.forEach((p) => {
    getProjectIncidents(p).forEach((inc) => {
      allIncidents.push(inc);
    });
  });

  const openIncidentsCount = allIncidents.filter((inc) => inc.resolutionStatus !== 'RESOLVED').length;
  const resolvedIncidentsCount = allIncidents.filter((inc) => inc.resolutionStatus === 'RESOLVED').length;
  const resolvedUnder72hCount = allIncidents.filter((inc) => {
    if (inc.resolutionStatus !== 'RESOLVED' || !inc.resolvedAt) return false;
    const diff =
      (new Date(inc.resolvedAt).getTime() - new Date(inc.stuckAt).getTime()) /
      (1000 * 60 * 60);
    return diff <= (inc.targetMaxHours || 72);
  }).length;
  const complianceRate =
    resolvedIncidentsCount > 0 ? Math.round((resolvedUnder72hCount / resolvedIncidentsCount) * 100) : 100;

  const getRootCauseLabel = (cause?: FmeaRootCause) => {
    switch (cause) {
      case 'SALES_ORDER_ERROR':
        return 'اشتباه در سفارش‌گذاری فروش';
      case 'SUPPLIER_DEFECT':
        return 'خطای تامین‌کننده یراق یا موتور';
      case 'SEWING_WORKSHOP_ERROR':
        return 'اشتباه در کارگاه دوخت و خیاطی';
      case 'LOGISTICS_DAMAGE':
        return 'آسیب حین حمل با ناوگان لجستیک';
      case 'SITE_PREP_ERROR':
        return 'عدم آمادگی بستر ساختمان مشتری';
      default:
        return 'نقص فنی پیش‌بینی‌نشده';
    }
  };

  const getCategoryTitle = (cat?: string) => {
    switch (cat) {
      case 'FABRIC_SHORTAGE':
        return 'کسری پارچه پرده/شید';
      case 'FABRIC_DEFECT':
        return 'پارگی یا عیب بافت پارچه';
      case 'HARDWARE_SHORTAGE':
        return 'کسری یراق، پایه یا براکت';
      case 'MEASUREMENT_MISMATCH':
        return 'مغایرت ابعاد پنجره با تولید';
      case 'DRYWALL_SUBSTRUCTURE_ISSUE':
        return 'عدم زیرسازی قوطی آهن کناف';
      case 'POWER_FAILURE':
        return 'عدم تامین برق موتور سامفی';
      default:
        return 'نقص فنی سر پروژه';
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Page Header */}
      <PageHeader
        title="پروژه‌های متوقف"
        subtitle="مدیریت رفع موانع فنی در حداکثر مهلت ۷۲ ساعت"
        actions={
          <SegmentedControl
            options={[
              { id: 'OPEN', label: 'فعال', badge: openIncidentsCount > 0 ? openIncidentsCount : undefined },
              { id: 'RESOLVED', label: 'رفع شده', badge: resolvedIncidentsCount > 0 ? resolvedIncidentsCount : undefined },
              { id: 'ALL', label: 'همه', badge: stuckProjects.length },
            ]}
            value={filter}
            onChange={(val) => setFilter(val as 'ALL' | 'OPEN' | 'RESOLVED')}
            size="sm"
          />
        }
      />

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3.5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
          <div className="text-xs text-[#69655F] dark:text-[#9E988D]">توقف‌های باز</div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono flex items-center gap-1.5">
            <span>{toPersianDigits(openIncidentsCount)}</span>
            {openIncidentsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3.5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
          <div className="text-xs text-[#69655F] dark:text-[#9E988D]">حل در مهلت ۷۲ ساعت</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {toPersianDigits(complianceRate)}٪
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3.5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
          <div className="text-xs text-[#69655F] dark:text-[#9E988D]">کل توقف‌ها</div>
          <div className="text-xl font-black text-[#181818] dark:text-white mt-1 font-mono">
            {toPersianDigits(allIncidents.length)} مورد
          </div>
        </div>

        <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-2xl p-3.5 border border-[#C1A056]/30 shadow-2xs">
          <div className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] font-bold">مهلت رفع توقف</div>
          <div className="text-xs text-[#181818] dark:text-white mt-2 font-mono font-bold">
            حداکثر ۷۲ ساعت
          </div>
        </div>
      </div>

      {/* Main Grid: List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Project List */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8A857B] absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو بر اساس عنوان یا کد پروژه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pr-9 pl-3 py-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-[#181818] dark:text-white"
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-8 text-center border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h4 className="font-bold text-sm text-[#181818] dark:text-white">
                پروژه‌ای در این بخش متوقف نیست
              </h4>
            </div>
          ) : (
            filteredProjects.map((p) => {
              const latestInc = getLatestIncident(p);
              const timing = getRemainingTime(latestInc);
              const isSelected = selectedProject?.id === p.id;
              const isResolved = p.status !== 'STUCK' && latestInc?.resolutionStatus === 'RESOLVED';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer text-right space-y-2 select-none ${
                    isSelected
                      ? 'border-[#C1A056] bg-[#FAF7F2] dark:bg-[#202020] ring-2 ring-[#C1A056]/30 shadow-xs'
                      : 'border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] hover:border-[#C1A056]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-[#8E6F27] dark:text-[#E5CA8F]">
                      {p.code}
                    </span>
                    {isResolved ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        رفع شده
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          timing.isOverdue
                            ? 'bg-rose-600 text-white animate-pulse'
                            : timing.hours < 24
                            ? 'bg-amber-500 text-white'
                            : 'bg-[#212121] text-[#E5CA8F]'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {timing.isOverdue
                            ? 'بیش از ۷۲ ساعت گذشته!'
                            : `${toPersianDigits(timing.hours)} ساعت باقی‌مانده`}
                        </span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#181818] dark:text-[#F5F3EF] line-clamp-1">
                      {p.title}
                    </h4>
                    <p className="text-[11px] text-[#69655F] dark:text-[#9E988D] mt-0.5 line-clamp-1">
                      {p.customerName} | {getCategoryTitle(latestInc?.category)}
                    </p>
                  </div>

                  {!isResolved && (
                    <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          timing.isOverdue ? 'bg-rose-600' : timing.hours < 24 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${timing.percent}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detail and Resolution Form */}
        <div className="lg:col-span-7">
          {selectedProject ? (
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs space-y-4">
              <div className="flex items-start justify-between border-b border-[#E2DDD4] dark:border-[#2C2C2C] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-[#212121] text-[#E5CA8F]">
                      {selectedProject.code}
                    </span>
                    <h3 className="font-black text-base text-[#181818] dark:text-[#F5F3EF]">
                      {selectedProject.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[#69655F] dark:text-[#9E988D] mt-1">
                    کارفرما: {selectedProject.customerName} | نشانی: {selectedProject.address}
                  </p>
                </div>
              </div>

              {/* Incident Details Card */}
              <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-500" />
                    <span>علت اعلام توقف:</span>
                  </div>
                  <span className="font-mono text-[11px]">
                    {activeIncident?.stuckAt ? formatJalaliDateTime(activeIncident.stuckAt) : ''}
                  </span>
                </div>

                <div className="text-xs text-[#181818] dark:text-[#F5F3EF] bg-white dark:bg-[#141414] p-3 rounded-xl border border-rose-200 dark:border-rose-900/30 leading-relaxed">
                  {activeIncident?.description || 'کسری یراق یا مغایرت فنی در محل پروژه.'}
                </div>
              </div>

              {/* Action Form if open */}
              {activeIncident?.resolutionStatus !== 'RESOLVED' ? (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ثبت اقدام و رفع توقف پروژه:</span>
                  </h4>

                  {resolutionError && (
                    <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200">
                      {resolutionError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                      ریشه‌یابی خطا:
                    </label>
                    <select
                      value={fmeaRootCause}
                      onChange={(e) => setFmeaRootCause(e.target.value as FmeaRootCause)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                    >
                      <option value="SUPPLIER_DEFECT">خطای تامین‌کننده یراق یا موتور</option>
                      <option value="SALES_ORDER_ERROR">اشتباه در سفارش‌گذاری فروش</option>
                      <option value="SEWING_WORKSHOP_ERROR">اشتباه در کارگاه دوخت و خیاطی</option>
                      <option value="LOGISTICS_DAMAGE">آسیب حین حمل با ناوگان لجستیک</option>
                      <option value="SITE_PREP_ERROR">عدم آمادگی بستر ساختمان مشتری</option>
                      <option value="OTHER">سایر موارد فنی</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                      شرح اقدام اصلاحی انجام‌شده:
                    </label>
                    <textarea
                      rows={2}
                      placeholder="مثال: قطعه کسری از انبار مرکزی تامین و به نصاب تحویل شد..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                      تاریخ اعزام مجدد (اختیاری):
                    </label>
                    <select
                      value={newScheduledDate}
                      onChange={(e) => setNewScheduledDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                    >
                      <option value="">همان روز قبلی باقی بماند</option>
                      {upcomingDays.map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.persianDayName} {d.persianDayNum} {d.persianMonthName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="md"
                      disabled={isResolving}
                      loading={isResolving}
                      onClick={() => handleResolveStuck(selectedProject)}
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      className="w-full"
                    >
                      رفع توقف و بازگشت به چرخه نصب
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>توقف این پروژه رفع شده است</span>
                  </div>
                  {activeIncident?.resolutionNote && (
                    <p className="text-xs text-[#4A4742] dark:text-[#BDB8AF]">
                      اقدام انجام‌شده: «{activeIncident.resolutionNote}»
                    </p>
                  )}
                  <div className="text-[10px] text-[#69655F] dark:text-[#9E988D]">
                    ثبت توسط {activeIncident?.resolvedBy} در تاریخ {formatJalaliDateTime(activeIncident?.resolvedAt)}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
