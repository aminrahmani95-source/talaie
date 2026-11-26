import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatProductCounts, bookingProductCounts } from '../../utils/productCounts';
import { SalesProjectBooking, InstallationTeam, User } from '../../types';
import {
  CalendarDays,
  Sparkles,
  Layers,
  MapPin,
  Phone,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react';
import { toPersianDigits, getUpcomingDays, formatJalali } from '../../utils/jalali';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { CloudImage } from '../common/CloudImage';

interface Props {
  booking: SalesProjectBooking;
  teams: InstallationTeam[];
  users: User[];
  onClose: () => void;
  onConfirm: (scheduledDate: string, teamId: string, teamName: string) => Promise<void> | void;
}

export const AssignSalesBookingModal: React.FC<Props> = ({
  booking,
  teams,
  users: _users,
  onClose,
  onConfirm,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEscapeKey(() => (previewUrl ? setPreviewUrl(null) : onClose()));
  // تاریخ‌های 90 روز آینده برای انتخاب آزادانه تاریخ
  const upcomingDays = getUpcomingDays(90);

  // پیش‌فرض تاریخ روی تاریخ پیشنهادی فروش قرار می‌گیرد اما کاملاً دست مدیر QC باز است
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    booking.requestedDate || upcomingDays[0]?.dateKey || ''
  );

  // پیش‌فرض اکیپ: اگر در رزرو فروش اکیپی ثبت شده باشد از آن، در غیر این صورت اکیپ اول
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    booking.allocatedTeams?.[0] || teams[0]?.id || 'TEAM_1'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDayInfo = upcomingDays.find((d) => d.dateKey === selectedDateKey);
  const isDateDifferentFromSales = selectedDateKey !== booking.requestedDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateKey) {
      setError('لطفاً تاریخ قطعی نصب را انتخاب نمایید.');
      return;
    }
    const chosenTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
    const teamName = chosenTeam ? chosenTeam.name : 'اکیپ نصب پیش‌فرض';

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedDateKey, selectedTeamId, teamName);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ثبت و تخصیص پروژه به برنامه نصب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تخصیص رزرو فروش به برنامه قطعی نصب"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-surface border border-line rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-ink my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-canvas">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center text-brand-ink">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-ink">
                تخصیص به برنامه نصب نصاب‌ها
              </h3>
              <span className="text-[12px] text-ink-2">
                تبدیل رزرو فروش به مأموریت اجرایی در تقویم
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-2 hover:text-ink hover:bg-raised transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* خلاصه رزرو اولیه ثبت‌شده توسط فروش */}
          <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-ink flex items-center gap-2">
                <span>{booking.customerName}</span>
                {booking.isSmart ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    هوشمند
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/15 text-ink border border-zinc-500/30">
                    دستی/استاندارد
                  </span>
                )}
              </div>
              <span className="font-black text-xs text-brand-ink bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                {formatProductCounts(bookingProductCounts(booking)) || `${toPersianDigits(booking.lathsCount)} لت`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px] text-ink-2 pt-1">
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-ink-3" />
                <span className="font-mono">{booking.customerPhone || 'بدون شماره'}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <UserIcon className="w-3 h-3 text-ink-3" />
                <span>فروشنده: {booking.salesRepName}</span>
              </div>
            </div>

            {booking.address && (
              <div className="flex items-start gap-1 text-[12px] text-ink-3 pt-1 border-t border-line">
                <MapPin className="w-3 h-3 text-ink-3 shrink-0 mt-0.5" />
                <span className="truncate">{booking.address}</span>
              </div>
            )}

            {/* پروپوزال ثبت‌شده توسط فروشنده؛ همین عکس‌ها خودکار به فرم مأموریت منتقل می‌شوند */}
            <div className="pt-2 border-t border-line">
              {booking.proposalImages && booking.proposalImages.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[12px] text-ink-2 flex items-center justify-between">
                    <span>📎 پروپوزال فروشنده</span>
                    <span className="text-emerald-600 dark:text-emerald-300 font-bold">به فرم مأموریت منتقل می‌شود</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {booking.proposalImages.map((img) => (
                      <a
                        key={img.id}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPreviewUrl(img.url);
                        }}
                        className="block w-14 h-16 rounded-md overflow-hidden border border-line hover:border-brand"
                        aria-label={`نمایش ${img.title}`}
                      >
                        <CloudImage src={img.url} alt={img.title} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-amber-700 dark:text-amber-300">
                  این رزرو پروپوزال ندارد؛ در فرم مأموریت می‌توانید اضافه کنید.
                </div>
              )}
            </div>

            {/* تاریخ پیشنهادی فروش */}
            <div className="pt-2 border-t border-dashed border-line flex items-center justify-between text-[12px]">
              <span className="text-ink-2">تاریخ تخمینی و اولویت فروش:</span>
              <span className="font-bold text-brand-soft font-mono bg-raised px-2 py-0.5 rounded border border-line-strong">
                {booking.jalaliDate ? toPersianDigits(booking.jalaliDate) : formatJalali(booking.requestedDate)}
              </span>
            </div>
          </div>

          {/* فیلد 1: انتخاب تاریخ قطعی نصب (کاملاً آزاد و منعطف) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-ink flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-ink" />
                <span>تعیین تاریخ قطعی اجرای نصب:</span>
              </label>
              {isDateDifferentFromSales && (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                  تغییر نسبت به پیشنهاد اولیه فروش
                </span>
              )}
            </div>

            <select
              value={selectedDateKey}
              onChange={(e) => setSelectedDateKey(e.target.value)}
              className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none transition cursor-pointer"
            >
              {upcomingDays.map((d) => (
                <option key={d.dateKey} value={d.dateKey}>
                  {d.persianDayName} {toPersianDigits(d.persianDayNum)} {d.persianMonthName}
                  {d.dateKey === booking.requestedDate ? ' — [پیشنهاد اولیه فروش]' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-3 leading-relaxed">
              مدیر QC اختیار تام دارد پروژه را برای هر روزی متناسب با آمادگی کارگاه و پرسنل تنظیم کند.
            </p>
          </div>

          {/* فیلد 2: انتخاب اکیپ نصب */}
          <div className="space-y-1.5">
            <label className="font-bold text-xs text-ink flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-ink" />
              <span>انتخاب اکیپ مجری نصب:</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => {
                const isSelected = selectedTeamId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTeamId(t.id)}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-brand bg-brand/10 text-ink ring-1 ring-brand/30'
                        : 'border-line bg-canvas text-ink-2 hover:border-line-strong'
                    }`}
                  >
                    <span className="font-bold text-xs truncate">{t.name}</span>
                    <span className="text-[11px] font-mono text-ink-3 mt-1">{t.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* دکمه‌های اقدام */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-raised hover:bg-hover text-ink-2 hover:text-ink transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-black bg-brand hover:bg-brand-hover text-on-brand transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'تایید و ثبت در برنامه نصب'}</span>
            </button>
          </div>
        </form>
      </div>
      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-label="نمایش بزرگ پروپوزال"
        >
          <CloudImage src={previewUrl} alt="پروپوزال" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>,
    document.body
  );
};
