import React, { useState, useEffect, useMemo } from 'react';
import { Portal } from '../ui/Portal';
import {
  CalendarDays,
  PlusCircle,
  Zap,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  User as UserIcon,
  Award,
  Layers,
  Info,
  Clock,
  ShieldCheck,
  Pencil,
  Trash2,
  Lock,
  Search,
  X,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { User, SalesProjectBooking, SalesAllocationMode, DailyLathCapacity, ProposalImage } from '../../types';
import { ProductCountsInput } from './ProductCountsInput';
import { ProposalUploader } from './ProposalUploader';
import { type ProductCounts, formatProductCounts, capacityUnits, bookingProductCounts } from '../../utils/productCounts';
import {
  getSalesCapacity,
  getThreeMonthCapacities,
  getDailyCapacity,
  calculateBookingOptions,
  createSalesBooking,
  updateSalesBooking,
  deleteSalesBooking,
  getSalesRepLeaderboard,
  getStoredBookings,
  getSalesDayStatus,
} from '../../utils/salesCapacity';
import { getUpcomingDays } from '../../utils/jalali';
import { useEscapeKey } from '../../hooks/useEscapeKey';

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
  // ظرفیت (تعداد اکیپ × لت) طبق تنظیمات مدیر QC؛ با هر تغییر، رویداد بروزرسانی رزروها هم صادر می‌شود
  const capacity = useMemo(() => getSalesCapacity(), [bookings]);

  // مودال برنامه‌ریزی و ثبت پروژه برای روز کلیک‌شده در تقویم
  const [bookingDayModal, setBookingDayModal] = useState<DailyLathCapacity | null>(null);

  // استیت ویرایش پروژه
  const [editingBooking, setEditingBooking] = useState<SalesProjectBooking | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editProducts, setEditProducts] = useState<ProductCounts>({ shade: 0, rail: 0, curtain: 0 });
  const editLathsCount = capacityUnits(editProducts);
  const [editProposalImages, setEditProposalImages] = useState<ProposalImage[]>([]);
  const [editIsSmart, setEditIsSmart] = useState<boolean>(true);
  const [editNotes, setEditNotes] = useState('');
  const [editDateKey, setEditDateKey] = useState<string>('');
  const [editMode, setEditMode] = useState<SalesAllocationMode>('SPREAD_DAILY');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // استیت حذف پروژه (فقط مدیر QC)
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
  const [products, setProducts] = useState<ProductCounts>({ shade: 0, rail: 0, curtain: 0 });
  const lathsCount = capacityUnits(products);
  const [proposalImages, setProposalImages] = useState<ProposalImage[]>([]);
  const [proposalMissing, setProposalMissing] = useState(false);
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
  // 1. مدیرعامل و مدیر QC دسترسی مدیریتی کامل دارند (isFullAdmin).
  // 2. هر کارشناس فروش (یا هر نقش دیگری) صرفاً و منحصراً پروژه‌های ثبت‌شده توسط خودش را می‌تواند ویرایش کند.
  const canEditBooking = (b: SalesProjectBooking) => {
    if (isFullAdmin) return true;
    // with an owner id only the id counts; partial name matching let «علی» edit «علی رضایی»'s bookings
    if (b.salesRepId) return b.salesRepId === currentUser.id;
    // old bookings saved without an id: exact name only
    return Boolean(b.salesRepName && b.salesRepName.trim() === currentUser.name.trim());
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
    setEditProducts(bookingProductCounts(b));
    setEditProposalImages(b.proposalImages || []);
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
      setEditFormError('شماره تماس معتبر 10 یا 11 رقمی وارد نمایید.');
      return;
    }
    if (!editAddress.trim()) {
      setEditFormError('آدرس و لوکیشن پروژه الزامی است.');
      return;
    }
    if (editLathsCount <= 0) {
      setEditFormError('تعداد شید، ریل یا پرده را وارد کنید.');
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
      shadeCount: editProducts.shade,
      railCount: editProducts.rail,
      curtainCount: editProducts.curtain,
      proposalImages: editProposalImages,
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

  // دریافت ظرفیت‌های 3 ماهه
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
      setFormError('تعداد شید، ریل یا پرده را وارد کنید.');
      return;
    }
    if (proposalImages.length === 0) {
      setProposalMissing(true);
      setFormError('عکس پروپوزال یا برگه‌ی سفارش را اضافه کنید؛ نصاب و برنامه‌ریز از روی آن کار می‌کنند.');
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
      setFormError(chosenOption.description || 'حالت انتخابی به دلیل تکمیل ظرفیت اکیپ‌ها در این تاریخ در دسترس نیست.');
      return;
    }

    const selDay = upcomingDays.find((d) => d.dateKey === selectedDateKey);
    const jalaliDateStr = selDay?.persianDateStr || selectedDateKey;

    const newBooking = createSalesBooking({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      lathsCount,
      shadeCount: products.shade,
      railCount: products.rail,
      curtainCount: products.curtain,
      proposalImages,
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
    setProducts({ shade: 0, rail: 0, curtain: 0 });
    setProposalImages([]);
    setProposalMissing(false);
  };

  // تفکیک ماه‌ها در تقویم (3 ماه آینده با شروع قطعی از آذر)
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

  // آمار وضعیت روزهای ماه انتخاب شده
  const monthStats = useMemo(() => {
    if (!activeMonthGroup) return { full: 0, nearFull: 0, available: 0, total: 0 };
    let full = 0;
    let nearFull = 0;
    let available = 0;
    let closed = 0;
    for (const d of activeMonthGroup.days) {
      const st = getSalesDayStatus(d);
      if (st === 'CLOSED') closed++;
      else if (st === 'FULL') full++;
      else if (st === 'LIMITED') nearFull++;
      else available++;
    }
    return { full, nearFull, available, total: activeMonthGroup.days.length - closed };
  }, [activeMonthGroup]);

  // روزهای فیلترشده تقویم ماه
  const filteredCalendarDays = useMemo(() => {
    if (!activeMonthGroup) return [];
    if (calendarFilter === 'FULL') {
      return activeMonthGroup.days.filter((d) => getSalesDayStatus(d) === 'FULL');
    }
    if (calendarFilter === 'NEAR_FULL') {
      return activeMonthGroup.days.filter((d) => getSalesDayStatus(d) === 'LIMITED');
    }
    if (calendarFilter === 'AVAILABLE') {
      return activeMonthGroup.days.filter((d) => getSalesDayStatus(d) === 'FREE');
    }
    return activeMonthGroup.days;
  }, [activeMonthGroup, calendarFilter]);

  // 30 روز آینده با وضعیت ظرفیت برای فرم ثبت
  const upcoming30Days = useMemo(() => {
    return upcomingDays.slice(0, 30).map((day) => {
      const cap = getDailyCapacity(day.dateKey, bookings);
      const isFull = cap.remainingLaths <= 0;
      const isInsufficient = cap.remainingLaths < lathsCount;
      const isNearFull = getSalesDayStatus(cap) === 'LIMITED';
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

  // Escape closes the top-most window (the stack in useEscapeKey keeps nested ones apart)
  useEscapeKey(() => setBookingDayModal(null), Boolean(bookingDayModal));
  useEscapeKey(() => setEditingBooking(null), Boolean(editingBooking));
  useEscapeKey(() => setDeletingBooking(null), Boolean(deletingBooking));
  useEscapeKey(() => setJustBooked(null), Boolean(justBooked));

  return (
    <div className="space-y-6 dir-rtl text-right font-sans pb-16" dir="rtl">
      {/* سربرگ فشرده */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-ink">فروش و ظرفیت نصب</h1>
          <p className="text-xs text-ink-3 mt-0.5 tabular-nums">
            ظرفیت روزانه {capacity.dailyTotal} لت · {capacity.teamCount} اکیپ × {capacity.lathsPerTeam} لت
          </p>
        </div>
        <div role="tablist" className="flex items-center gap-1 p-1 rounded-xl bg-sunken border border-line">
          {(
            [
              { key: 'calendar' as const, label: 'تقویم ظرفیت', icon: CalendarDays, count: undefined },
              { key: 'all-bookings' as const, label: 'رزروها', icon: FileText, count: bookings.length },
            ]
          ).map((t) => {
            const Icon = t.icon;
            const selected = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  selected ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${selected ? 'text-brand-ink' : ''}`} />
                {t.label}
                {t.count !== undefined && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-raised text-ink-2 tabular-nums">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* مودال موفقیت پس از ثبت */}
      {justBooked && (
        <Portal><div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-brand rounded-2xl max-w-lg w-full p-6 text-right shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-ink text-center">
              پروژه با موفقیت ثبت و لت‌ها رزرو شدند!
            </h3>
            <p className="text-xs text-ink-2 text-center mt-1">
              ظرفیت به صورت خودکار در تقویم دیسپچ و نصاب‌ها کسر گردید.
            </p>

            <div className="bg-canvas border border-line rounded-xl p-4 my-5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-ink">
                <span className="text-ink-2">شناسه رزرو:</span>
                <span className="font-mono text-brand-soft">{justBooked.id}</span>
              </div>
              <div className="flex justify-between items-center text-ink">
                <span className="text-ink-2">نام مشتری:</span>
                <span className="font-bold text-ink">{justBooked.customerName}</span>
              </div>
              <div className="flex justify-between items-center text-ink">
                <span className="text-ink-2">محصولات:</span>
                <span className="font-bold text-emerald-400 text-sm">{formatProductCounts(bookingProductCounts(justBooked))}</span>
              </div>
              <div className="flex justify-between items-center text-ink">
                <span className="text-ink-2">نوع سیستم:</span>
                <span>{justBooked.isSmart ? '⚡ هوشمند و موتوردار' : '🎛️ دستی و مکانیکی'}</span>
              </div>
              <div className="flex justify-between items-center text-ink">
                <span className="text-ink-2">تاریخ نصب:</span>
                <span className="font-bold text-ink">{justBooked.jalaliDate}</span>
              </div>
              <div className="flex justify-between items-center text-ink">
                <span className="text-ink-2">حالت تخصیص:</span>
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
                className="flex-1 bg-brand hover:bg-brand-hover text-black font-black py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                متوجه شدم و بستن
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ================= تب 2: مدیریت و اصلاح پروژه‌ها (ویرایش برای همه، حذف فقط برای مدیر QC) ================= */}
      {activeTab === 'all-bookings' && (
        <div className="space-y-5">
          {/* نوار جستجو و فیلترها */}
          <div className="bg-sunken border border-line rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-ink" />
                  <span>مدیریت و اصلاح اطلاعات پروژه‌های رزرو شده</span>
                </h2>
                <p className="text-xs text-ink-2 mt-1">
                  هر کارشناس فقط مجاز به ویرایش پروژه‌های ثبت‌شده توسط خودش است |{' '}
                  <span className="text-amber-300 font-semibold">
                    حذف رزرو و آزادسازی ظرفیت فقط با مدیر QC
                  </span>
                </p>
              </div>

              {/* نشان اختیارات کاربر جاری */}
              <div className="flex items-center gap-2">
                {isQcManager ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>دسترسی مدیر QC: مجاز به ویرایش و حذف</span>
                  </span>
                ) : isCeo ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-raised/80 border border-line-strong text-ink">
                    <ShieldCheck className="w-3.5 h-3.5 text-ink-2" />
                    <span>دسترسی مدیرعامل: مجاز به ویرایش همه رزروها (حذف فقط با مدیر QC)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-raised/80 border border-line-strong text-ink">
                    <Lock className="w-3.5 h-3.5 text-ink-2" />
                    <span>دسترسی کارشناس: ویرایش رزروهای خودتان (حذف فقط با مدیر QC)</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-line/80">
              {/* کادر جستجو */}
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجو بر اساس نام مشتری، شماره تماس، آدرس یا نام کارشناس..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-canvas border border-line-strong/80 rounded-xl pr-9 pl-8 py-2 text-xs text-ink placeholder-ink-3 focus:border-brand focus:outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-2.5 text-ink-3 hover:text-ink p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* فیلتر کارشناس */}
              <div className="sm:col-span-3 flex items-center bg-canvas border border-line-strong/80 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setRepFilter('ALL')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    repFilter === 'ALL'
                      ? 'bg-brand text-black shadow-xs'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  همه ثبت‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setRepFilter('MINE')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    repFilter === 'MINE'
                      ? 'bg-brand text-black shadow-xs'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  پروژه‌های من
                </button>
              </div>

              {/* فیلتر سیستم */}
              <div className="sm:col-span-3 flex items-center bg-canvas border border-line-strong/80 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSystemFilter('ALL')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    systemFilter === 'ALL'
                      ? 'bg-hover text-ink'
                      : 'text-ink-2 hover:text-ink'
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
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  هوشمند
                </button>
                <button
                  type="button"
                  onClick={() => setSystemFilter('MANUAL')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    systemFilter === 'MANUAL'
                      ? 'bg-slate-600 text-ink'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  دستی
                </button>
              </div>
            </div>
          </div>

          {/* لیست کارت‌های پروژه‌ها */}
          {filteredBookings.length === 0 ? (
            <div className="bg-sunken border border-line rounded-2xl p-12 text-center text-ink-2 space-y-3">
              <FileText className="w-10 h-10 text-ink-3 mx-auto" />
              <p className="text-sm font-bold text-ink">پروژه‌ای با این مشخصات یافت نشد.</p>
              <p className="text-xs text-ink-3">
                می‌توانید عبارت جستجو را پاک کنید یا از تب «ثبت پروژه»، سفارش جدیدی ثبت نمایید.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 @min-[700px]:grid-cols-2 gap-4">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-sunken border border-line hover:border-line-strong/90 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col justify-between space-y-4 transition"
                >
                  <div className="space-y-3">
                    {/* ردیف بالا: نام و برچسب لت‌ها */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-ink text-sm sm:text-base">{b.customerName}</h3>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              b.isSmart
                                ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                                : 'bg-raised border border-line-strong text-ink'
                            }`}
                          >
                            {b.isSmart ? '⚡ هوشمند/موتوردار' : '🎛️ دستی/مکانیکی'}
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-3 font-mono mt-0.5 block">
                          شناسه: {b.id}
                        </span>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="inline-block bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl">
                          {formatProductCounts(bookingProductCounts(b)) || `${b.lathsCount} لت`}
                        </span>
                        {(b.proposalImages?.length ?? 0) > 0 && (
                          <span className="block text-[11px] text-ink-3 mt-1">📎 پروپوزال دارد</span>
                        )}
                      </div>
                    </div>

                    {/* جزئیات تماس و لوکیشن */}
                    <div className="space-y-1.5 text-xs text-ink bg-canvas border border-line/80 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-brand-ink shrink-0" />
                        <span className="font-mono text-ink">{b.customerPhone}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-brand-ink shrink-0 mt-0.5" />
                        <span className="text-ink leading-relaxed text-[12px]">{b.address}</span>
                      </div>
                      {b.notes && (
                        <div className="flex items-start gap-2 pt-1 border-t border-line text-[12px] text-ink-2">
                          <Info className="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" />
                          <span>{b.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* اطلاعات دیسپچ و زمان‌بندی */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-ink">
                        <CalendarDays className="w-4 h-4 text-brand-ink" />
                        <span className="font-bold text-ink">{b.jalaliDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[12px] text-ink-2">
                        <span>نحوه تخصیص:</span>
                        <span className="text-brand-soft font-semibold">
                          {b.allocationMode === 'SPREAD_DAILY' ? 'پخش همزمان اکیپ‌ها' : 'روزهای متوالی'}
                        </span>
                      </div>
                    </div>

                    {/* اکیپ‌های تخصیص‌یافته و کارشناس */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-[12px] text-ink-2 border-t border-line/80 pt-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-ink-3">اکیپ‌ها:</span>
                        {b.allocatedTeams.map((tId) => {
                          const t = capacity.teams.find((item) => item.id === tId);
                          return (
                            <span
                              key={tId}
                              className="bg-raised border border-line-strong/80 text-ink px-1.5 py-0.5 rounded text-[11px] font-semibold"
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

                  {/* نوار اکشن‌ها: ویرایش برای همه، حذف فقط برای مدیر QC */}
                  <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
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
                        className="flex-1 bg-surface/60 border border-line text-ink-3 font-medium py-2 rounded-xl text-[12px] flex items-center justify-center gap-1.5"
                        title={`ویرایش منحصراً توسط ثبت‌کننده (${b.salesRepName}) یا مدیریت مجاز است`}
                      >
                        <Lock className="w-3.5 h-3.5 text-ink-3" />
                        <span>فقط ثبت‌کننده ({b.salesRepName})</span>
                      </div>
                    )}

                    {isQcManager ? (
                      <button
                        type="button"
                        onClick={() => handleStartDelete(b)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        title="حذف و آزادسازی ظرفیت لت‌ها (فقط مدیر QC)"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden sm:inline">حذف پروژه</span>
                        <span className="sm:hidden">حذف</span>
                      </button>
                    ) : (
                      <div
                        className="px-2 py-1.5 text-ink-3 text-[11px] flex items-center gap-1 shrink-0"
                        title="حذف پروژه و آزادسازی ظرفیت منحصراً در پنل مدیر QC امکان‌پذیر است."
                      >
                        <Lock className="w-3 h-3 text-ink-3" />
                        <span className="hidden sm:inline">حذف: فقط مدیر QC</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= تب 1: تقویم زنده 3 ماهه ظرفیت و ثبت پروژه ================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* ماه و فیلتر وضعیت (یک ردیف) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-sunken border border-line">
              {monthGroups.map((group, idx) => (
                <button
                  key={group.monthName}
                  type="button"
                  onClick={() => {
                    setSelectedMonthOffset(idx);
                    setInspectDayKey(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedMonthOffset === idx ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {group.monthName}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[12px] font-bold">
              {(
                [
                  { key: 'ALL' as const, label: 'همه', count: monthStats.total, dot: '' },
                  { key: 'AVAILABLE' as const, label: 'آزاد', count: monthStats.available, dot: 'bg-emerald-500' },
                  { key: 'NEAR_FULL' as const, label: 'محدود', count: monthStats.nearFull, dot: 'bg-amber-400' },
                  { key: 'FULL' as const, label: 'پر', count: monthStats.full, dot: 'bg-rose-500' },
                ]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={calendarFilter === f.key}
                  onClick={() => setCalendarFilter(f.key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition cursor-pointer tabular-nums ${
                    calendarFilter === f.key ? 'bg-raised border-line-strong text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                  }`}
                >
                  {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
                  {f.label} {f.count}
                </button>
              ))}
            </div>
          </div>

          {/* شبکه فشرده روزها: هر خانه = روز + لت خالی؛ لمس = ثبت پروژه */}
          <div className="grid grid-cols-4 sm:grid-cols-5 @min-[700px]:grid-cols-7 gap-2">
            {filteredCalendarDays.map((dayCap) => {
              const status = getSalesDayStatus(dayCap);
              const isClosed = status === 'CLOSED';
              const isFull = status === 'FULL';
              const isNearFull = status === 'LIMITED';
              const isSelected = inspectDayKey === dayCap.date;
              const pct = Math.min(100, (dayCap.bookedLaths / Math.max(1, dayCap.maxLaths)) * 100);
              const tone = isFull ? 'text-rose-400' : isNearFull ? 'text-amber-400' : 'text-emerald-400';
              const bar = isFull ? 'bg-rose-500' : isNearFull ? 'bg-amber-400' : 'bg-emerald-500';
              return (
                <button
                  key={dayCap.date}
                  type="button"
                  onClick={() => handleOpenDayModal(dayCap)}
                  disabled={isClosed}
                  aria-label={
                    isClosed
                      ? `${dayCap.dayName} ${dayCap.jalaliDate}: تعطیل`
                      : `${dayCap.dayName} ${dayCap.jalaliDate}: ${dayCap.remainingLaths} لت خالی`
                  }
                  className={`text-right rounded-xl border p-2 transition cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    isClosed
                      ? 'border-dashed border-line bg-sunken opacity-60'
                      : isSelected
                      ? 'border-brand ring-2 ring-brand bg-raised'
                      : isFull
                      ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/70'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-base font-black text-ink tabular-nums leading-none">
                      {dayCap.jalaliDate.split('/')[2]}
                    </span>
                    <span className="text-[11px] text-ink-3 truncate">{dayCap.dayName}</span>
                  </div>
                  <div className={`mt-2 text-xs font-black tabular-nums ${isClosed ? 'text-ink-3' : tone}`}>
                    {isClosed ? 'تعطیل' : isFull ? 'پر' : `${dayCap.remainingLaths} لت`}
                  </div>
                  <div className="mt-1.5 w-full bg-raised h-1 rounded-full overflow-hidden">
                    {!isClosed && <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />}
                  </div>
                </button>
              );
            })}

            {filteredCalendarDays.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-ink-2 rounded-xl border border-dashed border-line">
                روزی با این وضعیت در این ماه وجود ندارد.
              </div>
            )}
          </div>

          {/* رتبه‌بندی ماه (فشرده) */}
          <section className="rounded-xl bg-surface border border-line p-4" aria-label="رتبه‌بندی فروش ماه">
            <h2 className="text-sm font-black text-ink flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-brand-ink" />
              رتبه‌بندی فروش این ماه
            </h2>
            {leaderboard.length === 0 ? (
              <p className="text-xs text-ink-3">هنوز رزروی در این ماه ثبت نشده است.</p>
            ) : (
              <ol className="space-y-1.5">
                {leaderboard.slice(0, 5).map((rep, idx) => (
                  <li
                    key={rep.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg ${
                      rep.id === currentUser.id ? 'bg-brand/10 border border-brand/30' : 'bg-sunken'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 ${
                          idx === 0 ? 'bg-brand text-on-brand' : 'bg-raised text-ink-2'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm font-bold text-ink truncate">{rep.name}</span>
                    </span>
                    <span className="text-[12px] text-ink-2 tabular-nums shrink-0">
                      {rep.monthlyProjectsCount} پروژه · {rep.monthlyLathsCount} لت
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {/* ================= مودال برنامه‌ریزی و ثبت پروژه برای روز انتخابی تقویم ================= */}
      {bookingDayModal && (() => {
        const modalDayCap = getDailyCapacity(bookingDayModal.date, bookings);
        const dayBookings = bookings.filter((b) => b.requestedDate === bookingDayModal.date);
        const isFull = modalDayCap.remainingLaths <= 0;

        return (
          <Portal><div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex justify-center items-start p-3 sm:p-4 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="bg-sunken border border-brand rounded-2xl max-w-3xl w-full p-5 sm:p-6 text-right shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 space-y-5">
              {/* هدر مودال */}
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/20 border border-brand flex items-center justify-center text-brand-soft">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-ink">
                        برنامه‌ریزی و ثبت پروژه جدید
                      </h3>
                      <span className="text-xs bg-brand/20 text-brand-soft px-2.5 py-0.5 rounded-full font-bold">
                        {modalDayCap.dayName} {modalDayCap.jalaliDate}
                      </span>
                    </div>
                    <p className="text-xs text-ink-2 mt-0.5">
                      تخصیص خودکار بین {capacity.teamCount} اکیپ · سقف روزانه {capacity.dailyTotal} لت
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingDayModal(null)}
                  className="text-ink-2 hover:text-ink p-1 rounded-lg hover:bg-raised transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* وضعیت ظرفیت 2 اکیپ در این روز */}
              <div className="bg-canvas border border-line rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">
                    ظرفیت آزاد این روز:
                  </span>
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                      isFull
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {modalDayCap.remainingLaths} لت آزاد از {modalDayCap.maxLaths} لت
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {modalDayCap.teams.map((t) => {
                    const free = t.maxLaths - t.bookedLaths;
                    return (
                      <div
                        key={t.teamId}
                        className="bg-sunken border border-line rounded-lg p-2 text-right"
                      >
                        <div className="flex justify-between items-center text-[12px] font-bold text-ink mb-1">
                          <span>{t.teamName}</span>
                          <span className={free > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {free} لت
                          </span>
                        </div>
                        <div className="w-full bg-raised h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${free > 0 ? 'bg-brand' : 'bg-rose-500'}`}
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
                    <label className="block text-xs font-semibold text-ink mb-1">
                      نام و نام‌خانوادگی مشتری <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
                      <input
                        type="text"
                        placeholder="مثال: آقای مهندس صادقی"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-canvas border border-line-strong/80 rounded-xl pr-9 pl-3 py-2 text-xs text-ink placeholder-ink-3 focus:border-brand focus:outline-none transition"
                      />
                    </div>
                  </div>

                  {/* شماره تماس */}
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      شماره تماس مشتری <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
                      <input
                        type="text"
                        placeholder="0912..."
                        dir="ltr"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-canvas border border-line-strong/80 rounded-xl pr-9 pl-3 py-2 text-xs text-ink placeholder-ink-3 focus:border-brand focus:outline-none transition text-right"
                      />
                    </div>
                  </div>
                </div>

                {/* آدرس */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    آدرس و لوکیشن پروژه <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
                    <input
                      type="text"
                      placeholder="مثال: نیاوران، خیابان یاسر، پلاک 12، زنگ 4"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-canvas border border-line-strong/80 rounded-xl pr-9 pl-3 py-2 text-xs text-ink placeholder-ink-3 focus:border-brand focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* محصولات: شید، ریل، پرده */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    محصولات سفارش <span className="text-rose-400">*</span>
                  </label>
                  <ProductCountsInput value={products} onChange={setProducts} />
                </div>

                <ProposalUploader
                  images={proposalImages}
                  onChange={(imgs) => {
                    setProposalImages(imgs);
                    if (imgs.length) setProposalMissing(false);
                  }}
                  required
                  error={proposalMissing}
                />

                <div className="grid grid-cols-1 gap-4">
                  {/* نوع سیستم */}
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      مکانیزم حرکت لت‌ها
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-canvas border border-line-strong/80 rounded-xl p-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setIsSmart(true)}
                        className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          isSmart
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-ink-2 hover:text-ink'
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
                            ? 'bg-hover text-ink shadow-xs'
                            : 'text-ink-2 hover:text-ink'
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
                    <label className="block text-xs font-semibold text-ink">
                      شیوه تخصیص اکیپ‌ها:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* گزینه 1: پخش در روز */}
                      <div
                        onClick={() =>
                          bookingOptions.spreadOption.isAvailable &&
                          setSelectedMode('SPREAD_DAILY')
                        }
                        className={`border rounded-xl p-3 text-xs transition cursor-pointer relative ${
                          selectedMode === 'SPREAD_DAILY'
                            ? 'border-brand bg-brand/10 text-white ring-1 ring-brand'
                            : !bookingOptions.spreadOption.isAvailable
                            ? 'opacity-40 border-line bg-surface/40 cursor-not-allowed'
                            : 'border-line bg-canvas text-ink hover:border-line-strong'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-brand-ink" />
                            <span>{bookingOptions.spreadOption.title}</span>
                          </span>
                          {bookingOptions.spreadOption.isAvailable ? (
                            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                              قابل رزرو
                            </span>
                          ) : (
                            <span className="text-[11px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                              ظرفیت پر
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-ink-2 leading-relaxed">
                          {bookingOptions.spreadOption.description}
                        </p>
                      </div>

                      {/* گزینه 2: رزرو متوالی یک اکیپ */}
                      <div
                        onClick={() =>
                          bookingOptions.consecutiveOption.isAvailable &&
                          setSelectedMode('CONSECUTIVE_DAYS')
                        }
                        className={`border rounded-xl p-3 text-xs transition cursor-pointer relative ${
                          selectedMode === 'CONSECUTIVE_DAYS'
                            ? 'border-brand bg-brand/10 text-white ring-1 ring-brand'
                            : !bookingOptions.consecutiveOption.isAvailable
                            ? 'opacity-40 border-line bg-surface/40 cursor-not-allowed'
                            : 'border-line bg-canvas text-ink hover:border-line-strong'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-brand-ink" />
                            <span>{bookingOptions.consecutiveOption.title}</span>
                          </span>
                          {bookingOptions.consecutiveOption.isAvailable ? (
                            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                              قابل رزرو
                            </span>
                          ) : (
                            <span className="text-[11px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                              ظرفیت پر
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-ink-2 leading-relaxed">
                          {bookingOptions.consecutiveOption.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* یادداشت */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    یادداشت و دستور کار نصب (اختیاری)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="توضیحات خاص، مشخصات داربست یا طبقه..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-canvas border border-line-strong/80 rounded-xl p-2.5 text-xs text-ink placeholder-ink-3 focus:border-brand focus:outline-none transition resize-none"
                  />
                </div>

                {/* دکمه‌های فرم */}
                <div className="flex gap-2.5 pt-2 border-t border-line">
                  <button
                    type="submit"
                    className="flex-1 bg-brand hover:bg-brand-hover text-black font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-lg shadow-brand/20 flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>ثبت قطعی پروژه و رزرو ظرفیت</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingDayModal(null)}
                    className="px-5 bg-raised hover:bg-hover text-ink font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                  >
                    انصراف
                  </button>
                </div>
              </form>

              {/* پروژه‌های از قبل ثبت‌شده در این روز */}
              <div className="border-t border-line pt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-ink" />
                    <span>پروژه‌های ثبت‌شده در این تاریخ ({dayBookings.length} پروژه)</span>
                  </span>
                  <span className="text-ink-2 font-mono">
                    مجموع رزرو روز: {modalDayCap.bookedLaths} لت
                  </span>
                </div>

                {dayBookings.length === 0 ? (
                  <div className="text-[12px] text-ink-3 py-3 text-center bg-canvas rounded-xl border border-line">
                    هنوز هیچ پروژه‌ای برای این تاریخ رزرو نشده است.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {dayBookings.map((item) => (
                      <div
                        key={item.id}
                        className="bg-canvas border border-line rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-line-strong transition"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink text-xs">{item.customerName}</span>
                            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded">
                              {item.lathsCount} لت
                            </span>
                            <span className="text-[11px] text-ink-2 bg-raised px-1.5 py-0.2 rounded">
                              {item.isSmart ? '⚡ هوشمند' : '🎛️ دستی'}
                            </span>
                          </div>
                          <div className="text-[12px] text-ink-2 flex items-center gap-3">
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
                            <span className="text-[11px] text-ink-3 flex items-center gap-1 px-1">
                              <Lock className="w-3 h-3 text-ink-3" />
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
                            <span className="text-[11px] text-ink-3 flex items-center gap-1 px-1">
                              <Lock className="w-3 h-3 text-ink-3" />
                              <span>حذف: فقط مدیر QC</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div></Portal>
        );
      })()}
{/* ================= مودال ویرایش اطلاعات و تاریخ پروژه ================= */}
      {editingBooking && (
        <Portal><div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-start p-3 sm:p-4 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-sunken border border-brand rounded-2xl max-w-2xl w-full p-5 sm:p-6 text-right shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* هدر مودال */}
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-brand-ink" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-ink">
                    ویرایش اطلاعات و تاریخ پروژه
                  </h3>
                  <span className="text-[12px] text-ink-2">
                    شناسه رزرو: <span className="font-mono text-brand-soft">{editingBooking.id}</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="text-ink-2 hover:text-ink p-1 rounded-lg hover:bg-raised transition cursor-pointer"
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
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    نام و نام‌خانوادگی مشتری <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      className="w-full bg-canvas border border-line-strong/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-ink focus:border-brand focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* شماره تماس */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    شماره تماس مشتری <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
                    <input
                      type="text"
                      dir="ltr"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      className="w-full bg-canvas border border-line-strong/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-ink focus:border-brand focus:outline-none transition text-right"
                    />
                  </div>
                </div>
              </div>

              {/* آدرس پروژه */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  آدرس و لوکیشن پروژه <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full bg-canvas border border-line-strong/80 rounded-xl pr-9 pl-3 py-2.5 text-xs text-ink focus:border-brand focus:outline-none transition"
                  />
                </div>
              </div>

              {/* محصولات و پروپوزال */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">محصولات سفارش</label>
                <ProductCountsInput value={editProducts} onChange={setEditProducts} />
              </div>
              <ProposalUploader images={editProposalImages} onChange={setEditProposalImages} />

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    مکانیزم حرکت
                  </label>
                  <div className="flex items-center gap-2 bg-canvas border border-line-strong/80 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setEditIsSmart(true)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        editIsSmart ? 'bg-blue-600 text-white shadow-xs' : 'text-ink-2 hover:text-white'
                      }`}
                    >
                      ⚡ هوشمند/موتوردار
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditIsSmart(false)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        !editIsSmart ? 'bg-hover text-ink shadow-xs' : 'text-ink-2 hover:text-ink'
                      }`}
                    >
                      🎛️ دستی/مکانیکی
                    </button>
                  </div>
                </div>
              </div>

              {/* انتخابگر تاریخ نصب با کسر رزرو فعلی */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  تاریخ نصب درخواستی (با کسر خودکار ظرفیت قبلی همین پروژه)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 border border-line rounded-xl bg-canvas">
                  {upcomingDays.slice(0, 30).map((day) => {
                    const cap = getDailyCapacity(day.dateKey, bookings, editingBooking.id);
                    const isSelected = editDateKey === day.dateKey;
                    const isFull = cap.remainingLaths <= 0;
                    const isInsufficient = cap.remainingLaths < editLathsCount;
                    if (cap.isClosed) return null;

                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => setEditDateKey(day.dateKey)}
                        className={`p-2 rounded-lg text-right transition border cursor-pointer ${
                          isSelected
                            ? 'bg-brand text-black border-brand font-bold shadow-md'
                            : isFull || isInsufficient
                            ? 'bg-rose-950/20 border-rose-800/40 text-rose-300/80 hover:bg-rose-950/40'
                            : 'bg-surface border-line text-ink hover:border-line-strong'
                        }`}
                      >
                        <div className="text-[12px] font-bold">{day.persianDayName}</div>
                        <div className="text-[11px] font-mono">{day.persianDateStr}</div>
                        <div className="text-[10px] mt-0.5">
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
                  <label className="block text-xs font-semibold text-ink">
                    نحوه تخصیص اکیپ‌ها:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div
                      onClick={() =>
                        editBookingOptions.spreadOption.isAvailable && setEditMode('SPREAD_DAILY')
                      }
                      className={`border rounded-xl p-3 text-xs transition cursor-pointer ${
                        editMode === 'SPREAD_DAILY'
                          ? 'border-brand bg-brand/10 text-white ring-1 ring-brand'
                          : !editBookingOptions.spreadOption.isAvailable
                          ? 'opacity-40 border-line bg-surface/50 cursor-not-allowed'
                          : 'border-line bg-canvas text-ink hover:border-line-strong'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between mb-1">
                        <span>{editBookingOptions.spreadOption.title}</span>
                        {editBookingOptions.spreadOption.isAvailable ? (
                          <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                            قابل رزرو
                          </span>
                        ) : (
                          <span className="text-[11px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                            ظرفیت پر
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-ink-2">
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
                          ? 'border-brand bg-brand/10 text-white ring-1 ring-brand'
                          : !editBookingOptions.consecutiveOption.isAvailable
                          ? 'opacity-40 border-line bg-surface/50 cursor-not-allowed'
                          : 'border-line bg-canvas text-ink hover:border-line-strong'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between mb-1">
                        <span>{editBookingOptions.consecutiveOption.title}</span>
                        {editBookingOptions.consecutiveOption.isAvailable ? (
                          <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                            قابل رزرو
                          </span>
                        ) : (
                          <span className="text-[11px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                            ظرفیت پر
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-ink-2">
                        {editBookingOptions.consecutiveOption.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* یادداشت‌ها */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  یادداشت و دستور کار نصب
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-canvas border border-line-strong/80 rounded-xl p-2.5 text-xs text-ink focus:border-brand focus:outline-none transition resize-none"
                />
              </div>

              {/* دکمه‌های تایید و انصراف */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-brand hover:bg-brand-hover text-black font-black py-2.5 rounded-xl transition cursor-pointer text-xs"
                >
                  ذخیره تغییرات و به‌روزرسانی تقویم
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-5 bg-raised hover:bg-hover text-ink font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}

      {/* ================= مودال تایید حذف رزرو (فقط مدیر QC) ================= */}
      {deletingBooking && (
        <Portal><div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-rose-600/80 rounded-2xl max-w-md w-full p-6 text-right shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-ink text-center">
              آیا از حذف این رزرو اطمینان دارید؟
            </h3>
            <p className="text-xs text-amber-300 font-semibold text-center mt-1">
              عملیات انحصاری مدیر QC
            </p>

            <div className="bg-canvas border border-line rounded-xl p-3.5 my-4 space-y-2 text-xs">
              <div className="flex justify-between text-ink">
                <span className="text-ink-2">نام مشتری:</span>
                <span className="font-bold text-ink">{deletingBooking.customerName}</span>
              </div>
              <div className="flex justify-between text-ink">
                <span className="text-ink-2">تاریخ نصب:</span>
                <span className="font-bold text-ink">{deletingBooking.jalaliDate}</span>
              </div>
              <div className="flex justify-between text-ink">
                <span className="text-ink-2">تعداد لت‌ها:</span>
                <span className="font-bold text-emerald-400">{deletingBooking.lathsCount} لت</span>
              </div>
              <div className="flex justify-between text-ink">
                <span className="text-ink-2">کارشناس ثبت‌کننده:</span>
                <span className="text-ink">{deletingBooking.salesRepName}</span>
              </div>
            </div>

            <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 text-[12px] text-rose-200 leading-relaxed mb-5">
              با حذف این پروژه، ظرفیت <strong className="text-ink">{deletingBooking.lathsCount} لت</strong> بلافاصله در تقویم دیسپچ و اکیپ‌های نصب آزاد خواهد شد.
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
                className="px-5 bg-raised hover:bg-hover text-ink font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                انصراف
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* پیام فلوتینگ موفقیت */}
      {successToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-surface border border-emerald-500/80 text-emerald-100 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="mr-2 text-ink-2 hover:text-ink p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
