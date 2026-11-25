import React, { useState, useMemo, useEffect } from 'react';
import { Portal } from '../ui/Portal';
import { formatProductCounts, projectProductCounts } from '../../utils/productCounts';
import { Project, Ticket, User } from '../../types';
import {
  Package,
  CheckCircle2,
  Send,
  AlertTriangle,
  Layers,
  Wrench,
  Search,
  Phone,
  MapPin,
  Loader2,
  X,
  Truck,
  ArrowDownToLine,
  Eye,
  RotateCcw,
  Pencil,
  Inbox,
} from 'lucide-react';
import {
  toPersianDigits,
  getUpcomingDays,
  formatJalali,
  formatJalaliDateTime,
} from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { getUpcomingDispatchProjects, needsWarehouseReceipt, relativeDayLabel, DISPATCH_HORIZON_DAYS } from '../../utils/warehouseLists';

interface Props {
  currentUser: User;
  projects: Project[];
  tickets: Ticket[];
  onConfirmPacking: (projectId: string, notes?: string) => Promise<void>;
  onResolveTicket: (
    ticketId: string,
    action: 'SUPPLIED' | 'DISPATCHED_COURIER' | 'DELAYED',
    payload?: {
      courierInfo?: string;
      trackingCode?: string;
      delayReason?: string;
      estimatedAvailableDate?: string;
    }
  ) => Promise<void>;
  onConfirmGoodsReceipt?: (
    projectId: string,
    params: {
      confirmed: boolean;
      notes?: string;
      shelfLocation?: string;
    }
  ) => Promise<void>;
  onViewProposal?: (project: Project) => void;
  onOpenTicketModal?: (project: Project) => void;
  initialTab?: 'GOODS_RECEIPT' | 'PACKING' | 'TICKETS';
  /** داخل «انبار و متریال»: سربرگ و تب‌های داخلی تکراری نمایش داده نمی‌شوند */
  embedded?: boolean;
}

export const WarehouseDesk: React.FC<Props> = ({
  currentUser,
  projects,
  tickets,
  onConfirmPacking,
  onResolveTicket,
  onConfirmGoodsReceipt,
  onViewProposal,
  onOpenTicketModal,
  initialTab,
  embedded = false,
}) => {
  // Main view tabs: GOODS_RECEIPT (Default), PACKING, TICKETS
  const [activeTab, setActiveTab] = useState<'GOODS_RECEIPT' | 'PACKING' | 'TICKETS'>(
    initialTab || 'GOODS_RECEIPT'
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Search & Filters for Incoming Goods Pipeline
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [receiptFilterStatus, setReceiptFilterStatus] = useState<'ALL' | 'PENDING' | 'RECEIVED'>('PENDING');

  // Goods Receipt Modal states
  const [receiptModalProject, setReceiptModalProject] = useState<Project | null>(null);
  const [receiptShelfLocation, setReceiptShelfLocation] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptCheckItemsMatch, setReceiptCheckItemsMatch] = useState(true);
  const [receiptCheckQuality, setReceiptCheckQuality] = useState(true);
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Revoke Receipt Modal states
  const [revokeModalProject, setRevokeModalProject] = useState<Project | null>(null);
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState(false);

  // Pre-dispatch packing states
  const [packingNotes, setPackingNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Ticket resolution modal states
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [actionType, setActionType] = useState<'SUPPLIED' | 'DISPATCHED_COURIER' | 'DELAYED'>('SUPPLIED');
  const [courierInfo, setCourierInfo] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketError, setTicketError] = useState('');

  // Dates
  const todayKey = useMemo(() => getUpcomingDays(7)[0]?.dateKey || '', []);

  // 1. Incoming goods pipeline projects (active projects awaiting receipt or in progress)
  const incomingGoodsProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        needsWarehouseReceipt(p) ||
        (p.status !== 'COMPLETED' &&
          p.status !== 'CANCELLED' &&
          Boolean(p.technicalHandover?.warehouseConfirmation?.confirmed))
    );
  }, [projects]);

  // Statistics for Incoming Goods
  const pendingReceiptCount = useMemo(() => {
    return incomingGoodsProjects.filter(
      (p) => !p.technicalHandover?.warehouseConfirmation?.confirmed
    ).length;
  }, [incomingGoodsProjects]);

  const receivedCount = useMemo(() => {
    return incomingGoodsProjects.filter(
      (p) => Boolean(p.technicalHandover?.warehouseConfirmation?.confirmed)
    ).length;
  }, [incomingGoodsProjects]);

  // Filtered & sorted incoming projects
  const filteredIncomingProjects = useMemo(() => {
    let list = incomingGoodsProjects;
    if (receiptFilterStatus === 'PENDING') {
      list = list.filter((p) => !p.technicalHandover?.warehouseConfirmation?.confirmed);
    } else if (receiptFilterStatus === 'RECEIVED') {
      list = list.filter((p) => Boolean(p.technicalHandover?.warehouseConfirmation?.confirmed));
    }

    if (receiptSearchQuery.trim()) {
      const q = receiptSearchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.code || '').toLowerCase().includes(q) ||
          (p.title || '').toLowerCase().includes(q) ||
          (p.customerName || '').toLowerCase().includes(q) ||
          (p.customerPhone || '').toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q) ||
          (p.salesRepName || '').toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      // اول آن‌هایی که هنوز کالا ندارند، به ترتیب نزدیک‌ترین تاریخ نصب (بدون تاریخ آخر)
      const aRec = Boolean(a.technicalHandover?.warehouseConfirmation?.confirmed);
      const bRec = Boolean(b.technicalHandover?.warehouseConfirmation?.confirmed);
      if (!aRec && bRec) return -1;
      if (aRec && !bRec) return 1;
      const ad = a.scheduledDate || '9999';
      const bd = b.scheduledDate || '9999';
      if (ad !== bd) return ad.localeCompare(bd);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [incomingGoodsProjects, receiptFilterStatus, receiptSearchQuery]);

  // 2. Pre-dispatch packing projects
  const upcomingDispatchProjects = useMemo(() => {
    return getUpcomingDispatchProjects(projects, todayKey, DISPATCH_HORIZON_DAYS).sort((a, b) => {
      // بسته‌نشده‌ها اول
      const ap = a.warehousePrep?.isPackedAndReady ? 1 : 0;
      const bp = b.warehousePrep?.isPackedAndReady ? 1 : 0;
      return ap - bp || String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || ''));
    });
  }, [projects, todayKey]);

  // 3. Urgent warehouse tickets
  const warehouseTickets = useMemo(() => {
    return tickets
      .filter((t) => t.status === 'OPEN')
      .sort((a, b) => {
        const aDirect = a.assignedRole === 'WAREHOUSE' || Boolean(a.referralNote);
        const bDirect = b.assignedRole === 'WAREHOUSE' || Boolean(b.referralNote);
        if (aDirect && !bDirect) return -1;
        if (!aDirect && bDirect) return 1;
        if (a.isBlocking && !b.isBlocking) return -1;
        if (!a.isBlocking && b.isBlocking) return 1;
        return 0;
      });
  }, [tickets]);

  // Handlers for Goods Receipt
  const handleOpenReceiptModal = (project: Project) => {
    setReceiptModalProject(project);
    setReceiptShelfLocation(project.technicalHandover?.warehouseConfirmation?.shelfLocation || '');
    setReceiptNotes(project.technicalHandover?.warehouseConfirmation?.notes || '');
    setReceiptCheckItemsMatch(true);
    setReceiptCheckQuality(true);
    setReceiptError('');
  };

  const handleGoodsReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptModalProject || !onConfirmGoodsReceipt) return;

    if (!receiptCheckItemsMatch || !receiptCheckQuality) {
      setReceiptError('تأیید هر دو شرط تطابق اقلام و سلامت فیزیکی محموله جهت ورود به انبار الزامی است.');
      return;
    }

    setIsSubmittingReceipt(true);
    setReceiptError('');

    try {
      await onConfirmGoodsReceipt(receiptModalProject.id, {
        confirmed: true,
        shelfLocation: receiptShelfLocation.trim() || undefined,
        notes: receiptNotes.trim() || undefined,
      });
      setReceiptModalProject(null);
    } catch (err: any) {
      setReceiptError(err.message || 'خطا در ثبت تایید ورود کالا به انبار.');
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  const handleRevokeReceiptSubmit = async () => {
    if (!revokeModalProject || !onConfirmGoodsReceipt) return;

    setIsSubmittingRevoke(true);
    try {
      await onConfirmGoodsReceipt(revokeModalProject.id, {
        confirmed: false,
      });
      setRevokeModalProject(null);
    } catch (err: any) {
      console.error('Error revoking receipt:', err);
    } finally {
      setIsSubmittingRevoke(false);
    }
  };

  // Handlers for Packing
  const handlePackingSubmit = async (projectId: string) => {
    setProcessingId(projectId);
    try {
      await onConfirmPacking(projectId, packingNotes[projectId]);
    } finally {
      setProcessingId(null);
    }
  };

  // Handlers for Tickets
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (actionType === 'DISPATCHED_COURIER' && !courierInfo.trim()) {
      setTicketError('لطفاً مشخصات راننده یا پیک ارسال‌کننده را یادداشت نمایید.');
      return;
    }

    if (actionType === 'DELAYED') {
      if (!delayReason.trim()) {
        setTicketError('درج توضیحات علت عدم امکان تامین فوری الزامی است.');
        return;
      }
      if (!estimatedDate.trim()) {
        setTicketError('لطفاً زمان یا تاریخ تقریبی تامین قطعه را مشخص نمایید.');
        return;
      }
    }

    setIsSubmittingTicket(true);
    setTicketError('');

    try {
      await onResolveTicket(selectedTicket.id, actionType, {
        courierInfo: courierInfo.trim() || undefined,
        trackingCode: trackingCode.trim() || undefined,
        delayReason: delayReason.trim() || undefined,
        estimatedAvailableDate: estimatedDate.trim() || undefined,
      });

      setSelectedTicket(null);
      setCourierInfo('');
      setTrackingCode('');
      setDelayReason('');
      setEstimatedDate('');
    } catch (err: any) {
      setTicketError(err.message || 'خطا در ثبت پاسخ تیکت.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  useEscapeKey(() => setReceiptModalProject(null), Boolean(receiptModalProject));
  useEscapeKey(() => setRevokeModalProject(null), Boolean(revokeModalProject));
  useEscapeKey(() => setSelectedTicket(null), Boolean(selectedTicket));

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {/* Top Banner */}
      {!embedded && (
      <div className="bg-surface rounded-2xl p-5 border border-line flex flex-col @min-[900px]:flex-row items-start @min-[900px]:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-ink flex items-center gap-2">
            <span>میز کار انبار مرکزی و لجستیک گالری طلایی</span>
            <span className="text-xs font-bold bg-brand/15 text-brand-ink border border-brand/30 px-2.5 py-0.5 rounded-full">
              مسئول انبار: {getDisplayName(currentUser.name)}
            </span>
          </h2>
          <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
            مدیریت ورود فیزیکی کالا به انبار (مرجع انحصاری گیت تحویل فنی)، بسته‌بندی بارهای مأموریت‌های آتی و پاسخ فوری به تیکت‌های کسری کارگاه
          </p>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex items-center gap-1.5 bg-canvas p-1.5 rounded-xl border border-line w-full lg:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('GOODS_RECEIPT')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'GOODS_RECEIPT'
                ? 'bg-brand text-on-brand shadow-md'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>پیگیری ورود کالا و گیت انبار ({toPersianDigits(incomingGoodsProjects.length)})</span>
            {pendingReceiptCount > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500 text-on-brand font-mono font-bold animate-pulse">
                {pendingReceiptCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PACKING')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'PACKING'
                ? 'bg-brand text-on-brand shadow-md'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>بسته‌بندی بارهای فردا ({toPersianDigits(upcomingDispatchProjects.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TICKETS')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'TICKETS'
                ? 'bg-brand text-on-brand shadow-md'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>تیکت‌های فوری کسری ({toPersianDigits(warehouseTickets.length)})</span>
          </button>
        </div>
      </div>
      )}

      {/* ===================== TAB 1: INCOMING GOODS & TECHNICAL HANDOVER GATE ===================== */}
      {activeTab === 'GOODS_RECEIPT' && (
        <div className="space-y-5">
          {/* راهنمای یک‌خطی + فیلتر + جستجو */}
          <div className="bg-surface p-3 rounded-xl border border-line space-y-2.5">
            <p className="text-[12px] text-ink-2 leading-6">
              وقتی بار پروژه از کارخانه به انبار رسید، «تأیید ورود کالا» را بزنید؛ تا آن موقع اکیپ نمی‌تواند به محل نصب برود.
            </p>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { key: 'PENDING' as const, label: 'منتظر ورود', count: pendingReceiptCount, on: 'bg-amber-500 text-black' },
                  { key: 'RECEIVED' as const, label: 'در انبار', count: receivedCount, on: 'bg-emerald-600 text-white' },
                  { key: 'ALL' as const, label: 'همه', count: incomingGoodsProjects.length, on: 'bg-brand text-on-brand' },
                ]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={receiptFilterStatus === f.key}
                  onClick={() => setReceiptFilterStatus(f.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
                    receiptFilterStatus === f.key ? f.on : 'bg-canvas text-ink-2 hover:text-ink border border-line'
                  }`}
                >
                  {f.label} ({toPersianDigits(f.count)})
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={receiptSearchQuery}
                onChange={(e) => setReceiptSearchQuery(e.target.value)}
                placeholder="جستجو: کد، مشتری، تلفن یا آدرس"
                className="w-full text-sm pr-9 pl-3 py-2 rounded-lg border border-line bg-canvas text-ink placeholder-ink-3 focus:border-brand focus:outline-none min-h-[40px]"
              />
            </div>
          </div>

          {filteredIncomingProjects.length === 0 ? (
            <div className="bg-surface rounded-2xl p-10 text-center border border-line text-xs text-ink-2 space-y-2">
              <Inbox className="w-8 h-8 text-ink-3 mx-auto" />
              <p className="font-bold">
                {receiptFilterStatus === 'PENDING' && !receiptSearchQuery.trim()
                  ? 'همه‌ی بارها وارد انبار شده‌اند. کاری در صف نیست.'
                  : 'پروژه‌ای با این فیلتر پیدا نشد.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 @min-[900px]:grid-cols-2 gap-3">
              {filteredIncomingProjects.map((p) => {
                const wc = p.technicalHandover?.warehouseConfirmation;
                const whConfirmed = Boolean(wc?.confirmed);
                const day = relativeDayLabel(p.scheduledDate, todayKey);
                const dayTone =
                  whConfirmed
                    ? 'bg-canvas text-ink-2 border-line'
                    : day.tone === 'late' || day.tone === 'soon'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                      : day.tone === 'near'
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40'
                        : 'bg-canvas text-ink-2 border-line';
                const products = formatProductCounts(projectProductCounts(p));

                return (
                  <div
                    key={p.id}
                    className={`bg-surface rounded-xl p-4 border space-y-3 ${
                      whConfirmed ? 'border-emerald-500/40' : 'border-line'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line-strong px-2 py-0.5 rounded">
                            {p.code || 'بدون کد'}
                          </span>
                          <h3 className="font-black text-sm text-ink">{p.title}</h3>
                        </div>
                        {p.customerName && p.customerName !== p.title && (
                          <p className="text-xs text-ink-2 mt-1">{p.customerName}</p>
                        )}
                      </div>
                      <span className={`text-[12px] font-bold px-2 py-1 rounded-md border shrink-0 text-center ${dayTone}`}>
                        {p.scheduledDate ? (
                          <>
                            نصب {day.text ? `${day.text} · ` : ''}
                            {formatJalali(p.scheduledDate)}
                          </>
                        ) : (
                          'بدون تاریخ نصب'
                        )}
                      </span>
                    </div>

                    <div className="text-xs text-ink-2 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-ink">
                        <Layers className="w-3.5 h-3.5 text-brand-ink shrink-0" />
                        <span>{products || 'مقادیر ثبت نشده'}</span>
                        {p.mechanismType && <span className="font-normal text-ink-3 truncate">· {p.mechanismType}</span>}
                      </div>
                      {p.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                          <span className="truncate">{p.address}</span>
                        </div>
                      )}
                      {p.salesRepName && <div className="text-[12px] text-ink-3">فروش: {p.salesRepName}</div>}
                    </div>

                    {whConfirmed && (
                      <div className="text-[12px] text-emerald-800 dark:text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2.5 py-1.5">
                        ✓ در انبار از {formatJalali(wc?.confirmedAt)}
                        {wc?.shelfLocation ? ` · قفسه ${wc.shelfLocation}` : ''}
                        {wc?.notes ? ` · ${wc.notes}` : ''}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {!whConfirmed ? (
                        <button
                          type="button"
                          onClick={() => handleOpenReceiptModal(p)}
                          className="flex-1 min-h-[42px] rounded-lg bg-brand hover:bg-brand-hover text-on-brand font-black text-xs transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          <span>تأیید ورود کالا</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenReceiptModal(p)}
                            className="flex-1 min-h-[40px] rounded-lg bg-canvas hover:bg-raised text-brand-ink border border-brand/40 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>ویرایش رسید</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevokeModalProject(p)}
                            className="min-h-[40px] px-3 rounded-lg bg-canvas hover:bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-line text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="لغو تأیید در صورت ثبت اشتباه"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>لغو</span>
                          </button>
                        </>
                      )}
                      {p.proposalImages && p.proposalImages.length > 0 && onViewProposal && (
                        <button
                          type="button"
                          onClick={() => onViewProposal(p)}
                          className="min-h-[40px] px-3 rounded-lg bg-canvas hover:bg-raised text-ink-2 hover:text-ink border border-line text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          aria-label="پروپوزال"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>پروپوزال</span>
                        </button>
                      )}
                      {onOpenTicketModal && (
                        <button
                          type="button"
                          onClick={() => onOpenTicketModal(p)}
                          className="min-h-[40px] px-3 rounded-lg bg-canvas hover:bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="نقص، مغایرت یا کسری در محموله"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>نقص</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: PRE-DISPATCH PACKING ===================== */}
      {activeTab === 'PACKING' && (
        <div className="space-y-4">
          <div className="bg-sunken p-4 rounded-xl border border-brand/20 text-xs text-ink-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
            <span>
              بار کارهای امروز تا پس‌فردا. بعد از بستن هر بار «بار آماده است» را بزنید تا در تقویم مدیر علامت ✅ بخورد.
            </span>
          </div>

          {upcomingDispatchProjects.length === 0 ? (
            <div className="bg-surface rounded-2xl p-10 text-center border border-line text-xs text-ink-2">
              برای امروز تا پس‌فردا باری در صف نیست.
            </div>
          ) : (
            <div className="grid grid-cols-1 @min-[700px]:grid-cols-2 gap-4">
              {upcomingDispatchProjects.map((p) => {
                const isPacked = Boolean(p.warehousePrep?.isPackedAndReady);
                const isBusy = processingId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`bg-surface rounded-xl p-4 border transition space-y-3 ${
                      isPacked
                        ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : p.isForceMajeure
                        ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                        : 'border-line'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line-strong px-2 py-0.5 rounded">
                            {p.code}
                          </span>
                          <h3 className="font-black text-sm text-ink">{p.title}</h3>
                        </div>
                        {p.customerName && p.customerName !== p.title && (
                          <p className="text-xs text-ink-2 mt-1">{p.customerName}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {(() => {
                          const day = relativeDayLabel(p.scheduledDate, todayKey);
                          const tone =
                            isPacked
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : day.tone === 'late' || day.tone === 'soon'
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                                : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40';
                          return (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${tone}`}>
                              {day.text || 'اعزام'} · {formatJalali(p.scheduledDate)}
                            </span>
                          );
                        })()}
                        {p.isForceMajeure && (
                          <span className="text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
                            فورس ماژور
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-ink-2 space-y-1 bg-sunken p-3 rounded-xl border border-line">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-brand-ink shrink-0" />
                        <span className="truncate">{p.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-brand-ink shrink-0" />
                        <span className="tabular-nums font-mono">{p.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-line text-[12px] text-brand-ink">
                        <Layers className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {formatProductCounts(projectProductCounts(p)) || '—'}
                        </span>
                        {p.mechanismType && <span className="mr-1">({p.mechanismType})</span>}
                      </div>
                    </div>

                    {/* Tools required */}
                    {p.toolsRequired && p.toolsRequired.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[12px] font-bold text-ink-2 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-brand-ink" />
                          <span>ابزارهای الزامی این مأموریت:</span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {p.toolsRequired.slice(0, 4).map((t, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded bg-canvas text-ink-2 border border-line"
                            >
                              {t}
                            </span>
                          ))}
                          {p.toolsRequired.length > 4 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-canvas text-ink-3">
                              +{toPersianDigits(p.toolsRequired.length - 4)} ابزار دیگر
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Packing Status & Note Input */}
                    <div className="pt-2 border-t border-line space-y-3">
                      {isPacked ? (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>بار آماده و بسته‌بندی شد ✅</span>
                            </span>
                            <span className="text-[12px] text-emerald-300 tabular-nums">
                              {p.warehousePrep?.packedAt
                                ? formatJalaliDateTime(p.warehousePrep.packedAt)
                                : 'ثبت شده'}
                            </span>
                          </div>
                          {(p.warehousePrep?.packedByUserName || (p.warehousePrep as any)?.packedBy) && (
                            <p className="text-[12px] text-emerald-300/80">
                              توسط: {p.warehousePrep?.packedByUserName || (p.warehousePrep as any)?.packedBy}
                            </p>
                          )}
                          {(p.warehousePrep?.notes || (p.warehousePrep as any)?.packingNotes) && (
                            <p className="text-[12px] text-ink mt-1 bg-canvas/60 p-2 rounded border border-emerald-500/20">
                              یادداشت انبار: {p.warehousePrep?.notes || (p.warehousePrep as any)?.packingNotes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={packingNotes[p.id] || ''}
                            onChange={(e) =>
                              setPackingNotes({ ...packingNotes, [p.id]: e.target.value })
                            }
                            placeholder="یادداشت بار (اختیاری)، مثلاً: ۳ کارتن + ریل جدا"
                            className="w-full text-sm p-2.5 rounded-xl border border-line bg-canvas text-ink placeholder-ink-3 focus:border-brand focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePackingSubmit(p.id)}
                            className="w-full py-2.5 rounded-xl font-black text-xs bg-brand hover:bg-brand-hover text-on-brand flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Package className="w-4 h-4" />
                            )}
                            <span>بار آماده است</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 3: URGENT SITE SHORTAGE TICKETS ===================== */}
      {activeTab === 'TICKETS' && (
        <div className="space-y-4">
          <div className="bg-sunken p-4 rounded-xl border border-rose-500/20 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              تیکت‌های زیر مربوط به نصابان سر پروژه است که با کسری قطعه، ریل یا پیچ و یراق مواجه شده‌اند. لطفاً سریعاً پاسخ مناسب را انتخاب فرمایید.
            </span>
          </div>

          {warehouseTickets.length === 0 ? (
            <div className="bg-surface rounded-2xl p-10 text-center border border-line text-xs text-ink-2">
              هیچ تیکت بازی در کارتابل انبار وجود ندارد. تمام پروژه‌ها در وضعیت تامین پایدار هستند.
            </div>
          ) : (
            <div className="grid grid-cols-1 @min-[700px]:grid-cols-2 gap-4">
              {warehouseTickets.map((t) => {
                const isDirectReferral = t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote);

                return (
                  <div
                    key={t.id}
                    className={`bg-surface rounded-2xl p-5 border transition space-y-3 flex flex-col justify-between ${
                      t.isBlocking
                        ? 'border-rose-500/60 ring-1 ring-rose-500/30'
                        : isDirectReferral
                        ? 'border-purple-500/60 ring-1 ring-purple-500/30'
                        : 'border-line'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line-strong px-2 py-0.5 rounded">
                              {t.projectCode || 'عمومی'}
                            </span>
                            <span className="text-xs text-ink-2 font-bold">{t.projectTitle}</span>
                          </div>
                          <h4 className="font-black text-sm text-ink mt-1">{t.description}</h4>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {t.isBlocking && (
                            <span className="text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
                              متوقف‌کننده کار
                            </span>
                          )}
                          {isDirectReferral && (
                            <span className="text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded">
                              ارجاع به انبار
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ticket Description */}
                      <p className="text-xs text-ink-2 bg-sunken p-3 rounded-xl border border-line leading-relaxed">
                        {t.blockingReason || t.resolutionNote || 'نیازمند تامین فوری قطعه'}
                      </p>

                      {/* Referral note if any */}
                      {t.referralNote && (
                        <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
                          <p className="font-bold text-[12px] text-purple-300 mb-0.5">
                            دستور مدیر فنی به انبار:
                          </p>
                          <p>{t.referralNote}</p>
                        </div>
                      )}

                      {/* Ticket Reporter info */}
                      <div className="flex items-center justify-between text-[12px] text-ink-3 pt-2 border-t border-line">
                        <span>ثبت‌کننده: {t.authorName || 'همکاران فنی'}</span>
                        <span>{formatJalali(t.createdAt)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTicket(t);
                        setActionType('SUPPLIED');
                        setCourierInfo('');
                        setTrackingCode('');
                        setDelayReason('');
                        setEstimatedDate('');
                        setTicketError('');
                      }}
                      className="w-full py-2.5 rounded-xl font-black text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                    >
                      <Truck className="w-4 h-4" />
                      <span>رسیدگی و تعیین وضعیت ارسال قطعه</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL: GOODS RECEIPT CONFIRMATION ===================== */}
      {receiptModalProject && (
        <Portal><div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-brand/40 rounded-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-base text-ink flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-brand-ink" />
                <span>تأیید ورود و تحویل فیزیکی کالا به انبار</span>
              </h3>
              <button
                type="button"
                onClick={() => setReceiptModalProject(null)}
                className="text-ink-2 hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Project Summary */}
            <div className="bg-canvas p-3.5 rounded-xl border border-line text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-brand-ink">{receiptModalProject.code}</span>
                <span className="font-bold text-ink">{receiptModalProject.title}</span>
              </div>
              <div className="flex items-center justify-between text-ink-2 pt-1 border-t border-line">
                <span>کارفرما: {receiptModalProject.customerName}</span>
                <span>
                  حجم اقلام:{' '}
                  <strong className="text-ink tabular-nums">
                    {formatProductCounts(projectProductCounts(receiptModalProject)) || '—'}
                  </strong>
                </span>
              </div>
            </div>

            <form onSubmit={handleGoodsReceiptSubmit} className="space-y-4">
              {/* Verification Checklist */}
              <div className="bg-sunken p-3.5 rounded-xl border border-line space-y-2.5">
                <span className="text-xs font-bold text-brand-ink block">چک‌لیست بازرسی فیزیکی ورود کالا:</span>

                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptCheckItemsMatch}
                    onChange={(e) => setReceiptCheckItemsMatch(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-ink accent-brand bg-canvas border-line"
                  />
                  <span>تطابق تعداد و مشخصات اقلام دریافتی با برگه سفارش / فاکتور</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptCheckQuality}
                    onChange={(e) => setReceiptCheckQuality(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-ink accent-brand bg-canvas border-line"
                  />
                  <span>سلامت فیزیکی بسته‌بندی، پارچه‌ها، پروفیل ریل و موتورها (عدم پارگی یا خط و خش)</span>
                </label>
              </div>

              {/* Shelf Location */}
              <div>
                <label className="block text-xs font-bold text-ink-2 mb-1">
                  جای کالا در انبار (اختیاری)
                </label>
                <input
                  type="text"
                  value={receiptShelfLocation}
                  onChange={(e) => setReceiptShelfLocation(e.target.value)}
                  placeholder="مثال: ردیف B، قفسه ۴"
                  className="w-full text-sm p-2.5 rounded-xl border border-line bg-canvas text-ink placeholder-ink-3 focus:border-brand focus:outline-none font-bold"
                />
              </div>

              {/* Warehouse Notes */}
              <div>
                <label className="block text-xs font-bold text-ink-2 mb-1">
                  یادداشت‌ها و توضیحات تحویل‌گیرنده انبار (اختیاری):
                </label>
                <textarea
                  rows={2}
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder="مثال: اقلام با ۲ کارتن ریل و ۳ بسته پارچه تحویل گرفته شد، بسته‌بندی سالم و تست اولیه انجام شد..."
                  className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink placeholder-ink-3 focus:border-brand focus:outline-none resize-none"
                />
              </div>

              {/* Status Notice (Single Warehouse Authority) */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  با ثبت این فرم، <strong>گیت تحویل فنی پروژه ۱۰۰٪ باز خواهد شد</strong> و پروژه رسماً در کارتابل مسئول هماهنگی جهت زمان‌بندی نصب و اعزام اکیپ قرار می‌گیرد.
                </span>
              </div>

              {receiptError && <p className="text-xs text-rose-400 font-bold">{receiptError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setReceiptModalProject(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-raised text-ink-2 hover:text-ink cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceipt}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-brand hover:bg-brand-hover text-on-brand flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReceipt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="w-4 h-4" />
                  )}
                  <span>ثبت قطعی ورود کالا به انبار</span>
                </button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}

      {/* ===================== MODAL: REVOKE RECEIPT CONFIRMATION ===================== */}
      {revokeModalProject && (
        <Portal><div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-rose-500/40 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-sm text-rose-300 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>لغو تاییدیه ورود کالا به انبار</span>
              </h3>
              <button
                type="button"
                onClick={() => setRevokeModalProject(null)}
                className="text-ink-2 hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink leading-relaxed">
              آیا از لغو تاییدیه ورود فیزیکی کالا برای پروژه{' '}
              <strong className="text-brand-ink">{revokeModalProject.code || revokeModalProject.title}</strong> اطمینان
              دارید؟
            </p>
            <p className="text-[12px] text-rose-300/80 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              ⚠️ با لغو این تاییدیه، وضعیت گیت تحویل فنی مجدداً به حالت «قفل / در انتظار انبار» بازمی‌گردد و زمان‌بندی نصب تا زمان تایید مجدد مسدود خواهد شد.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setRevokeModalProject(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-raised text-ink-2 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSubmittingRevoke}
                onClick={handleRevokeReceiptSubmit}
                className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmittingRevoke ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>تایید لغو ورود کالا</span>
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ===================== MODAL: TICKET RESOLUTION ===================== */}
      {selectedTicket && (
        <Portal><div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-purple-500/40 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-base text-ink flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-400" />
                <span>تعیین تکلیف و تامین قطعه سر پروژه</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="text-ink-2 hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Subject */}
            <div className="bg-canvas p-3 rounded-xl border border-line text-xs space-y-1">
              <span className="font-mono text-brand-ink">{selectedTicket.projectCode || 'عمومی'}</span>
              <p className="font-bold text-ink">{selectedTicket.description}</p>
              {selectedTicket.blockingReason && (
                <p className="text-ink-2">{selectedTicket.blockingReason}</p>
              )}
            </div>

            {/* 3 Action Modes */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActionType('SUPPLIED')}
                className={`p-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  actionType === 'SUPPLIED'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-canvas border-line text-ink-2'
                }`}
              >
                1. تحویل حضوری
              </button>
              <button
                type="button"
                onClick={() => setActionType('DISPATCHED_COURIER')}
                className={`p-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  actionType === 'DISPATCHED_COURIER'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-canvas border-line text-ink-2'
                }`}
              >
                2. ارسال با پیک / اسنپ
              </button>
              <button
                type="button"
                onClick={() => setActionType('DELAYED')}
                className={`p-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  actionType === 'DELAYED'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-canvas border-line text-ink-2'
                }`}
              >
                3. عدم امکان فوری
              </button>
            </div>

            <form onSubmit={handleTicketSubmit} className="space-y-4">
              {actionType === 'SUPPLIED' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed">
                  قطعه یا متریال در انبار موجود و بسته‌بندی شد. آماده تحویل به سرپرست یا اکیپ می‌باشد.
                </div>
              )}

              {actionType === 'DISPATCHED_COURIER' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      مشخصات پیک یا راننده: *
                    </label>
                    <input
                      type="text"
                      value={courierInfo}
                      onChange={(e) => setCourierInfo(e.target.value)}
                      placeholder="مثال: پیک اسنپ / آقای رضایی (0912...)"
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      کد رهگیری یا لینک پیگیری پیک (اختیاری):
                    </label>
                    <input
                      type="text"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      placeholder="مثال: TRK-9812..."
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink font-mono"
                    />
                  </div>
                </div>
              )}

              {actionType === 'DELAYED' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      علت عدم امکان تامین فوری: *
                    </label>
                    <textarea
                      rows={2}
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      placeholder="مثال: قطعه در انبار موجود نیست و از شرکت واردکننده در حال ارسال است..."
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink resize-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      زمان یا تاریخ تقریبی آماده‌سازی و تامین: *
                    </label>
                    <input
                      type="text"
                      value={estimatedDate}
                      onChange={(e) => setEstimatedDate(e.target.value)}
                      placeholder="مثال: فردا ساعت 12 ظهر یا تاریخ 28 آبان"
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink"
                      required
                    />
                  </div>
                </div>
              )}

              {ticketError && <p className="text-xs text-rose-400 font-bold">{ticketError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-raised text-ink-2"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-md"
                >
                  {isSubmittingTicket ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>ثبت و اطلاع‌رسانی به نصاب و مدیر فنی</span>
                </button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}
    </div>
  );
};
