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

type TabType = 'calendar' | 'all-bookings';

export const SalesPortal: React.FC<Props> = ({ currentUser }) => {
  const isCeo = currentUser.role === 'CEO';
  const isQcManager = currentUser.role === 'QC_MANAGER';
  const isFullAdmin = isCeo || isQcManager;
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [bookings, setBookings] = useState<SalesProjectBooking[]>([]);

  // مودال برنامه‌ریزی و ثبت پروژه برای روز کلیک‌شده در تقویم
  const [bookingDayModal, setBookingDayModal] = useState<DailyLathCapacity | null>(null);

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

  // کنترل سطح دسترسی ویرایش:
  // ۱. مدیرعامل و مدیر اپ و QC دسترسی مدیریتی کامل دارند (isFullAdmin).
  // ۲. هر کارشناس فروش (یا هر نقش دیگری) صرفاً و منحصراً پروژه‌های ثبت‌شده توسط خودش را می‌تواند ویرایش کند.
  const canEditBooking = (b: SalesProjectBooking) => {
    if (isFullAdmin) return true;
    const matchId = Boolean(b.salesRepId && b.salesRepId === currentUser.id);
    const matchName = Boolean(
      b.salesRepName &&
      (b.salesRepName.trim() === currentUser.name.trim() ||
        currentUser.name.includes(b.salesRepName) ||
        b.salesRepName.includes(currentUser.name))
    );
    return matchId || matchName;
  };

  // عملیات ویرایش و حذف
  const handleStartEdit = (b: SalesProjectBooking) => {
    if (!canEditBooking(b)) {
      setSuccessToast(`شما فقط مجاز به ویرایش پروژه‌های ثبت‌شده توسط خودتان (${currentUser.name}) هستید.`);
      return;
    }
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
    if (editLathsCount <= 0) {
      setEditFormError('تعداد لت‌ها باید بزرگتر از صفر باشد.');
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
      daysDetails: chosenOption.daysDetails,
    });

    setEditingBooking(null);
    setSuccessToast(`تغییرات پروژه «${editCustomerName.trim()}» با موفقیت ذخیره و تقویم به‌روزرسانی شد.`);
  };

  const handleStartDelete = (b: SalesProjectBooking) => {
    if (!isQcManager) {
      alert('دسترسی غیرمجاز: حذف پروژه منحصراً در اختیار مدیریت اپ و QC می‌باشد.');
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

  // لیدربورد زنده (منحصراً برای کارشناسان رسمی فروش؛ مدیران سامانه و QC مستثنی هستند)
  const leaderboard = useMemo(() => {
    const excludedIds = currentUser.role !== 'SALES_REP' ? [currentUser.id] : [];
    return getSalesRepLeaderboard(undefined, excludedIds);
  }, [bookings, currentUser.id, currentUser.role]);

  // باز کردن مودال ثبت پروژه برای روز کلیک‌شده در تقویم
  const handleOpenDayModal = (dayCap: DailyLathCapacity) => {
    setBookingDayModal(dayCap);
    setSelectedDateKey(dayCap.date);
    setFormError(null);
  };

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
    if (lathsCount <= 0) {
      setFormError('تعداد لت‌ها باید بیشتر از صفر باشد.');
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
      daysDetails: chosenOption.daysDetails,
      salesRepId: currentUser.id,
      salesRepName: currentUser.name,
    });

    setBookingDayModal(null);
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
              {isQcManager || isCeo
                ? 'میز مدیریت فروش و برنامه‌ریزی نصب'
                : 'میز کارشناس فروش و برنامه‌ریزی نصب'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              ثبت پروژه جدید بدون محاسبات مالی، تخصیص هوشمند بین ۲ اکیپ (سقف روزانه ۴۰ لت) و تقویم ۳ ماهه
            </p>
          </div>

          {/* نشان کاربر آنلاین / مدیر سامانه یا کارشناس */}
          <div className="flex items-center gap-3 bg-[#1A202C]/80 border border-slate-700/60 rounded-xl px-3.5 py-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#C5A059]/20 border border-[#C5A059] flex items-center justify-center text-xl shrink-0">
              {currentUser.avatar || (isQcManager ? '👔' : '🎯')}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                {currentUser.name}
                <span className="text-[10px] bg-[#C5A059]/20 text-[#E5CA8F] px-1.5 py-0.5 rounded font-mono font-medium">
                  {isQcManager ? 'مدیر سامانه و QC' : isCeo ? 'مدیر عامل' : 'کارشناس فعال'}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                سقف هر اکیپ: ۲۰ لت | کل ظرفیت روز: ۴۰ لت
              </div>
            </div>
          </div>
        </div>

        {/* سوییچ تب‌ها - دقیقا ۲ تب: تقویم ۳ ماهه و مدیریت پروژه‌ها */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800/80 pt-4">
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
            <span>تقویم ۳ ماهه و برنامه‌ریزی نصب</span>
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
                  هر کارشناس فقط مجاز به ویرایش پروژه‌های ثبت‌شده توسط خودش است |{' '}
                  <span className="text-amber-300 font-semibold">
                    حذف رزرو و آزادسازی ظرفیت منحصراً در پنل مدیرعامل
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
                    {canEditBooking(b) ? (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(b)}
                        className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>ویرایش اطلاعات یا تغییر تاریخ</span>
                      </button>
                    ) : (
                      <div
                        className="flex-1 bg-slate-900/60 border border-slate-800 text-slate-500 font-medium py-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                        title={`ویرایش منحصراً توسط ثبت‌کننده (${b.salesRepName}) یا مدیریت مجاز است`}
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-600" />
                        <span>فقط ثبت‌کننده ({b.salesRepName})</span>
                      </div>
                    )}

                    {isQcManager ? (
                      <button
                        type="button"
                        onClick={() => handleStartDelete(b)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        title="حذف و آزادسازی ظرفیت لت‌ها (اختیار مدیر اپ و QC)"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden sm:inline">حذف پروژه</span>
                        <span className="sm:hidden">حذف</span>
                      </button>
                    ) : (
                      <div
                        className="px-2 py-1.5 text-slate-500 text-[10px] flex items-center gap-1 shrink-0"
                        title="حذف پروژه و آزادسازی ظرفیت منحصراً در پنل مدیر اپ و QC امکان‌پذیر است."
                      >
                        <Lock className="w-3 h-3 text-slate-600" />
                        <span className="hidden sm:inline">حذف: فقط مدیر اپ و QC</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= تب ۱: تقویم زنده ۳ ماهه ظرفیت و ثبت پروژه ================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* سکوی قهرمانان فروش و رده‌بندی ماهانه (بالای تقویم) */}
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

            {leaderboard.length === 0 && (
              <div className="col-span-1 md:col-span-3 bg-[#0D1117] border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                هنوز پروژه‌ای توسط کارشناسان رسمی فروش ثبت نشده است. رتبه‌بندی منحصراً متعلق به کارشناسان فروش است.
              </div>
            )}
          </div>
        </div>

          {/* راهنمای تعاملی */}
          <div className="bg-[#14171F] border border-[#C5A059]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-slate-300 shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span>
                <strong>برنامه‌ریزی سریع:</strong> برای مشاهده وضعیت تفکیکی ۲ اکیپ و ثبت پروژه برای هر روز، روی کارت همان روز در تقویم کلیک کنید.
              </span>
            </div>
            <span className="hidden sm:inline-block bg-[#C5A059]/15 text-[#E5CA8F] px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0">
              سقف روزانه: ۴۰ لت
            </span>
          </div>

          {/* نوار انتخاب ماه و فیلترهای رنگی وضعیت ظرفیت */}
          <div className="bg-[#14171F] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#C5A059]" />
                <span className="font-bold text-white text-sm">
                  مشاهده ظرفیت خالی روزانه به تفکیک ۲ اکیپ (سقف روزانه ۴۰ لت)
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
                  قرمز: پر (۴۰/۴۰)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-xs" />
                  زرد: کمتر از ۱۵ لت
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
              const isNearFull = dayCap.remainingLaths > 0 && dayCap.remainingLaths <= 15;
              const isSelected = inspectDayKey === dayCap.date;

              return (
                <div
                  key={dayCap.date}
                  onClick={() => handleOpenDayModal(dayCap)}
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
                    <span className="text-[#C5A059] font-bold flex items-center gap-1">
                      <PlusCircle className="w-3 h-3" /> ثبت پروژه
                    </span>
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

                  </div>
      )}

      {/* ================= مودال برنامه‌ریزی و ثبت پروژه برای روز انتخابی تقویم ================= */}
      {bookingDayModal && (() => {
        const modalDayCap = getDailyCapacity(bookingDayModal.date, bookings);
        const dayBookings = bookings.filter((b) => b.requestedDate === bookingDayModal.date);
        const isFull = modalDayCap.remainingLaths <= 0;

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[#14171F] border border-[#C5A059] rounded-2xl max-w-3xl w-full p-5 sm:p-6 text-right shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-200 space-y-5">
              {/* هدر مودال */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C5A059]/20 border border-[#C5A059] flex items-center justify-center text-[#E5CA8F]">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-white">
                        برنامه‌ریزی و ثبت پروژه جدید
                      </h3>
                      <span className="text-xs bg-[#C5A059]/20 text-[#E5CA8F] px-2.5 py-0.5 rounded-full font-bold">
                        {modalDayCap.dayName} {modalDayCap.jalaliDate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      تخصیص هوشمند بین ۲ اکیپ نصب طلایی | سقف روزانه ۴۰ لت
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingDayModal(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* وضعیت ظرفیت ۲ اکیپ در این روز */}
              <div className="bg-[#0D1117] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    ظرفیت آزاد امروز:
                  </span>
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                      isFull
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {modalDayCap.remainingLaths} لت آزاد از ۴۰ لت
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {modalDayCap.teams.map((t) => {
                    const free = t.maxLaths - t.bookedLaths;
                    return (
                      <div
                        key={t.teamId}
                        className="bg-[#14171F] border border-slate-800 rounded-lg p-2 text-right"
                      >
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-300 mb-1">
                          <span>{t.teamName}</span>
                          <span className={free > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {free} لت
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${free > 0 ? 'bg-[#C5A059]' : 'bg-rose-500'}`}
                            style={{ width: `${(t.bookedLaths / t.maxLaths) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* خطا در صورت وجود */}
              {formError && (
                <div className="bg-rose-950/60 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* فرم ثبت اطلاعات پروژه */}
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* نام مشتری */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      نام و نام‌خانوادگی مشتری <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                      <input
                        type="text"
                        placeholder="مثال: آقای مهندس صادقی"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition"
                      />
                    </div>
                  </div>

                  {/* شماره تماس */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      شماره تماس مشتری <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                      <input
                        type="text"
                        placeholder="۰۹۱۲..."
                        dir="ltr"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition text-right"
                      />
                    </div>
                  </div>
                </div>

                {/* آدرس */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    آدرس و لوکیشن پروژه <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                    <input
                      type="text"
                      placeholder="مثال: نیاوران، خیابان یاسر، پلاک ۱۲، زنگ ۴"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* تعداد لت‌ها و نوع مکانیزم */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        تعداد کل شیدها (لت‌ها)
                      </label>
                      <span className="text-[11px] text-[#C5A059] font-black">
                        {lathsCount} لت
                      </span>
                    </div>

                    {/* دکمه‌های پرکاربرد (شامل ۱۰۰ و ۱۱۵ لت) */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {[5, 10, 15, 20, 30, 45, 60, 100, 115].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setLathsCount(val)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                            lathsCount === val
                              ? 'bg-[#C5A059] text-black shadow-xs font-black'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {val} لت
                        </button>
                      ))}
                    </div>

                    {/* اینپوت عددی و اسلایدر بدون سقف ۶۰ */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={lathsCount}
                        onChange={(e) =>
                          setLathsCount(Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-20 bg-[#0D1117] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-black text-center text-white focus:border-[#C5A059] focus:outline-none"
                      />
                      <input
                        type="range"
                        min={1}
                        max={Math.max(150, lathsCount)}
                        value={lathsCount}
                        onChange={(e) => setLathsCount(parseInt(e.target.value))}
                        className="flex-1 accent-[#C5A059] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* نوع سیستم */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      مکانیزم حرکت لت‌ها
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-[#0D1117] border border-slate-700/80 rounded-xl p-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setIsSmart(true)}
                        className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          isSmart
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ هوشمند/موتوردار</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSmart(false)}
                        className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          !isSmart
                            ? 'bg-slate-700 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>🎛️ دستی/مکانیکی</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* کارت‌های هوشمند محاسبه تخصیص اکیپ‌ها */}
                {bookingOptions && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      شیوه تخصیص اکیپ‌ها:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* گزینه ۱: پخش در روز */}
                      <div
                        onClick={() =>
                          bookingOptions.spreadOption.isAvailable &&
                          setSelectedMode('SPREAD_DAILY')
                        }
                        className={`border rounded-xl p-3 text-xs transition cursor-pointer relative ${
                          selectedMode === 'SPREAD_DAILY'
                            ? 'border-[#C5A059] bg-[#C5A059]/10 text-white ring-1 ring-[#C5A059]'
                            : !bookingOptions.spreadOption.isAvailable
                            ? 'opacity-40 border-slate-800 bg-slate-900/40 cursor-not-allowed'
                            : 'border-slate-800 bg-[#0D1117] text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>{bookingOptions.spreadOption.title}</span>
                          </span>
                          {bookingOptions.spreadOption.isAvailable ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                              قابل رزرو
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                              ظرفیت پر
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {bookingOptions.spreadOption.description}
                        </p>
                      </div>

                      {/* گزینه ۲: رزرو متوالی یک اکیپ */}
                      <div
                        onClick={() =>
                          bookingOptions.consecutiveOption.isAvailable &&
                          setSelectedMode('CONSECUTIVE_DAYS')
                        }
                        className={`border rounded-xl p-3 text-xs transition cursor-pointer relative ${
                          selectedMode === 'CONSECUTIVE_DAYS'
                            ? 'border-[#C5A059] bg-[#C5A059]/10 text-white ring-1 ring-[#C5A059]'
                            : !bookingOptions.consecutiveOption.isAvailable
                            ? 'opacity-40 border-slate-800 bg-slate-900/40 cursor-not-allowed'
                            : 'border-slate-800 bg-[#0D1117] text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>{bookingOptions.consecutiveOption.title}</span>
                          </span>
                          {bookingOptions.consecutiveOption.isAvailable ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                              قابل رزرو
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                              ظرفیت پر
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {bookingOptions.consecutiveOption.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* یادداشت */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    یادداشت و دستور کار نصب (اختیاری)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="توضیحات خاص، مشخصات داربست یا طبقه..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#0D1117] border border-slate-700/80 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-[#C5A059] focus:outline-none transition resize-none"
                  />
                </div>

                {/* دکمه‌های فرم */}
                <div className="flex gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="submit"
                    className="flex-1 bg-[#C5A059] hover:bg-[#D4AF37] text-black font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-lg shadow-[#C5A059]/20 flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>ثبت قطعی پروژه و رزرو ظرفیت</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingDayModal(null)}
                    className="px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                  >
                    انصراف
                  </button>
                </div>
              </form>

              {/* پروژه‌های از قبل ثبت‌شده در این روز */}
              <div className="border-t border-slate-800 pt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>پروژه‌های ثبت‌شده در این تاریخ ({dayBookings.length} پروژه)</span>
                  </span>
                  <span className="text-slate-400 font-mono">
                    مجموع رزرو روز: {modalDayCap.bookedLaths} لت
                  </span>
                </div>

                {dayBookings.length === 0 ? (
                  <div className="text-[11px] text-slate-500 py-3 text-center bg-[#0D1117] rounded-xl border border-slate-800">
                    هنوز هیچ پروژه‌ای برای این تاریخ رزرو نشده است.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {dayBookings.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#0D1117] border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-700 transition"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{item.customerName}</span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded">
                              {item.lathsCount} لت
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                              {item.isSmart ? '⚡ هوشمند' : '🎛️ دستی'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-3">
                            <span>{item.customerPhone}</span>
                            <span>ثبت: {item.salesRepName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canEditBooking(item) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setBookingDayModal(null);
                                handleStartEdit(item);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>ویرایش</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 px-1">
                              <Lock className="w-3 h-3 text-slate-600" />
                              <span>فقط {item.salesRepName}</span>
                            </span>
                          )}

                          {isQcManager ? (
                            <button
                              type="button"
                              onClick={() => {
                                setBookingDayModal(null);
                                handleStartDelete(item);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 px-1">
                              <Lock className="w-3 h-3 text-slate-600" />
                              <span>حذف: فقط مدیر اپ و QC</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      تعداد کل لت‌ها (نامحدود)
                    </label>
                    <span className="text-[11px] text-[#C5A059] font-black">
                      {editLathsCount} لت
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {[5, 10, 15, 20, 30, 45, 60, 100, 115].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setEditLathsCount(val)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          editLathsCount === val
                            ? 'bg-[#C5A059] text-black shadow-xs font-black'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {val} لت
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={editLathsCount}
                      onChange={(e) =>
                        setEditLathsCount(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-20 bg-[#0D1117] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-black text-center text-white focus:border-[#C5A059] focus:outline-none"
                    />
                    <input
                      type="range"
                      min={1}
                      max={Math.max(150, editLathsCount)}
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
              عملیات انحصاری مدیر اپ و QC
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
