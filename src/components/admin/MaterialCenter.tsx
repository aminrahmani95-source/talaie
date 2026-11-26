import React, { useState, useMemo } from 'react';
import { Portal } from '../ui/Portal';
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
import { toPersianDigits, formatJalaliDateTime, localDateKey } from '../../utils/jalali';
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
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { getUpcomingDispatchProjects, needsWarehouseReceipt, DISPATCH_HORIZON_DAYS } from '../../utils/warehouseLists';
import { getWarehouseStage, WarehouseAction } from '../../utils/warehouseStatus';
import { WarehouseProjectFlow, WarehouseFlowState } from '../warehouse/WarehouseProjectFlow';
import { WarehouseStageBadge } from '../warehouse/WarehouseStageBadge';

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
  /** همه‌ی اقدام‌های انبار روی پروژه (ورود کالا، بستن بار، تحویل به اکیپ) */
  onWarehouseAction?: (projectId: string, action: WarehouseAction) => Promise<void>;
  onViewProposal?: (project: Project) => void;
  onOpenTicketModal?: (project: Project) => void;
  onNavigateTab?: (tab: any) => void;
}

type FilterTab = 'OPEN' | 'ALL' | 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'REJECTED';
type HubTab = 'REFERRALS' | 'REQUESTS' | 'GOODS_RECEIPT' | 'PACKING';

export const MaterialCenter: React.FC<Props> = ({
  materialRequests,
  currentUser,
  users = [],
  tickets = [],
  projects = [],
  onUpdateMaterialRequest,
  onResolveTicket,
  onWarehouseAction,
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

  const [hubTab, setHubTab] = useState<HubTab>(() => {
    if (warehouseTickets.length > 0) return 'REFERRALS';
    if (materialRequests.some((r) => r.status !== 'DELIVERED_CONFIRMED' && r.status !== 'REJECTED')) return 'REQUESTS';
    if ((projects || []).some(needsWarehouseReceipt)) return 'GOODS_RECEIPT';
    return 'REQUESTS';
  });

  // برگه‌ی جزئیات/فرم‌های انبار یک پروژه (مشترک بین ورود کالا، بارگیری، درخواست‌ها و ارجاعات)
  const [flow, setFlow] = useState<WarehouseFlowState | null>(null);
  const openProject = (projectId?: string) => {
    if (projectId && projects.some((p) => p.id === projectId)) setFlow({ projectId, view: 'DETAILS' });
  };

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
    return projects.filter(needsWarehouseReceipt).length;
  }, [projects]);

  const upcomingDispatchCount = useMemo(() => {
    if (!projects) return 0;
    // کارهایی که بارشان هنوز به اکیپ نرسیده (بسته‌نشده یا بسته‌شده ولی تحویل‌نشده)
    return getUpcomingDispatchProjects(projects, localDateKey(), DISPATCH_HORIZON_DAYS).filter((p) => {
      const st = getWarehouseStage(p);
      return st !== 'HANDED_OVER' && st !== 'NONE';
    }).length;
  }, [projects]);

  // پیش‌فرض: فقط درخواست‌هایی که هنوز کاری دارند
  const [filterTab, setFilterTab] = useState<FilterTab>('OPEN');
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
      if (filterTab === 'OPEN' && (r.status === 'DELIVERED_CONFIRMED' || r.status === 'REJECTED')) return false;
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
    }).sort((a, b) => {
      // کارهای باز اول، بعد بحرانی ← فوری ← عادی، بعد جدیدترین
      const closed = (r: MaterialRequest) => (r.status === 'DELIVERED_CONFIRMED' || r.status === 'REJECTED' ? 1 : 0);
      const urg = (r: MaterialRequest) => (r.urgency === 'CRITICAL_BLOCKING' ? 0 : r.urgency === 'URGENT' ? 1 : 2);
      return (
        closed(a) - closed(b) ||
        urg(a) - urg(b) ||
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
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

  // Escape closes the open window (top-most first)
  useEscapeKey(() => setDispatchModalRequest(null), Boolean(dispatchModalRequest));
  useEscapeKey(() => setStatusModalRequest(null), Boolean(statusModalRequest));
  useEscapeKey(() => setManifestText(null), Boolean(manifestText));
  useEscapeKey(() => setResolvingTicket(null), Boolean(resolvingTicket));

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="انبار و متریال" />

      {/* بخش‌های انبار: هر کاشی هم آمار است و هم تب (قبلاً کارت‌ها و نوار تب تکراری بودند) */}
      <div role="tablist" className="grid grid-cols-4 gap-2 sm:gap-3">
        {(
          [
            { key: 'REFERRALS' as const, label: 'ارجاعات فوری', count: warehouseTickets.length, icon: AlertTriangle, tone: 'text-purple-400', ring: 'ring-purple-500' },
            { key: 'REQUESTS' as const, label: 'درخواست متریال', count: metrics.pending + metrics.inTransit, icon: Package, tone: 'text-brand-ink', ring: 'ring-brand' },
            { key: 'GOODS_RECEIPT' as const, label: 'ورود کالا', count: pendingReceiptCount, icon: ArrowDownToLine, tone: 'text-amber-400', ring: 'ring-amber-500' },
            { key: 'PACKING' as const, label: 'بارگیری', count: upcomingDispatchCount, icon: Truck, tone: 'text-emerald-400', ring: 'ring-emerald-500' },
          ]
        ).map((t) => {
          const Icon = t.icon;
          const selected = hubTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setHubTab(t.key)}
              className={`text-right p-2.5 sm:p-3.5 rounded-xl border bg-surface transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selected ? `border-transparent ring-2 ${t.ring}` : 'border-line hover:border-line-strong'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${t.count > 0 ? t.tone : 'text-ink-3'}`}>
                  {toPersianDigits(t.count)}
                </span>
                <Icon className={`w-4 h-4 shrink-0 ${selected ? t.tone : 'text-ink-3'}`} />
              </div>
              <div className="text-[12px] sm:text-xs font-bold text-ink-2 mt-1.5 leading-tight">{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* ===================== TAB 1: LOGISTICS REFERRALS & TICKETS ===================== */}
      {hubTab === 'REFERRALS' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-surface p-4 rounded-xl border border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setReferralFilter('OPEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  referralFilter === 'OPEN'
                    ? 'bg-purple-600 text-white'
                    : 'text-ink-2 hover:bg-sunken'
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
                    : 'text-ink-2 hover:bg-sunken'
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
                    : 'text-ink-2 hover:bg-sunken'
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
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-canvas border border-line text-ink placeholder-ink-3 focus:outline-none focus:border-brand"
              />
              <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Cards Grid */}
          {filteredReferrals.length === 0 ? (
            <div className="bg-surface rounded-2xl p-10 text-center border border-line text-xs text-ink-2 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-ink">هیچ تیکت ارجاعی با این فیلتر یافت نشد.</p>
              <p className="text-[12px] text-ink-3">
                ارجاعات ثبت‌شده توسط مدیر در مرکز تیکت فوراً در این بخش برای اقدام انبار قرار می‌گیرند.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 @min-[700px]:grid-cols-2 gap-4">
              {filteredReferrals.map((t) => {
                const proj = projects?.find((p) => p.id === t.projectId || p.code === t.projectCode);
                const isResolved = t.status === 'RESOLVED';

                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl p-5 border transition flex flex-col justify-between space-y-4 shadow-sm ${
                      isResolved
                        ? 'bg-surface border-line'
                        : t.isBlocking
                        ? 'bg-surface border-rose-500/50 ring-1 ring-rose-500/20'
                        : 'bg-surface border-purple-500/50 ring-1 ring-purple-500/20'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line-strong px-2.5 py-0.5 rounded">
                              {t.projectCode || 'عمومی'}
                            </span>
                            <span className="text-xs text-ink-2 font-bold">{t.projectTitle}</span>
                          </div>
                          <h4 className="font-black text-sm text-ink mt-1.5">{t.description}</h4>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isResolved ? (
                            <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                              حل‌شده / تامین‌شده ✅
                            </span>
                          ) : (
                            <>
                              {t.isBlocking && (
                                <span className="text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full animate-pulse">
                                  متوقف‌کننده کار
                                </span>
                              )}
                              <span className="text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                                ارجاع به انبار
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Customer & Address Details */}
                      {proj && (
                        <div className="bg-canvas p-2.5 rounded-xl border border-line text-xs space-y-1">
                          <div className="flex items-center justify-between text-ink-2">
                            <span>کارفرما: <strong className="text-ink">{proj.customerName}</strong></span>
                            {proj.customerPhone && (
                              <a
                                href={`tel:${proj.customerPhone}`}
                                className="flex items-center gap-1 text-brand-ink hover:underline dir-ltr font-mono"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{proj.customerPhone}</span>
                              </a>
                            )}
                          </div>
                          {proj.address && (
                            <div className="flex items-start gap-1 text-[12px] text-ink-3 pt-1 border-t border-line">
                              <MapPin className="w-3 h-3 text-ink-3 shrink-0 mt-0.5" />
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
                            <span className="text-[11px] text-purple-400 font-mono">
                              {formatJalaliDateTime(t.referredAt || t.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-ink bg-canvas p-2 rounded-lg border border-purple-500/20">
                            {t.referralNote}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-purple-300/80 pt-1">
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
                            <span className="text-[11px] text-emerald-400 block pt-0.5">
                              زمان اقدام: {formatJalaliDateTime(t.resolvedAt)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reporter Info */}
                      <div className="flex items-center justify-between text-[12px] text-ink-3 pt-2 border-t border-line">
                        <span>ثبت‌کننده: {t.authorName || 'همکاران فنی'}</span>
                        <span>{formatJalaliDateTime(t.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-line space-y-2">
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
                          className="grow py-1.5 px-3 rounded-lg font-medium text-xs bg-raised hover:bg-line text-ink-2 hover:text-ink flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>اعلام تاخیر در تامین</span>
                        </button>

                        {proj && (
                          <button
                            type="button"
                            onClick={() => openProject(proj.id)}
                            className="py-1.5 px-3 rounded-lg font-medium text-xs bg-raised hover:bg-line text-brand-ink flex items-center gap-1 transition cursor-pointer min-h-[36px]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>جزئیات پروژه</span>
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
          embedded
          currentUser={currentUser}
          projects={projects || []}
          tickets={tickets || []}
          onResolveTicket={onResolveTicket || (async () => {})}
          onOpenFlow={(projectId, view) => setFlow({ projectId, view })}
        />
      )}

      {/* ===================== TAB 4: VEHICLE PACKING & DISPATCH ===================== */}
      {hubTab === 'PACKING' && currentUser && (
        <WarehouseDesk
          initialTab="PACKING"
          embedded
          currentUser={currentUser}
          projects={projects || []}
          tickets={tickets || []}
          onResolveTicket={onResolveTicket || (async () => {})}
          onOpenFlow={(projectId, view) => setFlow({ projectId, view })}
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
      <div className="bg-surface p-4 rounded-lg border border-line space-y-4">
        {/* Main Status Tabs */}
        <div className="flex items-center gap-2 border-b border-line pb-3 overflow-x-auto no-scrollbar -mx-1 px-1">
          {[
            { id: 'OPEN' as const, label: 'باز', count: metrics.pending + metrics.inTransit },
            { id: 'PENDING' as const, label: 'در انتظار تامین', count: metrics.pending },
            { id: 'IN_TRANSIT' as const, label: 'در مسیر و پیک', count: metrics.inTransit },
            { id: 'DELIVERED' as const, label: 'تحویل شده', count: metrics.delivered },
            { id: 'REJECTED' as const, label: 'رد شده', count: materialRequests.filter((r) => r.status === 'REJECTED').length },
            { id: 'ALL' as const, label: 'همه', count: metrics.total },
          ].map((tab) => {
            const isSelected = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSetFilterTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold transition cursor-pointer min-h-[40px] whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'text-brand-ink bg-brand dark:text-[#181818] '
                    : 'text-ink-3 hover:bg-raised'
                }`}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 rounded-md text-[12px] bg-black/10 dark:bg-white/10">
                  {toPersianDigits(tab.count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-filters (Category, Urgency, Search) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="w-4 h-4 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو: پروژه، مشتری، نصاب یا قطعه"
              value={searchQuery}
              onChange={(e) => handleSetSearchQuery(e.target.value)}
              className="w-full text-xs pr-9 pl-3 py-2.5 rounded-md bg-raised border border-line text-ink focus:outline-none focus:ring-1 focus:ring-brand min-h-[44px]"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => handleSetCategoryFilter(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink font-medium focus:outline-none focus:ring-1 focus:ring-brand min-h-[44px]"
            >
              <option value="ALL">همه دسته‌ها</option>
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
              className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink font-medium focus:outline-none focus:ring-1 focus:ring-brand min-h-[44px]"
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
          <div className="bg-surface p-8 rounded-lg border border-line text-center space-y-2">
            <Package className="w-10 h-10 text-ink-3 mx-auto opacity-50" />
            <h4 className="text-sm font-bold text-ink">هیچ درخواست متریالی با این فیلتر یافت نشد</h4>
            <p className="text-xs text-ink-3">
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
                className="bg-surface rounded-lg border border-line overflow-hidden  transition hover:border-brand/50"
              >
                {/* Header row */}
                <div className="p-4 space-y-1.5 border-b border-line">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line-strong px-2 py-0.5 rounded-md">
                        {req.projectCode}
                      </span>
                      <h3 className="font-bold text-sm sm:text-base text-ink">{req.projectTitle}</h3>
                      {(() => {
                        const rp = projects.find((p) => p.id === req.projectId);
                        return rp ? <WarehouseStageBadge project={rp} size="xs" /> : null;
                      })()}
                      {req.urgency !== 'NORMAL' && (
                        <span className={`text-[12px] px-2 py-0.5 rounded-md ${urgencyConfig.badgeClass}`}>
                          {urgencyConfig.label}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[12px] px-2 py-1 rounded-md font-bold border shrink-0 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {MATERIAL_STATUS_LABELS[req.status]}
                    </span>
                  </div>

                  <div className="text-xs text-ink-3 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                    {req.customerName && req.customerName !== req.projectTitle && (
                      <>
                        <span>کارفرما: {req.customerName}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{req.requestedByUserName}</span>
                    <span>•</span>
                    <span>{formatJalaliDateTime(req.createdAt)}</span>
                    <span>•</span>
                    <span>{MATERIAL_REASON_LABELS[req.reason]}</span>
                  </div>

                  {req.notes && (
                    <p className="text-xs text-ink bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5">
                      <span className="font-bold text-amber-700 dark:text-amber-300">یادداشت کارگاه: </span>
                      {req.notes}
                    </p>
                  )}
                </div>

                {/* Items Balance Summary Table */}
                <div className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    {summary.balances.map((b) => {
                      const started = b.totalDispatchedQty > 0;
                      const dispatchPct = Math.min(100, Math.round((b.totalDispatchedQty / b.requestedQty) * 100));
                      const receivedPct = Math.min(100, Math.round((b.totalReceivedQty / b.requestedQty) * 100));
                      return (
                        <div key={b.itemId} className="bg-canvas px-3 py-2 rounded-md border border-line text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-ink">{b.title}</span>
                            <span className="font-black text-ink tabular-nums shrink-0">
                              {toPersianDigits(b.requestedQty)} {b.unit}
                            </span>
                          </div>
                          {started && (
                            <>
                              <div className="w-full bg-raised h-1.5 rounded-full overflow-hidden relative">
                                <div className="h-full bg-purple-500 absolute right-0 top-0" style={{ width: `${dispatchPct}%` }} />
                                <div className="h-full bg-emerald-500 absolute right-0 top-0" style={{ width: `${receivedPct}%` }} />
                              </div>
                              <div className="flex items-center justify-between text-[12px] text-ink-3 gap-2 flex-wrap">
                                <span>
                                  ارسال‌شده {toPersianDigits(b.totalDispatchedQty)} • تحویل در کارگاه {toPersianDigits(b.totalReceivedQty)}
                                </span>
                                {b.remainingToDispatch > 0 ? (
                                  <span className="text-amber-700 dark:text-amber-300 font-bold">
                                    مانده {toPersianDigits(b.remainingToDispatch)} {b.unit}
                                  </span>
                                ) : b.pendingReceiptQty > 0 ? (
                                  <span className="text-purple-700 dark:text-purple-300 font-bold">در مسیر کارگاه</span>
                                ) : (
                                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">کامل</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {req.status !== 'DELIVERED_CONFIRMED' && req.status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => handleOpenDispatchModal(req)}
                        className="flex-1 min-h-[42px] rounded-md bg-brand hover:bg-brand-hover text-on-brand text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <Truck className="w-4 h-4" />
                        <span>ثبت ارسال</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal(req)}
                      className="min-h-[42px] px-3 rounded-md border border-line bg-raised text-ink-2 hover:text-ink text-xs font-bold cursor-pointer"
                    >
                      تغییر وضعیت
                    </button>
                    {projects.some((p) => p.id === req.projectId) && (
                      <button
                        type="button"
                        onClick={() => openProject(req.projectId)}
                        className="min-h-[42px] px-3 rounded-md border border-line bg-raised text-ink-2 hover:text-ink text-xs font-bold cursor-pointer flex items-center gap-1"
                        aria-label={`جزئیات پروژه ${req.projectCode}`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>پروژه</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      aria-expanded={isExpanded}
                      className="min-h-[42px] px-3 rounded-md border border-line bg-raised text-ink-2 hover:text-ink text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <span>سوابق</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details (Dispatches history, Logs, Notes) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-line space-y-4 bg-surface">
                    {/* Dispatches history */}
                    <div>
                      <h4 className="text-xs font-black text-ink-2 mb-2">
                        سوابق ارسال با پیک / ناوگان:
                      </h4>

                      {(!req.dispatches || req.dispatches.length === 0) ? (
                        <p className="text-xs text-ink-3 bg-raised p-3 rounded-md border border-dashed border-line">
                          هنوز هیچ ارسالی برای این درخواست ثبت نشده است.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {req.dispatches.map((disp, dIdx) => (
                            <div
                              key={disp.id}
                              className="bg-raised p-3 rounded-md border border-line space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-ink">
                                    ارسال {toPersianDigits(dIdx + 1)}: {disp.courierInfo}
                                  </span>
                                  {disp.trackingCode && (
                                    <span className="font-mono text-[12px] text-ink-3">
                                      کد رهگیری: {disp.trackingCode}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] text-ink-3">
                                    {formatJalaliDateTime(disp.dispatchedAt)}
                                  </span>
                                  {disp.receivedAtSiteConfirmed ? (
                                    <span className="text-[12px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>تحویل تایید شد</span>
                                    </span>
                                  ) : (
                                    <span className="text-[12px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>در مسیر کارگاه</span>
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleShowManifest(req, disp.id)}
                                    className="text-xs text-brand-ink hover:underline flex items-center gap-1 font-bold cursor-pointer py-1 px-2"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>برگه حواله</span>
                                  </button>
                                </div>
                              </div>

                              <div className="text-[12px] text-[#555] dark:text-[#AAA]">
                                اقلام ارسالی: {disp.items.map((i) => `${i.title} (${toPersianDigits(i.dispatchedQty)} ${i.unit || ''})`).join('، ')}
                              </div>

                              {disp.notes && (
                                <p className="text-[12px] text-ink-3 bg-raised p-2 rounded-lg">
                                  توضیحات ارسال: {disp.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Follow-up officer & Action history */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-line text-xs">
                      <div>
                        <span className="font-bold text-ink-2 block mb-1">
                          مسئول پیگیری دفتر:
                        </span>
                        <div className="flex items-center gap-2 text-ink-3">
                          <UserIcon className="w-4 h-4 text-brand-ink" />
                          <span>{req.assignedFollowUpUserName || 'تعیین نشده (ارجاع به همه)'}</span>
                        </div>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-line">
            <span className="text-xs text-ink-3">
              نمایش {toPersianDigits((currentPage - 1) * ITEMS_PER_PAGE + 1)} تا{' '}
              {toPersianDigits(Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length))} از{' '}
              {toPersianDigits(filteredRequests.length)} درخواست
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-line text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-raised min-h-[36px] transition cursor-pointer"
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
                        ? 'text-brand-ink bg-brand dark:text-[#181818]'
                        : 'border border-line hover:bg-raised text-ink-2'
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
                className="px-3 py-1.5 rounded-lg border border-line text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-raised min-h-[36px] transition cursor-pointer"
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
        <Portal><div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-center items-start p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-sunken w-full max-w-xl rounded-lg shadow-2xl border border-line overflow-hidden my-auto">
            <div className="bg-[#212121] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F5EFEB]">ثبت ارسال محموله با پیک</h3>
                  <p className="text-xs text-ink-3">
                    پروژه: {dispatchModalRequest.projectTitle} ({dispatchModalRequest.projectCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalRequest(null)}
                className="text-stone-400 hover:text-ink p-2 rounded-lg cursor-pointer min-h-[44px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDispatch} className="p-4 sm:p-6 space-y-4">
              {/* Courier info */}
              <div>
                <label className="block text-xs font-black text-ink-2 mb-1.5">
                  اطلاعات پیک / راننده / ناوگان (الزامی):
                </label>
                <input
                  type="text"
                  placeholder="مثال: اسنپ‌باکس آقای رضوانی (09121234567) یا وانت شرکت"
                  value={courierInfo}
                  onChange={(e) => setCourierInfo(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink focus:outline-none focus:ring-1 focus:ring-brand min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-ink-2 mb-1.5">
                  کد رهگیری یا شماره بارنامه (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثال: SNP-449102"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink font-mono focus:outline-none focus:ring-1 focus:ring-brand min-h-[44px]"
                />
              </div>

              {/* Items to dispatch */}
              <div>
                <label className="block text-xs font-black text-ink-2 mb-2">
                  تعداد اقلام تحویلی به پیک در این مرحله (ارسال مرحله‌ای):
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {calculateItemBalances(dispatchModalRequest).map((b) => (
                    <div
                      key={b.itemId}
                      className="flex items-center justify-between gap-3 p-2.5 bg-raised rounded-md border border-line text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-ink block truncate">
                          {b.title}
                        </span>
                        <span className="text-[12px] text-ink-3">
                          کل نیاز: {toPersianDigits(b.requestedQty)} • مانده: {toPersianDigits(b.remainingToDispatch)} {b.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[12px] text-ink-3">ارسال:</span>
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
                          className="w-16 p-1.5 rounded-lg text-center font-bold bg-sunken border border-line text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        <span className="text-[12px] text-ink-3 w-8">{b.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-ink-2 mb-1.5">
                  یادداشت هماهنگی با راننده (اختیاری):
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: هزینه پیک سر پروژه توسط شرکت پرداخت شده..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setDispatchModalRequest(null)}
                  className="px-4 py-2.5 rounded-md border border-line text-xs font-bold hover:bg-raised min-h-[44px] cursor-pointer"
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
        </div></Portal>
      )}

      {/* STATUS & ASSIGNMENT MODAL */}
      {statusModalRequest && (
        <Portal><div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-center items-start p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-sunken w-full max-w-md rounded-lg shadow-2xl border border-line overflow-hidden my-auto">
            <div className="bg-[#212121] text-white p-4 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#F5EFEB]">تغییر وضعیت و مسئول پیگیری</h3>
              <button
                type="button"
                onClick={() => setStatusModalRequest(null)}
                className="text-stone-400 hover:text-ink p-2 min-h-[44px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStatus} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-ink-2 mb-1.5">
                  وضعیت فرآیند تامین:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as MaterialRequestStatus)}
                  className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink font-bold focus:outline-none focus:ring-1 focus:ring-brand min-h-[44px]"
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
                  <p className="mt-1 text-[12px] text-ink-3">
                    وضعیت «تحویل قطعی» صرفاً پس از تایید فیزیکی دریافت تمامی اقلام توسط تکنسین در کارگاه فعال می‌شود.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-ink-2 mb-1.5">
                  ارجاع به مسئول پیگیری دفتر:
                </label>
                <select
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink font-medium focus:outline-none focus:ring-1 focus:ring-brand min-h-[44px]"
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
                <label className="block text-xs font-black text-ink-2 mb-1.5">
                  یادداشت تغییر وضعیت (در تاریخچه ثبت می‌شود):
                </label>
                <textarea
                  rows={2}
                  placeholder="علت تغییر وضعیت یا دستور به انبار..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md bg-raised border border-line text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setStatusModalRequest(null)}
                  className="px-4 py-2 rounded-md border border-line text-xs font-bold hover:bg-raised min-h-[44px] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-[#212121] text-brand-ink hover:bg-brand hover:text-[#212121] text-xs font-black transition min-h-[44px] cursor-pointer"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}

      {/* PRINTABLE DISPATCH MANIFEST MODAL */}
      {manifestText && (
        <Portal><div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-center items-start p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-surface w-full max-w-lg rounded-lg shadow-2xl border border-line overflow-hidden my-auto">
            <div className="bg-[#212121] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-brand-ink" />
                <h3 className="text-sm font-black text-[#F5EFEB]">حواله تحویل و پیک متریال</h3>
              </div>
              <button
                type="button"
                onClick={() => setManifestText(null)}
                className="text-stone-400 hover:text-ink p-2 min-h-[44px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <pre className="bg-canvas p-4 rounded-md border border-line text-xs font-mono text-[#212121] dark:text-[#E2DDD4] whitespace-pre-wrap leading-relaxed select-all">
                {manifestText}
              </pre>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyManifest}
                  className="px-4 py-2.5 rounded-md border border-line text-xs font-bold hover:bg-raised transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
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
                  className="px-5 py-2.5 rounded-md bg-[#212121] text-brand-ink hover:bg-brand hover:text-[#212121] text-xs font-black transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ حواله</span>
                </button>
              </div>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ===================== MODAL: LOGISTICS TICKET RESOLUTION ===================== */}
      {resolvingTicket && (
        <Portal><div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-purple-500/40 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-base text-ink flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-400" />
                <span>رسیدگی و تعیین وضعیت ارسال قطعه / کسری</span>
              </h3>
              <button
                type="button"
                onClick={() => setResolvingTicket(null)}
                className="text-ink-2 hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Subject */}
            <div className="bg-canvas p-3 rounded-xl border border-line text-xs space-y-1">
              <span className="font-mono text-brand-ink font-bold">{resolvingTicket.projectCode || 'عمومی'}</span>
              <p className="font-bold text-ink">{resolvingTicket.description}</p>
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
                    : 'bg-canvas border-line text-ink-2'
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
                    : 'bg-canvas border-line text-ink-2'
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
                    : 'bg-canvas border-line text-ink-2'
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
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      مشخصات پیک یا راننده: *
                    </label>
                    <input
                      type="text"
                      value={ticketCourierInfo}
                      onChange={(e) => setTicketCourierInfo(e.target.value)}
                      placeholder="مثال: اسنپ باکس / آقای احمدی (0912...)"
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      کد رهگیری یا لینک پیگیری پیک (اختیاری):
                    </label>
                    <input
                      type="text"
                      value={ticketTrackingCode}
                      onChange={(e) => setTicketTrackingCode(e.target.value)}
                      placeholder="مثال: SNP-9812..."
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {ticketActionType === 'DELAYED' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      علت عدم امکان تامین فوری: *
                    </label>
                    <textarea
                      rows={2}
                      value={ticketDelayReason}
                      onChange={(e) => setTicketDelayReason(e.target.value)}
                      placeholder="مثال: عدم موجودی در انبار مرکزی، سفارش پارچه به کارخانه نساجی ارسال گردید..."
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink resize-none focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-2 mb-1">
                      زمان یا تاریخ تقریبی آماده‌سازی و تامین: *
                    </label>
                    <input
                      type="text"
                      value={ticketEstimatedDate}
                      onChange={(e) => setTicketEstimatedDate(e.target.value)}
                      placeholder="مثال: فردا ساعت ۱۱ صبح / پس‌فردا"
                      className="w-full text-xs p-2.5 rounded-xl border border-line bg-canvas text-ink focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-raised text-ink-2 hover:text-ink cursor-pointer"
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
        </div></Portal>
      )}
      <WarehouseProjectFlow
        state={flow}
        onChange={setFlow}
        projects={projects}
        users={users}
        materialRequests={materialRequests}
        todayKey={localDateKey()}
        onAction={onWarehouseAction}
        onViewProposal={onViewProposal}
        onOpenTicketModal={onOpenTicketModal}
      />
    </div>
  );
};
