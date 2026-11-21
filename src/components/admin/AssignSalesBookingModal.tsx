import React, { useState } from 'react';
import { SalesProjectBooking, InstallationTeam, User } from '../../types';
import {
  CalendarDays,
  Sparkles,
  Layers,
  MapPin,
  Phone,
  User as UserIcon,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Plus,
} from 'lucide-react';
import { toPersianDigits, getUpcomingDays } from '../../utils/jalali';

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
  // تاریخ‌های ۹۰ روز آینده برای انتخاب آزادانه تاریخ
  const upcomingDays = getUpcomingDays(90);

  // پیش‌فرض تاریخ روی تاریخ پیشنهادی فروش قرار می‌گیرد اما کاملاً دست مدیر اپ و QC باز است
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تخصیص رزرو فروش به برنامه قطعی نصب"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-[#151B23] border border-[#212835] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-[#F0F4F8]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#212835] flex items-center justify-between bg-[#0D1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-[#F0F4F8]">
                تخصیص به برنامه نصب نصاب‌ها
              </h3>
              <span className="text-[11px] text-[#9BA7B6]">
                تبدیل رزرو فروش به مأموریت اجرایی در تقویم
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#1C232D] transition cursor-pointer"
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
          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-[#212835] space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-[#F0F4F8] flex items-center gap-2">
                <span>{booking.customerName}</span>
                {booking.isSmart ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    هوشمند
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-300 border border-zinc-500/30">
                    دستی/استاندارد
                  </span>
                )}
              </div>
              <span className="font-black text-xs text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded border border-[#C5A059]/20">
                {toPersianDigits(booking.lathsCount)} لت
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#9BA7B6] pt-1">
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-[#637184]" />
                <span className="font-mono">{booking.customerPhone || 'بدون شماره'}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <UserIcon className="w-3 h-3 text-[#637184]" />
                <span>فروشنده: {booking.salesRepName}</span>
              </div>
            </div>

            {booking.address && (
              <div className="flex items-start gap-1 text-[11px] text-[#637184] pt-1 border-t border-[#212835]">
                <MapPin className="w-3 h-3 text-[#637184] shrink-0 mt-0.5" />
                <span className="truncate">{booking.address}</span>
              </div>
            )}

            {/* تاریخ پیشنهادی فروش */}
            <div className="pt-2 border-t border-dashed border-[#212835] flex items-center justify-between text-[11px]">
              <span className="text-[#9BA7B6]">تاریخ تخمینی و اولویت فروش:</span>
              <span className="font-bold text-[#E5CA8F] font-mono bg-[#1C232D] px-2 py-0.5 rounded border border-[#2D3748]">
                {booking.jalaliDate} ({booking.requestedDate})
              </span>
            </div>
          </div>

          {/* فیلد ۱: انتخاب تاریخ قطعی نصب (کاملاً آزاد و منعطف) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-[#F0F4F8] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>تعیین تاریخ قطعی اجرای نصب:</span>
              </label>
              {isDateDifferentFromSales && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                  تغییر نسبت به پیشنهاد اولیه فروش
                </span>
              )}
            </div>

            <select
              value={selectedDateKey}
              onChange={(e) => setSelectedDateKey(e.target.value)}
              className="w-full bg-[#0D1117] border border-[#212835] rounded-xl px-3 py-2 text-xs text-[#F0F4F8] focus:border-[#C5A059] focus:outline-none transition cursor-pointer"
            >
              {upcomingDays.map((d) => (
                <option key={d.dateKey} value={d.dateKey}>
                  {d.persianDayName} {d.persianDayNum} {d.persianMonthName} ({d.dateKey})
                  {d.dateKey === booking.requestedDate ? ' — [پیشنهاد اولیه فروش]' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#637184] leading-relaxed">
              مدیر اپ و QC اختیار تام دارد پروژه را برای هر روزی متناسب با آمادگی کارگاه و پرسنل تنظیم کند.
            </p>
          </div>

          {/* فیلد ۲: انتخاب اکیپ نصب */}
          <div className="space-y-1.5">
            <label className="font-bold text-xs text-[#F0F4F8] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
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
                        ? 'border-[#C5A059] bg-[#C5A059]/10 text-[#F0F4F8] ring-1 ring-[#C5A059]/30'
                        : 'border-[#212835] bg-[#0D1117] text-[#9BA7B6] hover:border-[#2D3748]'
                    }`}
                  >
                    <span className="font-bold text-xs truncate">{t.name}</span>
                    <span className="text-[10px] font-mono text-[#637184] mt-1">{t.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* دکمه‌های اقدام */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#212835]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C232D] hover:bg-[#252F3D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-black bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'تایید و ثبت در برنامه نصب'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
