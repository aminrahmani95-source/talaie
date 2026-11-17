import React, { useState, useMemo, useEffect } from 'react';
import { Project, Ticket, User } from '../../types';
import {
  Package,
  CheckCircle2,
  Send,
  AlertTriangle,
  Clock,
  Layers,
  Wrench,
  Search,
  Calendar,
  Phone,
  MapPin,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Truck,
  ArrowDownToLine,
  CheckSquare,
  ShieldCheck,
  FileText,
  Eye,
  Archive,
  Sparkles,
  RotateCcw,
  Pencil,
  Info,
  Inbox,
  AlertCircle,
  Warehouse,
} from 'lucide-react';
import {
  toPersianDigits,
  getUpcomingDays,
  getTodayPersianString,
  formatJalali,
  formatJalaliDateTime,
} from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';

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
  const [receiptFilterStatus, setReceiptFilterStatus] = useState<'ALL' | 'PENDING' | 'RECEIVED'>('ALL');

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
      (p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
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
      // Prioritize unconfirmed warehouse projects (needs physical receipt)
      const aRec = Boolean(a.technicalHandover?.warehouseConfirmation?.confirmed);
      const bRec = Boolean(b.technicalHandover?.warehouseConfirmation?.confirmed);
      if (!aRec && bRec) return -1;
      if (aRec && !bRec) return 1;

      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [incomingGoodsProjects, receiptFilterStatus, receiptSearchQuery]);

  // 2. Pre-dispatch packing projects
  const upcomingDispatchProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        p.status === 'SCHEDULED' ||
        (p.status === 'IN_PROGRESS' && p.endDate && p.endDate >= todayKey)
    );
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#151B23] rounded-2xl p-5 border border-[#212835] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#F0F4F8] flex items-center gap-2">
            <span>میز کار انبار مرکزی و لجستیک گالری طلایی</span>
            <span className="text-xs font-bold bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 px-2.5 py-0.5 rounded-full">
              مسئول انبار: {getDisplayName(currentUser.name)}
            </span>
          </h2>
          <p className="text-xs text-[#9BA7B6] mt-1.5 leading-relaxed">
            مدیریت ورود فیزیکی کالا به انبار (مرجع انحصاری گیت تحویل فنی)، بسته‌بندی بارهای مأموریت‌های آتی و پاسخ فوری به تیکت‌های کسری کارگاه
          </p>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex items-center gap-1.5 bg-[#0D1117] p-1.5 rounded-xl border border-[#212835] w-full lg:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('GOODS_RECEIPT')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'GOODS_RECEIPT'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-md'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>پیگیری ورود کالا و گیت انبار ({toPersianDigits(incomingGoodsProjects.length)})</span>
            {pendingReceiptCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-[#0D1117] font-mono font-bold animate-pulse">
                {pendingReceiptCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PACKING')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'PACKING'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-md'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
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
                ? 'bg-[#C5A059] text-[#0D1117] shadow-md'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>تیکت‌های فوری کسری ({toPersianDigits(warehouseTickets.length)})</span>
          </button>
        </div>
      </div>

      {/* ===================== TAB 1: INCOMING GOODS & TECHNICAL HANDOVER GATE ===================== */}
      {activeTab === 'GOODS_RECEIPT' && (
        <div className="space-y-5">
          {/* Information Callout */}
          <div className="bg-[#111620] p-4 rounded-xl border border-[#C5A059]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
                  <span>گیت تحویل رسمی به واحد فنی (مرجع انحصاری: تاییدیه ورود کالا به انبار)</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.2 rounded-full">
                    پیش‌نیاز زمان‌بندی و اعزام اکیپ
                  </span>
                </h4>
                <p className="text-xs text-[#9BA7B6] mt-1 leading-relaxed">
                  طبق فرآیند سیستم، به دلیل عدم دسترسی به کارگاه تولید، گیت تحویل فنی منحصراً بر اساس
                  <strong className="text-[#C5A059] mx-1">ورود فیزیکی و تحویل کالا به انبار مرکزی</strong> عمل می‌کند.
                  به محض تحویل محموله پرده، شید، ریل و یراق‌آلات، ورود آن را تایید و شماره قفسه را ثبت نمایید تا گیت فنی پروژه ۱۰۰٪ باز شده و در کارتابل هماهنگی مجاز به زمان‌بندی و اعزام اکیپ گردد.
                </p>
              </div>
            </div>
          </div>

          {/* 3 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#151B23] p-4 rounded-xl border border-[#212835] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#9BA7B6]">کل سفارشات در گردش ورود کالا</span>
                <div className="text-xl font-black text-[#F0F4F8] tabular-nums mt-0.5">
                  {toPersianDigits(incomingGoodsProjects.length)}
                </div>
                <span className="text-[10px] text-[#637184]">پروژه‌های در حال پیگیری بار</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#0D1117] border border-[#212835] flex items-center justify-center text-[#9BA7B6]">
                <Inbox className="w-4 h-4" />
              </div>
            </div>

            <div
              onClick={() => setReceiptFilterStatus('PENDING')}
              className={`bg-[#151B23] p-4 rounded-xl border cursor-pointer transition hover:border-amber-500/40 flex items-center justify-between ${
                receiptFilterStatus === 'PENDING'
                  ? 'border-amber-500 ring-1 ring-amber-500/30'
                  : 'border-[#212835]'
              }`}
            >
              <div>
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <span>در انتظار تحویل و ورود به انبار</span>
                  {pendingReceiptCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
                </span>
                <div className="text-xl font-black text-amber-300 tabular-nums mt-0.5">
                  {toPersianDigits(pendingReceiptCount)}
                </div>
                <span className="text-[10px] text-[#637184]">گیت قفل • نیازمند وصول فیزیکی کالا</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
            </div>

            <div
              onClick={() => setReceiptFilterStatus('RECEIVED')}
              className={`bg-[#151B23] p-4 rounded-xl border cursor-pointer transition hover:border-emerald-500/40 flex items-center justify-between ${
                receiptFilterStatus === 'RECEIVED'
                  ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                  : 'border-[#212835]'
              }`}
            >
              <div>
                <span className="text-[11px] font-bold text-emerald-400">تحویل‌شده در انبار (گیت باز)</span>
                <div className="text-xl font-black text-emerald-300 tabular-nums mt-0.5">
                  {toPersianDigits(receivedCount)}
                </div>
                <span className="text-[10px] text-[#637184]">چیدمان‌شده در قفسه • آماده زمان‌بندی</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Search & Sub-Filter Bar */}
          <div className="bg-[#151B23] p-3 rounded-xl border border-[#212835] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#9BA7B6] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={receiptSearchQuery}
                onChange={(e) => setReceiptSearchQuery(e.target.value)}
                placeholder="جستجو با کد، نام مشتری، تلفن، آدرس یا فروشنده..."
                className="w-full text-xs pr-9 pl-3 py-2 rounded-lg border border-[#212835] bg-[#0D1117] text-[#F0F4F8] placeholder-[#637184] focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setReceiptFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  receiptFilterStatus === 'ALL'
                    ? 'bg-[#C5A059] text-[#0D1117]'
                    : 'bg-[#0D1117] text-[#9BA7B6] hover:text-[#F0F4F8] border border-[#212835]'
                }`}
              >
                همه ({toPersianDigits(incomingGoodsProjects.length)})
              </button>
              <button
                type="button"
                onClick={() => setReceiptFilterStatus('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  receiptFilterStatus === 'PENDING'
                    ? 'bg-amber-500 text-[#0D1117]'
                    : 'bg-[#0D1117] text-amber-400 hover:text-amber-300 border border-amber-500/30'
                }`}
              >
                در انتظار تحویل به انبار ⏳ ({toPersianDigits(pendingReceiptCount)})
              </button>
              <button
                type="button"
                onClick={() => setReceiptFilterStatus('RECEIVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  receiptFilterStatus === 'RECEIVED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0D1117] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
                }`}
              >
                تحویل‌شده در انبار ✅ ({toPersianDigits(receivedCount)})
              </button>
            </div>
          </div>

          {/* Projects Pipeline Cards */}
          {filteredIncomingProjects.length === 0 ? (
            <div className="bg-[#151B23] rounded-2xl p-12 text-center border border-[#212835] text-xs text-[#9BA7B6] space-y-2">
              <Inbox className="w-8 h-8 text-[#637184] mx-auto" />
              <p className="font-bold">هیچ پروژه‌ای مطابق فیلتر جاری یافت نشد.</p>
              <p className="text-[11px] text-[#637184]">
                با تغییر عبارت جستجو یا انتخاب تب «همه»، پروژه‌های در گردش را بررسی نمایید.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredIncomingProjects.map((p) => {
                const handover = p.technicalHandover || {
                  isHandoverComplete: false,
                  warehouseConfirmation: { confirmed: false },
                };

                const whConfirmed = Boolean(handover.warehouseConfirmation?.confirmed);
                const isGateOpen = Boolean(handover.isHandoverComplete);

                return (
                  <div
                    key={p.id}
                    className={`bg-[#151B23] rounded-2xl p-5 border transition flex flex-col justify-between gap-4 ${
                      whConfirmed
                        ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'border-amber-500/50 ring-1 ring-amber-500/20'
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-[#212835] pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black bg-[#0D1117] text-[#C5A059] border border-[#2D3748] px-2 py-0.5 rounded">
                              {p.code || 'بدون کد'}
                            </span>
                            <h3 className="font-black text-sm text-[#F0F4F8]">{p.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#9BA7B6] mt-1.5">
                            <span className="font-bold text-[#F0F4F8]">{p.customerName || 'کارفرما نامشخص'}</span>
                            {p.customerPhone && (
                              <a
                                href={`tel:${p.customerPhone}`}
                                className="text-[#C5A059] hover:underline flex items-center gap-1 tabular-nums font-mono text-[11px]"
                                dir="ltr"
                              >
                                <Phone className="w-3 h-3" />
                                {p.customerPhone}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Status Pills */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {whConfirmed ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>کالا در انبار تحویل شد</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                              <span>در انتظار ورود به انبار</span>
                            </span>
                          )}

                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-full border ${
                              isGateOpen
                                ? 'bg-[#C5A059]/15 text-[#C5A059] border-[#C5A059]/30'
                                : 'bg-zinc-500/10 text-zinc-400 border-zinc-700/50'
                            }`}
                          >
                            {isGateOpen ? '✓ گیت فنی باز است' : '🔒 گیت فنی قفل است'}
                          </span>
                        </div>
                      </div>

                      {/* Address & Sales Rep */}
                      <div className="text-xs text-[#9BA7B6] space-y-1 bg-[#111620] p-2.5 rounded-xl border border-[#212835]">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                          <span className="truncate">{p.address || 'آدرس ثبت نشده'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#637184] pt-1 border-t border-[#212835]/50">
                          <span>کارشناس فروش: <strong className="text-[#9BA7B6]">{p.salesRepName || 'واحد فروش'}</strong></span>
                          <span>تاریخ ثبت: <strong className="text-[#9BA7B6]">{formatJalali(p.createdAt)}</strong></span>
                        </div>
                      </div>

                      {/* Technical Specifications (Panels, Mechanism, Area) */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-[#0D1117] p-2 rounded-lg border border-[#212835]">
                          <span className="text-[10px] text-[#637184] block">لت‌های پرده</span>
                          <span className="font-bold text-[#F0F4F8] tabular-nums mt-0.5 block">
                            {toPersianDigits(p.curtainPanels ?? 0)} لت
                          </span>
                        </div>
                        <div className="bg-[#0D1117] p-2 rounded-lg border border-[#212835]">
                          <span className="text-[10px] text-[#637184] block">لت‌های شید</span>
                          <span className="font-bold text-[#F0F4F8] tabular-nums mt-0.5 block">
                            {toPersianDigits(p.shadePanels ?? 0)} لت
                          </span>
                        </div>
                        <div className="bg-[#0D1117] p-2 rounded-lg border border-[#212835]">
                          <span className="text-[10px] text-[#637184] block">مکانیزم و متراژ</span>
                          <span className="font-bold text-[#C5A059] text-[11px] truncate block mt-0.5">
                            {p.mechanismType || 'استاندارد'}
                          </span>
                        </div>
                      </div>

                      {/* Official Handover Gate Checklist Status (Single Warehouse Authority) */}
                      <div className="bg-[#0D1117] p-3 rounded-xl border border-[#212835] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#C5A059] flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>گیت تحویل رسمی به واحد فنی (صرفاً تاییدیه انبار):</span>
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              whConfirmed
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {whConfirmed ? '✓ گیت باز است (آماده زمان‌بندی)' : '🔒 گیت قفل است (نیازمند ورود کالا)'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-[#151B23] text-xs">
                          {whConfirmed ? (
                            <div className="space-y-1">
                              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  کالا به انبار تحویل شده و چیدمان گردید — تاییدکننده:{' '}
                                  {handover.warehouseConfirmation?.confirmedBy || 'انباردار'} (
                                  {formatJalali(handover.warehouseConfirmation?.confirmedAt)})
                                </span>
                              </div>
                              {handover.warehouseConfirmation?.shelfLocation && (
                                <p className="text-[11px] text-[#F0F4F8] mr-5">
                                  موقعیت چیدمان:{' '}
                                  <strong className="text-[#C5A059]">
                                    {handover.warehouseConfirmation.shelfLocation}
                                  </strong>
                                </p>
                              )}
                              {handover.warehouseConfirmation?.notes && (
                                <p className="text-[11px] text-[#9BA7B6] mr-5 italic">
                                  یادداشت انبار: {handover.warehouseConfirmation.notes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-amber-300/90 flex items-center gap-1.5 leading-relaxed">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                فیزیک کالا هنوز به انبار تحویل نشده است. به محض وصول بار، دکمه تایید ورود کالا را بزنید تا گیت فنی فوراً باز شود.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 border-t border-[#212835] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {p.proposalImages && p.proposalImages.length > 0 && onViewProposal && (
                          <button
                            type="button"
                            onClick={() => onViewProposal(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0D1117] hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] border border-[#212835] text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>تصاویر سفارش ({toPersianDigits(p.proposalImages.length)})</span>
                          </button>
                        )}

                        {onOpenTicketModal && (
                          <button
                            type="button"
                            onClick={() => onOpenTicketModal(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0D1117] hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="در صورت مشاهده نقص در پارچه، مغایرت یا کسری قطعات، تیکت فوری ثبت کنید"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>گزارش نقص یا کسری</span>
                          </button>
                        )}
                      </div>

                      {/* Primary Receipt Actions */}
                      <div className="flex items-center gap-1.5">
                        {!whConfirmed ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReceiptModal(p)}
                            className="px-4 py-2 rounded-xl bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] font-black text-xs transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                          >
                            <ArrowDownToLine className="w-4 h-4" />
                            <span>تأیید ورود و تحویل کالا به انبار</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReceiptModal(p)}
                              className="px-3 py-1.5 rounded-lg bg-[#0D1117] hover:bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>ویرایش رسید</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevokeModalProject(p)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#0D1117] hover:bg-rose-500/20 text-rose-400 border border-[#212835] text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="لغو تاییدیه در صورت ثبت اشتباهی"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>لغو</span>
                            </button>
                          </div>
                        )}
                      </div>
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
          <div className="bg-[#111620] p-4 rounded-xl border border-[#C5A059]/20 text-xs text-[#9BA7B6] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0" />
            <span>
              با زدن دکمه «تایید بسته‌بندی»، در تقویم مدیر فنی چراغ سبز «بار آماده ✅» روشن می‌شود و مسئول هماهنگی از تکمیل بار مأموریت فردا اطمینان خواهد یافت.
            </span>
          </div>

          {upcomingDispatchProjects.length === 0 ? (
            <div className="bg-[#151B23] rounded-2xl p-10 text-center border border-[#212835] text-xs text-[#9BA7B6]">
              هیچ پروژه‌ای در صف آماده‌سازی بار قرار ندارد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingDispatchProjects.map((p) => {
                const isPacked = Boolean(p.warehousePrep?.isPackedAndReady);
                const isBusy = processingId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`bg-[#151B23] rounded-2xl p-5 border transition space-y-4 ${
                      isPacked
                        ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : p.isForceMajeure
                        ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                        : 'border-[#212835]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black bg-[#0D1117] text-[#C5A059] border border-[#2D3748] px-2 py-0.5 rounded">
                            {p.code}
                          </span>
                          <h3 className="font-black text-sm text-[#F0F4F8]">{p.title}</h3>
                        </div>
                        <p className="text-xs text-[#9BA7B6] mt-1">{p.customerName}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-bold text-[#C5A059] bg-[#0D1117] px-2.5 py-1 rounded-md border border-[#212835]">
                          اعزام: {formatJalali(p.scheduledDate)}
                        </span>
                        {p.isForceMajeure && (
                          <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
                            فورس ماژور
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-[#9BA7B6] space-y-1 bg-[#111620] p-3 rounded-xl border border-[#212835]">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                        <span className="truncate">{p.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                        <span className="tabular-nums font-mono">{p.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-[#212835] text-[11px] text-[#C5A059]">
                        <Layers className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {toPersianDigits(p.shadePanels ?? 0)} شید • {toPersianDigits(p.curtainPanels ?? 0)} پرده
                        </span>
                        {p.mechanismType && <span className="mr-1">({p.mechanismType})</span>}
                      </div>
                    </div>

                    {/* Tools required */}
                    {p.toolsRequired && p.toolsRequired.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-[#9BA7B6] flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-[#C5A059]" />
                          <span>ابزارهای الزامی این مأموریت:</span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {p.toolsRequired.slice(0, 4).map((t, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded bg-[#0D1117] text-[#9BA7B6] border border-[#212835]"
                            >
                              {t}
                            </span>
                          ))}
                          {p.toolsRequired.length > 4 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0D1117] text-[#637184]">
                              +{toPersianDigits(p.toolsRequired.length - 4)} ابزار دیگر
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Packing Status & Note Input */}
                    <div className="pt-2 border-t border-[#212835] space-y-3">
                      {isPacked ? (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>بار آماده و بسته‌بندی شد ✅</span>
                            </span>
                            <span className="text-[11px] text-emerald-300 tabular-nums">
                              {p.warehousePrep?.packedAt
                                ? formatJalaliDateTime(p.warehousePrep.packedAt)
                                : 'ثبت شده'}
                            </span>
                          </div>
                          {(p.warehousePrep?.packedByUserName || (p.warehousePrep as any)?.packedBy) && (
                            <p className="text-[11px] text-emerald-300/80">
                              توسط: {p.warehousePrep?.packedByUserName || (p.warehousePrep as any)?.packedBy}
                            </p>
                          )}
                          {(p.warehousePrep?.notes || (p.warehousePrep as any)?.packingNotes) && (
                            <p className="text-[11px] text-[#F0F4F8] mt-1 bg-[#0D1117]/60 p-2 rounded border border-emerald-500/20">
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
                            placeholder="یادداشت بسته‌بندی یا شماره قفسه (اختیاری)..."
                            className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] placeholder-[#637184] focus:border-[#C5A059] focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePackingSubmit(p.id)}
                            className="w-full py-2.5 rounded-xl font-black text-xs bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Package className="w-4 h-4" />
                            )}
                            <span>تایید بسته‌بندی و اعلام به مدیر فنی</span>
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
          <div className="bg-[#111620] p-4 rounded-xl border border-rose-500/20 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              تیکت‌های زیر مربوط به نصابان سر پروژه است که با کسری قطعه، ریل یا پیچ و یراق مواجه شده‌اند. لطفاً سریعاً پاسخ مناسب را انتخاب فرمایید.
            </span>
          </div>

          {warehouseTickets.length === 0 ? (
            <div className="bg-[#151B23] rounded-2xl p-10 text-center border border-[#212835] text-xs text-[#9BA7B6]">
              هیچ تیکت بازی در کارتابل انبار وجود ندارد. تمام پروژه‌ها در وضعیت تامین پایدار هستند.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warehouseTickets.map((t) => {
                const isDirectReferral = t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote);

                return (
                  <div
                    key={t.id}
                    className={`bg-[#151B23] rounded-2xl p-5 border transition space-y-3 flex flex-col justify-between ${
                      t.isBlocking
                        ? 'border-rose-500/60 ring-1 ring-rose-500/30'
                        : isDirectReferral
                        ? 'border-purple-500/60 ring-1 ring-purple-500/30'
                        : 'border-[#212835]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black bg-[#0D1117] text-[#C5A059] border border-[#2D3748] px-2 py-0.5 rounded">
                              {t.projectCode || 'عمومی'}
                            </span>
                            <span className="text-xs text-[#9BA7B6] font-bold">{t.projectTitle}</span>
                          </div>
                          <h4 className="font-black text-sm text-[#F0F4F8] mt-1">{t.description}</h4>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {t.isBlocking && (
                            <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
                              متوقف‌کننده کار
                            </span>
                          )}
                          {isDirectReferral && (
                            <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded">
                              ارجاع به انبار
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ticket Description */}
                      <p className="text-xs text-[#9BA7B6] bg-[#111620] p-3 rounded-xl border border-[#212835] leading-relaxed">
                        {t.blockingReason || t.resolutionNote || 'نیازمند تامین فوری قطعه'}
                      </p>

                      {/* Referral note if any */}
                      {t.referralNote && (
                        <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
                          <p className="font-bold text-[11px] text-purple-300 mb-0.5">
                            دستور مدیر فنی به انبار:
                          </p>
                          <p>{t.referralNote}</p>
                        </div>
                      )}

                      {/* Ticket Reporter info */}
                      <div className="flex items-center justify-between text-[11px] text-[#637184] pt-2 border-t border-[#212835]">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-[#C5A059]/40 rounded-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#212835] pb-3">
              <h3 className="font-black text-base text-[#F0F4F8] flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-[#C5A059]" />
                <span>تأیید ورود و تحویل فیزیکی کالا به انبار</span>
              </h3>
              <button
                type="button"
                onClick={() => setReceiptModalProject(null)}
                className="text-[#9BA7B6] hover:text-[#F0F4F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Project Summary */}
            <div className="bg-[#0D1117] p-3.5 rounded-xl border border-[#212835] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[#C5A059]">{receiptModalProject.code}</span>
                <span className="font-bold text-[#F0F4F8]">{receiptModalProject.title}</span>
              </div>
              <div className="flex items-center justify-between text-[#9BA7B6] pt-1 border-t border-[#212835]">
                <span>کارفرما: {receiptModalProject.customerName}</span>
                <span>
                  حجم اقلام:{' '}
                  <strong className="text-[#F0F4F8] tabular-nums">
                    {toPersianDigits(
                      (receiptModalProject.shadePanels ?? 0) + (receiptModalProject.curtainPanels ?? 0)
                    )}{' '}
                    لت
                  </strong>
                </span>
              </div>
            </div>

            <form onSubmit={handleGoodsReceiptSubmit} className="space-y-4">
              {/* Verification Checklist */}
              <div className="bg-[#111620] p-3.5 rounded-xl border border-[#212835] space-y-2.5">
                <span className="text-xs font-bold text-[#C5A059] block">چک‌لیست بازرسی فیزیکی ورود کالا:</span>

                <label className="flex items-center gap-2 text-xs text-[#F0F4F8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptCheckItemsMatch}
                    onChange={(e) => setReceiptCheckItemsMatch(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C5A059] accent-[#C5A059] bg-[#0D1117] border-[#212835]"
                  />
                  <span>تطابق تعداد و مشخصات اقلام دریافتی با برگه سفارش / فاکتور</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#F0F4F8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptCheckQuality}
                    onChange={(e) => setReceiptCheckQuality(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C5A059] accent-[#C5A059] bg-[#0D1117] border-[#212835]"
                  />
                  <span>سلامت فیزیکی بسته‌بندی، پارچه‌ها، پروفیل ریل و موتورها (عدم پارگی یا خط و خش)</span>
                </label>
              </div>

              {/* Shelf Location */}
              <div>
                <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                  شماره قفسه یا موقعیت چیدمان در انبار (جهت بارگیری سریع اکیپ): *
                </label>
                <input
                  type="text"
                  value={receiptShelfLocation}
                  onChange={(e) => setReceiptShelfLocation(e.target.value)}
                  placeholder="مثال: ردیف B، قفسه ۴ / انبار شید غربی"
                  className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] placeholder-[#637184] focus:border-[#C5A059] focus:outline-none font-bold"
                  required
                />
              </div>

              {/* Warehouse Notes */}
              <div>
                <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                  یادداشت‌ها و توضیحات تحویل‌گیرنده انبار (اختیاری):
                </label>
                <textarea
                  rows={2}
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder="مثال: اقلام با ۲ کارتن ریل و ۳ بسته پارچه تحویل گرفته شد، بسته‌بندی سالم و تست اولیه انجام شد..."
                  className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] placeholder-[#637184] focus:border-[#C5A059] focus:outline-none resize-none"
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

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
                <button
                  type="button"
                  onClick={() => setReceiptModalProject(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceipt}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
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
        </div>
      )}

      {/* ===================== MODAL: REVOKE RECEIPT CONFIRMATION ===================== */}
      {revokeModalProject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-rose-500/40 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#212835] pb-3">
              <h3 className="font-black text-sm text-rose-300 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>لغو تاییدیه ورود کالا به انبار</span>
              </h3>
              <button
                type="button"
                onClick={() => setRevokeModalProject(null)}
                className="text-[#9BA7B6] hover:text-[#F0F4F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#F0F4F8] leading-relaxed">
              آیا از لغو تاییدیه ورود فیزیکی کالا برای پروژه{' '}
              <strong className="text-[#C5A059]">{revokeModalProject.code || revokeModalProject.title}</strong> اطمینان
              دارید؟
            </p>
            <p className="text-[11px] text-rose-300/80 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              ⚠️ با لغو این تاییدیه، وضعیت گیت تحویل فنی مجدداً به حالت «قفل / در انتظار انبار» بازمی‌گردد و زمان‌بندی نصب تا زمان تایید مجدد مسدود خواهد شد.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
              <button
                type="button"
                onClick={() => setRevokeModalProject(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C232D] text-[#9BA7B6] cursor-pointer"
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
        </div>
      )}

      {/* ===================== MODAL: TICKET RESOLUTION ===================== */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-purple-500/40 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#212835] pb-3">
              <h3 className="font-black text-base text-[#F0F4F8] flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-400" />
                <span>تعیین تکلیف و تامین قطعه سر پروژه</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="text-[#9BA7B6] hover:text-[#F0F4F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Subject */}
            <div className="bg-[#0D1117] p-3 rounded-xl border border-[#212835] text-xs space-y-1">
              <span className="font-mono text-[#C5A059]">{selectedTicket.projectCode || 'عمومی'}</span>
              <p className="font-bold text-[#F0F4F8]">{selectedTicket.description}</p>
              {selectedTicket.blockingReason && (
                <p className="text-[#9BA7B6]">{selectedTicket.blockingReason}</p>
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
                    : 'bg-[#0D1117] border-[#212835] text-[#9BA7B6]'
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
                    : 'bg-[#0D1117] border-[#212835] text-[#9BA7B6]'
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
                    : 'bg-[#0D1117] border-[#212835] text-[#9BA7B6]'
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
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      مشخصات پیک یا راننده: *
                    </label>
                    <input
                      type="text"
                      value={courierInfo}
                      onChange={(e) => setCourierInfo(e.target.value)}
                      placeholder="مثال: پیک اسنپ / آقای رضایی (0912...)"
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      کد رهگیری یا لینک پیگیری پیک (اختیاری):
                    </label>
                    <input
                      type="text"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      placeholder="مثال: TRK-9812..."
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] font-mono"
                    />
                  </div>
                </div>
              )}

              {actionType === 'DELAYED' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      علت عدم امکان تامین فوری: *
                    </label>
                    <textarea
                      rows={2}
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      placeholder="مثال: قطعه در انبار موجود نیست و از شرکت واردکننده در حال ارسال است..."
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] resize-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      زمان یا تاریخ تقریبی آماده‌سازی و تامین: *
                    </label>
                    <input
                      type="text"
                      value={estimatedDate}
                      onChange={(e) => setEstimatedDate(e.target.value)}
                      placeholder="مثال: فردا ساعت 12 ظهر یا تاریخ 28 آبان"
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8]"
                      required
                    />
                  </div>
                </div>
              )}

              {ticketError && <p className="text-xs text-rose-400 font-bold">{ticketError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C232D] text-[#9BA7B6]"
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
        </div>
      )}
    </div>
  );
};
