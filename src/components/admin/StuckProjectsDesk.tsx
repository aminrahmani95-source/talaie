import React, { useState } from 'react';
import { Project, StuckIncident, FmeaRootCause, User, ProjectStatus } from '../../types';
import {
  AlertOctagon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileSpreadsheet,
  ChevronRight,
  TrendingDown,
  Building,
  UserCheck,
  Truck,
  Scissors,
  Wrench,
  Search,
  Filter,
  Calendar,
} from 'lucide-react';
import { toPersianDigits, getUpcomingDays, formatJalali, formatJalaliDateTime } from '../../utils/jalali';

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

  // Helper to extract all incidents for a project
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

  // Collect all projects with stuck incidents
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

  // Helper to compute remaining hours out of the 72-hour KPI
  const getRemainingTime = (incident?: StuckIncident) => {
    if (!incident) return { hours: 72, minutes: 0, isOverdue: false, percent: 100 };
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
      alert('پروژه با موفقیت از حالت استاک خارج شد و مجدداً به برنامه فعال اکیپ نصب بازگشت.');
    } catch (err: any) {
      setResolutionError(err.message || 'خطا در رفع استاک پروژه.');
    } finally {
      setIsResolving(false);
    }
  };

  // KPI Calculations across all incidents
  const allIncidents: StuckIncident[] = [];
  projects.forEach((p) => {
    getProjectIncidents(p).forEach((inc) => {
      allIncidents.push(inc);
    });
  });

  const totalIncidentsCount = allIncidents.length;
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
    <div className="space-y-6 pb-12">
      {/* Header Banner in Obsidian & Gold */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-[#C1A056]/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">
                  کارتابل مدیریت و رفع استاک (پروژه‌های متوقف)
                </h2>
                <p className="text-xs text-[#C1A056] font-bold mt-0.5">
                  پایش شاخص سازمانی: رفع کامل توقف زیر ۷۲ ساعت و کاهش نرخ خطای FMEA به زیر ۱۰٪
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">مسئولین پیگیری:</span>
            <span className="text-xs bg-white/10 px-3 py-1 rounded-full font-bold text-white border border-white/10">
              مسئولین فنی و کنترل کیفیت
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs">
          <div className="text-xs text-slate-500 dark:text-zinc-400">توقف‌های باز (رویدادهای فعال)</div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono flex items-center gap-2">
            <span>{toPersianDigits(openIncidentsCount)}</span>
            {openIncidentsCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs">
          <div className="text-xs text-slate-500 dark:text-zinc-400">حل‌شده در مهلت ۷۲ ساعت</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {toPersianDigits(complianceRate)}٪
          </div>
        </div>

        <div className="bg-[#212121] text-white rounded-2xl p-4 border border-[#C1A056]/40 shadow-xs">
          <div className="text-xs text-[#C1A056] font-bold">کل توقف‌های ثبت‌شده</div>
          <div className="text-2xl font-black text-white mt-1 font-mono">
            {toPersianDigits(totalIncidentsCount)} مورد
          </div>
        </div>

        <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#C1A056]/30 shadow-xs">
          <div className="text-xs text-[#A88738] dark:text-[#C1A056] font-bold">هدف سازمانی KPI</div>
          <div className="text-xs text-slate-700 dark:text-zinc-300 mt-2 font-bold leading-tight">
            حداکثر مهلت: <span className="font-mono text-emerald-600 dark:text-emerald-400">72 ساعت</span>
          </div>
        </div>
      </div>

      {/* Main Content: Split List and Incident Resolution Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Project List */}
        <div className="lg:col-span-5 space-y-3">
          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="جستجو در پروژه‌های استاک..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pr-9 pl-3 py-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] bg-white dark:bg-[#1A1A1A] text-slate-800 dark:text-white"
              />
            </div>
            <div className="flex bg-[#E8E4DC] dark:bg-[#252525] p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setFilter('OPEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filter === 'OPEN'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                فعال ({toPersianDigits(openIncidentsCount)})
              </button>
              <button
                type="button"
                onClick={() => setFilter('RESOLVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filter === 'RESOLVED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                حل‌شده ({toPersianDigits(resolvedIncidentsCount)})
              </button>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-10 text-center border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                هیچ پروژه‌ای در این بخش متوقف نیست
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                تمام اکیپ‌های نصب در حال پیشبرد پروژه‌ها طبق برنامه زمان‌بندی هستند.
              </p>
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
                  className={`p-4 rounded-2xl border transition cursor-pointer text-right space-y-2.5 ${
                    isSelected
                      ? 'border-[#C1A056] bg-white dark:bg-[#222222] ring-2 ring-[#C1A056]/30 shadow-sm'
                      : 'border-[#E8E4DC] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-[#C1A056]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#C1A056]">{p.code}</span>
                    {isResolved ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        ✓ رفع شده در {toPersianDigits(timing.elapsedHours || 0)} ساعت
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          timing.isOverdue
                            ? 'bg-rose-600 text-white animate-pulse'
                            : timing.hours < 24
                            ? 'bg-amber-500 text-white'
                            : 'bg-[#212121] text-[#C1A056] border border-[#C1A056]/30'
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
                    <h4 className="font-bold text-sm text-[#212121] dark:text-white line-clamp-1">
                      {p.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      {p.customerName} | {getCategoryTitle(latestInc?.category)}
                    </p>
                  </div>

                  {/* Progress bar of 72 hours */}
                  {!isResolved && (
                    <div className="space-y-1">
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            timing.isOverdue
                              ? 'bg-rose-600'
                              : timing.hours < 24
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${timing.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detail and FMEA Action Form */}
        <div className="lg:col-span-7">
          {selectedProject ? (
            <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-6">
              {/* Project Top Bar */}
              <div className="flex items-start justify-between border-b border-[#E8E4DC] dark:border-[#2D2D2D] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#212121] text-[#C1A056]">
                      {selectedProject.code}
                    </span>
                    <h3 className="font-black text-base text-[#212121] dark:text-white">
                      {selectedProject.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    کارفرما: {selectedProject.customerName} ({selectedProject.customerPhone}) | نشانی: {selectedProject.address}
                  </p>
                </div>
              </div>

              {/* Incident Details Card */}
              <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-500" />
                    <span>علت اعلام توقف توسط اکیپ نصب:</span>
                  </div>
                  <span className="font-mono">
                    {activeIncident?.stuckAt
                      ? formatJalaliDateTime(activeIncident.stuckAt)
                      : 'ثبت‌شده سر پروژه'}
                  </span>
                </div>

                <div className="text-xs text-slate-800 dark:text-zinc-200 bg-white dark:bg-[#202020] p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 font-medium leading-relaxed">
                  {activeIncident?.description ||
                    'کسری یراق‌آلات و براکت دیواری و عدم تطابق اندازه لت‌های شید با پنجره کناف.'}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                  <span>دسته‌بندی خطا:</span>
                  <span className="font-bold text-[#212121] dark:text-white bg-white dark:bg-[#242424] px-2 py-0.5 rounded-md border border-[#E8E4DC] dark:border-[#333333]">
                    {getCategoryTitle(activeIncident?.category)}
                  </span>
                  <span>گزارش‌دهنده:</span>
                  <span className="font-bold text-[#212121] dark:text-white">
                    {activeIncident?.reportedBy || 'سرپرست نصب'}
                  </span>
                </div>
              </div>

              {/* If already resolved, display resolution details */}
              {activeIncident?.resolutionStatus === 'RESOLVED' && selectedProject.status !== 'STUCK' ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>این پروژه با موفقیت رفع استاک شد</span>
                  </div>

                  <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-[#1A1A1A] p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                    <span className="font-bold block mb-1">اقدام ثبت‌شده توسط مسئول QC:</span>
                    {activeIncident.resolutionNote}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>ثبت علت ریشه‌ای در ماتریس FMEA:</span>
                    <span className="font-bold text-[#C1A056]">
                      {getRootCauseLabel(activeIncident.rootCause)}
                    </span>
                  </div>
                </div>
              ) : (
                /* Resolution Action Form */
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#C1A056]" />
                    اقدام فوری جهت رفع توقف زیر ۷۲ ساعت (دستور کار مسئول QC):
                  </h4>

                  {/* FMEA Root Cause Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      ثبت علت ریشه‌ای خطا در ماتریس FMEA گالری طلایی:
                    </label>
                    <select
                      value={fmeaRootCause}
                      onChange={(e) => setFmeaRootCause(e.target.value as FmeaRootCause)}
                      className="w-full text-xs p-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] bg-[#FAF7F2] dark:bg-[#161616] dark:text-white font-bold"
                    >
                      <option value="SUPPLIER_DEFECT">خطای تامین‌کننده یراق یا موتور (کسری یا نقص کالا)</option>
                      <option value="SALES_ORDER_ERROR">اشتباه در سفارش‌گذاری واحد فروش (عدم همخوانی کروکی)</option>
                      <option value="SEWING_WORKSHOP_ERROR">اشتباه کارگاه دوخت و خیاطی (ارتفاع یا چین نامناسب)</option>
                      <option value="LOGISTICS_DAMAGE">آسیب فیزیکی حین بارگیری یا حمل با ناوگان وانت/ون</option>
                      <option value="SITE_PREP_ERROR">عدم آمادگی بستر کارفرما (برق نامناسب یا سستی کناف)</option>
                    </select>
                  </div>

                  {/* Optional New Scheduled Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#C1A056]" />
                      <span>تاریخ برنامه‌ریزی مجدد پس از رفع استاک (اختیاری):</span>
                    </label>
                    <select
                      value={newScheduledDate}
                      onChange={(e) => setNewScheduledDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] bg-[#FAF7F2] dark:bg-[#161616] dark:text-white font-medium"
                    >
                      <option value="">بدون تغییر ({formatJalali(selectedProject.scheduledDate, 'تعیین‌نشده')})</option>
                      {upcomingDays.map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} - {d.persianDayNum} {d.persianMonthName} ({formatJalali(d.dateKey)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Note */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      شرح اقدام انجام‌شده و نحوه تامین فوری کسری:
                    </label>
                    {resolutionError && (
                      <div className="mb-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{resolutionError}</span>
                      </div>
                    )}
                    <textarea
                      rows={3}
                      placeholder="مثال: قطعه کسری از انبار مرکزی تامین شد و جهت تسریع با پیک ارسال گردید. پروژه به روال عادی برگشت."
                      value={resolutionNote}
                      onChange={(e) => {
                        setResolutionNote(e.target.value);
                        setResolutionError(null);
                      }}
                      className="w-full text-xs p-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] bg-[#FAF7F2] dark:bg-[#161616] dark:text-white focus:ring-2 focus:ring-[#C1A056]"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={() => handleResolveStuck(selectedProject)}
                      className="w-full sm:flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isResolving ? 'در حال ثبت رفع استاک...' : 'رفع استاک و بازگشت پروژه به جریان فعال نصب'}</span>
                    </button>
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
