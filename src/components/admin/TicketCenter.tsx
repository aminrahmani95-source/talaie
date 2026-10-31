import React, { useState } from 'react';
import { Ticket } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import { toPersianDigits, formatJalaliDateTime } from '../../utils/jalali';
import { CloudImage } from '../common/CloudImage';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';

interface Props {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
}

export const TicketCenter: React.FC<Props> = ({ tickets, onUpdateTicket }) => {
  const [filter, setFilter] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED').length;

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
      resolvedAt: new Date().toISOString(),
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
    <div className="space-y-5 pb-10">
      {/* Page Header */}
      <PageHeader
        title="تیکت‌ها و پیام‌های اضطراری"
        subtitle="پیام‌ها و اعلام کسری‌های سر پروژه توسط تکنسین‌های نصب"
        actions={
          <SegmentedControl
            options={[
              { id: 'OPEN', label: 'تیکت‌های باز', badge: openCount > 0 ? openCount : undefined },
              { id: 'RESOLVED', label: 'حل شده‌ها', badge: resolvedCount > 0 ? resolvedCount : undefined },
              { id: 'ALL', label: 'همه تیکت‌ها', badge: tickets.length },
            ]}
            value={filter}
            onChange={(val) => setFilter(val as 'OPEN' | 'RESOLVED' | 'ALL')}
            size="sm"
          />
        }
      />

      {filteredTickets.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-8 text-center border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs max-w-md mx-auto">
          <CheckCircle2 className="w-12 h-12 text-[#8E6F27] dark:text-[#E5CA8F] mx-auto mb-2 opacity-50" />
          <h3 className="font-bold text-sm text-[#181818] dark:text-white">
            هیچ تیکت بازی وجود ندارد
          </h3>
          <p className="text-xs text-[#69655F] dark:text-[#9E988D] mt-1">
            همه موارد پیگیری شده یا هیچ گزارشی ارسال نشده است.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border shadow-2xs space-y-3 ${
                t.status === 'OPEN'
                  ? 'border-rose-300 dark:border-rose-900 ring-2 ring-rose-500/10'
                  : 'border-[#E2DDD4] dark:border-[#2C2C2C] opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7F2] dark:bg-[#222222] text-[#181818] dark:text-[#F5F3EF] border border-[#E2DDD4] dark:border-[#2C2C2C]">
                  {getTicketTypeLabel(t.type)}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    t.status === 'OPEN'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {t.status === 'OPEN' ? 'نیازمند اقدام' : 'حل شده'}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#181818] dark:text-[#F5F3EF] leading-tight">
                  {t.projectTitle} ({t.projectCode})
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-[#69655F] dark:text-[#9E988D] mt-1">
                  <span>ارسال‌کننده: {t.authorName}</span>
                  <span>•</span>
                  <span>{formatJalaliDateTime(t.createdAt)}</span>
                </div>
              </div>

              <p className="text-xs text-[#4A4742] dark:text-[#BDB8AF] bg-[#FAF7F2] dark:bg-[#141414] p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] leading-relaxed">
                {t.description}
              </p>

              {/* Photos */}
              {t.photos && t.photos.filter((p) => Boolean(p && p.trim() !== '')).length > 0 && (
                <div className="flex items-center gap-2">
                  {t.photos
                    .filter((p) => Boolean(p && p.trim() !== ''))
                    .map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPreviewPhoto(p)}
                        className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#E2DDD4] dark:border-[#2C2C2C] block group cursor-pointer"
                        aria-label="مشاهده تصویر ضمیمه"
                      >
                        <CloudImage src={p} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <ZoomIn className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {/* Resolution Info if Resolved */}
              {t.status === 'RESOLVED' && (
                <div className="bg-[#FAF7F2] dark:bg-[#141414] rounded-xl p-3 border border-[#C1A056]/30 text-xs text-[#181818] dark:text-[#F5F3EF] space-y-1">
                  <div className="font-bold flex items-center justify-between text-[#8E6F27] dark:text-[#E5CA8F]">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>اقدام انجام شده:</span>
                    </span>
                    {t.resolvedAt && (
                      <span className="text-[10px] text-[#69655F] dark:text-[#9E988D] font-normal font-mono">
                        {formatJalaliDateTime(t.resolvedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#4A4742] dark:text-[#BDB8AF]">{t.resolutionNote}</p>
                </div>
              )}

              {/* Action Form if Open */}
              {t.status === 'OPEN' && (
                <div className="pt-2 border-t border-[#E2DDD4] dark:border-[#2C2C2C]">
                  {resolvingId === t.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="اقدام انجام شده جهت رفع مشکل را بنویسید..."
                        className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleResolve(t)}
                          icon={<CheckCircle2 className="w-4 h-4" />}
                          className="flex-1"
                        >
                          ثبت حل مشکل
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResolvingId(null)}
                        >
                          انصراف
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setResolvingId(t.id)}
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      className="w-full"
                    >
                      پاسخ و حل این مشکل
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox for Ticket Photo */}
      {previewPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-12 left-0 text-white hover:text-rose-400 p-2 rounded-full bg-white/10 cursor-pointer"
              aria-label="بستن"
            >
              <X className="w-6 h-6" />
            </button>
            <CloudImage
              src={previewPhoto}
              alt="عکس تیکت"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
