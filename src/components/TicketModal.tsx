import React, { useState } from 'react';
import { Project, Ticket, TicketType, User } from '../types';
import { AlertTriangle, Upload, X, CheckCircle2 } from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface Props {
  project: Project;
  currentUser: User;
  onClose: () => void;
  onSubmit: (ticket: Ticket) => void;
}

const TICKET_TYPES: { type: TicketType; label: string; icon: string; desc: string }[] = [
  { type: 'DEFICIENCY_FABRIC', label: 'کسری یا آسیب پارچه', icon: '✂️', desc: 'کمبود متراژ، زدگی، لکه یا مغایرت رنگ پارچه' },
  { type: 'DAMAGED_HARDWARE', label: 'خرابی یراق‌آلات یا موتور', icon: '⚙️', desc: 'نقص گیربکس، سوختگی موتور، خرابی زنجیر یا پایه' },
  { type: 'WALL_ISSUE', label: 'مشکل زیرسازی و دیوار/سقف', icon: '🧱', desc: 'عدم استحکام کناف، لوله‌کشی توکار یا نیاز به شاسی‌کشی' },
  { type: 'MEASUREMENT_MISMATCH', label: 'مغایرت ابعاد', icon: '📏', desc: 'عدم تطابق عرض یا ارتفاع لت با قاب پنجره' },
  { type: 'CUSTOMER_ABSENT', label: 'عدم حضور مشتری / بسته بودن درب', icon: '🚪', desc: 'کارفرما در محل حضور ندارد' },
  { type: 'OTHER', label: 'سایر موارد فنی', icon: '⚠️', desc: 'مشکل متفرقه که مانع پیشرفت کار است' },
];

export const TicketModal: React.FC<Props> = ({ project, currentUser, onClose, onSubmit }) => {
  const [selectedType, setSelectedType] = useState<TicketType>('DEFICIENCY_FABRIC');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('لطفاً شرح مشکل را بنویسید.');
      return;
    }

    setSubmitting(true);

    const now = new Date();
    const timeStr = `${toPersianDigits(now.getHours())}:${toPersianDigits(String(now.getMinutes()).padStart(2, '0'))}`;

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
      createdAt: `${project.scheduledDate} - ساعت ${timeStr}`,
    };

    onSubmit(newTicket);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-8 border border-[#E8E4DC] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#D5733A]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl text-[#D5733A]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">ثبت تیکت کسری / خرابی سر پروژه</h3>
              <p className="text-xs text-[#E8E4DC]">{project.title}</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Ticket Type Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              نوع ایراد یا کسری را انتخاب کنید:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TICKET_TYPES.map((t) => {
                const isSelected = selectedType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setSelectedType(t.type)}
                    className={`flex items-start gap-2 p-2.5 rounded-xl border text-right transition ${
                      isSelected
                        ? 'border-red-500 bg-red-50/70 text-red-950 ring-2 ring-red-400/30'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{t.label}</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1">
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
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              توضیح دقیق مشکل (ویژه مدیر کیوسی):
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: پارچه شید لت سوم دارای پارگی ۵ سانتی‌متری است یا ریل پرده برای قاب سمت راست ۱۵ سانتی‌متر کوتاه است..."
              className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-slate-400"
            />
          </div>

          {/* Photo attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              بارگذاری عکس از محل ایراد یا برچسب قطعه (اختیاری):
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {photos.map((p, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-300">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 shadow hover:bg-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-red-400 bg-slate-50 cursor-pointer text-slate-500 hover:text-red-500 transition">
                <Upload className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-bold">افزودن</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition text-sm"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-lg shadow-red-600/20 text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              ارسال فوری تیکت به کیوسی
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
