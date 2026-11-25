import React, { useState, useMemo } from 'react';
import { triggerToast } from '../Toast';
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
  FileText,
  AlertCircle,
  CheckSquare,
  Pencil,
  Users,
  ChevronDown,
  Crown,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { getUpcomingDays, getTodayPersianString, toPersianDigits, toEnglishDigits, getDayInfoFromDateKey, DayInfo } from '../../utils/jalali';
import { getMultiDayTotalDays } from '../../utils/multiDay';
import { compressImageFile } from '../../utils/imageCompressor';
import { SupabaseSyncService } from '../../utils/supabase';
import { CloudImage } from '../common/CloudImage';
import { computeProjectDiff } from '../../utils/offlineQueue';
import { Button } from '../ui/Button';
import { getDisplayName } from '../../utils/technicianName';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export type ProjectFormSaveData =
  | { type: 'CREATE_PROJECT'; project: Project }
  | { type: 'PATCH_PROJECT'; id: string; patch: Partial<Project> };

interface Props {
  project?: Project | null;
  initialData?: Partial<Project> | null;
  defaultDate?: string;
  users: User[];
  teams?: InstallationTeam[];
  teamMembers?: TeamMember[];
  settings: SystemSettings;
  /** برای هشدار تداخل برنامه اکیپ/سرپرست در همان روز (اختیاری) */
  projects?: Project[];
  onClose: () => void;
  onSave: (data: ProjectFormSaveData) => void;
}

export const ProjectFormModal: React.FC<Props> = ({
  project,
  initialData,
  defaultDate,
  users,
  teams,
  teamMembers,
  settings,
  projects,
  onClose,
  onSave,
}) => {
  // فرم طولانی است؛ بستن تصادفی (Esc، ضربدر، انصراف) نباید اطلاعات واردشده را دور بریزد.
  const dirtyRef = React.useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };
  const requestClose = () => {
    if (
      dirtyRef.current &&
      !window.confirm('تغییرات این فرم ذخیره نشده است. بدون ذخیره بسته شود؟')
    ) {
      return;
    }
    onClose();
  };
  useEscapeKey(requestClose);
  const isEditing = Boolean(project);
  const effective = project || initialData;
  const days: DayInfo[] = useMemo(() => {
    const list: DayInfo[] = getUpcomingDays(365);
    const customDates = [effective?.scheduledDate, effective?.endDate, defaultDate].filter(Boolean) as string[];
    for (const cd of customDates) {
      if (!list.some((d) => d.dateKey === cd)) {
        const info = getDayInfoFromDateKey(cd);
        if (info) {
          list.push(info);
        }
      }
    }
    return list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [effective?.scheduledDate, effective?.endDate, defaultDate]);

  const defaultTeams: InstallationTeam[] = [
    { id: 'TEAM_1', name: 'اکیپ نصب 1', code: 'TEAM_1', createdAt: '', updatedAt: '' },
    { id: 'TEAM_2', name: 'اکیپ نصب 2', code: 'TEAM_2', createdAt: '', updatedAt: '' },
    { id: 'TEAM_3', name: 'اکیپ نصب 3', code: 'TEAM_3', createdAt: '', updatedAt: '' },
    { id: 'TEAM_4', name: 'اکیپ نصب 4', code: 'TEAM_4', createdAt: '', updatedAt: '' },
  ];
  const effectiveTeams = teams && teams.length > 0 ? teams : defaultTeams;

  // Gating & Technical Handover states (solely based on Warehouse Confirmation)
  const [whConfirmed, setWhConfirmed] = useState<boolean>(
    Boolean(effective?.technicalHandover?.warehouseConfirmation?.confirmed)
  );
  const [whConfirmedBy, setWhConfirmedBy] = useState<string>(
    effective?.technicalHandover?.warehouseConfirmation?.confirmedBy || ''
  );
  const [whNotes, setWhNotes] = useState<string>(
    effective?.technicalHandover?.warehouseConfirmation?.notes || ''
  );

  // Teams & Workload states
  const [assignedTeamId, setAssignedTeamId] = useState<string>(
    effective?.assignedTeamId || ''
  );
  const [assignedTeamName, setAssignedTeamName] = useState<string>(
    effective?.assignedTeamName || ''
  );
  const [estimatedWorkload, setEstimatedWorkload] = useState<string>(
    effective?.estimatedWorkload ? String(effective.estimatedWorkload) : ''
  );
  const [requiredDurationHours, setRequiredDurationHours] = useState<string>(
    effective?.requiredDurationHours ? String(effective.requiredDurationHours) : ''
  );
  const [secondMeasurementDoc, setSecondMeasurementDoc] = useState<string>(
    effective?.secondMeasurementDoc || ''
  );

  // Form states
  const [projectId] = useState(() => effective?.id || `p-${Date.now()}`);
  const [projectCode, setProjectCode] = useState(effective?.code || '');
  const [title, setTitle] = useState(effective?.title || '');
  const [customerName, setCustomerName] = useState(effective?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(effective?.customerPhone || '');
  const [address, setAddress] = useState(effective?.address || '');
  const [locationUrl, setLocationUrl] = useState(effective?.locationUrl || '');

  const [shadePanels, setShadePanels] = useState<number>(effective?.shadePanels ?? 0);
  const [curtainPanels, setCurtainPanels] = useState<number>(effective?.curtainPanels ?? 0);
  const [mechanismType, setMechanismType] = useState(effective?.mechanismType || '');
  const [approximateArea, setApproximateArea] = useState<string>(
    effective?.approximateArea ? String(effective.approximateArea) : ''
  );
  const [specialNotes, setSpecialNotes] = useState(effective?.specialNotes || '');

  // Scheduled date & time
  const [scheduledDate, setScheduledDate] = useState(
    effective?.scheduledDate || defaultDate || days[0]?.dateKey || ''
  );
  const [endDate, setEndDate] = useState(
    effective?.endDate || effective?.scheduledDate || defaultDate || days[0]?.dateKey || ''
  );
  const [scheduledTime, setScheduledTime] = useState(effective?.scheduledTime || '09:30');

  // Technician assignment
  // وقتی فرم با اکیپ از پیش انتخاب‌شده باز می‌شود (خانه اکیپ در تقویم یا رزرو فروش)،
  // سرپرست و نفرات همان اکیپ از ابتدا نمایش داده شوند، نه فقط موقع ثبت.
  const presetTeamMembers = useMemo(
    () =>
      effective?.assignedTeamId && !effective?.leadTechnicianId && !(effective?.assignedTechnicianIds || []).length
        ? (teamMembers || []).filter((m) => m.teamId === effective.assignedTeamId)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [assignedTechnicianIds, setAssignedTechnicianIds] = useState<string[]>(
    effective?.assignedTechnicianIds?.length
      ? effective.assignedTechnicianIds
      : presetTeamMembers.map((m) => m.userId)
  );
  const [leadTechnicianId, setLeadTechnicianId] = useState<string>(
    effective?.leadTechnicianId ||
      presetTeamMembers.find((m) => m.roleInTeam === 'LEAD')?.userId ||
      ''
  );

  // Tools checklist
  const [isFullTools, setIsFullTools] = useState<boolean>(effective?.isFullTools ?? true);
  const [toolsRequired, setToolsRequired] = useState<string[]>(
    effective?.toolsRequired || settings.defaultTools
  );
  const [customToolsNotes, setCustomToolsNotes] = useState(effective?.customToolsNotes || '');
  const [specialTools, setSpecialTools] = useState<string[]>(effective?.specialTools || []);
  const [isForceMajeure, setIsForceMajeure] = useState<boolean>(effective?.isForceMajeure ?? false);
  const [salesRepName, setSalesRepName] = useState<string>(effective?.salesRepName || '');

  // Proposal images
  const [proposalImages, setProposalImages] = useState<ProposalImage[]>(
    effective?.proposalImages || []
  );

  // Status & QC
  const status: Project['status'] =
    effective?.status || 'SCHEDULED';
  const qcStatus: Project['qcStatus'] = effective?.qcStatus || 'NOT_STARTED';

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
        triggerToast('error', err instanceof Error && err.message ? err.message : 'این عکس آماده نشد؛ دوباره امتحان کنید.');
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
      document.getElementById('project-title')?.focus();
      return;
    }

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits && phoneDigits.length < 8) {
      setFormError('شماره تماس مشتری کامل نیست.');
      document.getElementById('customer-phone')?.focus();
      return;
    }

    // انتساب خودکار سرپرست و تکنسین‌ها بر اساس اعضای اکیپ منتسب‌شده (در صورت عدم انتخاب دستی)
    let finalTechnicianIds = [...assignedTechnicianIds];
    let effectiveLead = leadTechnicianId;

    if (assignedTeamId) {
      const currentTeamMembers = (teamMembers || []).filter((m) => m.teamId === assignedTeamId);
      const leadMember = currentTeamMembers.find((m) => m.roleInTeam === 'LEAD');
      const selectedTeam = effectiveTeams.find((t) => t.id === assignedTeamId || t.code === assignedTeamId);
      
      if (!effectiveLead) {
        effectiveLead = leadMember?.userId || selectedTeam?.supervisorId || '';
      }
      
      if (finalTechnicianIds.length === 0) {
        finalTechnicianIds = currentTeamMembers.map((m) => m.userId);
        if (finalTechnicianIds.length === 0 && effectiveLead) {
          finalTechnicianIds = [effectiveLead];
        }
      }
    }

    if (!effectiveLead && finalTechnicianIds.length > 0) {
      effectiveLead = finalTechnicianIds[0];
    }
    // سرپرست همیشه جزو نفرات پروژه است (کارتابل نصاب و قوانین سرور بر همین اساس است).
    if (effectiveLead && !finalTechnicianIds.includes(effectiveLead)) {
      finalTechnicianIds = [effectiveLead, ...finalTechnicianIds];
    }

    // Handover Gate validation: فقط شروع اعزام به کارگاه (EN_ROUTE / IN_PROGRESS) منوط به تایید فیزیکی ورود کالا به انبار است
    const isDispatching = ['EN_ROUTE', 'IN_PROGRESS'].includes(status);

    if (isDispatching && !whConfirmed) {
      setFormError('دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید ورود کالا به انبار، قابل اعزام اکیپ و شروع کار در کارگاه نیست.');
      return;
    }

    const technicalHandover: ProjectTechnicalHandover = {
      isHandoverComplete: whConfirmed,
      warehouseConfirmation: {
        confirmed: whConfirmed,
        confirmedBy: whConfirmed ? (whConfirmedBy.trim() || 'مسئول انبار مرکزی') : undefined,
        confirmedAt: whConfirmed
          ? project?.technicalHandover?.warehouseConfirmation?.confirmedAt || new Date().toISOString()
          : undefined,
        notes: whNotes.trim() || undefined,
        shelfLocation: project?.technicalHandover?.warehouseConfirmation?.shelfLocation,
      },
      officialHandoverDate: whConfirmed
        ? project?.technicalHandover?.officialHandoverDate || new Date().toISOString()
        : undefined,
      unlockedAt: whConfirmed
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
          assignedTechnicianIds: finalTechnicianIds,
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
          assignedTechnicianIds: finalTechnicianIds,
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

  // ---- انتخاب نفرات ----
  const leadCandidates = users.filter((u) => u.role === 'LEAD_TECHNICIAN');
  const crewCandidates = users.filter(
    (u) => (u.role === 'TECHNICIAN' || u.role === 'LEAD_TECHNICIAN') && u.id !== leadTechnicianId
  );
  const userLabel = (id?: string) => {
    const u = users.find((x) => x.id === id);
    return u ? getDisplayName(u.name) : '';
  };

  const handleLeadChange = (id: string) => {
    markDirty();
    setLeadTechnicianId(id);
    if (id && !assignedTechnicianIds.includes(id)) {
      setAssignedTechnicianIds((prev) => [id, ...prev]);
    }
  };

  const handleCrewToggle = (id: string) => {
    markDirty();
    handleTechnicianToggle(id);
  };

  // ---- هشدار تداخل: همان اکیپ یا همان سرپرست در بازه همین تاریخ‌ها مأموریت دیگری دارد ----
  const scheduleConflicts = useMemo(() => {
    if (!projects || !scheduledDate) return [] as Project[];
    const rangeEnd = endDate && endDate > scheduledDate ? endDate : scheduledDate;
    return projects.filter((p) => {
      if (p.id === projectId) return false;
      if (p.status === 'CANCELLED' || p.status === 'COMPLETED') return false;
      const sameTeam = Boolean(assignedTeamId) && p.assignedTeamId === assignedTeamId;
      const sameLead = Boolean(leadTechnicianId) && p.leadTechnicianId === leadTechnicianId;
      if (!sameTeam && !sameLead) return false;
      // هم‌پوشانی بازه‌ها
      const pStart = p.scheduledDate;
      const pEnd = p.endDate && p.endDate > p.scheduledDate ? p.endDate : p.scheduledDate;
      if (!pStart) return false;
      return pStart <= rangeEnd && pEnd >= scheduledDate;
    });
  }, [projects, scheduledDate, endDate, projectId, assignedTeamId, leadTechnicianId]);

  const hasNoCrew = !assignedTeamId && !leadTechnicianId && assignedTechnicianIds.length === 0;

  const dateLabel = (key: string) => {
    const d = days.find((x) => x.dateKey === key);
    if (!d) return key;
    return `${d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} ${d.persianDayNum} ${d.persianMonthName}`;
  };

  const numericValue = (raw: string) => {
    const latin = toEnglishDigits(raw).replace(/[^\d]/g, '');
    return latin ? Number(latin) : 0;
  };
  const decimalValue = (raw: string) =>
    toEnglishDigits(raw)
      .replace(/[٫,]/g, '.')
      .replace(/[^\d.]/g, '');

  const inputCls =
    'w-full text-sm p-2.5 rounded-md border border-line bg-canvas text-ink focus:outline-none focus:border-brand';
  const labelCls = 'block text-xs font-semibold text-ink-2 mb-1';
  const sectionCls = 'bg-sunken border border-line rounded-lg p-4 space-y-3';
  const sectionTitleCls = 'text-sm font-bold text-ink flex items-center gap-1.5';
  const stepBadge = (n: number) => (
    <span className="w-5 h-5 rounded-full bg-brand text-black text-[11px] font-black flex items-center justify-center shrink-0">
      {toPersianDigits(n)}
    </span>
  );

  const crewSummary = assignedTeamName
    ? assignedTeamName
    : leadTechnicianId
      ? `سرپرست: ${userLabel(leadTechnicianId)}`
      : 'بدون اکیپ';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="bg-surface sm:rounded-lg max-w-2xl w-full shadow-2xl border border-line flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-canvas px-4 sm:px-5 py-3 text-ink flex items-center justify-between border-b border-brand/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-brand-ink shrink-0">
              {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="project-modal-title" className="font-bold text-sm sm:text-base text-ink truncate">
                  {isEditing ? 'ویرایش مأموریت' : 'ثبت مأموریت جدید'}
                </h3>
                {projectCode && (
                  <span className="text-xs bg-brand text-black font-mono font-bold px-2 py-0.5 rounded-md">
                    {projectCode}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-ink-3 truncate">
                فیلدهای ستاره‌دار الزامی‌اند؛ بقیه را می‌توانید بعداً تکمیل کنید.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 text-ink transition cursor-pointer shrink-0"
            aria-label="بستن فرم"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="project-form"
          onSubmit={handleSubmit}
          onChangeCapture={markDirty}
          className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4"
          noValidate
        >
          {/* ۱. مشتری و محل نصب */}
          <section className={sectionCls}>
            <h4 className={sectionTitleCls}>
              {stepBadge(1)}
              <MapPin className="w-4 h-4 text-brand-ink" />
              <span>مشتری و محل نصب</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="project-title" className={labelCls}>
                  عنوان پروژه <span className="text-rose-400">*</span>
                </label>
                <input
                  id="project-title"
                  type="text"
                  required
                  autoFocus={!isEditing}
                  placeholder="مثال: ویلای لواسان - سالن اصلی"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="customer-name" className={labelCls}>
                  نام کارفرما
                </label>
                <input
                  id="customer-name"
                  type="text"
                  placeholder="اگر خالی بماند، عنوان پروژه ثبت می‌شود"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="customer-phone" className={labelCls}>
                  شماره تماس مشتری
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="09121234567"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(toEnglishDigits(e.target.value).replace(/[^\d+\-\s]/g, ''))
                  }
                  className={`${inputCls} font-mono text-left`}
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="project-address" className={labelCls}>
                  نشانی دقیق محل نصب
                </label>
                <textarea
                  id="project-address"
                  rows={2}
                  placeholder="خیابان، کوچه، پلاک، طبقه و واحد..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="location-url" className={labelCls}>
                  لینک لوکیشن (نشان، بلد یا گوگل‌مپ)
                </label>
                <input
                  id="location-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://nshn.ir/..."
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  className={`${inputCls} text-left font-mono`}
                  dir="ltr"
                />
              </div>

              <div>
                <label htmlFor="sales-rep" className={labelCls}>
                  کارشناس فروش
                </label>
                <input
                  id="sales-rep"
                  type="text"
                  placeholder="مثال: خانم سلیمانی"
                  value={salesRepName}
                  onChange={(e) => setSalesRepName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <label
                className={`sm:col-span-2 flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition ${
                  isForceMajeure ? 'border-rose-500/50 bg-rose-500/10' : 'border-line bg-surface'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isForceMajeure}
                  onChange={(e) => setIsForceMajeure(e.target.checked)}
                  className="w-4 h-4 rounded accent-rose-500"
                />
                <span className={`text-xs font-bold ${isForceMajeure ? 'text-rose-400' : 'text-ink-2'}`}>
                  🔥 فورس‌ماژور — اولویت آنی و اقدام سریع
                </span>
              </label>
            </div>
          </section>

          {/* ۲. زمان و اکیپ */}
          <section className={sectionCls}>
            <h4 className={sectionTitleCls}>
              {stepBadge(2)}
              <Calendar className="w-4 h-4 text-brand-ink" />
              <span>زمان اجرا و اکیپ</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="scheduled-date" className={labelCls}>
                  تاریخ شروع <span className="text-rose-400">*</span>
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
                  className={`${inputCls} font-bold`}
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
                  <label htmlFor="end-date" className="block text-xs font-semibold text-ink-2">
                    تاریخ پایان
                  </label>
                  {endDate && endDate > scheduledDate ? (
                    <span className="text-[12px] bg-brand/20 text-brand-ink font-bold px-2 py-0.5 rounded-full">
                      {toPersianDigits(getMultiDayTotalDays(scheduledDate, endDate))} روزه
                    </span>
                  ) : (
                    <span className="text-[12px] text-ink-3">یک‌روزه</span>
                  )}
                </div>
                <select
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`${inputCls} font-bold`}
                >
                  {days
                    .filter((d) => d.dateKey >= scheduledDate)
                    .map((d) => (
                      <option key={d.dateKey} value={d.dateKey}>
                        {d.dateKey === scheduledDate ? 'همان روز (یک‌روزه)' : `${d.persianDayName} - ${d.persianDayNum} ${d.persianMonthName} (${toPersianDigits(d.persianDateStr)})`}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="scheduled-time" className={labelCls}>
                  ساعت حضور در محل
                </label>
                <input
                  id="scheduled-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className={`${inputCls} text-center font-bold font-mono`}
                />
              </div>

              <div>
                <label htmlFor="assigned-team" className={labelCls}>
                  اکیپ نصب
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
                  className={`${inputCls} font-bold`}
                >
                  <option value="">بدون اکیپ ثابت (انتخاب دستی نفرات)</option>
                  {effectiveTeams.map((t) => {
                    const leadMember = (teamMembers || []).find((m) => m.teamId === t.id && m.roleInTeam === 'LEAD');
                    const sup = users.find((u) => u.id === (leadMember?.userId || t.supervisorId));
                    const displayName = sup ? `اکیپ نصب ${getDisplayName(sup.name)}` : t.name;
                    return (
                      <option key={t.id || t.code} value={t.id || t.code}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* سرپرست و نفرات */}
              <div className="sm:col-span-2 rounded-lg border border-line bg-surface p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-brand-ink" />
                    نفرات اعزامی
                  </span>
                  {assignedTeamId && (
                    <span className="text-[12px] text-ink-3">از روی اعضای اکیپ پر شد؛ قابل تغییر است</span>
                  )}
                </div>

                <div>
                  <label htmlFor="lead-technician" className={labelCls}>
                    سرپرست
                  </label>
                  <select
                    id="lead-technician"
                    value={leadTechnicianId}
                    onChange={(e) => handleLeadChange(e.target.value)}
                    className={`${inputCls} font-bold`}
                  >
                    <option value="">— {assignedTeamId ? 'سرپرست اکیپ (خودکار)' : 'انتخاب نشده'} —</option>
                    {leadCandidates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {getDisplayName(u.name)}
                      </option>
                    ))}
                    {leadTechnicianId && !leadCandidates.some((u) => u.id === leadTechnicianId) && (
                      <option value={leadTechnicianId}>{userLabel(leadTechnicianId) || 'کاربر حذف‌شده'}</option>
                    )}
                  </select>
                </div>

                {crewCandidates.length > 0 && (
                  <div>
                    <span className={labelCls}>نفرات همراه (اختیاری)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {crewCandidates.map((u) => {
                        const checked = assignedTechnicianIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            aria-pressed={checked}
                            onClick={() => handleCrewToggle(u.id)}
                            className={`text-xs px-2.5 py-1.5 rounded-full font-bold transition flex items-center gap-1 cursor-pointer border ${
                              checked
                                ? 'bg-brand text-black border-brand'
                                : 'bg-canvas text-ink-2 border-line hover:border-brand/60'
                            }`}
                          >
                            {u.role === 'LEAD_TECHNICIAN' && <Crown className="w-3 h-3" />}
                            {checked ? '✓' : '+'} {getDisplayName(u.name)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasNoCrew && (
                  <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                    بدون اکیپ و سرپرست، این مأموریت در کارتابل هیچ نصابی دیده نمی‌شود.
                  </p>
                )}
              </div>

              {scheduleConflicts.length > 0 && (
                <div className="sm:col-span-2 p-3 rounded-md border border-amber-500/40 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    این اکیپ/سرپرست در همین تاریخ مأموریت دیگری هم دارد:
                  </div>
                  <ul className="list-disc pr-5 space-y-0.5">
                    {scheduleConflicts.slice(0, 4).map((p) => (
                      <li key={p.id}>
                        {p.title} — {dateLabel(p.scheduledDate)}
                        {p.scheduledTime ? ` ساعت ${toPersianDigits(p.scheduledTime)}` : ''}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[12px] opacity-80">ثبت مجاز است؛ فقط برای جلوگیری از تداخل اعلام شد.</div>
                </div>
              )}
            </div>
          </section>

          {/* ۳. مشخصات فنی و مدارک */}
          <section className={sectionCls}>
            <h4 className={sectionTitleCls}>
              {stepBadge(3)}
              <FileText className="w-4 h-4 text-brand-ink" />
              <span>مشخصات فنی و مدارک</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="shade-panels" className={labelCls}>
                  لت شید
                </label>
                <input
                  id="shade-panels"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={shadePanels ? String(shadePanels) : ''}
                  onChange={(e) => setShadePanels(numericValue(e.target.value))}
                  className={`${inputCls} text-center font-mono font-bold`}
                />
              </div>

              <div>
                <label htmlFor="curtain-panels" className={labelCls}>
                  لت پرده
                </label>
                <input
                  id="curtain-panels"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={curtainPanels ? String(curtainPanels) : ''}
                  onChange={(e) => setCurtainPanels(numericValue(e.target.value))}
                  className={`${inputCls} text-center font-mono font-bold`}
                />
              </div>

              <div>
                <label htmlFor="estimated-workload" className={labelCls}>
                  حجم کار (متر)
                </label>
                <input
                  id="estimated-workload"
                  type="text"
                  inputMode="decimal"
                  placeholder="24.5"
                  value={estimatedWorkload}
                  onChange={(e) => setEstimatedWorkload(decimalValue(e.target.value))}
                  className={`${inputCls} text-center font-mono font-bold`}
                />
              </div>

              <div>
                <label htmlFor="required-duration" className={labelCls}>
                  مدت کار (ساعت)
                </label>
                <input
                  id="required-duration"
                  type="text"
                  inputMode="decimal"
                  placeholder="4"
                  value={requiredDurationHours}
                  onChange={(e) => setRequiredDurationHours(decimalValue(e.target.value))}
                  className={`${inputCls} text-center font-mono font-bold`}
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="mechanism-type" className={labelCls}>
                  نوع مکانیزم و موتور
                </label>
                <input
                  id="mechanism-type"
                  type="text"
                  list="mechanism-suggestions"
                  placeholder="مثال: موتور سامفی رادیویی + ریل برقی"
                  value={mechanismType}
                  onChange={(e) => setMechanismType(e.target.value)}
                  className={inputCls}
                />
                <datalist id="mechanism-suggestions">
                  <option value="مکانیزم دستی استاندارد" />
                  <option value="مکانیزم زنجیری" />
                  <option value="موتور برقی هوشمند سامفی" />
                  <option value="موتور سامفی رادیویی + ریل برقی" />
                  <option value="ریل برقی پرده" />
                </datalist>
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="special-notes" className={labelCls}>
                  توضیحات و نکات کلیدی
                </label>
                <textarea
                  id="special-notes"
                  rows={2}
                  placeholder="حساسیت مشتری، نوع سقف کاذب، زیرسازی..."
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="second-measurement-doc" className={labelCls}>
                  سند اندازه‌گیری دوم (شماره فرم یا توضیح ابعاد تأییدشده)
                </label>
                <input
                  id="second-measurement-doc"
                  type="text"
                  placeholder="مثال: فرم شماره 108 — ابعاد با کناف مطابقت دارد"
                  value={secondMeasurementDoc}
                  onChange={(e) => setSecondMeasurementDoc(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <span className={`${labelCls} flex items-center gap-1.5`}>
                <Camera className="w-3.5 h-3.5 text-brand-ink" />
                تصویر پروپوزال فروش (نقشه و برگه سفارش)
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                {proposalImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative w-16 h-20 rounded-md overflow-hidden border border-brand bg-canvas"
                  >
                    <CloudImage src={img.url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        handleRemoveProposalImage(img.id);
                      }}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition cursor-pointer"
                      aria-label="حذف عکس"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <label className="flex flex-col items-center justify-center w-20 h-20 rounded-md border-2 border-dashed border-brand/70 hover:border-brand bg-canvas cursor-pointer text-brand-ink transition">
                  <Camera className="w-5 h-5 mb-1" />
                  <span className="text-xs font-bold">افزودن عکس</span>
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
          </section>

          {/* ۴. ورود کالا به انبار */}
          <section className={`${sectionCls} ${whConfirmed ? 'border-emerald-500/40' : 'border-brand/40'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className={sectionTitleCls}>
                {stepBadge(4)}
                <CheckSquare className="w-4 h-4 text-brand-ink" />
                <span>ورود کالا به انبار</span>
              </h4>
              <span
                className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full ${
                  whConfirmed
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30'
                }`}
              >
                {whConfirmed ? '✓ کالا در انبار است' : '📦 منتظر تأیید انبار'}
              </span>
            </div>

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
                className="mt-0.5 w-4 h-4 rounded accent-brand"
              />
              <span className="text-xs text-ink-2 leading-6">
                <span className="font-bold text-ink">کالا همین حالا در انبار تحویل شده است.</span>{' '}
                اگر تیک نزنید، پروژه در کارتابل انبار می‌ماند و اکیپ تا تأیید انبار نمی‌تواند حرکت کند.
              </span>
            </label>
            {whConfirmed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  aria-label="تحویل‌گیرنده انبار"
                  placeholder="نام یا سمت تحویل‌گیرنده انبار"
                  value={whConfirmedBy}
                  onChange={(e) => setWhConfirmedBy(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="text"
                  aria-label="یادداشت انبار"
                  placeholder="شماره قفسه، حواله یا یادداشت تحویل"
                  value={whNotes}
                  onChange={(e) => setWhNotes(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
          </section>

          {/* ۵. ابزار — پیش‌فرض فول ابزار است؛ فقط در صورت نیاز باز می‌شود */}
          <details className="group bg-sunken border border-line rounded-lg">
            <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-2 select-none">
              <span className={sectionTitleCls}>
                {stepBadge(5)}
                <Wrench className="w-4 h-4 text-brand-ink" />
                <span>ابزار</span>
              </span>
              <span className="flex items-center gap-2 text-[12px] text-ink-2">
                {isFullTools ? 'فول ابزار' : `${toPersianDigits(toolsRequired.length)} ابزار`}
                {specialTools.length > 0 && ` + ${toPersianDigits(specialTools.length)} ابزار ویژه`}
                <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
              </span>
            </summary>

            <div className="px-4 pb-4 space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">
                  ⚡ ابزارهای ویژه و کم‌تعداد (تحویل به این اکیپ)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['فارسی‌بر', 'دریل سرکج', 'نردبان 4 متری', 'تراز لیزری 360', 'دستگاه شیارزن', 'پیچ‌بند ضربه‌ای'].map(
                    (tool) => {
                      const isChecked = specialTools.includes(tool);
                      return (
                        <button
                          key={tool}
                          type="button"
                          aria-pressed={isChecked}
                          onClick={() => {
                            markDirty();
                            setSpecialTools((prev) =>
                              prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
                            );
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
                            isChecked
                              ? 'bg-amber-400 text-black shadow-sm'
                              : 'bg-canvas text-ink border border-line hover:border-amber-400/50'
                          }`}
                        >
                          {isChecked ? '✓' : '+'} {tool}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">چک‌لیست ابزار عمومی</span>
                <button
                  type="button"
                  onClick={() => {
                    markDirty();
                    handleToggleFullTools();
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    isFullTools ? 'bg-brand text-black' : 'bg-hover text-ink'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isFullTools ? '✓ فول ابزار' : 'انتخاب همه'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {settings.defaultTools.map((tool) => {
                  const checked = toolsRequired.includes(tool);
                  return (
                    <label
                      key={tool}
                      className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition select-none ${
                        checked ? 'border-brand bg-surface font-bold' : 'border-line bg-canvas'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToolCheckbox(tool)}
                        className="rounded w-4 h-4 accent-brand"
                      />
                      <span>{tool}</span>
                    </label>
                  );
                })}
              </div>

              <textarea
                rows={2}
                aria-label="یادداشت ابزار"
                placeholder="یادداشت ابزار (مثلاً: کابل‌کشی اضافه لازم است)"
                value={customToolsNotes}
                onChange={(e) => setCustomToolsNotes(e.target.value)}
                className={inputCls}
              />
            </div>
          </details>

        </form>

        {/* Sticky Modal Footer */}
        <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line bg-surface shrink-0 space-y-2">
          <div className="text-[12px] text-ink-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>📅 {dateLabel(scheduledDate)}{endDate && endDate > scheduledDate ? ` تا ${dateLabel(endDate)}` : ''}</span>
            <span>⏰ {toPersianDigits(scheduledTime || '—')}</span>
            <span>👷 {crewSummary}</span>
          </div>
          {formError && (
            <div className="text-[12px] font-bold text-rose-600 dark:text-rose-300">{formError}</div>
          )}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={isSubmitting}
              onClick={requestClose}
              className="flex-1"
            >
              انصراف
            </Button>

            <Button
              type="submit"
              form="project-form"
              variant="primary"
              size="md"
              loading={isSubmitting}
              disabled={!hasLeadTechnician || isSubmitting}
              disabledReason="ابتدا از بخش پرسنل حداقل یک سرپرست اکیپ تعریف کنید."
              className="flex-[2]"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isEditing ? 'ذخیره تغییرات' : 'ثبت مأموریت'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
