import React, { useState, useMemo, useEffect } from 'react';
import { Portal } from '../ui/Portal';
import { formatProductCounts, projectProductCounts } from '../../utils/productCounts';
import { Project, Ticket, User } from '../../types';
import {
  Package,
  Send,
  AlertTriangle,
  Layers,
  Search,
  MapPin,
  Loader2,
  X,
  Truck,
  ArrowDownToLine,
  Eye,
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
import type { WarehouseFlowView } from './WarehouseProjectFlow';
import { WarehouseStageBadge } from './WarehouseStageBadge';
import {
  countsChangedSincePacking,
  countsChangedSinceReceipt,
  formatCountDiffs,
  getWarehouseStage,
  receiptShortages,
} from '../../utils/warehouseStatus';

interface Props {
  currentUser: User;
  projects: Project[];
  tickets: Ticket[];
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
  /** باز کردن برگه‌ی جزئیات یا فرم‌های انبار (ورود، بستن بار، تحویل) */
  onOpenFlow?: (projectId: string, view: WarehouseFlowView) => void;
  initialTab?: 'GOODS_RECEIPT' | 'PACKING' | 'TICKETS';
  /** داخل «انبار و متریال»: سربرگ و تب‌های داخلی تکراری نمایش داده نمی‌شوند */
  embedded?: boolean;
}

export const WarehouseDesk: React.FC<Props> = ({
  currentUser,
  projects,
  tickets,
  onResolveTicket,
  onOpenFlow,
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
        <div className="space-y-4">
          {/* راهنمای یک‌خطی + فیلتر + جستجو */}
          <div className="bg-surface p-3 rounded-xl border border-line space-y-2.5">
            <p className="text-[12px] text-ink-2 leading-6">
              وقتی بار پروژه به انبار رسید، اقلام را بشمارید و «ثبت ورود کالا» را بزنید؛ تا آن موقع اکیپ نمی‌تواند به محل نصب برود. برای دیدن پروپوزال و جزئیات روی کارت بزنید.
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
              {filteredIncomingProjects.map((p) => (
                <WarehouseJobCard
                  key={p.id}
                  project={p}
                  todayKey={todayKey}
                  onOpen={(view) => onOpenFlow?.(p.id, view)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: PRE-DISPATCH PACKING ===================== */}
      {activeTab === 'PACKING' && (
        <div className="space-y-4">
          <div className="bg-surface p-3 rounded-xl border border-line text-[12px] text-ink-2 leading-6">
            بار کارهای امروز تا پس‌فردا. موقع بار زدن، اقلام و ابزار را با چک‌لیست تیک بزنید و بعد «تحویل به اکیپ» را ثبت کنید؛ مدیر و سرپرست همان لحظه وضعیت را می‌بینند.
          </div>

          {upcomingDispatchProjects.length === 0 ? (
            <div className="bg-surface rounded-2xl p-10 text-center border border-line text-xs text-ink-2">
              برای امروز تا پس‌فردا باری در صف نیست.
            </div>
          ) : (
            <div className="grid grid-cols-1 @min-[900px]:grid-cols-2 gap-3">
              {upcomingDispatchProjects.map((p) => (
                <WarehouseJobCard
                  key={p.id}
                  project={p}
                  todayKey={todayKey}
                  mode="packing"
                  onOpen={(view) => onOpenFlow?.(p.id, view)}
                />
              ))}
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

/**
 * کارت یک پروژه در صف انبار. کل کارت برگه‌ی جزئیات (پروپوزال، تعداد، اکیپ، سوابق) را باز می‌کند
 * و دکمه‌ی اصلی همیشه «قدم بعدی» همان پروژه است.
 */
const WarehouseJobCard: React.FC<{
  project: Project;
  todayKey: string;
  mode?: 'receipt' | 'packing';
  onOpen: (view: WarehouseFlowView) => void;
}> = ({ project: p, todayKey, mode = 'receipt', onOpen }) => {
  const stage = getWarehouseStage(p);
  const wc = p.technicalHandover?.warehouseConfirmation;
  const prep = p.warehousePrep;
  const day = relativeDayLabel(p.scheduledDate, todayKey);
  const settled = stage === 'PACKED' || stage === 'HANDED_OVER' || (mode === 'receipt' && stage === 'IN_STOCK');
  const dayTone = settled
    ? 'bg-canvas text-ink-2 border-line'
    : day.tone === 'late' || day.tone === 'soon'
      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
      : day.tone === 'near'
        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40'
        : 'bg-canvas text-ink-2 border-line';
  const products = formatProductCounts(projectProductCounts(p));
  const shortages = receiptShortages(p);
  const changed = countsChangedSincePacking(p).length ? countsChangedSincePacking(p) : countsChangedSinceReceipt(p);

  const next: { label: string; view: WarehouseFlowView; icon: React.ReactNode } | null =
    stage === 'AWAITING'
      ? { label: 'ثبت ورود کالا', view: 'RECEIPT', icon: <ArrowDownToLine className="w-4 h-4" /> }
      : stage === 'PARTIAL'
        ? { label: 'تکمیل ورود کالا', view: 'RECEIPT', icon: <ArrowDownToLine className="w-4 h-4" /> }
        : stage === 'IN_STOCK' && mode === 'packing'
          ? { label: 'بستن بار', view: 'PACK', icon: <Package className="w-4 h-4" /> }
          : stage === 'PACKED' && mode === 'packing'
            ? { label: 'تحویل به اکیپ', view: 'HAND_OVER', icon: <Truck className="w-4 h-4" /> }
            : null;

  return (
    <div
      className={`bg-surface rounded-xl border transition ${
        stage === 'HANDED_OVER' || stage === 'PACKED'
          ? 'border-emerald-500/40'
          : stage === 'PARTIAL'
            ? 'border-rose-500/40'
            : 'border-line'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen('DETAILS')}
        className="w-full text-right p-4 pb-3 space-y-2.5 cursor-pointer rounded-t-xl hover:bg-raised/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={`جزئیات ${p.code || ''} ${p.title}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line-strong px-2 py-0.5 rounded">
                {p.code || 'بدون کد'}
              </span>
              <span className="font-black text-sm text-ink">{p.title}</span>
            </div>
            {p.customerName && p.customerName !== p.title && <p className="text-xs text-ink-2 mt-1">{p.customerName}</p>}
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

        <div className="flex items-center gap-1.5 flex-wrap">
          <WarehouseStageBadge project={p} />
          {p.assignedTeamName && (
            <span className="text-[12px] text-ink-2 px-2 py-0.5 rounded-md bg-canvas border border-line">{p.assignedTeamName}</span>
          )}
          {(p.proposalImages?.length || 0) > 0 && (
            <span className="text-[12px] text-ink-2 px-2 py-0.5 rounded-md bg-canvas border border-line flex items-center gap-1">
              <Eye className="w-3 h-3" />
              پروپوزال {toPersianDigits(p.proposalImages!.length)}
            </span>
          )}
          {p.isForceMajeure && (
            <span className="text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
              فوری
            </span>
          )}
        </div>

        <div className="text-xs text-ink-2 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-ink">
            <Layers className="w-3.5 h-3.5 text-brand-ink shrink-0" />
            <span>{products || 'تعداد ثبت نشده'}</span>
            {p.mechanismType && <span className="font-normal text-ink-3 truncate">· {p.mechanismType}</span>}
          </div>
          {p.address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-ink-3 shrink-0" />
              <span className="truncate">{p.address}</span>
            </div>
          )}
        </div>

        {shortages.length > 0 && (
          <div className="text-[12px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-2.5 py-1.5">
            کسری: {formatCountDiffs(shortages, 'shortage')}
            {wc?.shortageAccepted ? ' (با کسری تأیید شد)' : ''}
          </div>
        )}
        {changed.length > 0 && (
          <div className="text-[12px] font-bold text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-md px-2.5 py-1.5">
            تعداد بعد از ثبت انبار عوض شده: {formatCountDiffs(changed, 'change')}
          </div>
        )}
        {stage !== 'AWAITING' && (wc?.confirmed || wc?.isPartial) && (
          <div className="text-[12px] text-ink-2">
            {wc?.confirmed ? 'ورود' : 'ورود ناقص'} {formatJalali(wc?.confirmedAt)}
            {wc?.confirmedBy ? ` · ${wc.confirmedBy}` : ''}
            {wc?.shelfLocation ? ` · قفسه ${wc.shelfLocation}` : ''}
          </div>
        )}
        {prep?.handedOverAt ? (
          <div className="text-[12px] text-ink-2">
            تحویل {prep.handedOverToName ? `به ${prep.handedOverToName} ` : ''}· {formatJalaliDateTime(prep.handedOverAt)}
          </div>
        ) : prep?.isPackedAndReady && prep.packedAt ? (
          <div className="text-[12px] text-ink-2">
            بسته شد {formatJalaliDateTime(prep.packedAt)}
            {prep.packedByUserName ? ` · ${prep.packedByUserName}` : ''}
            {prep.notes ? ` · ${prep.notes}` : ''}
          </div>
        ) : null}
      </button>

      <div className="flex items-center gap-2 px-4 pb-4">
        {next ? (
          <button
            type="button"
            onClick={() => onOpen(next.view)}
            className="flex-1 min-h-[44px] rounded-lg bg-brand hover:bg-brand-hover text-on-brand font-black text-sm transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            {next.icon}
            <span>{next.label}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpen('DETAILS')}
            className="flex-1 min-h-[44px] rounded-lg bg-canvas hover:bg-raised text-ink border border-line text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>جزئیات و سوابق</span>
          </button>
        )}
      </div>
    </div>
  );
};
