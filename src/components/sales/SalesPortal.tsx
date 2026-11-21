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
  Pencil,
  Trash2,
  Lock,
  Search,
  Filter,
  X,
  FileText,
  AlertTriangle,
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
  updateSalesBooking,
  deleteSalesBooking,
  getSalesRepLeaderboard,
  getStoredBookings,
} from '../../utils/salesCapacity';
import { getUpcomingDays } from '../../utils/jalali';

interface Props {
  currentUser: User;
}

type TabType = 'booking' | 'all-bookings' | 'calendar' | 'leaderboard';

export const SalesPortal: React.FC<Props> = ({ currentUser }) => {
  const isCeo = currentUser.role === 'CEO';
  const [activeTab, setActiveTab] = useState<TabType>('booking');
  const [bookings, setBookings] = useState<SalesProjectBooking[]>([]);

  // استیت ویرایش پروژه
  const [editingBooking, setEditingBooking] = useState<SalesProjectBooking | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLathsCount, setEditLathsCount] = useState<number>(15);
  const [editIsSmart, setEditIsSmart] = useState<boolean>(true);
  const [editNotes, setEditNotes] = useState('');
  const [editDateKey, setEditDateKey] = useState<string>('');
  const [editMode, setEditMode] = useState<SalesAllocationMode>('SPREAD_DAILY');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // استیت حذف پروژه (انحصاراً برای مدیرعامل)
  const [deletingBooking, setDeletingBooking] = useState<SalesProjectBooking | null>(null);

  // پیام موفقیت فلوتینگ
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // فیلترهای تب لیست همه پروژه‌ها
  const [searchQuery, setSearchQuery] = useState('');
  const [repFilter, setRepFilter] = useState<'ALL' | 'MINE'>('ALL');
  const [systemFilter, setSystemFilter] = useState<'ALL' | 'SMART' | 'MANUAL'>('ALL');

  // فرم ثبت پروژه
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lathsCount, setLathsCount] = useState<number>(15);
  const [isSmart, setIsSmart] = useState<boolean>(true);
  const [notes, setNotes] = useState('');

  // تاریخ درخواستی (شروع مستقیم از آذر ماه)
  const upcomingDays = useMemo(() => {
    const all = getUpcomingDays(105);
    return all.filter((day) => {
      const parts = day.persianDateStr.split('/');
      const month = parseInt(parts[1], 10);
      return month >= 9 || parseInt(parts[0], 10) > 1405;
    });
  }, []);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    upcomingDays[0]?.dateKey || ''
  );
  const [selectedMode, setSelectedMode] = useState<SalesAllocationMode>('SPREAD_DAILY');

  // استیت موفقیت ثبت
  const [justBooked, setJustBooked] = useState<SalesProjectBooking | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // فیلتر تقویم
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);
  const [inspectDayKey, setInspectDayKey] = useState<string | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<'ALL' | 'FULL' | 'NEAR_FULL' | 'AVAILABLE'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'AVAILABLE' | 'FULL'>('ALL');

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

  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(null), 4000);
    return () => clearTimeout(t);
  }, [successToast]);

  // محاسبه گزینه‌های رزرو برای روز انتخابی (ثبت جدید)
  const bookingOptions = useMemo(() => {
    if (!selectedDateKey || lathsCount <= 0) return null;
    return calculateBookingOptions(lathsCount, selectedDateKey);
  }, [lathsCount, selectedDateKey, bookings]);

  // محاسبه گزینه‌های رزرو برای ویرایش پروژه (با کسر خودکار ظرفیت رزرو جاری)
  const editBookingOptions = useMemo(() => {
    if (!editingBooking || !editDateKey || editLathsCount <= 0) return null;
    return calculateBookingOptions(editLathsCount, editDateKey, editingBooking.id);
  }, [editingBooking, editDateKey, editLathsCount, bookings]);

  // فیلتر هوشمند پروژه‌ها در تب مدیریت پروژه‌ها
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCustomer = b.customerName?.toLowerCase().includes(q);
        const matchPhone = b.customerPhone?.includes(q);
        const matchAddress = b.address?.toLowerCase().includes(q);
        const matchRep = b.salesRepName?.toLowerCase().includes(q);
        const matchId = b.id?.toLowerCase().includes(q);
        if (!matchCustomer && !matchPhone && !matchAddress && !matchRep && !matchId) return false;
      }
      if (repFilter === 'MINE' && b.salesRepId !== currentUser.id) return false;
      if (systemFilter === 'SMART' && !b.isSmart) return false;
      if (systemFilter === 'MANUAL' && b.isSmart) return false;
      return true;
    });
  }, [bookings, searchQuery, repFilter, systemFilter, currentUser.id]);

  // عملیات ویرایش و حذف
  const handleStartEdit = (b: SalesProjectBooking) => {
    setEditingBooking(b);
    setEditCustomerName(b.customerName);
    setEditCustomerPhone(b.customerPhone);
    setEditAddress(b.address);
    setEditLathsCount(b.lathsCount);
    setEditIsSmart(b.isSmart);
    setEditNotes(b.notes || '');
    setEditDateKey(b.requestedDate);
    setEditMode(b.allocationMode);
    setEditFormError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    setEditFormError(null);

    if (!editCustomerName.trim()) {
      setEditFormError('نام مشتری نمی‌تواند خالی باشد.');
      return;
    }
    if (!editCustomerPhone.trim() || editCustomerPhone.length < 10) {
      setEditFormError('شماره تماس معتبر ۱۰ یا ۱۱ رقمی وارد نمایید.');
      return;
    }
    if (!editAddress.trim()) {
      setEditFormError('آدرس و لوکیشن پروژه الزامی است.');
      return;
    }
    if (editLathsCount <= 0 || editLathsCount > 60) {
      setEditFormError('تعداد لت‌ها باید بین ۱ تا ۶۰ باشد.');
      return;
    }

    if (!editBookingOptions) {
      setEditFormError('امکان بررسی ظرفیت برای تاریخ انتخابی وجود ندارد.');
      return;
    }

    const chosenOption =
      editMode === 'SPREAD_DAILY'
        ? editBookingOptions.spreadOption
        : editBookingOptions.consecutiveOption;

    if (!chosenOption.isAvailable) {
      setEditFormError('ظرفیت اکیپ‌ها در تاریخ انتخابی برای این تعداد لت کافی نیست.');
      return;
    }

    const selDay = upcomingDays.find((d) => d.dateKey === editDateKey);
    const jalaliDateStr = selDay?.persianDateStr || editDateKey;

    updateSalesBooking(editingBooking.id, {
      customerName: editCustomerName.trim(),
      customerPhone: editCustomerPhone.trim(),
      address: editAddress.trim(),
      lathsCount: editLathsCount,
      isSmart: editIsSmart,
      notes: editNotes.trim(),
      requestedDate: editDateKey,
      jalaliDate: jalaliDateStr,
      allocationMode: editMode,
      allocatedTeams: chosenOption.allocatedTeams,
      allocatedDaysCount: chosenOption.requiredDays,
    });

    setEditingBooking(null);
    setSuccessToast(`تغییرات پروژه «${editCustomerName.trim()}» با موفقیت ذخیره و تقویم به‌روزرسانی شد.`);
  };

  const handleStartDelete = (b: SalesProjectBooking) => {
    if (!isCeo) {
      alert('دسترسی غیرمجاز: حذف پروژه منحصراً در اختیار مدیرعامل می‌باشد.');
      return;
    }
    setDeletingBooking(b);
  };

  const handleConfirmDelete = () => {
    if (!deletingBooking) return;
    deleteSalesBooking(deletingBooking.id);
    const name = deletingBooking.customerName;
    const laths = deletingBooking.lathsCount;
    setDeletingBooking(null);
    setSuccessToast(`رزرو پروژه «${name}» با موفقیت حذف و ظرفیت ${laths} لت در تقویم آزاد گردید.`);
  };

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

  // تفکیک ماه‌ها در تقویم (۳ ماه آینده با شروع قطعی از آذر)
  const monthGroups = useMemo(() => {
    const groups: { monthName: string; days: typeof threeMonthCapacities }[] = [];
    threeMonthCapacities.forEach((dayCap) => {
      const parts = dayCap.jalaliDate.split('/');
      const monthNum = parseInt(parts[1], 10);
      // حذف قطعی آبان؛ شروع مستمر از آذر
      if (monthNum === 8 && parts[0] === '۱۴۰۵') return;

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

  // آمار وضعیت روزهای ماه انتخاب شده
  const monthStats = useMemo(() => {
    if (!activeMonthGroup) return { full: 0, nearFull: 0, available: 0, total: 0 };
    let full = 0;
    let nearFull = 0;
    let available = 0;
    for (const d of activeMonthGroup.days) {
      if (d.remainingLaths <= 0) full++;
      else if (d.remainingLaths <= 20) nearFull++;
      else available++;
    }
    return { full, nearFull, available, total: activeMonthGroup.days.length };
  }, [activeMonthGroup]);

  // روزهای فیلترشده تقویم ماه
  const filteredCalendarDays = useMemo(() => {
    if (!activeMonthGroup) return [];
    if (calendarFilter === 'FULL') {
      return activeMonthGroup.days.filter((d) => d.remainingLaths <= 0);
    }
    if (calendarFilter === 'NEAR_FULL') {
      return activeMonthGroup.days.filter((d) => d.remainingLaths > 0 && d.remainingLaths <= 20);
    }
    if (calendarFilter === 'AVAILABLE') {
      return activeMonthGroup.days.filter((d) => d.remainingLaths > 20);
    }
    return activeMonthGroup.days;
  }, [activeMonthGroup, calendarFilter]);

  // ۳۰ روز آینده با وضعیت ظرفیت برای فرم ثبت
  const upcoming30Days = useMemo(() => {
    return upcomingDays.slice(0, 30).map((day) => {
      const cap = getDailyCapacity(day.dateKey, bookings);
      const isFull = cap.remainingLaths <= 0;
      const isInsufficient = cap.remainingLaths < lathsCount;
      const isNearFull = cap.remainingLaths > 0 && cap.remainingLaths <= 20;
      return {
        ...day,
        cap,
        isFull,
        isInsufficient,
        isNearFull,
      };
    });
  }, [upcomingDays, bookings, lathsCount]);

  const filteredUpcomingDays = useMemo(() => {
    if (dateFilter === 'AVAILABLE') {
      return upcoming30Days.filter((d) => !d.isInsufficient && !d.isFull);
    }
    if (dateFilter === 'FULL') {
      return upcoming30Days.filter((d) => d.isFull || d.isInsufficient);
    }
    return upcoming30Days;
  }, [upcoming30Days, dateFilter]);

  const selectedDayCapacity = useMemo(() => {
    if (!selectedDateKey) return null;
    return getDailyCapacity(selectedDateKey, bookings);
  }, [selectedDateKey, bookings]);

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
            onClick={() => setActiveTab('all-bookings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'all-bookings'
                ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-102'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>مدیریت و اصلاح پروژه‌ها</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'all-bookings'
                  ? 'bg-black/20 text-black'
                  : 'bg-[#C5A059]/20 text-[#E5CA8F]'
              }`}
            >
              {bookings.length}
            </span>
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

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const b = justBooked;
                  setJustBooked(null);
                  handleStartEdit(b);
                }}
                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-bold py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                <Pencil className="w-4 h-4" />
                <span>ویرایش فوری اطلاعات یا تاریخ</span>
              </button>
              <button
                type="button"
                onClick={() => setJustBooked(null)}
                className="flex-1 bg-[#C5A059] hover:bg-[#D4AF37] text-black font-black py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                متوجه شدم و بستن
              </button>
            </div>
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

              {/* تاریخ نصب درخواستی با فیلتر رنگی وضعیت ظرفیت */}
              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <label className="text-xs font-semibold text-slate-300">
                    تاریخ نصب مورد نظر کارشناس <span className="text-rose-400">*</span>
                  </label>
                  {/* فیلترهای رنگی روزهای کاری */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDateFilter('ALL')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                        dateFilter === 'ALL'
                          ? 'bg-[#C5A059] text-black shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      همه (۳۰)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter('AVAILABLE')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                        dateFilter === 'AVAILABLE'
                          ? 'bg-emerald-500 text-black shadow-xs'
                          : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ظرفیت کافی
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter('FULL')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                        dateFilter === 'FULL'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'bg-rose-950/40 text-rose-400 border border-rose-800/40 hover:bg-rose-900/50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      تکمیل / ناکافی
                    </button>
                  </div>
                </div>

                <select
                  value={selectedDateKey}
                  onChange={(e) => setSelectedDateKey(e.target.value)}
                  className={`w-full bg-[#0D1117] border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition cursor-pointer ${
                    selectedDayCapacity && selectedDayCapacity.remainingLaths <= 0
                      ? 'border-rose-500 ring-1 ring-rose-500/50'
                      : selectedDayCapacity && selectedDayCapacity.remainingLaths < lathsCount
                      ? 'border-amber-500 ring-1 ring-amber-500/50'
                      : 'border-slate-700/80 focus:border-[#C5A059]'
                  }`}
                >
                  {filteredUpcomingDays.map((day) => {
                    const isFull = day.isFull;
                    const isInsufficient = day.isInsufficient;
                    const isNearFull = day.isNearFull;
                    return (
                      <option
                        key={day.dateKey}
                        value={day.dateKey}
                        disabled={isInsufficient}
                        className={
                          isFull
                            ? 'text-rose-400 bg-rose-950 font-bold'
                            : isInsufficient
                            ? 'text-amber-400 bg-amber-950'
                            : isNearFull
                            ? 'text-amber-200 bg-[#0D1117]'
                            : 'text-emerald-300 bg-[#0D1117]'
                        }
                      >
                        {isFull ? '🔴' : isInsufficient ? '⚠️' : isNearFull ? '🟡' : '🟢'}{' '}
                        {day.persianDayName} {day.persianDateStr} —{' '}
                        {isFull
                          ? '[تکمیل ظرفیت - ۰ لت]'
                          : isInsufficient
                          ? `[ناکافی: ${day.cap.remainingLaths} لت آزاد برای نیاز ${lathsCount} لت]`
                          : `[${day.cap.remainingLaths} لت خالی از ۶۰]`}
                      </option>
                    );
                  })}
                </select>

                {/* کارت وضعیت زنده ظرفیت روز انتخاب شده */}
                {selectedDayCapacity && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      selectedDayCapacity.remainingLaths <= 0
                        ? 'bg-rose-950/50 border-rose-500 text-rose-200'
                        : selectedDayCapacity.remainingLaths < lathsCount
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : selectedDayCapacity.remainingLaths <= 20
                        ? 'bg-amber-950/20 border-amber-500/50 text-amber-300'
                        : 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          selectedDayCapacity.remainingLaths <= 0
                            ? 'bg-rose-500 animate-ping'
                            : selectedDayCapacity.remainingLaths < lathsCount
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                      />
                      <span className="font-bold truncate">
                        {selectedDayCapacity.remainingLaths <= 0
                          ? 'تکمیل ظرفیت شرکت در این تاریخ (۰ لت خالی - انتخاب تاریخ دیگر الزامی است)'
                          : selectedDayCapacity.remainingLaths < lathsCount
                          ? `ظرفیت روز (${selectedDayCapacity.remainingLaths} لت) کمتر از نیاز پروژه (${lathsCount} لت) است`
                          : `ظرفیت روز آماده رزرو: ${selectedDayCapacity.remainingLaths} لت آزاد از ۶۰ لت`}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-black shrink-0 mr-2">
                      {selectedDayCapacity.bookedLaths}/۶۰ لت
                    </span>
                  </div>
                )}
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
                    className="bg-[#0D1117] border border-slate-800/80 rounded-xl p-3 text-xs space-y-1.5 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{item.customerName}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded text-[11px]">
                          {item.lathsCount} لت
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          title="ویرایش این پروژه"
                          className="p-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {isCeo && (
                          <button
                            type="button"
                            onClick={() => handleStartDelete(item)}
                            title="حذف پروژه و آزادسازی ظرفیت (مدیرعامل)"
                            className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{item.jalaliDate}</span>
                      <span>ثبت توسط: {item.salesRepName}</span>
                    </div>
                  </div>
                ))}

                {bookings.length === 0 && (
                  <div className="text-slate-500 text-center py-4 text-xs">
                    هنوز پروژه‌ای ثبت نشده است.
                  </div>
                )}
              </div>

              {bookings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('all-bookings')}
                  className="w-full text-center text-xs font-bold text-[#E5CA8F] hover:text-[#C5A059] bg-[#1C232D] hover:bg-[#252E3B] border border-[#2D3748] py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>مشاهده و مدیریت همه پروژه‌ها ({bookings.length} پروژه)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= تب ۲: مدیریت و اصلاح پروژه‌ها (ویرایش برای همه، حذف منحصراً برای مدیرعامل) ================= */}
      {activeTab === 'all-bookings' && (
        <div className="space-y-5">
          {/* نوار جستجو و فیلترها */}
          <div className="bg-[#14171F] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#C5A059]" />
                  <span>مدیریت و اصلاح اطلاعات پروژه‌های رزرو شده</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  امکان ویرایش سریع مشخصات، تغییر تعداد لت یا جابجایی تاریخ برای کارشناسان |{' '}
                  <span className="text-amber-300 font-semibold">
                    حذف رزرو و آزادسازی لت‌ها منحصراً در پنل مدیرعامل
                  </span>
                </p>
              </div>

              {/* نشان اختیارات کاربر جاری */}
              <div className="flex items-center gap-2">
                {isCeo ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>دسترسی مدیرعامل: مجاز به ویرایش و حذف</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 border border-slate-700 text-slate-300">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>دسترسی کارشناس: مجاز به ویرایش (حذف فقط با مدیرعامل)</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-slate-800/80">
              {/* کادر جستجو */}
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجو بر اساس نام مشتری، شماره تماس، آدرس یا نام کارشناس..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-2.5 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* فیلتر کارشناس */}
              <div className="sm:col-span-3 flex items-center bg-[#0D1117] border border-slate-700/80 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setRepFilter('ALL')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    repFilter === 'ALL'
                      ? 'bg-[#C5A059] text-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  همه ثبت‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setRepFilter('MINE')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    repFilter === 'MINE'
                      ? 'bg-[#C5A059] text-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  پروژه‌های من
                </button>
              </div>

              {/* فیلتر سیستم */}
              <div className="sm:col-span-3 flex items-center bg-[#0D1117] border border-slate-700/80 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSystemFilter('ALL')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    systemFilter === 'ALL'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  همه
                </button>
                <button
                  type="button"
                  onClick={() => setSystemFilter('SMART')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    systemFilter === 'SMART'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  هوشمند
                </button>
                <button
                  type="button"
                  onClick={() => setSystemFilter('MANUAL')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    systemFilter === 'MANUAL'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  دستی
                </button>
              </div>
            </div>
          </div>

          {/* لیست کارت‌های پروژه‌ها */}
          {filteredBookings.length === 0 ? (
            <div className="bg-[#14171F] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">پروژه‌ای با این مشخصات یافت نشد.</p>
              <p className="text-xs text-slate-500">
                می‌توانید عبارت جستجو را پاک کنید یا از تب «ثبت پروژه»، سفارش جدیدی ثبت نمایید.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-[#14171F] border border-slate-800 hover:border-slate-700/90 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col justify-between space-y-4 transition"
                >
                  <div className="space-y-3">
                    {/* ردیف بالا: نام و برچسب لت‌ها */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm sm:text-base">{b.customerName}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              b.isSmart
                                ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                                : 'bg-slate-800 border border-slate-700 text-slate-300'
                            }`}
                          >
                            {b.isSmart ? '⚡ هوشمند/موتوردار' : '🎛️ دستی/مکانیکی'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                          شناسه: {b.id}
                        </span>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="inline-block bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl">
                          {b.lathsCount} لت
                        </span>
                      </div>
                    </div>

                    {/* جزئیات تماس و لوکیشن */}
                    <div className="space-y-1.5 text-xs text-slate-300 bg-[#0D1117] border border-slate-800/80 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                        <span className="font-mono text-slate-200">{b.customerPhone}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                        <span className="text-slate-300 leading-relaxed text-[11px]">{b.address}</span>
                      </div>
                      {b.notes && (
                        <div className="flex items-start gap-2 pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span>{b.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* اطلاعات دیسپچ و زمان‌بندی */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <CalendarDays className="w-4 h-4 text-[#C5A059]" />
                        <span className="font-bold text-white">{b.jalaliDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>نحوه تخصیص:</span>
                        <span className="text-[#E5CA8F] font-semibold">
                          {b.allocationMode === 'SPREAD_DAILY' ? 'پخش همزمان اکیپ‌ها' : 'روزهای متوالی'}
                        </span>
                      </div>
                    </div>

                    {/* اکیپ‌های تخصیص‌یافته و کارشناس */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-slate-500">اکیپ‌ها:</span>
                        {b.allocatedTeams.map((tId) => {
                          const t = INSTALLATION_TEAMS.find((item) => item.id === tId);
                          return (
                            <span
                              key={tId}
                              className="bg-slate-800 border border-slate-700/80 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            >
                              {t?.name || tId}
                            </span>
                          );
                        })}
                      </div>
                      <div>
                        <span>ثبت: {b.salesRepName}</span>
                      </div>
                    </div>
                  </div>

                  {/* نوار اکشن‌ها: ویرایش برای همه، حذف منحصراً برای مدیرعامل */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(b)}
                      className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>ویرایش اطلاعات یا تغییر تاریخ</span>
                    </button>

                    {isCeo ? (
                      <button
                        type="button"
                        onClick={() => handleStartDelete(b)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        title="حذف و آزادسازی ظرفیت لت‌ها (اختیار مدیرعامل)"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden sm:inline">حذف (مدیرعامل)</span>
                        <span className="sm:hidden">حذف</span>
                      </button>
                    ) : (
                      <div
                        className="px-2 py-1.5 text-slate-500 text-[10px] flex items-center gap-1 shrink-0"
                        title="حذف پروژه و آزادسازی ظرفیت منحصراً در پنل مدیرعامل امکان‌پذیر است."
                      >
                        <Lock className="w-3 h-3 text-slate-600" />
                        <span className="hidden sm:inline">حذف: فقط مدیرعامل</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= تب ۲: تقویم زنده ۳ ماهه ظرفیت ================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          {/* نوار انتخاب ماه و فیلترهای رنگی وضعیت ظرفیت */}
          <div className="bg-[#14171F] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
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
                    onClick={() => {
                      setSelectedMonthOffset(idx);
                      setInspectDayKey(null);
                    }}
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

            {/* نوار فیلترهای تفکیکی رنگی و راهنما */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-xs ml-1 font-semibold">فیلتر وضعیت:</span>
                <button
                  type="button"
                  onClick={() => setCalendarFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    calendarFilter === 'ALL'
                      ? 'bg-white text-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  همه روزها ({monthStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarFilter('FULL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    calendarFilter === 'FULL'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 ring-2 ring-rose-300'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-800/50 hover:bg-rose-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  🔴 تکمیل ظرفیت ({monthStats.full})
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarFilter('NEAR_FULL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    calendarFilter === 'NEAR_FULL'
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25 ring-2 ring-amber-300'
                      : 'bg-amber-950/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  🟡 در آستانه تکمیل ({monthStats.nearFull})
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarFilter('AVAILABLE')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    calendarFilter === 'AVAILABLE'
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-300'
                      : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  🟢 ظرفیت آزاد ({monthStats.available})
                </button>
              </div>

              {/* راهنمای رنگ‌ها */}
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-xs" />
                  قرمز: پر (۶۰/۶۰)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-xs" />
                  زرد: کمتر از ۲۰ لت
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-xs" />
                  سبز: ظرفیت باز
                </span>
              </div>
            </div>
          </div>

          {/* شبکه روزهای تقویم با هایلایت رنگی واضح */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredCalendarDays.map((dayCap) => {
              const isFull = dayCap.remainingLaths <= 0;
              const isNearFull = dayCap.remainingLaths > 0 && dayCap.remainingLaths <= 20;
              const isSelected = inspectDayKey === dayCap.date;

              return (
                <div
                  key={dayCap.date}
                  onClick={() => setInspectDayKey(dayCap.date)}
                  className={`border rounded-xl p-3 transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'border-[#C5A059] shadow-lg shadow-[#C5A059]/20 bg-[#1A202C] ring-2 ring-[#C5A059]'
                      : isFull
                      ? 'border-rose-500 bg-rose-950/40 text-rose-100 hover:border-rose-400 hover:bg-rose-950/60 ring-1 ring-rose-500/50 shadow-md shadow-rose-950/30'
                      : isNearFull
                      ? 'border-amber-500/70 bg-amber-950/30 text-amber-100 hover:border-amber-400 hover:bg-amber-950/50 ring-1 ring-amber-500/40 shadow-xs'
                      : 'border-emerald-500/30 bg-[#14171F] hover:border-emerald-400 hover:bg-emerald-950/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-slate-300 font-medium">{dayCap.dayName}</span>
                    <span className="text-xs font-bold text-white font-mono">{dayCap.jalaliDate.split('/')[2]}</span>
                  </div>

                  {/* برچسب رنگی در بالای کارت */}
                  <div className="mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isFull
                          ? 'bg-rose-500/25 text-rose-200 border border-rose-500/60'
                          : isNearFull
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50'
                          : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isFull ? 'bg-rose-400' : isNearFull ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                      />
                      {isFull ? '🔴 تکمیل ظرفیت' : isNearFull ? '🟡 ظرفیت محدود' : '🟢 ظرفیت آزاد'}
                    </span>
                  </div>

                  <div className="my-1.5">
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
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
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

                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 mt-2">
                    <span>{dayCap.bookingsCount} رزرو</span>
                    <span>سقف: ۶۰</span>
                  </div>
                </div>
              );
            })}

            {filteredCalendarDays.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 bg-[#14171F] rounded-2xl border border-slate-800">
                <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold">هیچ روزی با وضعیت انتخابی در این ماه یافت نشد.</p>
              </div>
            )}
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

              {/* پروژه‌های ثبت‌شده در این روز */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#C5A059]" />
                    <span>
                      پروژه‌های رزرو شده در این روز (
                      {bookings.filter((b) => b.requestedDate === inspectedDay.date).length} پروژه)
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    مجموع رزرو این روز: {inspectedDay.bookedLaths} لت از ۶۰ لت
                  </span>
                </div>

                {bookings.filter((b) => b.requestedDate === inspectedDay.date).length === 0 ? (
                  <div className="text-xs text-slate-500 py-3 text-center bg-[#0D1117] rounded-xl border border-slate-800/80">
                    هیچ پروژه‌ای برای این روز ثبت نشده و تمام ظرفیت ۶۰ لت آزاد است.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bookings
                      .filter((b) => b.requestedDate === inspectedDay.date)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#0D1117] border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{item.customerName}</span>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                                {item.lathsCount} لت
                              </span>
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                {item.isSmart ? '⚡ هوشمند' : '🎛️ دستی'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#C5A059]" />
                                {item.customerPhone}
                              </span>
                              <span>ثبت توسط: {item.salesRepName}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>ویرایش</span>
                            </button>
                            {isCeo ? (
                              <button
                                type="button"
                                onClick={() => handleStartDelete(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 px-1">
                                <Lock className="w-3 h-3 text-slate-600" />
                                <span>حذف: فقط مدیرعامل</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
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

      {/* ================= مودال ویرایش اطلاعات و تاریخ پروژه ================= */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#14171F] border border-[#C5A059] rounded-2xl max-w-2xl w-full p-5 sm:p-6 text-right shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* هدر مودال */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#C5A059]" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    ویرایش اطلاعات و تاریخ پروژه
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    شناسه رزرو: <span className="font-mono text-[#E5CA8F]">{editingBooking.id}</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editFormError && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
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
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white focus:border-[#C5A059] focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* شماره تماس */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    شماره تماس مشتری <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                    <input
                      type="text"
                      dir="ltr"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white focus:border-[#C5A059] focus:outline-none transition text-right"
                    />
                  </div>
                </div>
              </div>

              {/* آدرس پروژه */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  آدرس و لوکیشن پروژه <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white focus:border-[#C5A059] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* تعداد لت‌ها و نوع سیستم */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    تعداد کل لت‌ها (۱ تا ۶۰)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={editLathsCount}
                      onChange={(e) =>
                        setEditLathsCount(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))
                      }
                      className="w-24 bg-[#0D1117] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs font-black text-center text-white focus:border-[#C5A059] focus:outline-none"
                    />
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={editLathsCount}
                      onChange={(e) => setEditLathsCount(parseInt(e.target.value))}
                      className="flex-1 accent-[#C5A059] cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    مکانیزم حرکت
                  </label>
                  <div className="flex items-center gap-2 bg-[#0D1117] border border-slate-700/80 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setEditIsSmart(true)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        editIsSmart ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚡ هوشمند/موتوردار
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditIsSmart(false)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        !editIsSmart ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🎛️ دستی/مکانیکی
                    </button>
                  </div>
                </div>
              </div>

              {/* انتخابگر تاریخ نصب با کسر رزرو فعلی */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  تاریخ نصب درخواستی (با کسر خودکار ظرفیت قبلی همین پروژه)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-800 rounded-xl bg-[#0D1117]">
                  {upcomingDays.slice(0, 30).map((day) => {
                    const cap = getDailyCapacity(day.dateKey, bookings, editingBooking.id);
                    const isSelected = editDateKey === day.dateKey;
                    const isFull = cap.remainingLaths <= 0;
                    const isInsufficient = cap.remainingLaths < editLathsCount;

                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => setEditDateKey(day.dateKey)}
                        className={`p-2 rounded-lg text-right transition border cursor-pointer ${
                          isSelected
                            ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold shadow-md'
                            : isFull || isInsufficient
                            ? 'bg-rose-950/20 border-rose-800/40 text-rose-300/80 hover:bg-rose-950/40'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-[11px] font-bold">{day.dayName}</div>
                        <div className="text-[10px] font-mono">{day.persianDateStr}</div>
                        <div className="text-[9px] mt-0.5">
                          {cap.remainingLaths} لت خالی
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* گزینه‌های محاسبه‌شده تخصیص */}
              {editBookingOptions && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    نحوه تخصیص اکیپ‌ها:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div
                      onClick={() =>
                        editBookingOptions.spreadOption.isAvailable && setEditMode('SPREAD_DAILY')
                      }
                      className={`border rounded-xl p-3 text-xs transition cursor-pointer ${
                        editMode === 'SPREAD_DAILY'
                          ? 'border-[#C5A059] bg-[#C5A059]/10 text-white ring-1 ring-[#C5A059]'
                          : !editBookingOptions.spreadOption.isAvailable
                          ? 'opacity-40 border-slate-800 bg-slate-900/50 cursor-not-allowed'
                          : 'border-slate-800 bg-[#0D1117] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between mb-1">
                        <span>{editBookingOptions.spreadOption.title}</span>
                        {editBookingOptions.spreadOption.isAvailable ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                            قابل رزرو
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                            ظرفیت پر
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {editBookingOptions.spreadOption.description}
                      </p>
                    </div>

                    <div
                      onClick={() =>
                        editBookingOptions.consecutiveOption.isAvailable &&
                        setEditMode('CONSECUTIVE_DAYS')
                      }
                      className={`border rounded-xl p-3 text-xs transition cursor-pointer ${
                        editMode === 'CONSECUTIVE_DAYS'
                          ? 'border-[#C5A059] bg-[#C5A059]/10 text-white ring-1 ring-[#C5A059]'
                          : !editBookingOptions.consecutiveOption.isAvailable
                          ? 'opacity-40 border-slate-800 bg-slate-900/50 cursor-not-allowed'
                          : 'border-slate-800 bg-[#0D1117] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between mb-1">
                        <span>{editBookingOptions.consecutiveOption.title}</span>
                        {editBookingOptions.consecutiveOption.isAvailable ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                            قابل رزرو
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                            ظرفیت پر
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {editBookingOptions.consecutiveOption.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* یادداشت‌ها */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  یادداشت و دستور کار نصب
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl p-2.5 text-xs text-white focus:border-[#C5A059] focus:outline-none transition resize-none"
                />
              </div>

              {/* دکمه‌های تایید و انصراف */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#C5A059] hover:bg-[#D4AF37] text-black font-black py-2.5 rounded-xl transition cursor-pointer text-xs"
                >
                  ذخیره تغییرات و به‌روزرسانی تقویم
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= مودال تایید حذف رزرو (انحصاری مدیرعامل) ================= */}
      {deletingBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-rose-600/80 rounded-2xl max-w-md w-full p-6 text-right shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-white text-center">
              آیا از حذف این رزرو اطمینان دارید؟
            </h3>
            <p className="text-xs text-amber-300 font-semibold text-center mt-1">
              عملیات ویژه مدیرعامل (CEO Authority)
            </p>

            <div className="bg-[#0D1117] border border-slate-800 rounded-xl p-3.5 my-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">نام مشتری:</span>
                <span className="font-bold text-white">{deletingBooking.customerName}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">تاریخ نصب:</span>
                <span className="font-bold text-white">{deletingBooking.jalaliDate}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">تعداد لت‌ها:</span>
                <span className="font-bold text-emerald-400">{deletingBooking.lathsCount} لت</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">کارشناس ثبت‌کننده:</span>
                <span className="text-slate-300">{deletingBooking.salesRepName}</span>
              </div>
            </div>

            <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 text-[11px] text-rose-200 leading-relaxed mb-5">
              با حذف این پروژه، ظرفیت <strong className="text-white">{deletingBooking.lathsCount} لت</strong> بلافاصله در تقویم دیسپچ و اکیپ‌های نصب آزاد خواهد شد.
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                تایید و حذف قطعی رزرو
              </button>
              <button
                type="button"
                onClick={() => setDeletingBooking(null)}
                className="px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* پیام فلوتینگ موفقیت */}
      {successToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-[#151B23] border border-emerald-500/80 text-emerald-100 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="mr-2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
