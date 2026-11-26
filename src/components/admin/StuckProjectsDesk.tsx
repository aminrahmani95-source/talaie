import React, { useEffect, useRef, useState } from 'react';
import { Project, StuckIncident, FmeaRootCause, User, ProjectStatus } from '../../types';
import {
  Clock,
  CheckCircle2,
  Flame,
  Search,
  Settings2,
  Package,
} from 'lucide-react';
import { toPersianDigits, getUpcomingDays, formatJalaliDateTime } from '../../utils/jalali';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { triggerToast } from '../Toast';
import { Button } from '../ui/Button';
import { getDisplayName } from '../../utils/technicianName';

interface Props {
  projects: Project[];
  currentUser?: User;
  onPatchProject: (id: string, patch: Partial<Project>) => void;
  onManageProject?: (project: Project) => void;
  onReferToWarehouse?: (project: Project, note: string) => Promise<void> | void;
  /** از پیشخوان: همین پروژه انتخاب و فرم رفع توقفش نشان داده شود */
  focusProjectId?: string | null;
  /** داخل صفحه‌ی «توقف و تیکت»: سربرگ صفحه تکرار نشود */
  embedded?: boolean;
}

export const StuckProjectsDesk: React.FC<Props> = ({
  projects,
  currentUser,
  onPatchProject,
  onManageProject,
  onReferToWarehouse,
  focusProjectId,
  embedded = false,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(focusProjectId || null);
  const detailRef = useRef<HTMLDivElement>(null);
  // روی گوشی فرم رفع توقف زیر فهرست است؛ بعد از انتخاب، تا آن پایین برو
  const revealDetail = () => {
    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.5) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };
  useEffect(() => {
    if (focusProjectId) {
      setSelectedProjectId(focusProjectId);
      setFilter('OPEN');
      revealDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProjectId]);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newScheduledDate, setNewScheduledDate] = useState('');
  const [fmeaRootCause, setFmeaRootCause] = useState<FmeaRootCause>('SUPPLIER_DEFECT');
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const upcomingDays = getUpcomingDays(180);

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
      resolvedBy: getDisplayName(currentUser?.name) || 'مسئول QC',
      resolutionNote: resolutionNote.trim(),
      rootCause: fmeaRootCause,
    };

    const updatedIncidents =
      lastIndex >= 0 && incidents[lastIndex].resolutionStatus !== 'RESOLVED'
        ? incidents.map((inc, idx) => (idx === lastIndex ? resolvedIncident : inc))
        : [...incidents, resolvedIncident];

    // کار تمام‌شده یا لغوشده با رفع توقف دوباره باز نمی‌شود (قبلاً پروژه‌ی تأییدشده «برنامه‌ریزی‌شده» می‌شد)
    const isClosedProject = project.status === 'COMPLETED' || project.status === 'CANCELLED';
    const targetStatus: ProjectStatus = isClosedProject
      ? project.status
      : resolvedIncident.previousStatus && project.startedAt
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
      // the card simply vanished from the list before; say what happened
      triggerToast('success', `توقف ${project.code} رفع شد و پروژه به چرخه‌ی نصب برگشت.`);
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
        title={embedded ? 'توقف‌ها' : 'پروژه‌های متوقف'}
        subtitle={`مهلت رفع هر توقف: ۷۲ ساعت${allIncidents.length > 0 ? ` · ${toPersianDigits(complianceRate)}٪ در مهلت حل شده` : ''}`}
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

      {/* Main Grid: List + Detail */}
      <div className="grid grid-cols-1 @min-[900px]:grid-cols-12 gap-5">
        {/* Left Column: Project List */}
        <div className="@min-[900px]:col-span-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو بر اساس عنوان یا کد پروژه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pr-9 pl-3 py-2.5 rounded-md border border-line bg-surface text-ink"
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="bg-surface rounded-lg p-8 text-center border border-line ">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h4 className="font-bold text-sm text-ink">
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
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    revealDetail();
                  }}
                  className={`p-3.5 rounded-lg border transition cursor-pointer text-right space-y-2 select-none ${
                    isSelected
                      ? 'border-brand bg-raised ring-2 ring-brand/30 '
                      : 'border-line bg-surface hover:border-brand/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-brand-ink">
                      {p.code}
                    </span>
                    {isResolved ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        رفع شده
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          timing.isOverdue
                            ? 'bg-rose-600 text-white animate-pulse'
                            : timing.hours < 24
                            ? 'bg-amber-500 text-white'
                            : 'bg-canvas text-brand-ink border border-line'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {timing.isOverdue
                            ? 'بیش از 72 ساعت گذشته!'
                            : `${toPersianDigits(timing.hours)} ساعت باقی‌مانده`}
                        </span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-ink line-clamp-1">
                      {p.title}
                    </h4>
                    <p className="text-xs text-ink-3 mt-0.5 line-clamp-1">
                      {p.customerName} | {getCategoryTitle(latestInc?.category)}
                    </p>
                  </div>

                  {!isResolved && (
                    <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
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
        <div ref={detailRef} className="@min-[900px]:col-span-7 scroll-mt-20">
          {selectedProject ? (
            <div className="bg-surface rounded-lg p-5 border border-line  space-y-4">
              <div className="flex items-start justify-between border-b border-line pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-canvas text-brand-ink border border-line whitespace-nowrap">
                      {selectedProject.code}
                    </span>
                    <h3 className="font-black text-base text-ink">
                      {selectedProject.title}
                    </h3>
                  </div>
                  <p className="text-xs text-ink-3 mt-1">
                    {selectedProject.customerName && selectedProject.customerName !== selectedProject.title
                      ? `کارفرما: ${selectedProject.customerName} · `
                      : ''}
                    {selectedProject.address}
                  </p>
                </div>
                {onManageProject && (
                  <button
                    type="button"
                    onClick={() => onManageProject(selectedProject)}
                    className="shrink-0 px-3 min-h-[44px] text-xs font-bold rounded-md bg-raised text-brand-ink hover:bg-[#EFEBE4] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Settings2 className="w-4 h-4" />
                    مدیریت کامل
                  </button>
                )}
              </div>

              {/* Incident Details Card */}
              <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-500" />
                    <span>علت اعلام توقف:</span>
                  </div>
                  <span className="text-xs">
                    {activeIncident?.stuckAt ? formatJalaliDateTime(activeIncident.stuckAt) : ''}
                  </span>
                </div>

                <div className="text-xs text-ink bg-sunken p-3 rounded-md border border-rose-200 dark:border-rose-900/30 leading-relaxed">
                  {activeIncident?.description || 'کسری یراق یا مغایرت فنی در محل پروژه.'}
                </div>
              </div>

              {/* Action Form if open */}
              {activeIncident?.resolutionStatus !== 'RESOLVED' || selectedProject.status === 'STUCK' ? (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ثبت اقدام و رفع توقف پروژه:</span>
                  </h4>

                  {resolutionError && (
                    <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-md border border-rose-200">
                      {resolutionError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">
                      ریشه‌یابی خطا:
                    </label>
                    <select
                      value={fmeaRootCause}
                      onChange={(e) => setFmeaRootCause(e.target.value as FmeaRootCause)}
                      className="w-full text-xs p-2.5 rounded-md border border-line bg-sunken text-ink"
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
                    <label className="block text-xs font-semibold text-ink-2 mb-1">
                      شرح اقدام اصلاحی انجام‌شده:
                    </label>
                    <textarea
                      rows={2}
                      placeholder="مثال: قطعه کسری از انبار مرکزی تامین و به نصاب تحویل شد..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-md border border-line bg-sunken text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">
                      تاریخ اعزام مجدد (اختیاری):
                    </label>
                    <select
                      value={newScheduledDate}
                      onChange={(e) => setNewScheduledDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-md border border-line bg-sunken text-ink"
                    >
                      <option value="">همان روز قبلی باقی بماند</option>
                      {upcomingDays.map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.persianDayName} {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 space-y-2">
                    {onReferToWarehouse && (
                      <button
                        type="button"
                        onClick={() => {
                          const note = resolutionNote.trim() || 'کسری فوری قطعه سر پروژه — نیازمند تامین و ارسال از انبار';
                          onReferToWarehouse(selectedProject, note);
                        }}
                        className="w-full py-2.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                      >
                        <Package className="w-4 h-4" />
                        <span>ارجاع فوری به کارتابل انبار (تامین قطعه/پیک)</span>
                      </button>
                    )}

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
                <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>توقف این پروژه رفع شده است</span>
                  </div>
                  {activeIncident?.resolutionNote && (
                    <p className="text-xs text-ink-2">
                      اقدام انجام‌شده: «{activeIncident.resolutionNote}»
                    </p>
                  )}
                  <div className="text-xs text-ink-3">
                    ثبت توسط {getDisplayName(activeIncident?.resolvedBy)} در تاریخ {formatJalaliDateTime(activeIncident?.resolvedAt)}
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
