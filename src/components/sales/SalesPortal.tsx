import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Trophy,
  PlusCircle,
  Zap,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  User as UserIcon,
  Flame,
  Award,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Clock,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { User, SalesProjectBooking, SalesAllocationMode } from '../../types';
import {
  MAX_DAILY_COMPANY_LATHS,
  MAX_LATHS_PER_TEAM,
  INSTALLATION_TEAMS,
  getThreeMonthCapacities,
  getDailyCapacity,
  calculateBookingOptions,
  createSalesBooking,
  getSalesRepLeaderboard,
  getStoredBookings,
} from '../../utils/salesCapacity';
import { getUpcomingDays } from '../../utils/jalali';

interface Props {
  currentUser: User;
}

type TabType = 'booking' | 'calendar' | 'leaderboard';

export const SalesPortal: React.FC<Props> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>('booking');
  const [bookings, setBookings] = useState<SalesProjectBooking[]>([]);

  // فرم ثبت پروژه
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lathsCount, setLathsCount] = useState<number>(15);
  const [isSmart, setIsSmart] = useState<boolean>(true);
  const [notes, setNotes] = useState('');

  // تاریخ درخواستی
  const upcomingDays = useMemo(() => getUpcomingDays(90), []);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    upcomingDays[1]?.dateKey || ''
  );
  const [selectedMode, setSelectedMode] = useState<SalesAllocationMode>('SPREAD_DAILY');

  // استیت موفقیت ثبت
  const [justBooked, setJustBooked] = useState<SalesProjectBooking | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // فیلتر تقویم
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);
  const [inspectDayKey, setInspectDayKey] = useState<string | null>(null);

  // بارگذاری داده‌ها و گوش‌دادن به رویدادها
  const refreshData = () => {
    setBookings(getStoredBookings());
  };

  useEffect(() => {
    refreshData();
    const handleUpdate = () => refreshData();
    window.addEventListener('talaei_sales_bookings_updated', handleUpdate);
    return () => window.removeEventListener('talaei_sales_bookings_updated', handleUpdate);
  }, []);

  // محاسبه گزینه‌های رزرو برای روز انتخابی
  const bookingOptions = useMemo(() => {
    if (!selectedDateKey || lathsCount <= 0) return null;
    return calculateBookingOptions(lathsCount, selectedDateKey);
  }, [lathsCount, selectedDateKey, bookings]);

  // دریافت ظرفیت‌های ۳ ماهه
  const threeMonthCapacities = useMemo(() => {
    return getThreeMonthCapacities(90);
  }, [bookings]);

  // لیدربورد زنده
  const leaderboard = useMemo(() => {
    return getSalesRepLeaderboard();
  }, [bookings]);

  // ثبت نهایی فرم
  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('لطفاً نام مشتری را وارد نمایید.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 10) {
      setFormError('لطفاً شماره تماس معتبر مشتری را وارد نمایید.');
      return;
    }
    if (!address.trim()) {
      setFormError('لطفاً آدرس و لوکیشن پروژه را مشخص کنید.');
      return;
    }
    if (lathsCount <= 0 || lathsCount > 60) {
      setFormError('تعداد لت‌ها باید بین ۱ تا ۶۰ لت باشد.');
      return;
    }

    if (!bookingOptions) {
      setFormError('امکان محاسبه ظرفیت برای این تاریخ وجود ندارد.');
      return;
    }

    const chosenOption =
      selectedMode === 'SPREAD_DAILY'
        ? bookingOptions.spreadOption
        : bookingOptions.consecutiveOption;

    if (!chosenOption.isAvailable) {
      setFormError('حالت انتخابی به دلیل تکمیل ظرفیت اکیپ‌ها در این تاریخ در دسترس نیست.');
      return;
    }

    const selDay = upcomingDays.find((d) => d.dateKey === selectedDateKey);
    const jalaliDateStr = selDay?.persianDateStr || selectedDateKey;

    const newBooking = createSalesBooking({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      lathsCount,
      isSmart,
      notes: notes.trim(),
      requestedDate: selectedDateKey,
      jalaliDate: jalaliDateStr,
      allocationMode: selectedMode,
      allocatedTeams: chosenOption.allocatedTeams,
      allocatedDaysCount: chosenOption.requiredDays,
      salesRepId: currentUser.id,
      salesRepName: currentUser.name,
    });

    setJustBooked(newBooking);
    // ریست فرم
    setCustomerName('');
    setCustomerPhone('');
    setAddress('');
    setNotes('');
  };

  // تفکیک ماه‌ها در تقویم (۳ ماه)
  const monthGroups = useMemo(() => {
    const groups: { monthName: string; days: typeof threeMonthCapacities }[] = [];
    threeMonthCapacities.forEach((dayCap) => {
      const parts = dayCap.jalaliDate.split('/');
      const monthNum = parseInt(parts[1], 10);
      const monthNames = [
        '',
        'فروردین',
        'اردیبهشت',
        'خرداد',
        'تیر',
        'مرداد',
        'شهریور',
        'مهر',
        'آبان',
        'آذر',
        'دی',
        'بهمن',
        'اسفند',
      ];
      const monthName = `${monthNames[monthNum] || 'ماه'} ${parts[0]}`;

      let currentGroup = groups.find((g) => g.monthName === monthName);
      if (!currentGroup) {
        currentGroup = { monthName, days: [] };
        groups.push(currentGroup);
      }
      currentGroup.days.push(dayCap);
    });
    return groups;
  }, [threeMonthCapacities]);

  const activeMonthGroup = monthGroups[selectedMonthOffset] || monthGroups[0];
  const inspectedDay = threeMonthCapacities.find((d) => d.date === inspectDayKey);

  return (
    <div className="space-y-6 dir-rtl text-right font-sans pb-16" dir="rtl">
      {/* هدر ماژول فروش */}
      <div className="bg-[#14171F] border border-[#C5A059]/30 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-[#C5A059]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#C5A059] uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4 text-[#E5CA8F]" />
              <span>سامانه هوشمند فروش و رزرو لت‌های طلایی</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              میز کارشناس فروش و برنامه‌ریزی نصب
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              ثبت پروژه جدید بدون محاسبات مالی، تخصیص هوشمند بین ۴ اکیپ (سقف روزانه ۶۰ لت) و تقویم ۳ ماهه
            </p>
          </div>

          {/* نشان کارشناس آنلاین */}
          <div className="flex items-center gap-3 bg-[#1A202C]/80 border border-slate-700/60 rounded-xl px-3.5 py-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#C5A059]/20 border border-[#C5A059] flex items-center justify-center text-xl shrink-0">
              {currentUser.avatar || '🎯'}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                {currentUser.name}
                <span className="text-[10px] bg-[#C5A059]/20 text-[#E5CA8F] px-1.5 py-0.5 rounded font-mono font-medium">
                  کارشناس فعال
                </span>
              </div>
              <div className="text-xs text-slate-400">
                سقف هر اکیپ: ۱۵ لت | کل ظرفیت روز: ۶۰ لت
              </div>
            </div>
          </div>
        </div>

        {/* سوییچ تب‌ها */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('booking')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'booking'
                ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-102'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>ثبت پروژه و رزرو لت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-102'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>تقویم زنده ظرفیت ۳ ماهه</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-102'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>جدول رده‌بندی و گیمیفیکیشن</span>
            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              فان
            </span>
          </button>
        </div>
      </div>

      {/* مودال موفقیت پس از ثبت */}
      {justBooked && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-[#C5A059] rounded-2xl max-w-lg w-full p-6 text-right shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white text-center">
              پروژه با موفقیت ثبت و لت‌ها رزرو شدند!
            </h3>
            <p className="text-xs text-slate-400 text-center mt-1">
              ظرفیت به صورت خودکار در تقویم دیسپچ و نصاب‌ها کسر گردید.
            </p>

            <div className="bg-[#0D1117] border border-slate-800 rounded-xl p-4 my-5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">شناسه رزرو:</span>
                <span className="font-mono text-[#E5CA8F]">{justBooked.id}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">نام مشتری:</span>
                <span className="font-bold text-white">{justBooked.customerName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">تعداد لت‌ها:</span>
                <span className="font-bold text-emerald-400 text-sm">{justBooked.lathsCount} لت</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">نوع سیستم:</span>
                <span>{justBooked.isSmart ? '⚡ هوشمند و موتوردار' : '🎛️ دستی و مکانیکی'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">تاریخ نصب:</span>
                <span className="font-bold text-white">{justBooked.jalaliDate}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">حالت تخصیص:</span>
                <span>
                  {justBooked.allocationMode === 'SPREAD_DAILY'
                    ? 'پخش همزمان بین چند اکیپ در یک روز'
                    : 'رزرو متوالی یک اکیپ در چند روز'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setJustBooked(null)}
              className="w-full bg-[#C5A059] hover:bg-[#D4AF37] text-black font-black py-3 rounded-xl transition cursor-pointer"
            >
              متوجه شدم و بستن
            </button>
          </div>
        </div>
      )}

      {/* ================= تب ۱: ثبت پروژه و رزرو ظرفیت ================= */}
      {activeTab === 'booking' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* فرم اصلی ورودی اطلاعات */}
          <div className="lg:col-span-7 bg-[#14171F] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-[#C5A059]" />
                <span>اطلاعات پروژه و شیدهای فروخته‌شده</span>
              </h2>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-medium">
                ۱۰۰٪ بدون محاسبات مالی
              </span>
            </div>

            {formError && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* نام مشتری */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    نام و نام‌خانوادگی مشتری <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                    <input
                      type="text"
                      placeholder="مثال: دکتر کیانی"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* شماره تماس */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    شماره تماس مستقیم مشتری <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                    <input
                      type="tel"
                      placeholder="0912..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition dir-ltr text-right"
                    />
                  </div>
                </div>
              </div>

              {/* آدرس و لوکیشن */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  آدرس دقیق محل نصب (لوکیشن) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  <input
                    type="text"
                    placeholder="مثال: فرمانیه، دیباجی شمالی، پلاک ۱۲، زنگ ۴"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* انتخاب تعداد لت (Laths) */}
              <div className="bg-[#0D1117] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#C5A059]" />
                    <span>تعداد لت‌های پروژه (واحد شمارش شید)</span>
                  </label>
                  <div className="text-sm font-black text-[#E5CA8F] bg-[#C5A059]/10 border border-[#C5A059]/30 px-3 py-0.5 rounded-lg">
                    {lathsCount} لت
                  </div>
                </div>

                {/* کلیدهای سریع انتخاب لت */}
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 30, 45, 60].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setLathsCount(num)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        lathsCount === num
                          ? 'bg-[#C5A059] text-black border-[#C5A059] shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {num} لت
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="1"
                  max="60"
                  value={lathsCount}
                  onChange={(e) => setLathsCount(Number(e.target.value))}
                  className="w-full accent-[#C5A059] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>۱ لت (حداقل)</span>
                  <span>۱۵ لت (سقف ۱ اکیپ)</span>
                  <span>۳۰ لت (۲ اکیپ)</span>
                  <span>۶۰ لت (کل ظرفیت روز)</span>
                </div>
              </div>

              {/* انتخاب نوع شید: هوشمند vs دستی */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsSmart(true)}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 ${
                    isSmart
                      ? 'bg-[#C5A059]/15 border-[#C5A059] text-white shadow-xs'
                      : 'bg-[#0D1117] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">هوشمند و برقی</div>
                    <div className="text-[10px] text-slate-400">موتوردار، ریموت یا اتصال BMS</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSmart(false)}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 ${
                    !isSmart
                      ? 'bg-[#C5A059]/15 border-[#C5A059] text-white shadow-xs'
                      : 'bg-[#0D1117] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-700/40 text-slate-300 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">مکانیکی و دستی</div>
                    <div className="text-[10px] text-slate-400">زنجیری ساده یا شید معمولی</div>
                  </div>
                </button>
              </div>

              {/* تاریخ نصب درخواستی */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  تاریخ نصب مورد نظر کارشناس <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedDateKey}
                  onChange={(e) => setSelectedDateKey(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:border-[#C5A059] focus:outline-none transition cursor-pointer"
                >
                  {upcomingDays.slice(0, 30).map((day) => {
                    const cap = getDailyCapacity(day.dateKey, bookings);
                    const isFull = cap.remainingLaths < lathsCount;
                    return (
                      <option
                        key={day.dateKey}
                        value={day.dateKey}
                        disabled={isFull}
                        className={isFull ? 'text-slate-600 bg-slate-900' : 'text-white bg-[#0D1117]'}
                      >
                        {day.persianDayName} {day.persianDateStr} — ({cap.remainingLaths} لت خالی از ۶۰)
                        {isFull ? ' [تکمیل ظرفیت]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* کادر توضیحات تکمیلی */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  توضیحات و الزامات فنی خاص (اختیاری)
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: ارتفاع سقف بیش از ۳.۵ متر، نیاز به نردبان بلند، یا هماهنگی ویژه با سرایدار..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#C5A059] hover:bg-[#D4AF37] text-black font-black py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#C5A059]/20 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>ثبت قطعی پروژه و رزرو ظرفیت لت</span>
              </button>
            </form>
          </div>

          {/* ستون کناری: پیشنهاد هوشمند اکیپ‌ها و ظرفیت زنده */}
          <div className="lg:col-span-5 space-y-5">
            {/* کارت انتخاب هوشمند حالت تخصیص */}
            <div className="bg-[#14171F] border border-[#C5A059]/30 rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-2.5">
                <Sparkles className="w-4 h-4 text-[#C5A059]" />
                <span>پیشنهاد هوشمند تخصیص اکیپ‌ها</span>
              </div>

              {bookingOptions ? (
                <div className="space-y-3">
                  {/* گزینه ۱: پخش همزمان */}
                  <div
                    onClick={() => {
                      if (bookingOptions.spreadOption.isAvailable) {
                        setSelectedMode('SPREAD_DAILY');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      selectedMode === 'SPREAD_DAILY'
                        ? 'bg-[#C5A059]/15 border-[#C5A059] text-white shadow-xs'
                        : 'bg-[#0D1117] border-slate-800 text-slate-300'
                    } ${!bookingOptions.spreadOption.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#E5CA8F]">
                        حالت ۱: انجام یک‌روزه (پخش بین اکیپ‌ها)
                      </span>
                      {bookingOptions.spreadOption.isAvailable ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          قابل اجرا
                        </span>
                      ) : (
                        <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded-full">
                          ظرفیت پر
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {bookingOptions.spreadOption.description}
                    </p>
                    {bookingOptions.spreadOption.isAvailable && (
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        {bookingOptions.spreadOption.daysDetails[0]?.teams.map((t) => (
                          <span
                            key={t.teamId}
                            className="bg-slate-800 text-slate-200 text-[10px] px-2 py-1 rounded border border-slate-700 font-mono"
                          >
                            {t.teamName}: {t.laths} لت
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* گزینه ۲: چند روز متوالی */}
                  <div
                    onClick={() => {
                      if (bookingOptions.consecutiveOption.isAvailable) {
                        setSelectedMode('CONSECUTIVE_DAYS');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      selectedMode === 'CONSECUTIVE_DAYS'
                        ? 'bg-[#C5A059]/15 border-[#C5A059] text-white shadow-xs'
                        : 'bg-[#0D1117] border-slate-800 text-slate-300'
                    } ${!bookingOptions.consecutiveOption.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#E5CA8F]">
                        حالت ۲: رزرو متوالی یک اکیپ ({bookingOptions.consecutiveOption.requiredDays} روزه)
                      </span>
                      {bookingOptions.consecutiveOption.isAvailable ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          قابل اجرا
                        </span>
                      ) : (
                        <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded-full">
                          ظرفیت پر
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {bookingOptions.consecutiveOption.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-4">
                  در حال محاسبه ظرفیت...
                </div>
              )}
            </div>

            {/* کارت آخرین پروژه‌های ثبت‌شده توسط کارشناسان */}
            <div className="bg-[#14171F] border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#C5A059]" />
                  <span>آخرین پروژه‌های رزرو شده تیم فروش</span>
                </span>
                <span className="text-[10px] text-slate-400">به‌روزرسانی در لحظه</span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {bookings.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0D1117] border border-slate-800/80 rounded-xl p-3 text-xs space-y-1 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{item.customerName}</span>
                      <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded text-[11px]">
                        {item.lathsCount} لت
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{item.jalaliDate}</span>
                      <span>ثبت توسط: {item.salesRepName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= تب ۲: تقویم زنده ۳ ماهه ظرفیت ================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          {/* نوار انتخاب ماه */}
          <div className="bg-[#14171F] border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#C5A059]" />
              <span className="font-bold text-white text-sm">
                مشاهده ظرفیت خالی روزانه به تفکیک ۴ اکیپ (سقف روزانه ۶۰ لت)
              </span>
            </div>

            {/* ماه‌های ۳ گانه */}
            <div className="flex items-center gap-2">
              {monthGroups.map((group, idx) => (
                <button
                  key={group.monthName}
                  type="button"
                  onClick={() => setSelectedMonthOffset(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedMonthOffset === idx
                      ? 'bg-[#C5A059] text-black shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {group.monthName}
                </button>
              ))}
            </div>
          </div>

          {/* شبکه روزهای تقویم */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {activeMonthGroup?.days.map((dayCap) => {
              const isFull = dayCap.remainingLaths <= 0;
              const isNearFull = dayCap.remainingLaths > 0 && dayCap.remainingLaths <= 20;
              const isSelected = inspectDayKey === dayCap.date;

              return (
                <div
                  key={dayCap.date}
                  onClick={() => setInspectDayKey(dayCap.date)}
                  className={`bg-[#14171F] border rounded-xl p-3 transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'border-[#C5A059] shadow-lg shadow-[#C5A059]/10 bg-[#1A202C]'
                      : isFull
                      ? 'border-rose-900/60 bg-rose-950/10 hover:border-rose-700'
                      : isNearFull
                      ? 'border-amber-900/60 bg-amber-950/10 hover:border-amber-700'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">{dayCap.dayName}</span>
                    <span className="text-xs font-bold text-white font-mono">{dayCap.jalaliDate.split('/')[2]}</span>
                  </div>

                  <div className="my-2">
                    <div className="flex justify-between items-baseline text-[11px] mb-1">
                      <span className="text-slate-400">ظرفیت خالی:</span>
                      <span
                        className={`font-black ${
                          isFull
                            ? 'text-rose-400'
                            : isNearFull
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {dayCap.remainingLaths} لت
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFull ? 'bg-rose-500' : isNearFull ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (dayCap.bookedLaths / MAX_DAILY_COMPANY_LATHS) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 mt-1">
                    <span>{dayCap.bookingsCount} رزرو</span>
                    <span>سقف: ۶۰</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* پنل نمایش جزئیات روز انتخابی */}
          {inspectedDay && (
            <div className="bg-[#14171F] border border-[#C5A059] rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#C5A059]" />
                  <span className="font-bold text-white text-base">
                    وضعیت تفکیکی اکیپ‌ها برای {inspectedDay.dayName} {inspectedDay.jalaliDate}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">ظرفیت کل باقی‌مانده:</span>
                  <span className="text-sm font-black text-[#E5CA8F] bg-[#C5A059]/10 border border-[#C5A059]/30 px-3 py-1 rounded-lg">
                    {inspectedDay.remainingLaths} لت از ۶۰ لت
                  </span>
                </div>
              </div>

              {/* ۴ اکیپ روز */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {inspectedDay.teams.map((team) => {
                  const free = team.maxLaths - team.bookedLaths;
                  return (
                    <div
                      key={team.teamId}
                      className="bg-[#0D1117] border border-slate-800 rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                        <span>{team.teamName}</span>
                        <span className={free > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {free} لت آزاد
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#C5A059] rounded-full"
                          style={{
                            width: `${(team.bookedLaths / team.maxLaths) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>رزرو شده: {team.bookedLaths} لت</span>
                        <span>سقف: ۱۵ لت</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= تب ۳: جدول رده‌بندی و گیمیفیکیشن ================= */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* هدر انگیزشی */}
          <div className="bg-gradient-to-r from-amber-950/40 via-[#14171F] to-amber-950/40 border border-[#C5A059]/40 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
            <div className="inline-flex items-center gap-2 bg-[#C5A059]/20 border border-[#C5A059]/40 px-3 py-1 rounded-full text-xs font-bold text-[#E5CA8F] mb-3">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>رقابت دوستانه ماهانه تیم فروش طلایی</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              جدول قهرمانان فروش و رزرو شید
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl mx-auto">
              رتبه‌بندی بر اساس تعداد پروژه‌های موفق، حجم لت‌های رزرو شده و فعالیت مستمر در ماه جاری
            </p>
          </div>

          {/* سکوی ۳ نفر برتر (Podium) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-6">
            {/* رتبه ۲: نقره */}
            {leaderboard[1] && (
              <div className="bg-[#14171F] border border-slate-700/80 rounded-2xl p-5 text-center shadow-lg order-2 md:order-1 relative">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-md">
                  {leaderboard[1].avatarIcon}
                </div>
                <div className="text-xs font-bold text-slate-400 bg-slate-800 inline-block px-2.5 py-0.5 rounded-full mb-1">
                  رتبه ۲ (نقره 🥈)
                </div>
                <h3 className="text-base font-black text-white">{leaderboard[1].name}</h3>
                <div className="text-xs text-[#E5CA8F] font-bold mt-1">
                  {leaderboard[1].caricatureTag}
                </div>

                <div className="bg-[#0D1117] border border-slate-800 rounded-xl p-3 mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>پروژه‌های ثبت‌شده:</span>
                    <span className="font-bold text-white">{leaderboard[1].monthlyProjectsCount} پروژه</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>مجموع لت‌ها:</span>
                    <span className="font-bold text-emerald-400">{leaderboard[1].monthlyLathsCount} لت</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>روزهای فعال ماه:</span>
                    <span className="font-bold text-slate-200">{leaderboard[1].activeBookingDays} روز</span>
                  </div>
                </div>
              </div>
            )}

            {/* رتبه ۱: طلا (بزرگ‌تر و در مرکز) */}
            {leaderboard[0] && (
              <div className="bg-[#171B24] border-2 border-[#C5A059] rounded-2xl p-6 text-center shadow-2xl order-1 md:order-2 relative -translate-y-2">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#C5A059] text-black font-black text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                  <Award className="w-3.5 h-3.5" />
                  <span>قهرمان لت ماه 👑</span>
                </div>

                <div className="w-20 h-20 rounded-full bg-[#C5A059]/20 border-3 border-[#C5A059] flex items-center justify-center text-4xl mx-auto mb-3 shadow-xl">
                  {leaderboard[0].avatarIcon}
                </div>
                <div className="text-xs font-bold text-[#E5CA8F] bg-[#C5A059]/15 inline-block px-3 py-0.5 rounded-full mb-1">
                  رتبه ۱ (طلا 🥇)
                </div>
                <h3 className="text-lg font-black text-white">{leaderboard[0].name}</h3>
                <div className="text-xs text-amber-300 font-bold mt-1">
                  {leaderboard[0].caricatureTag}
                </div>

                <div className="bg-[#0D1117] border border-[#C5A059]/30 rounded-xl p-3.5 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>پروژه‌های ثبت‌شده:</span>
                    <span className="font-black text-[#E5CA8F] text-sm">
                      {leaderboard[0].monthlyProjectsCount} پروژه
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>مجموع لت‌ها:</span>
                    <span className="font-black text-emerald-400 text-sm">
                      {leaderboard[0].monthlyLathsCount} لت
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>روزهای فعال ماه:</span>
                    <span className="font-bold text-slate-200">{leaderboard[0].activeBookingDays} روز</span>
                  </div>
                </div>
              </div>
            )}

            {/* رتبه ۳: برنز */}
            {leaderboard[2] && (
              <div className="bg-[#14171F] border border-amber-900/60 rounded-2xl p-5 text-center shadow-lg order-3 relative">
                <div className="w-16 h-16 rounded-full bg-amber-950/50 border-2 border-amber-700 flex items-center justify-center text-3xl mx-auto mb-3 shadow-md">
                  {leaderboard[2].avatarIcon}
                </div>
                <div className="text-xs font-bold text-amber-400 bg-amber-950 inline-block px-2.5 py-0.5 rounded-full mb-1">
                  رتبه ۳ (برنز 🥉)
                </div>
                <h3 className="text-base font-black text-white">{leaderboard[2].name}</h3>
                <div className="text-xs text-amber-300 font-bold mt-1">
                  {leaderboard[2].caricatureTag}
                </div>

                <div className="bg-[#0D1117] border border-slate-800 rounded-xl p-3 mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>پروژه‌های ثبت‌شده:</span>
                    <span className="font-bold text-white">{leaderboard[2].monthlyProjectsCount} پروژه</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>مجموع لت‌ها:</span>
                    <span className="font-bold text-emerald-400">{leaderboard[2].monthlyLathsCount} لت</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>روزهای فعال ماه:</span>
                    <span className="font-bold text-slate-200">{leaderboard[2].activeBookingDays} روز</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
