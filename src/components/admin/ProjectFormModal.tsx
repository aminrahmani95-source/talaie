import React, { useState, useMemo } from 'react';
import { Project, User, SystemSettings, ProposalImage, InstallationTeam, TeamMember, ProjectTechnicalHandover } from '../../types';
import {
  X,
  Plus,
  CheckCircle2,
  Sparkles,
  Wrench,
  Camera,
  MapPin,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Search,
  Warehouse,
  Users,
  CheckSquare,
} from 'lucide-react';
import { getUpcomingDays, getTodayPersianString, toPersianDigits, getDayInfoFromDateKey, DayInfo } from '../../utils/jalali';
import { getMultiDayTotalDays } from '../../utils/multiDay';
import { compressImageFile } from '../../utils/imageCompressor';
import { SupabaseSyncService } from '../../utils/supabase';
import { CloudImage } from '../common/CloudImage';
import { computeProjectDiff } from '../../utils/offlineQueue';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { getDisplayName } from '../../utils/technicianName';

export type ProjectFormSaveData =
  | { type: 'CREATE_PROJECT'; project: Project }
  | { type: 'PATCH_PROJECT'; id: string; patch: Partial<Project> };

interface Props {
  project?: Project | null;
  defaultDate?: string;
  users: User[];
  teams?: InstallationTeam[];
  teamMembers?: TeamMember[];
  settings: SystemSettings;
  onClose: () => void;
  onSave: (data: ProjectFormSaveData) => void;
}

export const ProjectFormModal: React.FC<Props> = ({
  project,
  defaultDate,
  users,
  teams,
  teamMembers,
  settings,
  onClose,
  onSave,
}) => {
  const isEditing = !!project;
  const days: DayInfo[] = useMemo(() => {
    const list: DayInfo[] = getUpcomingDays(365);
    const customDates = [project?.scheduledDate, project?.endDate, defaultDate].filter(Boolean) as string[];
    for (const cd of customDates) {
      if (!list.some((d) => d.dateKey === cd)) {
        const info = getDayInfoFromDateKey(cd);
        if (info) {
          list.push(info);
        }
      }
    }
    return list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [project?.scheduledDate, project?.endDate, defaultDate]);

  const defaultTeams: InstallationTeam[] = [
    { id: 'TEAM_1', name: 'اکیپ نصب 1', code: 'TEAM_1', createdAt: '', updatedAt: '' },
    { id: 'TEAM_2', name: 'اکیپ نصب 2', code: 'TEAM_2', createdAt: '', updatedAt: '' },
    { id: 'TEAM_3', name: 'اکیپ نصب 3', code: 'TEAM_3', createdAt: '', updatedAt: '' },
    { id: 'TEAM_4', name: 'اکیپ نصب 4', code: 'TEAM_4', createdAt: '', updatedAt: '' },
  ];
  const effectiveTeams = teams && teams.length > 0 ? teams : defaultTeams;

  // Gating & Technical Handover states (solely based on Warehouse Confirmation)
  const [whConfirmed, setWhConfirmed] = useState<boolean>(
    Boolean(project?.technicalHandover?.warehouseConfirmation?.confirmed)
  );
  const [whConfirmedBy, setWhConfirmedBy] = useState<string>(
    project?.technicalHandover?.warehouseConfirmation?.confirmedBy || ''
  );
  const [whNotes, setWhNotes] = useState<string>(
    project?.technicalHandover?.warehouseConfirmation?.notes || ''
  );

  const isHistorical = Boolean(project?.technicalHandover?.isHistoricalMigration);
  const isHandoverComplete =
    whConfirmed ||
    isHistorical ||
    Boolean(project && project.status !== 'MEASUREMENT_PENDING' && !project.technicalHandover);

  // Teams & Workload states
  const [assignedTeamId, setAssignedTeamId] = useState<string>(
    project?.assignedTeamId || ''
  );
  const [assignedTeamName, setAssignedTeamName] = useState<string>(
    project?.assignedTeamName || ''
  );
  const [estimatedWorkload, setEstimatedWorkload] = useState<string>(
    project?.estimatedWorkload ? String(project.estimatedWorkload) : ''
  );
  const [requiredDurationHours, setRequiredDurationHours] = useState<string>(
    project?.requiredDurationHours ? String(project.requiredDurationHours) : ''
  );
  const [secondMeasurementDoc, setSecondMeasurementDoc] = useState<string>(
    project?.secondMeasurementDoc || ''
  );

  // Form states
  const [projectId] = useState(() => project?.id || `p-${Date.now()}`);
  const [projectCode, setProjectCode] = useState(project?.code || '');
  const [title, setTitle] = useState(project?.title || '');
  const [customerName, setCustomerName] = useState(project?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(project?.customerPhone || '');
  const [address, setAddress] = useState(project?.address || '');
  const [locationUrl, setLocationUrl] = useState(project?.locationUrl || '');

  const [shadePanels, setShadePanels] = useState<number>(project?.shadePanels ?? 0);
  const [curtainPanels, setCurtainPanels] = useState<number>(project?.curtainPanels ?? 0);
  const [mechanismType, setMechanismType] = useState(project?.mechanismType || '');
  const [approximateArea, setApproximateArea] = useState<string>(
    project?.approximateArea ? String(project.approximateArea) : ''
  );
  const [specialNotes, setSpecialNotes] = useState(project?.specialNotes || '');

  // Scheduled date & time
  const [scheduledDate, setScheduledDate] = useState(
    project?.scheduledDate || (isHandoverComplete ? defaultDate || days[0]?.dateKey || '' : '')
  );
  const [endDate, setEndDate] = useState(
    project?.endDate || project?.scheduledDate || (isHandoverComplete ? defaultDate || days[0]?.dateKey || '' : '')
  );
  const [scheduledTime, setScheduledTime] = useState(project?.scheduledTime || '09:30');

  // Technician assignment
  const [assignedTechnicianIds, setAssignedTechnicianIds] = useState<string[]>(
    project?.assignedTechnicianIds || []
  );
  const [leadTechnicianId, setLeadTechnicianId] = useState<string>(
    project?.leadTechnicianId || ''
  );
  const [techSearchQuery, setTechSearchQuery] = useState('');

  // Tools checklist
  const [isFullTools, setIsFullTools] = useState<boolean>(project?.isFullTools ?? true);
  const [toolsRequired, setToolsRequired] = useState<string[]>(
    project?.toolsRequired || settings.defaultTools
  );
  const [customToolsNotes, setCustomToolsNotes] = useState(project?.customToolsNotes || '');
  const [specialTools, setSpecialTools] = useState<string[]>(project?.specialTools || []);
  const [isForceMajeure, setIsForceMajeure] = useState<boolean>(project?.isForceMajeure ?? false);
  const [salesRepName, setSalesRepName] = useState<string>(project?.salesRepName || '');

  // Proposal images
  const [proposalImages, setProposalImages] = useState<ProposalImage[]>(
    project?.proposalImages || []
  );

  // Status & QC
  const status: Project['status'] =
    project?.status || (isHandoverComplete ? 'SCHEDULED' : 'MEASUREMENT_PENDING');
  const qcStatus: Project['qcStatus'] = project?.qcStatus || 'NOT_STARTED';

  // Form error and submission lock
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasLeadTechnician = users.some((u) => u.role === 'LEAD_TECHNICIAN');

  const handleToggleFullTools = () => {
    if (!isFullTools) {
      setIsFullTools(true);
      setToolsRequired([...settings.defaultTools]);
    } else {
      setIsFullTools(false);
      setToolsRequired([]);
    }
  };

  const handleToolCheckbox = (tool: string) => {
    let next: string[];
    if (toolsRequired.includes(tool)) {
      next = toolsRequired.filter((t) => t !== tool);
      setIsFullTools(false);
    } else {
      next = [...toolsRequired, tool];
      if (next.length === settings.defaultTools.length) {
        setIsFullTools(true);
      }
    }
    setToolsRequired(next);
  };

  const handleTechnicianToggle = (userId: string) => {
    let next: string[];
    if (assignedTechnicianIds.includes(userId)) {
      next = assignedTechnicianIds.filter((id) => id !== userId);
      if (leadTechnicianId === userId) {
        setLeadTechnicianId(next[0] || '');
      }
    } else {
      next = [...assignedTechnicianIds, userId];
      if (!leadTechnicianId) {
        setLeadTechnicianId(userId);
      }
    }
    setAssignedTechnicianIds(next);
  };

  const handleProposalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        const compressedUrl = await compressImageFile(file, 1600, 1600, 0.8);
        const newImg: ProposalImage = {
          id: `prop-${Date.now()}-${index}`,
          title: file.name || `برگه پروپوزال ${proposalImages.length + 1}`,
          url: compressedUrl,
          uploadedAt: getTodayPersianString(),
        };
        setProposalImages((prev) => [...prev, newImg]);
      } catch (err) {
        console.warn('Proposal upload compression failed:', err);
      }
    }
    e.target.value = '';
  };

  const handleRemoveProposalImage = (id: string) => {
    setProposalImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!hasLeadTechnician) {
      setFormError('ابتدا از بخش مدیریت تکنسین‌ها حداقل یک سرپرست اکیپ تعریف کنید');
      return;
    }

    if (!title.trim()) {
      setFormError('لطفاً عنوان یا نام پروژه را وارد کنید.');
      return;
    }

    if (assignedTechnicianIds.length === 0) {
      setFormError('حداقل یک تکنسین یا سرپرست باید به این مأموریت اختصاص داده شود.');
      return;
    }

    const effectiveLead = leadTechnicianId || assignedTechnicianIds[0];
    if (!effectiveLead) {
      setFormError('لطفاً سرپرست اکیپ را مشخص کنید.');
      return;
    }

    // Handover Gate validation:
    const isScheduling =
      ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED'].includes(status) ||
      Boolean(scheduledDate && scheduledDate.trim() !== '') ||
      Boolean(assignedTeamId && assignedTeamId.trim() !== '');

    if (isScheduling && !isHandoverComplete) {
      setFormError('دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید پیش‌نیاز تحویل و ورود کالا به انبار، قابل زمان‌بندی و اعزام اکیپ نیست.');
      return;
    }

    const technicalHandover: ProjectTechnicalHandover = {
      isHandoverComplete,
      warehouseConfirmation: {
        confirmed: whConfirmed,
        confirmedBy: whConfirmedBy.trim() || 'مسئول انبار مرکزی',
        confirmedAt: whConfirmed
          ? project?.technicalHandover?.warehouseConfirmation?.confirmedAt || new Date().toISOString()
          : undefined,
        notes: whNotes.trim() || undefined,
        shelfLocation: project?.technicalHandover?.warehouseConfirmation?.shelfLocation,
      },
      officialHandoverDate: isHandoverComplete
        ? project?.technicalHandover?.officialHandoverDate || new Date().toISOString()
        : undefined,
      unlockedAt: isHandoverComplete
        ? project?.technicalHandover?.unlockedAt || new Date().toISOString()
        : undefined,
    };

    setFormError('');
    setIsSubmitting(true);

    try {
      if (project) {
        const newFields: Partial<Project> = {
          title: title.trim(),
          customerName: customerName.trim() || title.trim(),
          customerPhone: customerPhone.trim(),
          address: address.trim(),
          locationUrl: locationUrl.trim(),
          shadePanels: Number(shadePanels) || 0,
          curtainPanels: Number(curtainPanels) || 0,
          mechanismType: mechanismType.trim(),
          approximateArea: approximateArea ? Number(approximateArea) : undefined,
          specialNotes: specialNotes.trim(),
          proposalImages,
          scheduledDate,
          endDate: endDate && endDate > scheduledDate ? endDate : undefined,
          scheduledTime,
          assignedTechnicianIds,
          leadTechnicianId: effectiveLead,
          assignedTeamId: assignedTeamId || undefined,
          assignedTeamName: assignedTeamName || undefined,
          estimatedWorkload: estimatedWorkload ? Number(estimatedWorkload) : undefined,
          requiredDurationHours: requiredDurationHours ? Number(requiredDurationHours) : undefined,
          secondMeasurementDoc: secondMeasurementDoc.trim() || undefined,
          technicalHandover,
          isFullTools,
          toolsRequired,
          customToolsNotes: customToolsNotes.trim(),
          specialTools,
          isForceMajeure,
          priority: isForceMajeure ? 'HIGH' : (project.priority || 'NORMAL'),
          salesRepName: salesRepName.trim() || undefined,
          status,
          qcStatus: status === 'COMPLETED' && qcStatus === 'NOT_STARTED' ? 'PENDING' : qcStatus,
          updatedAt: new Date().toISOString(),
        };

        const diff = computeProjectDiff(project, newFields);
        if (diff.technicalHandover && 'isHistoricalMigration' in diff.technicalHandover) {
          delete (diff.technicalHandover as any).isHistoricalMigration;
        }
        await onSave({ type: 'PATCH_PROJECT', id: project.id, patch: diff });
      } else {
        let finalCode = projectCode;
        if (!finalCode) {
          try {
            finalCode = await SupabaseSyncService.getNextProjectCode();
            setProjectCode(finalCode);
          } catch (err) {
            console.warn('Failed to get sequential project code on commit:', err);
            finalCode = `PRJ-${Date.now().toString().slice(-4)}`;
          }
        }

        const newProject: Project = {
          id: projectId,
          code: finalCode,
          title: title.trim(),
          customerName: customerName.trim() || title.trim(),
          customerPhone: customerPhone.trim(),
          address: address.trim(),
          locationUrl: locationUrl.trim(),
          shadePanels: Number(shadePanels) || 0,
          curtainPanels: Number(curtainPanels) || 0,
          mechanismType: mechanismType.trim(),
          approximateArea: approximateArea ? Number(approximateArea) : undefined,
          specialNotes: specialNotes.trim(),
          proposalImages,
          scheduledDate,
          endDate: endDate && endDate > scheduledDate ? endDate : undefined,
          scheduledTime,
          assignedTechnicianIds,
          leadTechnicianId: effectiveLead,
          assignedTeamId: assignedTeamId || undefined,
          assignedTeamName: assignedTeamName || undefined,
          estimatedWorkload: estimatedWorkload ? Number(estimatedWorkload) : undefined,
          requiredDurationHours: requiredDurationHours ? Number(requiredDurationHours) : undefined,
          secondMeasurementDoc: secondMeasurementDoc.trim() || undefined,
          technicalHandover,
          isFullTools,
          toolsRequired,
          customToolsNotes: customToolsNotes.trim(),
          specialTools,
          isForceMajeure,
          priority: isForceMajeure ? 'HIGH' : 'NORMAL',
          salesRepName: salesRepName.trim() || undefined,
          status,
          beforePhotos: [],
          afterPhotos: [],
          completionPhotos: [],
          completionNotes: '',
          qcStatus: status === 'COMPLETED' ? 'PENDING' : qcStatus,
          evaluations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await onSave({ type: 'CREATE_PROJECT', project: newProject });
      }
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت اطلاعات مأموریت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nonQcUsers = users.filter((u) => u.role !== 'QC_MANAGER');
  const filteredUsers = nonQcUsers.filter((u) => {
    if (!techSearchQuery.trim()) return true;
    const q = techSearchQuery.trim().toLowerCase();
    return getDisplayName(u.name).toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#151B23] rounded-lg max-w-2xl w-full shadow-2xl border border-[#212835] flex flex-col max-h-[92vh] overflow-hidden my-4">
        {/* Modal Header */}
        <div className="bg-[#0D1117] px-5 py-3.5 text-white flex items-center justify-between border-b border-[#C5A059]/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#C5A059]">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="project-modal-title" className="font-bold text-sm sm:text-base text-white">
                  {isEditing ? 'ویرایش مأموریت' : 'ثبت مأموریت جدید'}
                </h3>
                {projectCode && (
                  <span className="text-xs bg-[#C1A056] text-black font-mono font-bold px-2 py-0.5 rounded-md">
                    {projectCode}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="بستن فرم"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Section 1: Customer & Address */}
          <div className="bg-[#111620] border border-[#212835] rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#C5A059]" />
              <span>اطلاعات پروژه و محل نصب</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="project-title" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  عنوان پروژه: *
                </label>
                <input
                  id="project-title"
                  type="text"
                  required
                  placeholder="مثال: ویلای لواسان - سالن اصلی"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-black/30 rounded-lg border border-[#212835]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isForceMajeure}
                    onChange={(e) => setIsForceMajeure(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-500 accent-rose-500 focus:ring-rose-500"
                  />
                  <span className={`text-xs font-bold ${isForceMajeure ? 'text-rose-400' : 'text-[#9BA7B6]'}`}>
                    🔥 پروژه فورس‌ماژور (اولویت آنی و اقدام سریع)
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#9BA7B6]">کارشناس فروش:</span>
                  <input
                    type="text"
                    placeholder="مثال: خانم سلیمانی"
                    value={salesRepName}
                    onChange={(e) => setSalesRepName(e.target.value)}
                    className="text-xs p-1.5 rounded border border-[#212835] bg-[#0D1117] text-white w-36"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="customer-name" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  نام کارفرما:
                </label>
                <input
                  id="customer-name"
                  type="text"
                  placeholder="مثال: آقای پیروز"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="customer-phone" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  شماره تماس مشتری:
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  placeholder="09......"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="project-address" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  نشانی دقیق محل نصب:
                </label>
                <textarea
                  id="project-address"
                  rows={2}
                  placeholder="خیابان، کوچه، پلاک، طبقه و واحد..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="location-url" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  لینک لوکیشن (نشان، بلد یا گوگل‌مپ):
                </label>
                <input
                  id="location-url"
                  type="url"
                  placeholder="https://nshn.ir/... یا https://maps.google.com/..."
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Section: Official Handover Gate */}
          <div className="bg-[#111620] border border-[#C5A059]/40 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-[#C5A059]" />
                <span>گیت تحویل رسمی به واحد فنی (پیش‌نیاز زمان‌بندی و اعزام)</span>
              </h4>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                isHandoverComplete
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30'
              }`}>
                {isHandoverComplete ? '✓ گیت تایید شده' : '⏳ در انتظار تایید پیش‌نیازها'}
              </span>
            </div>

            {!isHandoverComplete && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>پروژه تا زمان ثبت و تأیید ورود و تحویل کالا به انبار مرکزی، قابل زمان‌بندی و اعزام اکیپ نیست.</span>
              </div>
            )}

            {/* Warehouse Confirmation Card (Sole Handover Gate Prerequisite) */}
            <div className={`p-4 rounded-md border transition-all ${
              whConfirmed
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-[#212835] bg-white dark:bg-[#151515]'
            }`}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whConfirmed}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setWhConfirmed(val);
                    if (val && !whConfirmedBy) {
                      setWhConfirmedBy('مسئول انبار مرکزی');
                    }
                  }}
                  className="mt-0.5 w-4 h-4 rounded text-[#C5A059] focus:ring-[#C1A056] accent-[#C1A056]"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-[#F0F4F8] flex items-center gap-1.5">
                    <Warehouse className="w-4 h-4 text-[#C5A059]" />
                    <span>تأیید ورود و تحویل فیزیکی کالا به انبار مرکزی</span>
                  </span>
                  <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">
                    پارچه‌ها، پرده‌ها، شیدها و یراق‌آلات کامل تحویل انبار مرکزی شده، در قفسه چیدمان گردیده و آماده بارگیری اکیپ است.
                  </span>
                </div>
              </label>
              {whConfirmed && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="نام یا سمت تحویل‌گیرنده انبار..."
                    value={whConfirmedBy}
                    onChange={(e) => setWhConfirmedBy(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-emerald-500/30 bg-white dark:bg-[#121212] dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="شماره قفسه، حواله انبار یا یادداشت تحویل..."
                    value={whNotes}
                    onChange={(e) => setWhNotes(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#212835] bg-white dark:bg-[#121212] dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Technical Specifications */}
          <div className="bg-[#111620] border border-[#212835] rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#C5A059]" />
              <span>مشخصات فنی پرده و شید</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="shade-panels" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  تعداد لت شید:
                </label>
                <input
                  id="shade-panels"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={shadePanels}
                  onChange={(e) => setShadePanels(Number(e.target.value))}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white text-center font-mono font-bold"
                />
              </div>

              <div>
                <label htmlFor="curtain-panels" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  تعداد لت پرده:
                </label>
                <input
                  id="curtain-panels"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={curtainPanels}
                  onChange={(e) => setCurtainPanels(Number(e.target.value))}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white text-center font-mono font-bold"
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label htmlFor="mechanism-type" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  نوع مکانیزم و موتور:
                </label>
                <input
                  id="mechanism-type"
                  type="text"
                  placeholder="موتور سامفی رادیویی + ریل برقی"
                  value={mechanismType}
                  onChange={(e) => setMechanismType(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="special-notes" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  توضیحات و نکات کلیدی:
                </label>
                <textarea
                  id="special-notes"
                  rows={2}
                  placeholder="نکات حساسیت مشتری، نوع سقف کاذب، زیرسازی..."
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Proposal Images */}
          <div className="bg-[#111620] border border-[#C5A059]/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#C5A059]" />
                <span>تصویر پروپوزال فروش (نقشه و برگه سفارش)</span>
              </h4>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {proposalImages.map((img) => (
                <div
                  key={img.id}
                  className="relative w-16 h-20 rounded-md overflow-hidden border border-[#C5A059]  bg-[#0D1117]"
                >
                  <CloudImage src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveProposalImage(img.id)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition cursor-pointer"
                    aria-label="حذف عکس"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-20 h-20 rounded-md border-2 border-dashed border-[#C5A059] hover:border-[#212121] bg-[#0D1117] cursor-pointer text-[#C5A059] transition">
                <Camera className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">پیوست عکس</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleProposalUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 4: Schedule & Team Assignment */}
          <div className="bg-[#111620] border border-[#212835] rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#C5A059]" />
              <span>زمان‌بندی، انتساب اکیپ و برآورد فنی</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Assigned Installation Team */}
              <div className="sm:col-span-2">
                <label htmlFor="assigned-team" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  اکیپ تخصیص‌یافته (از 4 اکیپ رسمی نصب):
                </label>
                <select
                  id="assigned-team"
                  value={assignedTeamId}
                  onChange={(e) => {
                    const tId = e.target.value;
                    setAssignedTeamId(tId);
                    const selected = effectiveTeams.find((t) => t.id === tId || t.code === tId);
                    let computedTeamName = selected ? selected.name : '';
                    if (tId) {
                      const currentTeamMembers = (teamMembers || []).filter((m) => m.teamId === tId);
                      const leadMember = currentTeamMembers.find((m) => m.roleInTeam === 'LEAD');
                      const sup = users.find((u) => u.id === (leadMember?.userId || selected?.supervisorId));
                      if (sup) {
                        computedTeamName = `اکیپ نصب ${getDisplayName(sup.name)}`;
                      }
                      const techIds = currentTeamMembers.map((m) => m.userId);
                      if (leadMember) {
                        setLeadTechnicianId(leadMember.userId);
                      } else if (selected?.supervisorId) {
                        setLeadTechnicianId(selected.supervisorId);
                      }
                      if (techIds.length > 0) {
                        setAssignedTechnicianIds(techIds);
                      } else if (selected?.supervisorId) {
                        setAssignedTechnicianIds([selected.supervisorId]);
                      }
                    }
                    setAssignedTeamName(computedTeamName);
                  }}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white font-bold"
                >
                  <option value="">بدون اکیپ (تعیین نشده)</option>
                  {effectiveTeams.map((t) => {
                    const leadMember = (teamMembers || []).find((m) => m.teamId === t.id && m.roleInTeam === 'LEAD');
                    const sup = users.find((u) => u.id === (leadMember?.userId || t.supervisorId));
                    const displayName = sup ? `اکیپ نصب ${getDisplayName(sup.name)}` : t.name;
                    return (
                      <option key={t.id || t.code} value={t.id || t.code}>
                        {displayName} ({t.code})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Workload & Duration Estimates */}
              <div>
                <label htmlFor="estimated-workload" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  حجم کار تخمینی (متر طول / مساحت):
                </label>
                <input
                  id="estimated-workload"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="مثال: 24.5"
                  value={estimatedWorkload}
                  onChange={(e) => setEstimatedWorkload(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white font-bold text-center font-mono"
                />
              </div>

              <div>
                <label htmlFor="required-duration" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  تخمین مدت کار (ساعت):
                </label>
                <input
                  id="required-duration"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="مثال: 4"
                  value={requiredDurationHours}
                  onChange={(e) => setRequiredDurationHours(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white font-bold text-center font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="second-measurement-doc" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  سند قطعی اندازه‌گیری دوم (شماره فرم یا توضیحات ابعاد تاییدشده):
                </label>
                <input
                  id="second-measurement-doc"
                  type="text"
                  placeholder="مثال: فرم اندازه‌گیری دوم شماره 108 — ابعاد کف‌سازی با کناف مطابقت دارد"
                  value={secondMeasurementDoc}
                  onChange={(e) => setSecondMeasurementDoc(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="scheduled-date" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  تاریخ اجرا:
                </label>
                <select
                  id="scheduled-date"
                  value={scheduledDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setScheduledDate(newStart);
                    if (!endDate || endDate < newStart) {
                      setEndDate(newStart);
                    }
                  }}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white font-bold"
                >
                  {days.map((d) => (
                    <option key={d.dateKey} value={d.dateKey}>
                      {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} -{' '}
                      {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="end-date" className="block text-xs font-semibold text-[#9BA7B6]">
                    تاریخ پایان (برای پروژه‌های چندروزه):
                  </label>
                  {endDate && endDate > scheduledDate && (
                    <span className="text-xs bg-[#C1A056]/20 text-[#C5A059] font-bold px-2 py-0.5 rounded-full">
                      پروژه {toPersianDigits(getMultiDayTotalDays(scheduledDate, endDate))} روزه
                    </span>
                  )}
                </div>
                <select
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white font-bold"
                >
                    {days
                      .filter((d) => d.dateKey >= scheduledDate)
                      .map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} -{' '}
                          {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                        </option>
                      ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="scheduled-time" className="block text-xs font-semibold text-[#9BA7B6] mb-1">
                  ساعت حضور در محل:
                </label>
                <input
                  id="scheduled-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white text-center font-bold font-mono"
                />
              </div>
            </div>

            {/* Technicians Multi-Select with Searchable Chip List */}
            <div className="pt-1">
              {!hasLeadTechnician && (
                <div className="mb-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>حداقل یک سرپرست اکیپ در پرسنل تعریف کنید</span>
                </div>
              )}

              <label className="block text-xs font-semibold text-[#9BA7B6] mb-1.5">
                تکنسین‌های حاضر در این مأموریت (سرپرست مشخص شود):
              </label>

              {nonQcUsers.length > 6 && (
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-[#8A857B] absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="جستجوی تکنسین..."
                    value={techSearchQuery}
                    onChange={(e) => setTechSearchQuery(e.target.value)}
                    className="w-full text-xs pr-8 pl-2.5 py-1.5 rounded-lg border border-[#212835] bg-[#0D1117] dark:text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                {filteredUsers.map((u) => {
                  const isSelected = assignedTechnicianIds.includes(u.id);
                  const isLead = leadTechnicianId === u.id;

                  return (
                    <div
                      key={u.id}
                      onClick={() => handleTechnicianToggle(u.id)}
                      className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition select-none ${
                        isSelected
                          ? 'border-[#C5A059] bg-white dark:bg-[#222222] ring-1 ring-[#C1A056]/30'
                          : 'border-[#212835] bg-white/70 dark:bg-[#161616]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={getDisplayName(u.name)} id={u.id} size="sm" />
                        <span className="text-xs font-bold truncate">{getDisplayName(u.name)}</span>
                      </div>

                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLeadTechnicianId(u.id);
                          }}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition cursor-pointer ${
                            isLead
                              ? 'bg-[#0D1117] text-[#E5CA8F]'
                              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                          }`}
                        >
                          {isLead ? '⭐ سرپرست' : 'سرپرست کن'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 5: Tools Checklist */}
          <div className="bg-[#111620] border border-[#212835] rounded-lg p-4 space-y-3">
            {/* Special Tools (فارسی‌بر، دریل سرکج، نردبان 4 متری، تراز 360 و ...) */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300">
                  ⚡ ابزارهای ویژه و کم‌تعداد (تحویل به این اکیپ):
                </span>
                <span className="text-[11px] text-amber-400">رهگیری ابزارهای خاص محدود</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'فارسی‌بر',
                  'دریل سرکج',
                  'نردبان 4 متری',
                  'تراز لیزری 360',
                  'دستگاه شیارزن',
                  'پیچ‌بند ضربه‌ای',
                ].map((tool) => {
                  const isChecked = specialTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() =>
                        setSpecialTools((prev) =>
                          prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
                        )
                      }
                      className={`text-xs px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
                        isChecked
                          ? 'bg-amber-400 text-black shadow-sm'
                          : 'bg-black/40 text-gray-300 border border-[#212835] hover:border-amber-400/50'
                      }`}
                    >
                      {isChecked ? '✓' : '+'} {tool}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <h4 className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#C5A059]" />
                <span>چک‌لیست ابزار عمومی</span>
              </h4>

              <button
                type="button"
                onClick={handleToggleFullTools}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  isFullTools
                    ? 'bg-[#0D1117] text-[#E5CA8F]'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{isFullTools ? '✓ حالت فول ابزار' : 'دکمه فول ابزار'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {settings.defaultTools.map((tool) => {
                const checked = toolsRequired.includes(tool);
                return (
                  <label
                    key={tool}
                    className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition select-none ${
                      checked
                        ? 'border-[#C5A059] bg-white dark:bg-[#222222] font-bold'
                        : 'border-[#212835] bg-white/70 dark:bg-[#161616]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToolCheckbox(tool)}
                      className="rounded text-[#C5A059] focus:ring-[#C1A056] w-4 h-4 accent-[#C1A056]"
                    />
                    <span>{tool}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Inline Error */}
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </form>

        {/* Sticky Modal Footer */}
        <div className="p-4 border-t border-[#212835] bg-[#FAF7F2] dark:bg-[#181818] flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1"
          >
            انصراف
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={!hasLeadTechnician || isSubmitting}
            onClick={handleSubmit}
            className="flex-1"
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            {isEditing ? 'ذخیره تغییرات' : 'ثبت مأموریت'}
          </Button>
        </div>
      </div>
    </div>
  );
};
