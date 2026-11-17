import React, { useState, useMemo } from 'react';
import {
  MaterialRequest,
  MaterialCategory,
  MaterialRequestStatus,
  MaterialUrgency,
  User,
  Project,
  Ticket,
} from '../../types';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Printer,
  Copy,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  X,
  Send,
  Check,
  ArrowDownToLine,
  Phone,
  MapPin,
  Eye,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { toPersianDigits, formatJalaliDateTime } from '../../utils/jalali';
import { triggerToast } from '../Toast';
import { WarehouseDesk } from '../warehouse/WarehouseDesk';
import {
  calculateItemBalances,
  getMaterialRequestSummary,
  createDispatchPayload,
  updateMaterialRequestStatusPayload,
  generatePrintableDispatchManifest,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUS_COLORS,
  MATERIAL_URGENCY_LABELS,
  MATERIAL_REASON_LABELS,
} from '../../utils/materialRequests';

interface Props {
  materialRequests: MaterialRequest[];
  currentUser?: User;
  users?: User[];
  tickets?: Ticket[];
  projects?: Project[];
  onUpdateMaterialRequest: (request: MaterialRequest) => void;
  onResolveTicket?: (
    ticketId: string,
    action: 'SUPPLIED' | 'DISPATCHED_COURIER' | 'DELAYED',
    payload?: {
      courierInfo?: string;
      trackingCode?: string;
      delayReason?: string;
      estimatedAvailableDate?: string;
    }
  ) => Promise<void>;
  onConfirmPacking?: (projectId: string, notes?: string) => Promise<void>;
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
  onNavigateTab?: (tab: any) => void;
}

type FilterTab = 'ALL' | 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'REJECTED';
type HubTab = 'REFERRALS' | 'REQUESTS' | 'GOODS_RECEIPT' | 'PACKING';

export const MaterialCenter: React.FC<Props> = ({
  materialRequests,
  currentUser,
  users = [],
  tickets = [],
  projects = [],
  onUpdateMaterialRequest,
  onResolveTicket,
  onConfirmPacking,
  onConfirmGoodsReceipt,
  onViewProposal,
  onOpenTicketModal,
  onNavigateTab,
}) => {
  // Compute warehouse referred tickets
  const warehouseTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets
      .filter((t) => t.status === 'OPEN' && (t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote)))
      .sort((a, b) => {
        if (a.isBlocking && !b.isBlocking) return -1;
        if (!a.isBlocking && b.isBlocking) return 1;
        return (b.referredAt || b.createdAt || '').localeCompare(a.referredAt || a.createdAt || '');
      });
  }, [tickets]);

  const [hubTab, setHubTab] = useState<HubTab>(
    warehouseTickets.length > 0 ? 'REFERRALS' : 'REQUESTS'
  );

  // Referrals filter & search
  const [referralFilter, setReferralFilter] = useState<'OPEN' | 'BLOCKING' | 'RESOLVED'>('OPEN');
  const [referralSearchQuery, setReferralSearchQuery] = useState('');

  // Referral resolution modal state
  const [resolvingTicket, setResolvingTicket] = useState<Ticket | null>(null);
  const [ticketActionType, setTicketActionType] = useState<'SUPPLIED' | 'DISPATCHED_COURIER' | 'DELAYED'>('DISPATCHED_COURIER');
  const [ticketCourierInfo, setTicketCourierInfo] = useState('');
  const [ticketTrackingCode, setTicketTrackingCode] = useState('');
  const [ticketDelayReason, setTicketDelayReason] = useState('');
  const [ticketEstimatedDate, setTicketEstimatedDate] = useState('');
  const [isSubmittingTicketAction, setIsSubmittingTicketAction] = useState(false);

  // Incoming factory goods & dispatch counts for KPI cards
  const pendingReceiptCount = useMemo(() => {
    if (!projects) return 0;
    return projects.filter(
      (p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED' && !p.technicalHandover?.warehouseConfirmation?.confirmed
    ).length;
  }, [projects]);

  const upcomingDispatchCount = useMemo(() => {
    if (!projects) return 0;
    return projects.filter(
      (p) => p.status === 'SCHEDULED' || (p.status === 'IN_PROGRESS' && p.scheduledDate)
    ).length;
  }, [projects]);

  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected request for dispatch drawer / modal
  const [dispatchModalRequest, setDispatchModalRequest] = useState<MaterialRequest | null>(null);
  const [courierInfo, setCourierInfo] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});

  // Status update modal
  const [statusModalRequest, setStatusModalRequest] = useState<MaterialRequest | null>(null);
  const [newStatus, setNewStatus] = useState<MaterialRequestStatus>('IN_PROCUREMENT');
  const [statusNote, setStatusNote] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');

  // Printable manifest modal
  const [manifestText, setManifestText] = useState<string | null>(null);
  const [copiedManifest, setCopiedManifest] = useState(false);

  // Expanded card tracking
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Compute Metrics
  const metrics = useMemo(() => {
    let pending = 0;
    let inTransit = 0;
    let delivered = 0;
    let critical = 0;

    for (const r of materialRequests) {
      if (r.status === 'SUBMITTED' || r.status === 'IN_PROCUREMENT') pending++;
      else if (r.status === 'PARTIALLY_DISPATCHED' || r.status === 'DISPATCHED') inTransit++;
      else if (r.status === 'DELIVERED_CONFIRMED') delivered++;

      if (r.urgency === 'CRITICAL_BLOCKING' && r.status !== 'DELIVERED_CONFIRMED' && r.status !== 'REJECTED') {
        critical++;
      }
    }

    return {
      total: materialRequests.length,
      pending,
      inTransit,
      delivered,
      critical,
    };
  }, [materialRequests]);

  // Filtered list
  const filteredRequests = useMemo(() => {
    return materialRequests.filter((r) => {
      // Tab filter
      if (filterTab === 'PENDING' && r.status !== 'SUBMITTED' && r.status !== 'IN_PROCUREMENT') return false;
      if (filterTab === 'IN_TRANSIT' && r.status !== 'PARTIALLY_DISPATCHED' && r.status !== 'DISPATCHED') return false;
      if (filterTab === 'DELIVERED' && r.status !== 'DELIVERED_CONFIRMED') return false;
      if (filterTab === 'REJECTED' && r.status !== 'REJECTED') return false;

      // Category filter
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;

      // Urgency filter
      if (urgencyFilter !== 'ALL' && r.urgency !== urgencyFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesProj = r.projectTitle?.toLowerCase().includes(q) || r.projectCode?.toLowerCase().includes(q);
        const matchesCust = r.customerName?.toLowerCase().includes(q);
        const matchesReq = r.requestedByUserName?.toLowerCase().includes(q);
        const matchesItem = r.items?.some((i) => i.title.toLowerCase().includes(q));
        if (!matchesProj && !matchesCust && !matchesReq && !matchesItem) return false;
      }

      return true;
    });
  }, [materialRequests, filterTab, categoryFilter, urgencyFilter, searchQuery]);

  // Pagination (10 items per page) to prevent sluggish rendering
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRequests = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, safeCurrentPage]);

  const handleSetFilterTab = (tab: FilterTab) => {
    setFilterTab(tab);
    setCurrentPage(1);
  };

  const handleSetCategoryFilter = (cat: string) => {
    setCategoryFilter(cat);
    setCurrentPage(1);
  };

  const handleSetUrgencyFilter = (urg: string) => {
    setUrgencyFilter(urg);
    setCurrentPage(1);
  };

  const handleSetSearchQuery = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  // Open Dispatch Modal
  const handleOpenDispatchModal = (req: MaterialRequest) => {
    setDispatchModalRequest(req);
    setCourierInfo('');
    setTrackingCode('');
    setDispatchNotes('');

    // Pre-populate dispatch quantities with remaining to dispatch
    const balances = calculateItemBalances(req);
    const initialQty: Record<string, number> = {};
    for (const b of balances) {
      initialQty[b.itemId] = b.remainingToDispatch;
    }
    setDispatchQuantities(initialQty);
  };

  // Submit Dispatch
  const handleSubmitDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalRequest || !currentUser) return;

    try {
      const itemsToDispatch = Object.entries(dispatchQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, dispatchedQty]) => ({ itemId, dispatchedQty }));

      if (itemsToDispatch.length === 0) {
        alert('حداقل مقدار یک قلم کالا برای ارسال باید بیشتر از صفر باشد.');
        return;
      }

      const updated = createDispatchPayload(
        dispatchModalRequest,
        {
          courierInfo: courierInfo.trim(),
          trackingCode: trackingCode.trim() || undefined,
          notes: dispatchNotes.trim() || undefined,
          items: itemsToDispatch,
        },
        currentUser
      );

      onUpdateMaterialRequest(updated);
      setDispatchModalRequest(null);
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت ارسال متریال.');
    }
  };

  // Open Status / Assignment Modal
  const handleOpenStatusModal = (req: MaterialRequest) => {
    setStatusModalRequest(req);
    setNewStatus(req.status);
    setStatusNote('');
    setAssignedUserId(req.assignedFollowUpUserId || '');
  };

  // Submit Status Change
  const handleSubmitStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalRequest || !currentUser) return;

    try {
      const assignedUser = users.find((u) => u.id === assignedUserId);
      const updated = updateMaterialRequestStatusPayload(
        statusModalRequest,
        newStatus,
        currentUser,
        statusNote.trim() || undefined,
        assignedUser ? { id: assignedUser.id, name: assignedUser.name } : undefined
      );

      onUpdateMaterialRequest(updated);
      setStatusModalRequest(null);
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت.');
    }
  };

  // Show Manifest
  const handleShowManifest = (req: MaterialRequest, dispatchId: string) => {
    const disp = req.dispatches?.find((d) => d.id === dispatchId);
    if (!disp) return;
    const text = generatePrintableDispatchManifest(req, disp);
    setManifestText(text);
    setCopiedManifest(false);
  };

  const handleCopyManifest = () => {
    if (!manifestText) return;
    navigator.clipboard.writeText(manifestText);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  // Referrals filter calculation
  const filteredReferrals = useMemo(() => {
    if (!tickets) return [];
    let list = tickets.filter(
      (t) => t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote)
    );

    if (referralFilter === 'BLOCKING') {
      list = list.filter((t) => t.status === 'OPEN' && t.isBlocking);
    } else if (referralFilter === 'RESOLVED') {
      list = list.filter((t) => t.status === 'RESOLVED');
    } else {
      // 'OPEN'
      list = list.filter((t) => t.status === 'OPEN');
    }

    if (referralSearchQuery.trim()) {
      const q = referralSearchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.projectCode || '').toLowerCase().includes(q) ||
          (t.projectTitle || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.referralNote || '').toLowerCase().includes(q) ||
          (t.authorName || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      if (a.isBlocking && !b.isBlocking) return -1;
      if (!a.isBlocking && b.isBlocking) return 1;
      return (b.referredAt || b.createdAt || '').localeCompare(a.referredAt || a.createdAt || '');
    });
  }, [tickets, referralFilter, referralSearchQuery]);

  const handleTicketResolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket) return;

    if (!onResolveTicket) {
      triggerToast('error', 'اکشن ثبت وضعیت تیکت فعال نیست.');
      return;
    }

    if (ticketActionType === 'DISPATCHED_COURIER' && !ticketCourierInfo.trim()) {
      triggerToast('warning', 'لطفاً نام راننده یا مشخصات پیک اسنپ/تپسی را وارد نمایید.');
      return;
    }

    if (ticketActionType === 'DELAYED') {
      if (!ticketDelayReason.trim()) {
        triggerToast('warning', 'لطفاً علت تاخیر در تامین قطعه را بنویسید.');
        return;
      }
      if (!ticketEstimatedDate.trim()) {
        triggerToast('warning', 'لطفاً تاریخ یا زمان تقریبی تامین را وارد نمایید.');
        return;
      }
    }

    setIsSubmittingTicketAction(true);
    try {
      await onResolveTicket(resolvingTicket.id, ticketActionType, {
        courierInfo: ticketCourierInfo.trim() || undefined,
        trackingCode: ticketTrackingCode.trim() || undefined,
        delayReason: ticketDelayReason.trim() || undefined,
        estimatedAvailableDate: ticketEstimatedDate.trim() || undefined,
      });

      triggerToast('success', 'وضعیت تیکت و اقدام لجستیک با موفقیت ذخیره گردید.');
      setResolvingTicket(null);
      setTicketCourierInfo('');
      setTicketTrackingCode('');
      setTicketDelayReason('');
      setTicketEstimatedDate('');
    } catch (err: any) {
      triggerToast('error', err.message || 'خطا در ثبت اقدام تیکت.');
    } finally {
      setIsSubmittingTicketAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مرکز متریال و لجستیک انبار"
        subtitle="مدیریت ورود کالای کارخانه، بسته‌بندی اعزام، ارجاعات فوری و تامین متریال سر کارگاه"
      />

      {/* KPI Cards & Direct Section Switchers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setHubTab('REFERRALS')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer select-none active:scale-[0.98] ${
            hubTab === 'REFERRALS'
              ? 'bg-[#1C232D] border-purple-500 shadow-md ring-1 ring-purple-500/40'
              : 'bg-[#151B23] border-[#212835] hover:border-purple-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-400">ارجاعات فوری به انبار</span>
            <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400 tabular-nums">
            {toPersianDigits(warehouseTickets.length)}
          </div>
          <span className="text-[11px] text-[#9BA7B6] mt-1 block">تیکت‌های ارجاع‌شده توسط مدیر</span>
        </button>

        <button
          type="button"
          onClick={() => setHubTab('REQUESTS')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer select-none active:scale-[0.98] ${
            hubTab === 'REQUESTS'
              ? 'bg-[#1C232D] border-[#C5A059] shadow-md ring-1 ring-[#C5A059]/40'
              : 'bg-[#151B23] border-[#212835] hover:border-[#C5A059]/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#C5A059]">درخواست‌های متریال سر کارگاه</span>
            <div className="w-8 h-8 rounded-lg bg-[#111620] border border-[#212835] flex items-center justify-center text-[#C5A059]">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#F0F4F8] tabular-nums">
            {toPersianDigits(metrics.total)}
          </div>
          <span className="text-[11px] text-[#9BA7B6] mt-1 block">اقلام درخواستی تکنسین‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => setHubTab('GOODS_RECEIPT')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer select-none active:scale-[0.98] ${
            hubTab === 'GOODS_RECEIPT'
              ? 'bg-[#1C232D] border-amber-500 shadow-md ring-1 ring-amber-500/40'
              : 'bg-[#151B23] border-[#212835] hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400">ورود کالا به انبار</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 tabular-nums">
            {toPersianDigits(pendingReceiptCount)}
          </div>
          <span className="text-[11px] text-[#9BA7B6] mt-1 block">محموله‌های کارخانه و گیت هندوور</span>
        </button>

        <button
          type="button"
          onClick={() => setHubTab('PACKING')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer select-none active:scale-[0.98] ${
            hubTab === 'PACKING'
              ? 'bg-[#1C232D] border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
              : 'bg-[#151B23] border-[#212835] hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-400">بسته‌بندی بارهای فردا</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 tabular-nums">
            {toPersianDigits(upcomingDispatchCount)}
          </div>
          <span className="text-[11px] text-[#9BA7B6] mt-1 block">چک‌لیست بارگیری خودروها</span>
        </button>
      </div>

      {/* Primary Sub-tab Switcher Bar */}
      <div className="flex items-center gap-1.5 bg-[#111620] p-1.5 rounded-xl border border-[#212835] overflow-x-auto">
        <button
          type="button"
          onClick={() => setHubTab('REFERRALS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            hubTab === 'REFERRALS'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#151B23]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>کارتابل ارجاعات انبار و تیکت‌های کسری</span>
          {warehouseTickets.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-mono font-bold animate-pulse">
              {toPersianDigits(warehouseTickets.length)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setHubTab('REQUESTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            hubTab === 'REQUESTS'
              ? 'bg-[#C5A059] text-[#0D1117] shadow-md'
              : 'text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#151B23]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>درخواست‌های متریال سر کارگاه</span>
          {materialRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#212835] text-[#9BA7B6] font-mono font-bold">
              {toPersianDigits(materialRequests.length)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setHubTab('GOODS_RECEIPT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            hubTab === 'GOODS_RECEIPT'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#151B23]'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          <span>ورود کالا به انبار (محموله‌های کارخانه)</span>
          {pendingReceiptCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-[#0D1117] font-mono font-bold">
              {toPersianDigits(pendingReceiptCount)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setHubTab('PACKING')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            hubTab === 'PACKING'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#151B23]'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>بسته‌بندی بارهای فردا</span>
          {upcomingDispatchCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-[#0D1117] font-mono font-bold">
              {toPersianDigits(upcomingDispatchCount)}
            </span>
          )}
        </button>
      </div>

      {/* ===================== TAB 1: LOGISTICS REFERRALS & TICKETS ===================== */}
      {hubTab === 'REFERRALS' && (
        <div className="space-y-4">
          <div className="bg-[#111620] p-4 rounded-xl border border-purple-500/30 text-xs text-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <span className="font-bold block text-sm text-[#F0F4F8]">
                  کارتابل پیگیری ارجاعات به انبار و لجستیک
                </span>
                <span className="text-[#9BA7B6] text-xs">
                  پروژه‌ها و تیکت‌هایی که دارای کسری قطعه، ریل، پارچه یا موتور بوده و مستقیماً به انبار جهت تامین و ارسال پیک ارجاع شده‌اند.
                </span>
              </div>
            </div>
            {warehouseTickets.length > 0 && (
              <span className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0 text-xs">
                {toPersianDigits(warehouseTickets.length)} ارجاع فعال
              </span>
            )}
          </div>

          {/* Filters & Search */}
          <div className="bg-[#151B23] p-4 rounded-xl border border-[#212835] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setReferralFilter('OPEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  referralFilter === 'OPEN'
                    ? 'bg-purple-600 text-white'
                    : 'text-[#9BA7B6] hover:bg-[#111620]'
                }`}
              >
                ارجاعات باز ({toPersianDigits(warehouseTickets.length)})
              </button>
              <button
                type="button"
                onClick={() => setReferralFilter('BLOCKING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  referralFilter === 'BLOCKING'
                    ? 'bg-rose-600 text-white'
                    : 'text-[#9BA7B6] hover:bg-[#111620]'
                }`}
              >
                متوقف‌کننده کار ({toPersianDigits(warehouseTickets.filter((t) => t.isBlocking).length)})
              </button>
              <button
                type="button"
                onClick={() => setReferralFilter('RESOLVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  referralFilter === 'RESOLVED'
                    ? 'bg-emerald-600 text-white'
                    : 'text-[#9BA7B6] hover:bg-[#111620]'
                }`}
              >
                حل‌شده و ارسال‌شده
              </button>
            </div>

            <div className="relative grow sm:max-w-xs">
              <input
                type="text"
                value={referralSearchQuery}
                onChange={(e) => setReferralSearchQuery(e.target.value)}
                placeholder="جستجو در ارجاعات..."
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-[#0D1117] border border-[#212835] text-[#F0F4F8] placeholder-[#637184] focus:outline-none focus:border-[#C5A059]"
              />
              <Search className="w-3.5 h-3.5 text-[#637184] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Cards Grid */}
          {filteredReferrals.length === 0 ? (
            <div className="bg-[#151B23] rounded-2xl p-10 text-center border border-[#212835] text-xs text-[#9BA7B6] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-[#F0F4F8]">هیچ تیکت ارجاعی با این فیلتر یافت نشد.</p>
              <p className="text-[11px] text-[#637184]">
                ارجاعات ثبت‌شده توسط مدیر در مرکز تیکت فوراً در این بخش برای اقدام انبار قرار می‌گیرند.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReferrals.map((t) => {
                const proj = projects?.find((p) => p.id === t.projectId || p.code === t.projectCode);
                const isResolved = t.status === 'RESOLVED';

                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl p-5 border transition flex flex-col justify-between space-y-4 shadow-sm ${
                      isResolved
                        ? 'bg-[#151B23] border-[#212835]'
                        : t.isBlocking
                        ? 'bg-[#161214] border-rose-500/50 ring-1 ring-rose-500/20'
                        : 'bg-[#151B23] border-purple-500/50 ring-1 ring-purple-500/20'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black bg-[#0D1117] text-[#C5A059] border border-[#2D3748] px-2.5 py-0.5 rounded">
                              {t.projectCode || 'عمومی'}
                            </span>
                            <span className="text-xs text-[#9BA7B6] font-bold">{t.projectTitle}</span>
                          </div>
                          <h4 className="font-black text-sm text-[#F0F4F8] mt-1.5">{t.description}</h4>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isResolved ? (
                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                              حل‌شده / تامین‌شده ✅
                            </span>
                          ) : (
                            <>
                              {t.isBlocking && (
                                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full animate-pulse">
                                  متوقف‌کننده کار
                                </span>
                              )}
                              <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                                ارجاع به انبار
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Customer & Address Details */}
                      {proj && (
                        <div className="bg-[#0D1117] p-2.5 rounded-xl border border-[#212835] text-xs space-y-1">
                          <div className="flex items-center justify-between text-[#9BA7B6]">
                            <span>کارفرما: <strong className="text-[#F0F4F8]">{proj.customerName}</strong></span>
                            {proj.customerPhone && (
                              <a
                                href={`tel:${proj.customerPhone}`}
                                className="flex items-center gap-1 text-[#C5A059] hover:underline dir-ltr font-mono"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{proj.customerPhone}</span>
                              </a>
                            )}
                          </div>
                          {proj.address && (
                            <div className="flex items-start gap-1 text-[11px] text-[#637184] pt-1 border-t border-[#212835]">
                              <MapPin className="w-3 h-3 text-[#637184] shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{proj.address}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Technical problem description */}
                      {t.blockingReason && (
                        <p className="text-xs text-rose-200/90 bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/20 leading-relaxed">
                          <strong className="text-rose-300 block mb-0.5">علت توقف کارگاه:</strong>
                          {t.blockingReason}
                        </p>
                      )}

                      {/* Manager Referral Note Box */}
                      {t.referralNote && (
                        <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 text-xs text-purple-200 space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-purple-300 flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-purple-400" />
                              دستور اقدام مدیر به انبار و لجستیک:
                            </span>
                            <span className="text-[10px] text-purple-400 font-mono">
                              {formatJalaliDateTime(t.referredAt || t.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[#F0F4F8] bg-[#0D1117] p-2 rounded-lg border border-purple-500/20">
                            {t.referralNote}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-purple-300/80 pt-1">
                            <span>ارجاع‌دهنده: {t.referredByUserName || 'کاربر سیستم'}</span>
                            <span>مسئول اقدام: {t.assignedUserName || 'انبار و لجستیک'}</span>
                          </div>
                        </div>
                      )}

                      {/* Resolution Note if Resolved */}
                      {isResolved && t.resolutionNote && (
                        <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 space-y-1">
                          <span className="font-bold text-emerald-300 block">اقدام انجام‌شده:</span>
                          <p>{t.resolutionNote}</p>
                          {t.resolvedAt && (
                            <span className="text-[10px] text-emerald-400 block pt-0.5">
                              زمان اقدام: {formatJalaliDateTime(t.resolvedAt)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reporter Info */}
                      <div className="flex items-center justify-between text-[11px] text-[#637184] pt-2 border-t border-[#212835]">
                        <span>ثبت‌کننده: {t.authorName || 'همکاران فنی'}</span>
                        <span>{formatJalaliDateTime(t.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-[#212835] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingTicket(t);
                            setTicketActionType('DISPATCHED_COURIER');
                            setTicketCourierInfo('');
                            setTicketTrackingCode('');
                            setTicketDelayReason('');
                            setTicketEstimatedDate('');
                          }}
                          className="py-2 px-3 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>ارسال با پیک / اسنپ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setResolvingTicket(t);
                            setTicketActionType('SUPPLIED');
                            setTicketCourierInfo('');
                            setTicketTrackingCode('');
                            setTicketDelayReason('');
                            setTicketEstimatedDate('');
                          }}
                          className="py-2 px-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تامین از انبار</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingTicket(t);
                            setTicketActionType('DELAYED');
                            setTicketCourierInfo('');
                            setTicketTrackingCode('');
                            setTicketDelayReason('');
                            setTicketEstimatedDate('');
                          }}
                          className="grow py-1.5 px-3 rounded-lg font-medium text-xs bg-[#1C232D] hover:bg-[#212835] text-[#9BA7B6] hover:text-[#F0F4F8] flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>اعلام تاخیر در تامین</span>
                        </button>

                        {proj && proj.proposalImages && proj.proposalImages.length > 0 && onViewProposal && (
                          <button
                            type="button"
                            onClick={() => onViewProposal(proj)}
                            className="py-1.5 px-3 rounded-lg font-medium text-xs bg-[#1C232D] hover:bg-[#212835] text-[#C5A059] flex items-center gap-1 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>تصاویر سفارش</span>
                          </button>
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

      {/* ===================== TAB 3: GOODS RECEIPT (FACTORY SHIPMENTS) ===================== */}
      {hubTab === 'GOODS_RECEIPT' && currentUser && (
        <WarehouseDesk
          initialTab="GOODS_RECEIPT"
          currentUser={currentUser}
          projects={projects || []}
          tickets={tickets || []}
          onConfirmPacking={onConfirmPacking || (async () => {})}
          onResolveTicket={onResolveTicket || (async () => {})}
          onConfirmGoodsReceipt={onConfirmGoodsReceipt}
          onViewProposal={onViewProposal}
          onOpenTicketModal={onOpenTicketModal}
        />
      )}

      {/* ===================== TAB 4: VEHICLE PACKING & DISPATCH ===================== */}
      {hubTab === 'PACKING' && currentUser && (
        <WarehouseDesk
          initialTab="PACKING"
          currentUser={currentUser}
          projects={projects || []}
          tickets={tickets || []}
          onConfirmPacking={onConfirmPacking || (async () => {})}
          onResolveTicket={onResolveTicket || (async () => {})}
          onConfirmGoodsReceipt={onConfirmGoodsReceipt}
          onViewProposal={onViewProposal}
          onOpenTicketModal={onOpenTicketModal}
        />
      )}

      {/* ===================== TAB 2: FIELD MATERIAL REQUESTS ===================== */}
      {hubTab === 'REQUESTS' && (
        <>

      {metrics.critical > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
            <span className="font-bold">
              توجه: تعداد {toPersianDigits(metrics.critical)} درخواست متریال بحرانی (متوقف‌کننده کار اکیپ سر پروژه) نیازمند اقدام فوری ارسال است.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSetUrgencyFilter('CRITICAL_BLOCKING')}
            className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-rose-700 cursor-pointer shrink-0"
          >
            مشاهده بحرانی‌ها
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="bg-[#151B23] p-4 rounded-lg border border-[#212835] space-y-4">
        {/* Main Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#212835] pb-3">
          {[
            { id: 'ALL' as const, label: 'همه درخواست‌ها', count: metrics.total },
            { id: 'PENDING' as const, label: 'در انتظار تامین', count: metrics.pending },
            { id: 'IN_TRANSIT' as const, label: 'در مسیر و پیک', count: metrics.inTransit },
            { id: 'DELIVERED' as const, label: 'تحویل شده', count: metrics.delivered },
            { id: 'REJECTED' as const, label: 'رد شده', count: materialRequests.filter((r) => r.status === 'REJECTED').length },
          ].map((tab) => {
            const isSelected = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSetFilterTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold transition cursor-pointer min-h-[40px] ${
                  isSelected
                    ? 'bg-[#212121] text-[#C5A059] dark:bg-[#C1A056] dark:text-[#181818] '
                    : 'text-[#637184] hover:bg-[#F2EDE4] dark:hover:bg-[#25231F]'
                }`}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 rounded-md text-[11px] bg-black/10 dark:bg-white/10">
                  {toPersianDigits(tab.count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-filters (Category, Urgency, Search) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A8A29E] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو بر اساس نام پروژه، مشتری، تکنسین، یا قطعه..."
              value={searchQuery}
              onChange={(e) => handleSetSearchQuery(e.target.value)}
              className="w-full text-xs pr-9 pl-3 py-2.5 rounded-md bg-[#FAF7F2] dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => handleSetCategoryFilter(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md bg-[#FAF7F2] dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
            >
              <option value="ALL">همه دسته‌بندی‌های متریال</option>
              {(Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategory[]).map((c) => (
                <option key={c} value={c}>
                  {MATERIAL_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={urgencyFilter}
              onChange={(e) => handleSetUrgencyFilter(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md bg-[#FAF7F2] dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
            >
              <option value="ALL">همه اولویت‌ها</option>
              {(Object.keys(MATERIAL_URGENCY_LABELS) as MaterialUrgency[]).map((u) => (
                <option key={u} value={u}>
                  {MATERIAL_URGENCY_LABELS[u].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-[#151B23] p-8 rounded-lg border border-[#212835] text-center space-y-2">
            <Package className="w-10 h-10 text-[#A8A29E] mx-auto opacity-50" />
            <h4 className="text-sm font-bold text-[#212121] dark:text-white">هیچ درخواست متریالی با این فیلتر یافت نشد</h4>
            <p className="text-xs text-[#637184]">
              درخواست‌های ثبت‌شده توسط تکنسین‌ها سر پروژه در این بخش قابل بررسی و ارسال خواهند بود.
            </p>
          </div>
        ) : (
          paginatedRequests.map((req) => {
            const summary = getMaterialRequestSummary(req);
            const statusConfig = MATERIAL_STATUS_COLORS[req.status];
            const urgencyConfig = MATERIAL_URGENCY_LABELS[req.urgency];
            const isExpanded = expandedId === req.id;

            return (
              <div
                key={req.id}
                className="bg-[#151B23] rounded-lg border border-[#212835] overflow-hidden  transition hover:border-[#C5A059]/50"
              >
                {/* Header row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2DDD4]/60 dark:border-[#2E2B26]/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black bg-[#212121] text-[#E5CA8F] px-2 py-0.5 rounded-md">
                        {req.projectCode}
                      </span>
                      <h3 className="font-bold text-sm sm:text-base text-[#212121] dark:text-white">
                        {req.projectTitle}
                      </h3>
                      <span className={`text-[11px] px-2 py-0.5 rounded-md ${urgencyConfig.badgeClass}`}>
                        {urgencyConfig.label}
                      </span>
                    </div>

                    <div className="text-xs text-[#637184] flex items-center gap-2 flex-wrap">
                      <span>کارفرما: {req.customerName || '—'}</span>
                      <span>•</span>
                      <span>درخواست‌کننده: {req.requestedByUserName}</span>
                      <span>•</span>
                      <span>علت: {MATERIAL_REASON_LABELS[req.reason]}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {MATERIAL_STATUS_LABELS[req.status]}
                    </span>

                    {/* Quick action buttons */}
                    {req.status !== 'DELIVERED_CONFIRMED' && req.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenDispatchModal(req)}
                        className="bg-[#212121] text-[#C5A059] hover:bg-[#C1A056] hover:text-[#212121] text-xs font-bold gap-1 min-h-[38px]"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>ارسال با پیک</span>
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal(req)}
                      className="text-xs text-[#637184] hover:text-[#212121] dark:hover:text-white p-2 rounded-lg border border-[#212835] min-h-[38px] cursor-pointer"
                      title="تغییر وضعیت یا مسئول پیگیری"
                    >
                      وضعیت
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="text-[#637184] hover:text-[#212121] dark:hover:text-white p-2 rounded-lg min-h-[38px] cursor-pointer"
                      aria-label="نمایش جزئیات"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Items Balance Summary Table */}
                <div className="p-4 sm:p-5 bg-[#FAF7F2]/40 dark:bg-[#181714]/40 space-y-3">
                  <div className="text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] flex items-center justify-between">
                    <span>اقلام درخواستی و وضعیت ارسال/تحویل:</span>
                    <span className="text-[11px] text-[#C5A059]">
                      تعداد کل: {toPersianDigits(summary.totalItems)} قلم
                    </span>
                  </div>

                  <div className="space-y-2">
                    {summary.balances.map((b) => {
                      const dispatchPct = Math.min(100, Math.round((b.totalDispatchedQty / b.requestedQty) * 100));
                      const receivedPct = Math.min(100, Math.round((b.totalReceivedQty / b.requestedQty) * 100));

                      return (
                        <div
                          key={b.itemId}
                          className="bg-white dark:bg-[#1E1D1A] p-3 rounded-md border border-[#212835] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-[#212121] dark:text-white">{b.title}</span>
                            <span className="font-mono text-[#C5A059]">
                              نیاز: {toPersianDigits(b.requestedQty)} {b.unit} • ارسال‌شده: {toPersianDigits(b.totalDispatchedQty)} • دریافت‌شده: {toPersianDigits(b.totalReceivedQty)}
                            </span>
                          </div>

                          {/* Dual progress bar: Dispatched vs Received */}
                          <div className="w-full bg-[#E2DDD4] dark:bg-[#282828] h-2 rounded-full overflow-hidden relative">
                            {/* Dispatched bar (purple) */}
                            <div
                              className="h-full bg-purple-400 dark:bg-purple-600 transition-all duration-300 absolute right-0 top-0"
                              style={{ width: `${dispatchPct}%` }}
                            />
                            {/* Received bar (emerald) */}
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300 absolute right-0 top-0"
                              style={{ width: `${receivedPct}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#637184]">
                            <span>
                              {b.remainingToDispatch > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  مانده برای ارسال: {toPersianDigits(b.remainingToDispatch)} {b.unit}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  تمام مقدار ارسال شد
                                </span>
                              )}
                            </span>

                            {b.pendingReceiptQty > 0 && (
                              <span className="text-purple-600 dark:text-purple-400 font-bold">
                                {toPersianDigits(b.pendingReceiptQty)} {b.unit} در مسیر پیک (در انتظار تایید کارگاه)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expanded Details (Dispatches history, Logs, Notes) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-[#212835] space-y-4 bg-[#151B23]">
                    {/* Dispatches history */}
                    <div>
                      <h4 className="text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-2">
                        سوابق ارسال با پیک / ناوگان:
                      </h4>

                      {(!req.dispatches || req.dispatches.length === 0) ? (
                        <p className="text-xs text-[#A8A29E] bg-[#FAF7F2] dark:bg-[#25231F] p-3 rounded-md border border-dashed border-[#212835]">
                          هنوز هیچ ارسالی برای این درخواست ثبت نشده است.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {req.dispatches.map((disp, dIdx) => (
                            <div
                              key={disp.id}
                              className="bg-[#FAF7F2] dark:bg-[#25231F] p-3 rounded-md border border-[#212835] space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#212121] dark:text-white">
                                    ارسال {toPersianDigits(dIdx + 1)}: {disp.courierInfo}
                                  </span>
                                  {disp.trackingCode && (
                                    <span className="font-mono text-[11px] text-[#A8A29E]">
                                      کد رهگیری: {disp.trackingCode}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#637184]">
                                    {formatJalaliDateTime(disp.dispatchedAt)}
                                  </span>
                                  {disp.receivedAtSiteConfirmed ? (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>تحویل تایید شد</span>
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>در مسیر کارگاه</span>
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleShowManifest(req, disp.id)}
                                    className="text-xs text-[#C5A059] hover:underline flex items-center gap-1 font-bold cursor-pointer py-1 px-2"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>برگه حواله</span>
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-[#555] dark:text-[#AAA]">
                                اقلام ارسالی: {disp.items.map((i) => `${i.title} (${toPersianDigits(i.dispatchedQty)} ${i.unit || ''})`).join('، ')}
                              </div>

                              {disp.notes && (
                                <p className="text-[11px] text-[#637184] bg-white dark:bg-[#1E1D1A] p-2 rounded-lg">
                                  توضیحات ارسال: {disp.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Follow-up officer & Action history */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#212835] text-xs">
                      <div>
                        <span className="font-bold text-[#4A4742] dark:text-[#D5D0C7] block mb-1">
                          مسئول پیگیری دفتر:
                        </span>
                        <div className="flex items-center gap-2 text-[#637184]">
                          <UserIcon className="w-4 h-4 text-[#C5A059]" />
                          <span>{req.assignedFollowUpUserName || 'تعیین نشده (ارجاع به همه)'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-[#4A4742] dark:text-[#D5D0C7] block mb-1">
                          یادداشت تکنسین سر کارگاه:
                        </span>
                        <p className="text-[#637184]">
                          {req.notes || 'توضیحی ثبت نشده است.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#212835]">
            <span className="text-xs text-[#637184]">
              نمایش {toPersianDigits((currentPage - 1) * ITEMS_PER_PAGE + 1)} تا{' '}
              {toPersianDigits(Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length))} از{' '}
              {toPersianDigits(filteredRequests.length)} درخواست
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[#212835] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[36px] transition cursor-pointer"
              >
                قبلی
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-[#212121] text-[#C5A059] dark:bg-[#C1A056] dark:text-[#181818]'
                        : 'border border-[#212835] hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] text-[#4A4742] dark:text-[#D5D0C7]'
                    }`}
                  >
                    {toPersianDigits(pageNum)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-[#212835] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[36px] transition cursor-pointer"
              >
                بعدی
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* DISPATCH DRAWER / MODAL */}
      {dispatchModalRequest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-[#FAF7F2] dark:bg-[#1C1B18] w-full max-w-xl rounded-lg shadow-2xl border border-[#212835] overflow-hidden my-6">
            <div className="bg-[#212121] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F5EFEB]">ثبت ارسال محموله با پیک</h3>
                  <p className="text-xs text-[#A8A29E]">
                    پروژه: {dispatchModalRequest.projectTitle} ({dispatchModalRequest.projectCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalRequest(null)}
                className="text-stone-400 hover:text-white p-2 rounded-lg cursor-pointer min-h-[44px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDispatch} className="p-4 sm:p-6 space-y-4">
              {/* Courier info */}
              <div>
                <label className="block text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-1.5">
                  اطلاعات پیک / راننده / ناوگان (الزامی):
                </label>
                <input
                  type="text"
                  placeholder="مثال: اسنپ‌باکس آقای رضوانی (09121234567) یا وانت شرکت"
                  value={courierInfo}
                  onChange={(e) => setCourierInfo(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-white dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-1.5">
                  کد رهگیری یا شماره بارنامه (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثال: SNP-449102"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-white dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
                />
              </div>

              {/* Items to dispatch */}
              <div>
                <label className="block text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-2">
                  تعداد اقلام تحویلی به پیک در این مرحله (ارسال مرحله‌ای):
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {calculateItemBalances(dispatchModalRequest).map((b) => (
                    <div
                      key={b.itemId}
                      className="flex items-center justify-between gap-3 p-2.5 bg-white dark:bg-[#25231F] rounded-md border border-[#212835] text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-[#212121] dark:text-white block truncate">
                          {b.title}
                        </span>
                        <span className="text-[11px] text-[#A8A29E]">
                          کل نیاز: {toPersianDigits(b.requestedQty)} • مانده: {toPersianDigits(b.remainingToDispatch)} {b.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-[#69655F]">ارسال:</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max={b.remainingToDispatch}
                          step="any"
                          value={dispatchQuantities[b.itemId] ?? b.remainingToDispatch}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setDispatchQuantities((prev) => ({ ...prev, [b.itemId]: val }));
                          }}
                          className="w-16 p-1.5 rounded-lg text-center font-bold bg-[#FAF7F2] dark:bg-[#1C1B18] border border-[#212835] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056]"
                        />
                        <span className="text-[11px] text-[#69655F] w-8">{b.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-1.5">
                  یادداشت هماهنگی با راننده (اختیاری):
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: هزینه پیک سر پروژه توسط شرکت پرداخت شده..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-white dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#212835]">
                <button
                  type="button"
                  onClick={() => setDispatchModalRequest(null)}
                  className="px-4 py-2.5 rounded-md border border-[#212835] text-xs font-bold hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[44px] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition min-h-[44px] flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>ثبت و صدور حواله خروج</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS & ASSIGNMENT MODAL */}
      {statusModalRequest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-[#FAF7F2] dark:bg-[#1C1B18] w-full max-w-md rounded-lg shadow-2xl border border-[#212835] overflow-hidden my-6">
            <div className="bg-[#212121] text-white p-4 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#F5EFEB]">تغییر وضعیت و مسئول پیگیری</h3>
              <button
                type="button"
                onClick={() => setStatusModalRequest(null)}
                className="text-stone-400 hover:text-white p-2 min-h-[44px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStatus} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-1.5">
                  وضعیت فرآیند تامین:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as MaterialRequestStatus)}
                  className="w-full text-xs p-2.5 rounded-md bg-white dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
                >
                  <option value="SUBMITTED">{MATERIAL_STATUS_LABELS['SUBMITTED']}</option>
                  <option value="IN_PROCUREMENT">{MATERIAL_STATUS_LABELS['IN_PROCUREMENT']}</option>
                  <option value="PARTIALLY_DISPATCHED">{MATERIAL_STATUS_LABELS['PARTIALLY_DISPATCHED']}</option>
                  <option value="DISPATCHED">{MATERIAL_STATUS_LABELS['DISPATCHED']}</option>
                  {statusModalRequest && getMaterialRequestSummary(statusModalRequest).isAllReceived && (
                    <option value="DELIVERED_CONFIRMED">{MATERIAL_STATUS_LABELS['DELIVERED_CONFIRMED']}</option>
                  )}
                  <option value="REJECTED">{MATERIAL_STATUS_LABELS['REJECTED']}</option>
                  <option value="CANCELLED">{MATERIAL_STATUS_LABELS['CANCELLED']}</option>
                </select>
                {statusModalRequest && !getMaterialRequestSummary(statusModalRequest).isAllReceived && (
                  <p className="mt-1 text-[11px] text-[#A8A29E]">
                    وضعیت «تحویل قطعی» صرفاً پس از تایید فیزیکی دریافت تمامی اقلام توسط تکنسین در کارگاه فعال می‌شود.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-1.5">
                  ارجاع به مسئول پیگیری دفتر:
                </label>
                <select
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-white dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
                >
                  <option value="">بدون انتساب اختصاصی (عمومی)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-1.5">
                  یادداشت تغییر وضعیت (در تاریخچه ثبت می‌شود):
                </label>
                <textarea
                  rows={2}
                  placeholder="علت تغییر وضعیت یا دستور به انبار..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-white dark:bg-[#25231F] border border-[#212835] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#212835]">
                <button
                  type="button"
                  onClick={() => setStatusModalRequest(null)}
                  className="px-4 py-2 rounded-md border border-[#212835] text-xs font-bold hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[44px] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-[#212121] text-[#C5A059] hover:bg-[#C1A056] hover:text-[#212121] text-xs font-black transition min-h-[44px] cursor-pointer"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE DISPATCH MANIFEST MODAL */}
      {manifestText && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-[#151B23] w-full max-w-lg rounded-lg shadow-2xl border border-[#212835] overflow-hidden my-6">
            <div className="bg-[#212121] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#C5A059]" />
                <h3 className="text-sm font-black text-[#F5EFEB]">حواله تحویل و پیک متریال</h3>
              </div>
              <button
                type="button"
                onClick={() => setManifestText(null)}
                className="text-stone-400 hover:text-white p-2 min-h-[44px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <pre className="bg-[#FAF7F2] dark:bg-[#121212] p-4 rounded-md border border-[#212835] text-xs font-mono text-[#212121] dark:text-[#E2DDD4] whitespace-pre-wrap leading-relaxed select-all">
                {manifestText}
              </pre>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyManifest}
                  className="px-4 py-2.5 rounded-md border border-[#212835] text-xs font-bold hover:bg-[#FAF7F2] dark:hover:bg-[#25231F] transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  {copiedManifest ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>کپی متن حواله</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-md bg-[#212121] text-[#C5A059] hover:bg-[#C1A056] hover:text-[#212121] text-xs font-black transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ حواله</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: LOGISTICS TICKET RESOLUTION ===================== */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-purple-500/40 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#212835] pb-3">
              <h3 className="font-black text-base text-[#F0F4F8] flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-400" />
                <span>رسیدگی و تعیین وضعیت ارسال قطعه / کسری</span>
              </h3>
              <button
                type="button"
                onClick={() => setResolvingTicket(null)}
                className="text-[#9BA7B6] hover:text-[#F0F4F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Subject */}
            <div className="bg-[#0D1117] p-3 rounded-xl border border-[#212835] text-xs space-y-1">
              <span className="font-mono text-[#C5A059] font-bold">{resolvingTicket.projectCode || 'عمومی'}</span>
              <p className="font-bold text-[#F0F4F8]">{resolvingTicket.description}</p>
              {resolvingTicket.referralNote && (
                <p className="text-purple-300 font-medium">دستور مدیر: {resolvingTicket.referralNote}</p>
              )}
            </div>

            {/* 3 Action Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTicketActionType('DISPATCHED_COURIER')}
                className={`p-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  ticketActionType === 'DISPATCHED_COURIER'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-[#0D1117] border-[#212835] text-[#9BA7B6]'
                }`}
              >
                ۱. ارسال با پیک / اسنپ
              </button>
              <button
                type="button"
                onClick={() => setTicketActionType('SUPPLIED')}
                className={`p-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  ticketActionType === 'SUPPLIED'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-[#0D1117] border-[#212835] text-[#9BA7B6]'
                }`}
              >
                ۲. تامین از انبار
              </button>
              <button
                type="button"
                onClick={() => setTicketActionType('DELAYED')}
                className={`p-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  ticketActionType === 'DELAYED'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-[#0D1117] border-[#212835] text-[#9BA7B6]'
                }`}
              >
                ۳. اعلام تاخیر در تامین
              </button>
            </div>

            <form onSubmit={handleTicketResolutionSubmit} className="space-y-4">
              {ticketActionType === 'SUPPLIED' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed">
                  قطعه یا متریال در انبار تامین و بسته‌بندی شد. آماده تحویل حضوری به سرپرست یا اکیپ می‌باشد. با ثبت، وضعیت تیکت به «حل‌شده» تغییر می‌یابد.
                </div>
              )}

              {ticketActionType === 'DISPATCHED_COURIER' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      مشخصات پیک یا راننده: *
                    </label>
                    <input
                      type="text"
                      value={ticketCourierInfo}
                      onChange={(e) => setTicketCourierInfo(e.target.value)}
                      placeholder="مثال: اسنپ باکس / آقای احمدی (0912...)"
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      کد رهگیری یا لینک پیگیری پیک (اختیاری):
                    </label>
                    <input
                      type="text"
                      value={ticketTrackingCode}
                      onChange={(e) => setTicketTrackingCode(e.target.value)}
                      placeholder="مثال: SNP-9812..."
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {ticketActionType === 'DELAYED' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      علت عدم امکان تامین فوری: *
                    </label>
                    <textarea
                      rows={2}
                      value={ticketDelayReason}
                      onChange={(e) => setTicketDelayReason(e.target.value)}
                      placeholder="مثال: عدم موجودی در انبار مرکزی، سفارش پارچه به کارخانه نساجی ارسال گردید..."
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] resize-none focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#9BA7B6] mb-1">
                      زمان یا تاریخ تقریبی آماده‌سازی و تامین: *
                    </label>
                    <input
                      type="text"
                      value={ticketEstimatedDate}
                      onChange={(e) => setTicketEstimatedDate(e.target.value)}
                      placeholder="مثال: فردا ساعت ۱۱ صبح / پس‌فردا"
                      className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-md cursor-pointer transition active:scale-95"
                >
                  {isSubmittingTicketAction ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>ثبت و ذخیره اقدام لجستیک</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
