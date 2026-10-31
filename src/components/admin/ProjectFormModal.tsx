import React, { useState, useEffect } from 'react';
import { Project, User, SystemSettings, ProposalImage } from '../../types';
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
} from 'lucide-react';
import { getUpcomingDays, getTodayPersianString } from '../../utils/jalali';
import { compressImageFile } from '../../utils/imageCompressor';
import { SupabaseSyncService } from '../../utils/supabase';
import { CloudImage } from '../common/CloudImage';
import { computeProjectDiff } from '../../utils/offlineQueue';

export type ProjectFormSaveData =
  | { type: 'CREATE_PROJECT'; project: Project }
  | { type: 'PATCH_PROJECT'; id: string; patch: Partial<Project> };

interface Props {
  project?: Project | null;
  defaultDate?: string;
  users: User[];
  settings: SystemSettings;
  onClose: () => void;
  onSave: (data: ProjectFormSaveData) => void;
}

export const ProjectFormModal: React.FC<Props> = ({
  project,
  defaultDate,
  users,
  settings,
  onClose,
  onSave,
}) => {
  const isEditing = !!project;
  const days = getUpcomingDays(30);

  // Form states
  const [projectId] = useState(() => project?.id || `p-${Date.now()}`);
  const [projectCode, setProjectCode] = useState(project?.code || '');
  const [title, setTitle] = useState(project?.title || '');
  const [customerName, setCustomerName] = useState(project?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(project?.customerPhone || '');
  const [address, setAddress] = useState(project?.address || '');
  const [locationUrl, setLocationUrl] = useState(project?.locationUrl || '');
  const [codeLoading, setCodeLoading] = useState<boolean>(!project?.code);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Fetch sequential project code for new project
  useEffect(() => {
    if (!project?.code) {
      setCodeLoading(true);
      setCodeError(null);
      SupabaseSyncService.getNextProjectCode()
        .then((code) => {
          setProjectCode(code);
          setCodeLoading(false);
        })
        .catch((err) => {
          console.warn('Failed to get sequential project code:', err);
          setCodeError('خطا در دریافت کد رهگیری ترتیبی از سرور ابری. لطفاً اتصال را بررسی نمایید.');
          setCodeLoading(false);
        });
    }
  }, [project?.code]);

  const [shadePanels, setShadePanels] = useState<number>(project?.shadePanels ?? 0);
  const [curtainPanels, setCurtainPanels] = useState<number>(project?.curtainPanels ?? 0);
  const [mechanismType, setMechanismType] = useState(project?.mechanismType || '');
  const [approximateArea, setApproximateArea] = useState<string>(project?.approximateArea ? String(project.approximateArea) : '');
  const [specialNotes, setSpecialNotes] = useState(project?.specialNotes || '');

  // Scheduled date & time
  const [scheduledDate, setScheduledDate] = useState(
    project?.scheduledDate || defaultDate || days[0]?.dateKey || ''
  );
  const [scheduledTime, setScheduledTime] = useState(project?.scheduledTime || '09:30');

  // Technician assignment
  const [assignedTechnicianIds, setAssignedTechnicianIds] = useState<string[]>(
    project?.assignedTechnicianIds || []
  );
  const [leadTechnicianId, setLeadTechnicianId] = useState<string>(
    project?.leadTechnicianId || ''
  );

  // Tools checklist
  const [isFullTools, setIsFullTools] = useState<boolean>(project?.isFullTools ?? true);
  const [toolsRequired, setToolsRequired] = useState<string[]>(
    project?.toolsRequired || settings.defaultTools
  );
  const [customToolsNotes, setCustomToolsNotes] = useState(project?.customToolsNotes || '');

  // Proposal images
  const [proposalImages, setProposalImages] = useState<ProposalImage[]>(
    project?.proposalImages || []
  );

  // Status & QC
  const [status, setStatus] = useState<Project['status']>(project?.status || 'SCHEDULED');
  const [qcStatus, setQcStatus] = useState<Project['qcStatus']>(project?.qcStatus || 'NOT_STARTED');

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
      setFormError('ابتدا از بخش مدیریت تکنسینها حداقل یک سرپرست اکیپ تعریف کنید');
      return;
    }

    if (!title.trim()) {
      setFormError('لطفاً عنوان یا نام پروژه را وارد کنید.');
      return;
    }

    if (!project?.code && !projectCode) {
      setFormError('کد سفارش معتبر از سرور دریافت نشده است. لطفاً اتصال اینترنت را بررسی و مجدداً تلاش فرمایید.');
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

    setFormError('');
    setIsSubmitting(true);

    try {
      if (project) {
        // Editing existing project: calculate diff and send ONLY changed fields
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
          scheduledTime,
          assignedTechnicianIds,
          leadTechnicianId: effectiveLead,
          isFullTools,
          toolsRequired,
          customToolsNotes: customToolsNotes.trim(),
          status,
          qcStatus: status === 'COMPLETED' && qcStatus === 'NOT_STARTED' ? 'PENDING' : qcStatus,
          updatedAt: new Date().toISOString(),
        };

        const diff = computeProjectDiff(project, newFields);
        await onSave({ type: 'PATCH_PROJECT', id: project.id, patch: diff });
      } else {
        // New project: send CREATE_PROJECT
        const newProject: Project = {
          id: projectId,
          code: projectCode,
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
          scheduledTime,
          assignedTechnicianIds,
          leadTechnicianId: effectiveLead,
          isFullTools,
          toolsRequired,
          customToolsNotes: customToolsNotes.trim(),
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-3xl w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header in talaei.ir Obsidian & Gold */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl text-[#C1A056]">
              <Plus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="project-modal-title" className="font-black text-lg text-white">
                  {isEditing ? 'ویرایش مأموریت و پروژه' : 'ثبت مأموریت جدید گالری طلایی'}
                </h3>
                {projectCode && (
                  <span className="text-xs bg-[#C1A056] text-black font-mono font-bold px-2 py-0.5 rounded-lg">
                    {projectCode}
                  </span>
                )}
                {codeLoading && (
                  <span className="text-[10px] text-amber-300 animate-pulse">
                    در حال دریافت کد...
                  </span>
                )}
              </div>
              {codeError && (
                <p className="text-xs text-rose-400 font-bold mt-1">{codeError}</p>
              )}
              <p className="text-xs text-[#E8E4DC]">
                مشخصات فنی شید و پرده، تخصیص اکیپ، چک‌لیست ابزار و پیوست پروپوزال فروش
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition"
            aria-label="بستن فرم"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Section 1: Customer & Address */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#E8E4DC] dark:border-[#2D2D2D] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              اطلاعات پروژه و نشانی کارفرما
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="project-title" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  نام پروژه / کارفرما: *
                </label>
                <input
                  id="project-title"
                  type="text"
                  required
                  placeholder="مثال: ویلای لواسان (آقای دکتر پیروز)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              <div>
                <label htmlFor="customer-phone" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  شماره تماس مشتری (جهت تماس تکنسین):
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  placeholder="09......"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="project-address" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  آدرس دقیق محل نصب:
                </label>
                <textarea
                  id="project-address"
                  rows={2}
                  placeholder="خیابان، کوچه، پلاک، طبقه و زنگ..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="location-url" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  لینک موقعیت مکانی (نشان، بلد یا گوگل‌مپ):
                </label>
                <input
                  id="location-url"
                  type="url"
                  placeholder="https://nshn.ir/... یا https://maps.google.com/..."
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500 text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Technical Specifications */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#E8E4DC] dark:border-[#2D2D2D] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              مشخصات فنی پرده و شید
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="shade-panels" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  تعداد لت شید:
                </label>
                <input
                  id="shade-panels"
                  type="number"
                  min="0"
                  value={shadePanels}
                  onChange={(e) => setShadePanels(Number(e.target.value))}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white text-center font-bold font-mono"
                />
              </div>

              <div>
                <label htmlFor="curtain-panels" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  تعداد لت پرده:
                </label>
                <input
                  id="curtain-panels"
                  type="number"
                  min="0"
                  value={curtainPanels}
                  onChange={(e) => setCurtainPanels(Number(e.target.value))}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white text-center font-bold font-mono"
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label htmlFor="mechanism-type" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  نوع مکانیزم و موتور:
                </label>
                <input
                  id="mechanism-type"
                  type="text"
                  placeholder="مثلاً موتور سامفی رادیویی + ریل برقی بی‌صدا"
                  value={mechanismType}
                  onChange={(e) => setMechanismType(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="special-notes" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  توضیحات و نکات کلیدی فروش / کارفرما:
                </label>
                <textarea
                  id="special-notes"
                  rows={2}
                  placeholder="نکات حساسیت مشتری، نوع سقف کاذب، زمان‌بندی ورود..."
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Proposal Photos Attachment */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#C1A056]/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
                تصویر پروپوزال واحد فروش (برگه سفارش و نقشه)
              </h4>
              <span className="text-[11px] text-[#A88738] dark:text-[#C1A056]">تکنسین‌ها سر پروژه می‌توانند زوم کنند</span>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {proposalImages.map((img) => (
                <div
                  key={img.id}
                  className="relative w-20 h-24 rounded-xl overflow-hidden border border-[#C1A056] shadow-xs bg-white dark:bg-[#141414]"
                >
                  <CloudImage src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveProposalImage(img.id)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition"
                    title="حذف"
                    aria-label="حذف عکس پروپوزال"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] truncate px-1 py-0.5 text-center">
                    {img.title}
                  </div>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-[#C1A056] hover:border-[#212121] dark:hover:border-white bg-white dark:bg-[#141414] cursor-pointer text-[#A88738] dark:text-[#C1A056] transition">
                <Camera className="w-6 h-6 mb-1 text-[#C1A056]" aria-hidden="true" />
                <span className="text-[11px] font-bold">پیوست عکس</span>
                <span className="text-[9px] text-[#C1A056]/80">فروش / نقشه</span>
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

          {/* Section 4: Date, Time & Technicians Assignment */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#E8E4DC] dark:border-[#2D2D2D] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              زمان‌بندی و تعیین اکیپ تکنسین‌ها
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="scheduled-date" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  تاریخ اجرا (انتخاب از تقویم 30 روزه):
                </label>
                <select
                  id="scheduled-date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white font-bold"
                >
                  {days.map((d) => (
                    <option key={d.dateKey} value={d.dateKey}>
                      {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} -{' '}
                      {d.persianDayNum} {d.persianMonthName} ({d.persianDateStr})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scheduled-time" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  ساعت حضور در محل:
                </label>
                <div className="relative">
                  <input
                    id="scheduled-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white text-center font-bold font-mono"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Technicians Multi-Select */}
            <div className="pt-2">
              {!hasLeadTechnician && (
                <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>ابتدا از بخش مدیریت تکنسینها حداقل یک سرپرست اکیپ تعریف کنید</span>
                </div>
              )}
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                تکنسین‌های حاضر در این مأموریت (حداقل یک نفر باید سرپرست باشد):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {users
                  .filter((u) => u.role !== 'QC_MANAGER')
                  .map((u) => {
                    const isSelected = assignedTechnicianIds.includes(u.id);
                    const isLead = leadTechnicianId === u.id;

                    return (
                      <div
                        key={u.id}
                        onClick={() => handleTechnicianToggle(u.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none active:scale-[0.99] ${
                          isSelected
                            ? 'border-[#C1A056] bg-white dark:bg-[#252525] text-[#212121] dark:text-white ring-1 ring-[#C1A056]/30 shadow-xs'
                            : 'border-[#E8E4DC] dark:border-[#333333] bg-white/70 dark:bg-[#161616] hover:border-[#C1A056]/50 text-slate-600 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            aria-label={`انتخاب ${u.name}`}
                            className="rounded text-[#C1A056] focus:ring-[#C1A056] w-4 h-4 pointer-events-none accent-[#C1A056]"
                          />
                          <span className="text-sm font-bold">{u.name}</span>
                        </div>

                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLeadTechnicianId(u.id);
                            }}
                            className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition ${
                              isLead
                                ? 'bg-[#212121] dark:bg-[#C1A056] text-[#C1A056] dark:text-[#121212] shadow-xs'
                                : 'bg-[#EAE6DD] dark:bg-[#333333] text-slate-700 dark:text-zinc-200 hover:bg-[#C1A056]/20'
                            }`}
                          >
                            {isLead ? '⭐ سرپرست اکیپ' : 'تبدیل به سرپرست'}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Section 5: Smart Tools Checklist + Full Tools Button in Gold */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#E8E4DC] dark:border-[#2D2D2D] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
                چک‌لیست ابزار و تجهیزات مورد نیاز
              </h4>

              {/* Glowing Full Tools Button in Gold Gradient */}
              <button
                type="button"
                onClick={handleToggleFullTools}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition active:scale-95 ${
                  isFullTools
                    ? 'bg-gradient-to-r from-[#C1A056] to-[#A88738] text-white shadow-md'
                    : 'bg-[#EAE6DD] dark:bg-[#333333] hover:bg-[#C1A056]/20 text-slate-700 dark:text-zinc-200 hover:text-[#A88738]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isFullTools ? '✓ حالت فول ابزار (انتخاب همه)' : 'دکمه فول ابزار'}</span>
              </button>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {settings.defaultTools.map((tool) => {
                const checked = toolsRequired.includes(tool);
                return (
                  <label
                    key={tool}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition select-none ${
                      checked
                        ? 'border-[#C1A056] bg-white dark:bg-[#252525] text-[#212121] dark:text-white font-bold'
                        : 'border-[#E8E4DC] dark:border-[#333333] bg-white/70 dark:bg-[#161616] text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-[#202020]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToolCheckbox(tool)}
                      className="rounded text-[#C1A056] focus:ring-[#C1A056] w-4 h-4 accent-[#C1A056]"
                    />
                    <span>{tool}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label htmlFor="custom-tools-notes" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                ابزار خاص یا قطعات غیراستاندارد (اختیاری):
              </label>
              <input
                id="custom-tools-notes"
                type="text"
                placeholder="مثلاً: براکت دیواری تقویت‌شده 50 سانتی، رولپلاک پروانه‌ای کناف بلند..."
                value={customToolsNotes}
                onChange={(e) => setCustomToolsNotes(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
              />
            </div>
          </div>

          {/* Section 6: Status & QC Management */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#E8E4DC] dark:border-[#2D2D2D] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              وضعیت اجرای نصب و کنترل کیفیت (QC)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="project-status" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  وضعیت اجرای پروژه:
                </label>
                <select
                  id="project-status"
                  value={status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as Project['status'];
                    setStatus(nextStatus);
                    if (nextStatus === 'COMPLETED' && qcStatus === 'NOT_STARTED') {
                      setQcStatus('PENDING');
                    }
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white font-bold"
                >
                  <option value="MEASUREMENT_PENDING">در انتظار بازدید و اندازه‌گیری دوم</option>
                  <option value="SCHEDULED">برنامه‌ریزی شده (هنوز اعزام نشده)</option>
                  <option value="EN_ROUTE">در مسیر پروژه</option>
                  <option value="IN_PROGRESS">در حال نصب سر صحنه</option>
                  <option value="STUCK">متوقف / پرونده استاک (&lt;72h)</option>
                  <option value="COMPLETED">نصب پایان یافته</option>
                  <option value="CANCELLED">لغو شده</option>
                </select>
              </div>

              <div>
                <label htmlFor="qc-status" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  وضعیت نظارت و بررسی QC:
                </label>
                <select
                  id="qc-status"
                  value={qcStatus}
                  onChange={(e) => setQcStatus(e.target.value as Project['qcStatus'])}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white font-bold"
                >
                  <option value="NOT_STARTED">هنوز نصب نشده</option>
                  <option value="PENDING">در انتظار بررسی و تایید QC</option>
                  <option value="APPROVED">تایید رسمی QC</option>
                  <option value="REJECTED">عدم تایید / نیاز به اصلاح</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inline Validation Error Message */}
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-[#252525] active:scale-[0.99] transition text-sm min-h-[44px] cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={!hasLeadTechnician || isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-[#212121] hover:bg-[#333333] disabled:opacity-50 text-[#C1A056] font-bold transition shadow-lg text-sm flex items-center justify-center gap-2 border border-[#C1A056]/30 active:scale-[0.99] min-h-[44px] cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C1A056]" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              )}
              {isSubmitting ? 'در حال ثبت...' : isEditing ? 'ذخیره تغییرات مأموریت' : 'ثبت و ابلاغ مأموریت'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
