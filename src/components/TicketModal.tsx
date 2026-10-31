import React, { useState } from 'react';
import { Project, Ticket, TicketType, User } from '../types';
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
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';
import { compressImageFile } from '../utils/imageCompressor';
import { CloudImage } from './common/CloudImage';

interface Props {
  project: Project;
  currentUser: User;
  onClose: () => void;
  onSubmit: (ticket: Ticket) => void;
}

interface TicketTypeConfig {
  type: TicketType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

const TICKET_TYPES: TicketTypeConfig[] = [
  {
    type: 'DEFICIENCY_FABRIC',
    label: 'کسری یا آسیب پارچه',
    icon: Scissors,
    desc: 'کمبود متراژ، زدگی، لکه یا مغایرت رنگ پارچه',
  },
  {
    type: 'DAMAGED_HARDWARE',
    label: 'خرابی یراق‌آلات یا موتور',
    icon: Settings2,
    desc: 'نقص گیربکس، سوختگی موتور، خرابی زنجیر یا پایه',
  },
  {
    type: 'WALL_ISSUE',
    label: 'مشکل زیرسازی و دیوار/سقف',
    icon: Hammer,
    desc: 'عدم استحکام کناف، لوله‌کشی توکار یا نیاز به شاسی‌کشی',
  },
  {
    type: 'MEASUREMENT_MISMATCH',
    label: 'مغایرت ابعاد',
    icon: Ruler,
    desc: 'عدم تطابق عرض یا ارتفاع لت با قاب پنجره',
  },
  {
    type: 'CUSTOMER_ABSENT',
    label: 'عدم حضور کارفرما',
    icon: DoorClosed,
    desc: 'کارفرما در محل حضور ندارد یا درب واحد بسته است',
  },
  {
    type: 'OTHER',
    label: 'سایر موارد فنی',
    icon: HelpCircle,
    desc: 'مشکل متفرقه فنی که مانع پیشرفت نصب پروژه است',
  },
];

export const TicketModal: React.FC<Props> = ({ project, currentUser, onClose, onSubmit }) => {
  const [selectedType, setSelectedType] = useState<TicketType>('DEFICIENCY_FABRIC');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

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

    setSubmitting(true);

    const newTicket: Ticket = {
      id: `t-${Date.now()}`,
      projectId: project.id,
      projectCode: project.code,
      projectTitle: project.title,
      authorId: currentUser.id,
      authorName: currentUser.name,
      type: selectedType,
      description: description.trim(),
      photos,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-8 border border-[#E8E4DC] dark:border-[#2D2D2D] transition-colors animate-in fade-in zoom-in-95 duration-200">
        {/* Header with Terracotta/Obsidian Theme */}
        <div className="bg-[#212121] dark:bg-[#151515] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#D5733A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D5733A]/20 border border-[#D5733A]/40 flex items-center justify-center text-[#D5733A]">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="ticket-modal-title" className="font-black text-base sm:text-lg text-white">
                ثبت تیکت کسری یا خرابی سر پروژه
              </h3>
              <p className="text-xs text-[#E8E4DC]/80 line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره تیکت"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D5733A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {ticketError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{ticketError}</span>
            </div>
          )}
          {/* Ticket Type Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#E8E4DC] mb-2.5">
              نوع ایراد یا کسری را انتخاب کنید:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TICKET_TYPES.map((t) => {
                const isSelected = selectedType === t.type;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setSelectedType(t.type)}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border text-right transition-all min-h-[52px] ${
                      isSelected
                        ? 'border-[#D5733A] bg-[#D5733A]/10 text-[#D5733A] dark:bg-[#D5733A]/20 dark:text-[#ff955c] ring-2 ring-[#D5733A]/30 shadow-sm'
                        : 'border-slate-200 dark:border-[#2D2D2D] hover:border-slate-300 dark:hover:border-[#3D3D3D] bg-slate-50 dark:bg-[#222222] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#D5733A] text-white'
                          : 'bg-slate-200/80 dark:bg-[#2E2E2E] text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs leading-snug">{t.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-2">
                        {t.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="ticket-description" className="block text-xs font-bold text-slate-700 dark:text-[#E8E4DC] mb-1.5">
              توضیح دقیق مشکل (ویژه مسئولین فنی و کنترل کیفیت):
            </label>
            <textarea
              id="ticket-description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: پارچه شید لت سوم دارای پارگی 5 سانتی‌متری است یا ریل پرده برای قاب سمت راست 15 سانتی‌متر کوتاه است..."
              className="w-full text-sm p-3.5 rounded-2xl border border-slate-300 dark:border-[#333333] bg-white dark:bg-[#222222] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D5733A] focus:border-[#D5733A] transition"
            />
          </div>

          {/* Photo attachments */}
          <div>
            <label htmlFor="ticket-photo-upload" className="block text-xs font-bold text-slate-700 dark:text-[#E8E4DC] mb-2">
              بارگذاری عکس از محل ایراد یا برچسب قطعه (اختیاری):
            </label>
            <div className="flex flex-wrap gap-2.5 items-center">
              {photos.map((p, idx) => (
                <div
                  key={idx}
                  className="relative w-18 h-18 rounded-2xl overflow-hidden border border-slate-300 dark:border-[#333333] shadow-xs group"
                >
                  <CloudImage src={p} alt={`تصویر ایراد ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    aria-label={`حذف تصویر شماره ${idx + 1}`}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-700 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Camera Button (with capture) */}
              <label
                className="flex flex-col items-center justify-center w-18 h-18 rounded-2xl border-2 border-dashed border-[#D5733A]/50 bg-[#D5733A]/10 hover:bg-[#D5733A]/20 cursor-pointer text-[#D5733A] transition min-h-[72px] min-w-[72px]"
              >
                <Camera className="w-5 h-5 mb-1" aria-hidden="true" />
                <span className="text-[10px] font-bold">دوربین</span>
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
                className="flex flex-col items-center justify-center w-18 h-18 rounded-2xl border-2 border-dashed border-slate-300 dark:border-[#3A3A3A] hover:border-[#D5733A] dark:hover:border-[#D5733A] bg-slate-50 dark:bg-[#222222] cursor-pointer text-slate-500 dark:text-slate-400 hover:text-[#D5733A] dark:hover:text-[#D5733A] transition min-h-[72px] min-w-[72px]"
              >
                <Upload className="w-5 h-5 mb-1" aria-hidden="true" />
                <span className="text-[10px] font-bold">گالری</span>
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
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-[#2D2D2D]">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 dark:border-[#333333] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-[#252525] transition text-sm active:scale-[0.98] disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#D5733A] hover:bg-[#b85e2b] text-white font-black transition shadow-lg shadow-[#D5733A]/25 text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
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
