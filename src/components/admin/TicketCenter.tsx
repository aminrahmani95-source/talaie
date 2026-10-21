import React, { useState } from 'react';
import { Ticket } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
}

export const TicketCenter: React.FC<Props> = ({ tickets, onUpdateTicket }) => {
  const [filter, setFilter] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'OPEN') return t.status === 'OPEN';
    if (filter === 'RESOLVED') return t.status === 'RESOLVED';
    return true;
  });

  const handleResolve = (ticket: Ticket) => {
    if (!resolutionNote.trim()) {
      alert('لطفاً اقدام انجام شده جهت حل مشکل را بنویسید.');
      return;
    }

    const updated: Ticket = {
      ...ticket,
      status: 'RESOLVED',
      resolutionNote: resolutionNote.trim(),
      resolvedAt: new Date().toLocaleDateString('fa-IR'),
    };

    onUpdateTicket(updated);
    setResolvingId(null);
    setResolutionNote('');
  };

  const getTicketTypeLabel = (type: string) => {
    switch (type) {
      case 'DEFICIENCY_FABRIC':
        return 'کسری یا آسیب پارچه';
      case 'DAMAGED_HARDWARE':
        return 'خرابی یراق‌آلات یا موتور';
      case 'WALL_ISSUE':
        return 'مشکل زیرسازی و دیوار/سقف';
      case 'MEASUREMENT_MISMATCH':
        return 'مغایرت ابعاد و متراژ';
      case 'CUSTOMER_ABSENT':
        return 'عدم حضور کارفرما';
      default:
        return 'سایر موارد فنی';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Banner in talaei.ir Dark Style */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-rose-500/30">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-[#D5733A]" aria-hidden="true" />
              <h2 className="text-xl font-black text-white">کارتابل تیکت‌های فوری و کسری‌های سر پروژه</h2>
            </div>
            <p className="text-xs text-[#E8E4DC] mt-1">
              پیام‌های اضطراری تکنسین‌ها از محل نصب (کسری یراق، پارچه معیوب، ایراد زیرسازی) برای اقدام فوری واحد QC گالری طلایی
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-full border border-white/10">
            <button
              type="button"
              onClick={() => setFilter('OPEN')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition min-h-[38px] active:scale-95 ${
                filter === 'OPEN' ? 'bg-[#D5733A] text-white shadow-xs' : 'text-white hover:text-[#C1A056]'
              }`}
            >
              تیکت‌های باز ({toPersianDigits(tickets.filter((t) => t.status === 'OPEN').length)})
            </button>
            <button
              type="button"
              onClick={() => setFilter('RESOLVED')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition min-h-[38px] active:scale-95 ${
                filter === 'RESOLVED' ? 'bg-[#C1A056] text-[#212121] shadow-xs' : 'text-white hover:text-[#C1A056]'
              }`}
            >
              حل شده‌ها
            </button>
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition min-h-[38px] active:scale-95 ${
                filter === 'ALL' ? 'bg-[#C1A056] text-[#212121] shadow-xs' : 'text-white hover:text-[#C1A056]'
              }`}
            >
              همه تیکت‌ها
            </button>
          </div>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-12 text-center border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs max-w-lg mx-auto">
          <CheckCircle2 className="w-16 h-16 text-[#C1A056] mx-auto mb-3" aria-hidden="true" />
          <h3 className="font-bold text-[#212121] dark:text-white text-base">هیچ تیکت بازی وجود ندارد!</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            همه موارد سر پروژه‌ها پیگیری شده یا هیچ موردی توسط تکنسین‌ها گزارش نشده است.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className={`bg-white dark:bg-[#1C1C1C] rounded-3xl p-5 border shadow-xs space-y-4 ${
                t.status === 'OPEN'
                  ? 'border-rose-300 dark:border-rose-800/80 ring-2 ring-rose-500/10'
                  : 'border-[#E8E4DC] dark:border-[#2D2D2D] opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FAF7F2] dark:bg-[#252525] text-[#212121] dark:text-zinc-200 border border-[#E8E4DC] dark:border-[#333333]">
                  {getTicketTypeLabel(t.type)}
                </span>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                    t.status === 'OPEN'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
                      : 'bg-[#194840]/15 text-[#194840] dark:bg-[#194840]/30 dark:text-emerald-400'
                  }`}
                >
                  {t.status === 'OPEN' ? 'نیازمند اقدام فوری' : 'حل شده'}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#212121] dark:text-white leading-tight">
                  {t.projectTitle} ({t.projectCode})
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-[#71717A] dark:text-zinc-400 mt-1">
                  <span>فرستنده: {t.authorName}</span>
                  <span>•</span>
                  <span>{t.createdAt}</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-zinc-200 bg-[#FAF7F2] dark:bg-[#202020] p-3 rounded-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] leading-relaxed">
                {t.description}
              </p>

              {/* Photos */}
              {t.photos && t.photos.length > 0 && (
                <div className="flex items-center gap-2">
                  {t.photos.map((p, i) => (
                    <a
                      key={i}
                      href={p}
                      target="_blank"
                      rel="noreferrer"
                      className="w-16 h-16 rounded-xl overflow-hidden border border-[#E8E4DC] dark:border-[#333333] block"
                      aria-label="مشاهده تصویر ضمیمه"
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {/* Resolution Info if Resolved */}
              {t.status === 'RESOLVED' && (
                <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-3 border border-[#C1A056]/40 text-xs text-[#212121] dark:text-zinc-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[#A88738] dark:text-[#C1A056]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                    اقدام انجام شده توسط QC:
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-zinc-300">{t.resolutionNote}</p>
                </div>
              )}

              {/* Action Form if Open */}
              {t.status === 'OPEN' && (
                <div className="pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
                  {resolvingId === t.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="اقدام انجام شده (مثلاً: قطعه یدک با پیک فرستاده شد یا با کارفرما هماهنگ گردید)..."
                        className="w-full text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolve(t)}
                          className="flex-1 py-2.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-[#C1A056]/30 active:scale-95 min-h-[44px]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          ثبت حل مشکل
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolvingId(null)}
                          className="px-4 py-2.5 border border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-300 rounded-xl text-xs hover:bg-[#FAF7F2] dark:hover:bg-[#252525] transition active:scale-95 min-h-[44px]"
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setResolvingId(t.id)}
                      className="w-full py-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold rounded-xl text-xs border border-rose-200 dark:border-rose-900/60 transition flex items-center justify-center gap-2 active:scale-98 min-h-[44px]"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      پاسخ و حل این مشکل
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
