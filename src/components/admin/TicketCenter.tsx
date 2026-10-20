import React, { useState } from 'react';
import { Ticket, TicketStatus } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Camera,
  X,
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
        return '✂️ کسری یا آسیب پارچه';
      case 'DAMAGED_HARDWARE':
        return '⚙️ خرابی یراق‌آلات یا موتور';
      case 'WALL_ISSUE':
        return '🧱 مشکل زیرسازی و دیوار/سقف';
      case 'MEASUREMENT_MISMATCH':
        return '📏 مغایرت ابعاد';
      case 'CUSTOMER_ABSENT':
        return '🚪 عدم حضور مشتری';
      default:
        return '⚠️ سایر موارد فنی';
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <h2 className="text-xl font-black">کارتابل تیکت‌های فوری و کسری‌های سر پروژه</h2>
            </div>
            <p className="text-xs text-rose-200 mt-1">
              پیام‌های اضطراری تکنسین‌ها از محل نصب (کسری یراق، پارچه معیوب، ایراد زیرسازی) برای اقدام فوری واحد کیوسی
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-1 rounded-2xl">
            <button
              onClick={() => setFilter('OPEN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === 'OPEN' ? 'bg-rose-600 text-white' : 'text-rose-200 hover:bg-white/10'
              }`}
            >
              تیکت‌های باز ({toPersianDigits(tickets.filter((t) => t.status === 'OPEN').length)})
            </button>
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === 'RESOLVED' ? 'bg-rose-600 text-white' : 'text-rose-200 hover:bg-white/10'
              }`}
            >
              حل شده‌ها
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === 'ALL' ? 'bg-rose-600 text-white' : 'text-rose-200 hover:bg-white/10'
              }`}
            >
              همه تیکت‌ها
            </button>
          </div>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">هیچ تیکت بازی وجود ندارد!</h3>
          <p className="text-xs text-slate-500 mt-1">
            همه موارد سر پروژه‌ها پیگیری شده یا هیچ موردی توسط تکنسین‌ها گزارش نشده است.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className={`bg-white rounded-3xl p-5 border shadow-sm space-y-4 ${
                t.status === 'OPEN'
                  ? 'border-rose-300 ring-2 ring-rose-500/10'
                  : 'border-slate-200 opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">
                  {getTicketTypeLabel(t.type)}
                </span>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                    t.status === 'OPEN'
                      ? 'bg-rose-100 text-rose-800 animate-pulse'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {t.status === 'OPEN' ? 'نیازمند اقدام فوری' : 'حل شده'}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 leading-tight">
                  {t.projectTitle} ({t.projectCode})
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                  <span>فرستنده: {t.authorName}</span>
                  <span>•</span>
                  <span>{t.createdAt}</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 leading-relaxed">
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
                      className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300 block"
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {/* Resolution Info if Resolved */}
              {t.status === 'RESOLVED' && (
                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    اقدام انجام شده توسط کیوسی:
                  </div>
                  <p className="text-[11px] text-emerald-800">{t.resolutionNote}</p>
                </div>
              )}

              {/* Action Form if Open */}
              {t.status === 'OPEN' && (
                <div className="pt-2 border-t border-slate-100">
                  {resolvingId === t.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="اقدام انجام شده (مثلاً: قطعه یدک با پیک فرستاده شد یا با کارفرما هماهنگ گردید)..."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 bg-white"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResolve(t)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ثبت حل مشکل
                        </button>
                        <button
                          onClick={() => setResolvingId(null)}
                          className="px-3 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs hover:bg-slate-50 transition"
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolvingId(t.id)}
                      className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
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
