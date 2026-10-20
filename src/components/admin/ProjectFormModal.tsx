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
} from 'lucide-react';
import { getUpcomingDays } from '../../utils/jalali';

interface Props {
  project?: Project | null;
  users: User[];
  settings: SystemSettings;
  onClose: () => void;
  onSave: (project: Project) => void;
}

export const ProjectFormModal: React.FC<Props> = ({
  project,
  users,
  settings,
  onClose,
  onSave,
}) => {
  const isEditing = !!project;
  const days = getUpcomingDays(30);

  // Form states
  const [title, setTitle] = useState(project?.title || '');
  const [customerName, setCustomerName] = useState(project?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(project?.customerPhone || '');
  const [address, setAddress] = useState(project?.address || '');
  const [locationUrl, setLocationUrl] = useState(project?.locationUrl || '');

  const [shadePanels, setShadePanels] = useState<number>(project?.shadePanels ?? 0);
  const [curtainPanels, setCurtainPanels] = useState<number>(project?.curtainPanels ?? 0);
  const [mechanismType, setMechanismType] = useState(project?.mechanismType || '');
  const [approximateArea, setApproximateArea] = useState<string>(project?.approximateArea ? String(project.approximateArea) : '');
  const [specialNotes, setSpecialNotes] = useState(project?.specialNotes || '');

  // Scheduled date & time
  const [scheduledDate, setScheduledDate] = useState(project?.scheduledDate || days[0]?.dateKey);
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

  const handleProposalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newImg: ProposalImage = {
            id: `prop-${Date.now()}-${index}`,
            title: file.name || `برگه پروپوزال ${proposalImages.length + 1}`,
            url: event.target!.result as string,
            uploadedAt: new Date().toLocaleDateString('fa-IR'),
          };
          setProposalImages((prev) => [...prev, newImg]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveProposalImage = (id: string) => {
    setProposalImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('لطفاً عنوان یا نام پروژه را وارد کنید.');
      return;
    }

    if (assignedTechnicianIds.length === 0) {
      alert('حداقل یک تکنسین یا سرپرست باید به این مأموریت اختصاص داده شود.');
      return;
    }

    const newProject: Project = {
      id: project?.id || `p-${Date.now()}`,
      code: project?.code || `PRJ-${Math.floor(100 + Math.random() * 900)}`,
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
      leadTechnicianId: leadTechnicianId || assignedTechnicianIds[0],
      isFullTools,
      toolsRequired,
      customToolsNotes: customToolsNotes.trim(),
      status: project?.status || 'SCHEDULED',
      completionPhotos: project?.completionPhotos || [],
      qcStatus: project?.qcStatus || 'NOT_STARTED',
      createdAt: project?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newProject);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-[#E8E4DC] overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header in talaei.ir Obsidian & Gold */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl text-[#C1A056]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">
                {isEditing ? 'ویرایش مأموریت و پروژه' : 'ثبت مأموریت جدید گالری طلایی'}
              </h3>
              <p className="text-xs text-[#E8E4DC]">
                مشخصات فنی شید و پرده، تخصیص اکیپ، چک‌لیست ابزار و پیوست پروپوزال فروش
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Section 1: Customer & Address */}
          <div className="bg-[#FAF7F2] border border-[#E8E4DC] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#212121] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#C1A056]" />
              اطلاعات پروژه و نشانی کارفرما
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نام پروژه / کارفرما: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ویلای لواسان (آقای دکتر پیروز)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شماره تماس مشتری (جهت تماس تکنسین):
                </label>
                <input
                  type="tel"
                  placeholder="0912..."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  آدرس دقیق محل نصب:
                </label>
                <textarea
                  rows={2}
                  placeholder="خیابان، کوچه، پلاک، طبقه و زنگ..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  لینک موقعیت مکانی (نشان، بلد یا گوگل‌مپ):
                </label>
                <input
                  type="url"
                  placeholder="https://nshn.ir/... یا https://maps.google.com/..."
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Technical Specifications */}
          <div className="bg-[#FAF7F2] border border-[#E8E4DC] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#212121] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C1A056]" />
              مشخصات فنی پرده و شید
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تعداد لت شید:
                </label>
                <input
                  type="number"
                  min="0"
                  value={shadePanels}
                  onChange={(e) => setShadePanels(Number(e.target.value))}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white text-center font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تعداد لت پرده:
                </label>
                <input
                  type="number"
                  min="0"
                  value={curtainPanels}
                  onChange={(e) => setCurtainPanels(Number(e.target.value))}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white text-center font-bold"
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نوع مکانیزم و موتور:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً موتور سامفی رادیویی + ریل برقی بی‌صدا"
                  value={mechanismType}
                  onChange={(e) => setMechanismType(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  توضیحات و نکات کلیدی فروش / کارفرما:
                </label>
                <textarea
                  rows={2}
                  placeholder="نکات حساسیت مشتری، نوع سقف کاذب، زمان‌بندی ورود..."
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Proposal Photos Attachment */}
          <div className="bg-[#FAF7F2] border border-[#C1A056]/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#212121] flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#C1A056]" />
                تصویر پروپوزال واحد فروش (برگه سفارش و نقشه)
              </h4>
              <span className="text-[11px] text-[#A88738]">تکنسین‌ها سر پروژه می‌توانند زوم کنند</span>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {proposalImages.map((img) => (
                <div
                  key={img.id}
                  className="relative w-20 h-24 rounded-xl overflow-hidden border border-[#C1A056] shadow-xs bg-white"
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveProposalImage(img.id)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition"
                    title="حذف"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] truncate px-1 py-0.5 text-center">
                    {img.title}
                  </div>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-[#C1A056] hover:border-[#212121] bg-white cursor-pointer text-[#A88738] transition">
                <Camera className="w-6 h-6 mb-1 text-[#C1A056]" />
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
          <div className="bg-[#FAF7F2] border border-[#E8E4DC] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#212121] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C1A056]" />
              زمان‌بندی و تعیین اکیپ تکنسین‌ها
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تاریخ اجرا (انتخاب از تقویم ۳۰ روزه):
                </label>
                <select
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ساعت حضور در محل:
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white text-center font-bold"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>

            {/* Technicians Multi-Select */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
                          isSelected
                            ? 'border-[#C1A056] bg-white text-[#212121] ring-1 ring-[#C1A056]/30 shadow-xs'
                            : 'border-[#E8E4DC] bg-white/70 hover:border-[#C1A056]/50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
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
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold transition ${
                              isLead
                                ? 'bg-[#212121] text-[#C1A056] shadow-xs'
                                : 'bg-[#EAE6DD] text-slate-700 hover:bg-[#C1A056]/20'
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
          <div className="bg-[#FAF7F2] border border-[#E8E4DC] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#212121] flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#C1A056]" />
                چک‌لیست ابزار و تجهیزات مورد نیاز
              </h4>

              {/* Glowing Full Tools Button in Gold Gradient */}
              <button
                type="button"
                onClick={handleToggleFullTools}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition ${
                  isFullTools
                    ? 'bg-gradient-to-r from-[#C1A056] to-[#A88738] text-white shadow-md'
                    : 'bg-[#EAE6DD] hover:bg-[#C1A056]/20 text-slate-700 hover:text-[#A88738]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
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
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition select-none ${
                      checked
                        ? 'border-[#C1A056] bg-white text-[#212121] font-bold'
                        : 'border-[#E8E4DC] bg-white/70 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToolCheckbox(tool)}
                      className="rounded text-[#C1A056] focus:ring-[#C1A056] w-3.5 h-3.5 accent-[#C1A056]"
                    />
                    <span>{tool}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ابزار خاص یا قطعات غیراستاندارد (اختیاری):
              </label>
              <input
                type="text"
                placeholder="مثلاً: براکت دیواری تقویت‌شده ۵۰ سانتی، رولپلاک پروانه‌ای کناف بلند..."
                value={customToolsNotes}
                onChange={(e) => setCustomToolsNotes(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-white"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E4DC]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-[#E8E4DC] text-slate-700 font-medium hover:bg-slate-50 transition text-sm"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold transition shadow-lg text-sm flex items-center justify-center gap-2 border border-[#C1A056]/30"
            >
              <CheckCircle2 className="w-4 h-4 text-[#C1A056]" />
              {isEditing ? 'ذخیره تغییرات مأموریت' : 'ثبت و ابلاغ مأموریت'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
