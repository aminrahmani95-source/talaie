import React, { useState } from 'react';
import { Project, Ticket, TicketType, IssueCategory, User } from '../types';
import {
  AlertTriangle,
  Camera,
  Upload,
  X,
  CheckCircle2,
  Scissors,
  Settings2,
  Hammer,
  Ruler,
  DoorClosed,
  HelpCircle,
  Trash2,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';
import { compressImageFile } from '../utils/imageCompressor';
import { CloudImage } from './common/CloudImage';
import { getDisplayName } from '../utils/technicianName';
import { getSlaDeadline, ISSUE_CATEGORY_LABELS } from '../utils/sla';

interface Props {
  project: Project;
  currentUser: User;
  onClose: () => void;
  onSubmit: (ticket: Ticket) => void;
}

interface TicketTypeConfig {
  type: TicketType;
  category: IssueCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

const TICKET_TYPES: TicketTypeConfig[] = [
  {
    type: 'DEFICIENCY_FABRIC',
    category: 'PRODUCTION_DEFECT',
    label: 'کسری یا آسیب پارچه',
    icon: Scissors,
    desc: 'کمبود متراژ، زدگی، لکه یا مغایرت رنگ پارچه',
  },
  {
    type: 'DAMAGED_HARDWARE',
    category: 'EQUIPMENT_DEFECT',
    label: 'خرابی یراق‌آلات یا موتور',
    icon: Settings2,
    desc: 'نقص گیربکس، سوختگی موتور، خرابی زنجیر یا پایه',
  },
  {
    type: 'WALL_ISSUE',
    category: 'SITE_NOT_READY',
    label: 'مشکل زیرسازی و دیوار/سقف',
    icon: Hammer,
    desc: 'عدم استحکام کناف، لوله‌کشی توکار یا نیاز به شاسی‌کشی',
  },
  {
    type: 'MEASUREMENT_MISMATCH',
    category: 'MEASUREMENT_ERROR',
    label: 'مغایرت ابعاد',
    icon: Ruler,
    desc: 'عدم تطابق عرض یا ارتفاع لت با قاب پنجره',
  },
  {
    type: 'CUSTOMER_ABSENT',
    category: 'SITE_NOT_READY',
    label: 'عدم حضور کارفرما',
    icon: DoorClosed,
    desc: 'کارفرما در محل حضور ندارد یا درب واحد بسته است',
  },
  {
    type: 'OTHER',
    category: 'OTHER',
    label: 'سایر موارد فنی',
    icon: HelpCircle,
    desc: 'مشکل متفرقه فنی که مانع پیشرفت نصب پروژه است',
  },
];

export const TicketModal: React.FC<Props> = ({ project, currentUser, onClose, onSubmit }) => {
  const [selectedType, setSelectedType] = useState<TicketType>('DEFICIENCY_FABRIC');
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>('PRODUCTION_DEFECT');
  const [isBlocking, setIsBlocking] = useState<boolean>(false);
  const [blockingReason, setBlockingReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const handleSelectType = (type: TicketType, defaultCat: IssueCategory) => {
    setSelectedType(type);
    setSelectedCategory(defaultCat);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.75);
        setPhotos((prev) => [...prev, compressed]);
      } catch (err) {
        console.warn('Ticket image compression failed:', err);
      }
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setTicketError(null);

    if (!description.trim()) {
      setTicketError('لطفاً شرح مشکل را بنویسید.');
      return;
    }

    if (isBlocking && !blockingReason.trim()) {
      setTicketError('در صورت مسدودکننده بودن مشکل، لطفاً دلیل توقف عملیات را شرح دهید.');
      return;
    }

    setSubmitting(true);
    const createdAt = new Date().toISOString();

    const newTicket: Ticket = {
      id: `t-${Date.now()}`,
      projectId: project.id,
      projectCode: project.code,
      projectTitle: project.title,
      authorId: currentUser.id,
      authorName: getDisplayName(currentUser.name),
      type: selectedType,
      category: selectedCategory,
      isBlocking,
      blockingReason: isBlocking ? blockingReason.trim() : undefined,
      assignedTeamId: project.assignedTeamId,
      assignedTeamName: project.assignedTeamName,
      resolutionDeadline: getSlaDeadline(createdAt),
      description: description.trim(),
      photos,
      status: 'OPEN',
      createdAt,
      actionHistory: [
        {
          id: `act-${Date.now()}`,
          timestamp: createdAt,
          action: 'CREATED',
          byUserId: currentUser.id,
          byUserName: getDisplayName(currentUser.name),
          note: isBlocking ? `ثبت تیکت مسدودکننده: ${blockingReason.trim()}` : 'ثبت تیکت فنی سر پروژه',
        },
      ],
    };

    try {
      onSubmit(newTicket);
    } catch (err: any) {
      setTicketError(err.message || 'خطا در ثبت تیکت.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-[#151B23] rounded-lg max-w-lg w-full overflow-hidden shadow-2xl my-8 border border-[#212835] transition-colors animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0D1117] px-6 py-4 text-[#F0F4F8] flex items-center justify-between border-b border-[#212835]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#1C232D] border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 id="ticket-modal-title" className="font-bold text-base sm:text-lg text-[#F0F4F8]">
                ثبت تیکت کسری یا خرابی سر پروژه
              </h3>
              <p className="text-xs text-[#9BA7B6] line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره تیکت"
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {ticketError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{ticketError}</span>
            </div>
          )}
          {/* Ticket Type Picker */}
          <div>
            <label className="block text-xs font-semibold text-[#F0F4F8] mb-2">
              نوع ایراد یا کسری را انتخاب کنید:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TICKET_TYPES.map((t) => {
                const isSelected = selectedType === t.type;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => handleSelectType(t.type, t.category)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-md border text-right transition cursor-pointer min-h-[48px] ${
                      isSelected
                        ? 'border-[#C5A059] bg-[#1C232D] text-[#E5CA8F] ring-1 ring-[#C5A059]/40 font-bold'
                        : 'border-[#212835] bg-[#111620] text-[#9BA7B6] hover:bg-[#1C232D] hover:text-[#F0F4F8]'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#C5A059] text-[#0D1117]'
                          : 'bg-[#1C232D] text-[#9BA7B6]'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs leading-snug">{t.label}</div>
                      <div className="text-[11px] opacity-75 leading-tight mt-0.5 line-clamp-2">
                        {t.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Issue Category (8 Official Categories) */}
          <div>
            <label className="block text-xs font-semibold text-[#F0F4F8] mb-1.5">
              دسته‌بندی استاندارد ایراد (جهت پایش کیفیت و ریشه‌یابی):
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as IssueCategory)}
              className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059]"
            >
              {Object.entries(ISSUE_CATEGORY_LABELS).map(([catKey, catLabel]) => (
                <option key={catKey} value={catKey}>
                  {catLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Blocking Toggle */}
          <div className="p-3.5 rounded-md border border-rose-500/30 bg-rose-500/10 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isBlocking}
                onChange={(e) => setIsBlocking(e.target.checked)}
                className="mt-0.5 rounded border-rose-500/40 text-rose-500 focus:ring-rose-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  این مشکل مانع پیشرفت و ادامه عملیات نصب است (مسدودکننده / Blocking)
                </span>
                <span className="text-[11px] text-rose-400/80 block mt-0.5">
                  تیکت‌های مسدودکننده در دسک کنترل توقف با اولویت بحرانی پیگیری می‌شوند.
                </span>
              </div>
            </label>

            {isBlocking && (
              <div className="pt-2 border-t border-rose-500/30">
                <label className="block text-xs font-semibold text-rose-300 mb-1">
                  علت توقف کار و مانع موجود:
                </label>
                <input
                  type="text"
                  value={blockingReason}
                  onChange={(e) => setBlockingReason(e.target.value)}
                  placeholder="مثال: عدم امکان ادامه به دلیل نبود برق / شکستگی بازو حین نصب"
                  className="w-full text-xs p-2 rounded-md border border-rose-500/40 bg-[#0D1117] text-[#F0F4F8] focus:ring-1 focus:ring-rose-500"
                  required={isBlocking}
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="ticket-description" className="block text-xs font-semibold text-[#F0F4F8] mb-1.5">
              توضیح دقیق مشکل (ویژه مسئولین فنی و کنترل کیفیت):
            </label>
            <textarea
              id="ticket-description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: پارچه شید لت سوم دارای پارگی 5 سانتی‌متری است یا ریل پرده برای قاب سمت راست 15 سانتی‌متر کوتاه است..."
              className="w-full text-xs p-3 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] placeholder:text-[#637184] focus:outline-none focus:border-[#C5A059] transition"
            />
          </div>

          {/* Photo attachments */}
          <div>
            <label className="block text-xs font-semibold text-[#F0F4F8] mb-2">
              بارگذاری عکس از محل ایراد یا برچسب قطعه (اختیاری):
            </label>
            <div className="flex flex-wrap gap-2.5 items-center">
              {photos.map((p, idx) => (
                <div
                  key={idx}
                  className="relative w-16 h-16 rounded-md overflow-hidden border border-[#212835] shadow-xs group"
                >
                  <CloudImage src={p} alt={`تصویر ایراد ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    aria-label={`حذف تصویر شماره ${idx + 1}`}
                    className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-700 transition text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Camera Button (with capture) */}
              <label
                className="flex flex-col items-center justify-center w-16 h-16 rounded-md border border-dashed border-[#C5A059]/60 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 cursor-pointer text-[#C5A059] transition min-h-[64px] min-w-[64px]"
              >
                <Camera className="w-4 h-4 mb-0.5" aria-hidden="true" />
                <span className="text-[10px] font-semibold">دوربین</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              {/* Gallery Button (without capture) */}
              <label
                className="flex flex-col items-center justify-center w-16 h-16 rounded-md border border-dashed border-[#2D3748] hover:border-[#C5A059] bg-[#111620] hover:bg-[#1C232D] cursor-pointer text-[#9BA7B6] hover:text-[#F0F4F8] transition min-h-[64px] min-w-[64px]"
              >
                <Upload className="w-4 h-4 mb-0.5" aria-hidden="true" />
                <span className="text-[10px] font-semibold">گالری</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Action buttons with minimum 44px touch targets */}
          <div className="flex items-center gap-3 pt-4 border-t border-[#212835]">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-md border border-[#212835] bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] font-semibold transition text-xs cursor-pointer disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-md bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] font-bold transition text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'در حال ارسال تیکت...' : 'ارسال فوری تیکت به QC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
