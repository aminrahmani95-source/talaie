import React, { useState } from 'react';
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
  Search,
} from 'lucide-react';
import { getUpcomingDays, getTodayPersianString } from '../../utils/jalali';
import { compressImageFile } from '../../utils/imageCompressor';
import { SupabaseSyncService } from '../../utils/supabase';
import { CloudImage } from '../common/CloudImage';
import { computeProjectDiff } from '../../utils/offlineQueue';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

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

  const [shadePanels, setShadePanels] = useState<number>(project?.shadePanels ?? 0);
  const [curtainPanels, setCurtainPanels] = useState<number>(project?.curtainPanels ?? 0);
  const [mechanismType, setMechanismType] = useState(project?.mechanismType || '');
  const [approximateArea, setApproximateArea] = useState<string>(
    project?.approximateArea ? String(project.approximateArea) : ''
  );
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
  const [techSearchQuery, setTechSearchQuery] = useState('');

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

  const nonQcUsers = users.filter((u) => u.role !== 'QC_MANAGER');
  const filteredUsers = nonQcUsers.filter((u) => {
    if (!techSearchQuery.trim()) return true;
    return u.name.includes(techSearchQuery.trim());
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-2xl w-full shadow-2xl border border-[#E2DDD4] dark:border-[#2C2C2C] flex flex-col max-h-[92vh] overflow-hidden my-4">
        {/* Modal Header */}
        <div className="bg-[#212121] px-5 py-3.5 text-white flex items-center justify-between border-b border-[#C1A056]/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#C1A056]">
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
          <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#E2DDD4] dark:border-[#2C2C2C] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
              <span>اطلاعات پروژه و محل نصب</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="project-title" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  عنوان پروژه: *
                </label>
                <input
                  id="project-title"
                  type="text"
                  required
                  placeholder="مثال: ویلای لواسان - سالن اصلی"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="customer-name" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  نام کارفرما:
                </label>
                <input
                  id="customer-name"
                  type="text"
                  placeholder="مثال: آقای پیروز"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="customer-phone" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  شماره تماس مشتری:
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  placeholder="09......"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="project-address" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  نشانی دقیق محل نصب:
                </label>
                <textarea
                  id="project-address"
                  rows={2}
                  placeholder="خیابان، کوچه، پلاک، طبقه و واحد..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="location-url" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  لینک لوکیشن (نشان، بلد یا گوگل‌مپ):
                </label>
                <input
                  id="location-url"
                  type="url"
                  placeholder="https://nshn.ir/... یا https://maps.google.com/..."
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Technical Specifications */}
          <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#E2DDD4] dark:border-[#2C2C2C] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
              <span>مشخصات فنی پرده و شید</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="shade-panels" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  تعداد لت شید:
                </label>
                <input
                  id="shade-panels"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={shadePanels}
                  onChange={(e) => setShadePanels(Number(e.target.value))}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white text-center font-mono font-bold"
                />
              </div>

              <div>
                <label htmlFor="curtain-panels" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  تعداد لت پرده:
                </label>
                <input
                  id="curtain-panels"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={curtainPanels}
                  onChange={(e) => setCurtainPanels(Number(e.target.value))}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white text-center font-mono font-bold"
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label htmlFor="mechanism-type" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  نوع مکانیزم و موتور:
                </label>
                <input
                  id="mechanism-type"
                  type="text"
                  placeholder="موتور سامفی رادیویی + ریل برقی"
                  value={mechanismType}
                  onChange={(e) => setMechanismType(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="special-notes" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  توضیحات و نکات کلیدی:
                </label>
                <textarea
                  id="special-notes"
                  rows={2}
                  placeholder="نکات حساسیت مشتری، نوع سقف کاذب، زیرسازی..."
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Proposal Images */}
          <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#C1A056]/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
                <span>تصویر پروپوزال فروش (نقشه و برگه سفارش)</span>
              </h4>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {proposalImages.map((img) => (
                <div
                  key={img.id}
                  className="relative w-16 h-20 rounded-xl overflow-hidden border border-[#C1A056] shadow-2xs bg-white dark:bg-[#141414]"
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

              <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-[#C1A056] hover:border-[#212121] bg-white dark:bg-[#141414] cursor-pointer text-[#8E6F27] dark:text-[#E5CA8F] transition">
                <Camera className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">پیوست عکس</span>
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
          <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#E2DDD4] dark:border-[#2C2C2C] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
              <span>زمان‌بندی و تعیین اکیپ</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="scheduled-date" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  تاریخ اجرا:
                </label>
                <select
                  id="scheduled-date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white font-bold"
                >
                  {days.map((d) => (
                    <option key={d.dateKey} value={d.dateKey}>
                      {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} -{' '}
                      {d.persianDayNum} {d.persianMonthName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scheduled-time" className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
                  ساعت حضور در محل:
                </label>
                <input
                  id="scheduled-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white text-center font-bold font-mono"
                />
              </div>
            </div>

            {/* Technicians Multi-Select with Searchable Chip List */}
            <div className="pt-1">
              {!hasLeadTechnician && (
                <div className="mb-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>حداقل یک سرپرست اکیپ در پرسنل تعریف کنید</span>
                </div>
              )}

              <label className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1.5">
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
                    className="w-full text-xs pr-8 pl-2.5 py-1.5 rounded-lg border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
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
                      className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition select-none ${
                        isSelected
                          ? 'border-[#C1A056] bg-white dark:bg-[#222222] ring-1 ring-[#C1A056]/30'
                          : 'border-[#E2DDD4] dark:border-[#2C2C2C] bg-white/70 dark:bg-[#161616]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={u.name} id={u.id} size="sm" />
                        <span className="text-xs font-bold truncate">{u.name}</span>
                      </div>

                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLeadTechnicianId(u.id);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition cursor-pointer ${
                            isLead
                              ? 'bg-[#212121] text-[#E5CA8F]'
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
          <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#E2DDD4] dark:border-[#2C2C2C] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
                <span>چک‌لیست ابزار و تجهیزات</span>
              </h4>

              <button
                type="button"
                onClick={handleToggleFullTools}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                  isFullTools
                    ? 'bg-[#212121] text-[#E5CA8F]'
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
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition select-none ${
                      checked
                        ? 'border-[#C1A056] bg-white dark:bg-[#222222] font-bold'
                        : 'border-[#E2DDD4] dark:border-[#2C2C2C] bg-white/70 dark:bg-[#161616]'
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
          </div>

          {/* Inline Error */}
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </form>

        {/* Sticky Modal Footer */}
        <div className="p-4 border-t border-[#E2DDD4] dark:border-[#2C2C2C] bg-[#FAF7F2] dark:bg-[#181818] flex items-center gap-3 shrink-0">
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
