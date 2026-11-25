import React, { useState } from 'react';
import { triggerToast } from './Toast';
import { Project, Ticket, TicketType, IssueCategory, User } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Scissors,
  Settings2,
  Hammer,
  Ruler,
  DoorClosed,
  HelpCircle,
  Trash2,
  AlertOctagon,
} from 'lucide-react';

import { compressImageFile } from '../utils/imageCompressor';
import { CloudImage } from './common/CloudImage';
import { getDisplayName } from '../utils/technicianName';
import { getSlaDeadline, ISSUE_CATEGORY_LABELS } from '../utils/sla';
import { Sheet } from './ui/Sheet';
import { PhotoSourceButtons } from './ui/PhotoSourceButtons';

interface Props {
  project: Project;
  currentUser: User;
  onClose: () => void;
  onSubmit: (ticket: Ticket) => Promise<void> | void;
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
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  const requestClose = () => {
    if (submitting) return;
    const dirty = description.trim() || blockingReason.trim() || photos.length > 0;
    if (dirty && !window.confirm('گزارش ارسال نشده است. بدون ارسال بسته شود؟')) return;
    onClose();
  };

  const handleSelectType = (type: TicketType, defaultCat: IssueCategory) => {
    setSelectedType(type);
    setSelectedCategory(defaultCat);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsProcessingPhotos(true);

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.75);
        setPhotos((prev) => [...prev, compressed]);
      } catch (err) {
        console.warn('Ticket image compression failed:', err);
        triggerToast('error', err instanceof Error && err.message ? err.message : 'این عکس آماده نشد؛ دوباره امتحان کنید.');
      }
    }
    setIsProcessingPhotos(false);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setTicketError(null);

    if (!description.trim()) {
      setTicketError('در یک جمله بنویسید چه مشکلی پیش آمده.');
      document.getElementById('ticket-description')?.focus();
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
      await onSubmit(newTicket);
    } catch (err: any) {
      setTicketError(err.message || 'خطا در ثبت تیکت.');
      setSubmitting(false);
    }
  };

  const selectedConfig = TICKET_TYPES.find((t) => t.type === selectedType);

  return (
    <Sheet
      isOpen
      onClose={requestClose}
      title="گزارش ایراد فنی"
      subtitle={`${project.code} • ${project.title}`}
      size="md"
      footer={
        <div className="space-y-2">
          {ticketError && (
            <div role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{ticketError}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={requestClose}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-md border border-line bg-raised text-ink-2 hover:text-ink font-semibold transition text-sm cursor-pointer disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              form="ticket-form"
              disabled={submitting || isProcessingPhotos}
              className="flex-[2] min-h-[44px] py-2.5 px-4 rounded-md bg-brand hover:bg-brand-hover text-on-brand font-bold transition text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'در حال ارسال...' : 'ارسال به QC'}
            </button>
          </div>
        </div>
      }
    >
      <form id="ticket-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-[12px] text-ink-2 leading-6 bg-sunken border border-line rounded-md p-2.5">
          برای ایراد قطعه، پارچه، ابعاد یا محل نصب. اگر فقط قطعه یا متریال کم دارید، «درخواست متریال» سریع‌تر به انبار می‌رسد.
        </p>

        {/* Ticket Type Picker */}
        <div>
          <span className="block text-xs font-bold text-ink mb-2">۱. نوع ایراد</span>
          <div className="grid grid-cols-2 gap-1.5">
            {TICKET_TYPES.map((t) => {
              const isSelected = selectedType === t.type;
              const IconComponent = t.icon;
              return (
                <button
                  key={t.type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectType(t.type, t.category)}
                  className={`flex items-center gap-2 p-2.5 rounded-md border text-right transition cursor-pointer min-h-[52px] ${
                    isSelected
                      ? 'border-brand bg-raised text-ink ring-1 ring-brand/40 font-bold'
                      : 'border-line bg-sunken text-ink-2 hover:bg-raised hover:text-ink'
                  }`}
                >
                  <span
                    className={`p-1.5 rounded shrink-0 ${
                      isSelected ? 'bg-brand text-on-brand' : 'bg-raised text-ink-2'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span className="text-xs leading-snug">{t.label}</span>
                </button>
              );
            })}
          </div>
          {selectedConfig && (
            <p className="text-[12px] text-ink-3 mt-1.5 pr-1">{selectedConfig.desc}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="ticket-description" className="block text-xs font-bold text-ink mb-1.5">
            ۲. چه شده؟ <span className="text-rose-400">*</span>
          </label>
          <textarea
            id="ticket-description"
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setTicketError(null);
            }}
            placeholder="مثلاً: پارچه شید لت سوم ۵ سانت پارگی دارد / ریل پنجره سمت راست ۱۵ سانت کوتاه است."
            className="w-full text-sm p-3 rounded-md border border-line bg-canvas text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand transition"
          />
        </div>

        {/* Photo attachments */}
        <div>
          <span className="block text-xs font-bold text-ink mb-2">۳. عکس (توصیه می‌شود)</span>
          <div className="flex flex-wrap gap-2 items-center">
            <PhotoSourceButtons onChange={handlePhotoUpload} busy={isProcessingPhotos} />
            {photos.map((p, idx) => (
              <div
                key={idx}
                className="relative w-14 h-14 rounded-md overflow-hidden border border-line shadow-xs"
              >
                <CloudImage src={p} alt={`تصویر ایراد ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(idx)}
                  aria-label={`حذف تصویر شماره ${idx + 1}`}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-700 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Blocking Toggle */}
        <div
          className={`p-3 rounded-md border space-y-2.5 transition ${
            isBlocking ? 'border-rose-500/50 bg-rose-500/10' : 'border-line bg-sunken'
          }`}
        >
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isBlocking}
              onChange={(e) => setIsBlocking(e.target.checked)}
              className="mt-0.5 rounded w-4 h-4 accent-rose-500"
            />
            <span>
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isBlocking ? 'text-rose-600 dark:text-rose-300' : 'text-ink'}`}>
                <AlertOctagon className="w-3.5 h-3.5" />
                این ایراد جلوی ادامه‌ی کار را گرفته است
              </span>
              <span className="text-[12px] text-ink-3 block mt-0.5">
                با اولویت بالا پیگیری می‌شود. اگر کل کار را باید رها کنید، از «اعلام توقف» استفاده کنید.
              </span>
            </span>
          </label>

          {isBlocking && (
            <input
              type="text"
              aria-label="چه چیزی مانع ادامه‌ی کار است"
              value={blockingReason}
              onChange={(e) => setBlockingReason(e.target.value)}
              placeholder="چه چیزی مانع ادامه است؟ مثلاً: برق قطع است / بازوی موتور شکست"
              className="w-full text-sm p-2.5 rounded-md border border-rose-500/40 bg-canvas text-ink"
            />
          )}
        </div>

        {/* Issue Category: برای QC؛ از روی نوع ایراد خودکار پر می‌شود */}
        <details className="group rounded-md border border-line bg-sunken">
          <summary className="list-none cursor-pointer p-2.5 flex items-center justify-between text-xs text-ink-2 select-none">
            <span>دسته‌بندی کیفی: {ISSUE_CATEGORY_LABELS[selectedCategory]}</span>
            <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
          </summary>
          <div className="px-2.5 pb-2.5">
            <select
              aria-label="دسته‌بندی کیفی ایراد"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as IssueCategory)}
              className="w-full text-sm p-2.5 rounded-md border border-line bg-canvas text-ink focus:border-brand"
            >
              {Object.entries(ISSUE_CATEGORY_LABELS).map(([catKey, catLabel]) => (
                <option key={catKey} value={catKey}>
                  {catLabel}
                </option>
              ))}
            </select>
          </div>
        </details>
      </form>
    </Sheet>
  );
};
