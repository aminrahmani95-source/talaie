import React, { useState, useMemo } from 'react';
import {
  MaterialRequest,
  MaterialCategory,
  MaterialRequestStatus,
  MaterialUrgency,
  User,
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
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { toPersianDigits, formatJalaliDateTime } from '../../utils/jalali';
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
  onUpdateMaterialRequest: (request: MaterialRequest) => void;
}

type FilterTab = 'ALL' | 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'REJECTED';

export const MaterialCenter: React.FC<Props> = ({
  materialRequests,
  currentUser,
  users = [],
  onUpdateMaterialRequest,
}) => {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="مرکز متریال، لجستیک و پیگیری کسری‌ها"
        subtitle="مدیریت درخواست‌های متریال سر کارگاه، ارسال مرحله‌ای با پیک و رهگیری تحویل قطعی"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1C1B18] p-4 rounded-2xl border border-[#E2DDD4] dark:border-[#2E2B26] shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#69655F] dark:text-[#A8A29E]">کل درخواست‌ها</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#212121] dark:text-[#F5EFEB]">
            {toPersianDigits(metrics.total)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1B18] p-4 rounded-2xl border border-[#E2DDD4] dark:border-[#2E2B26] shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">در انتظار تامین انبار</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
            {toPersianDigits(metrics.pending)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1B18] p-4 rounded-2xl border border-[#E2DDD4] dark:border-[#2E2B26] shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-400">در مسیر و ارسال پیک</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-700 dark:text-purple-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-400">
            {toPersianDigits(metrics.inTransit)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1B18] p-4 rounded-2xl border border-[#E2DDD4] dark:border-[#2E2B26] shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">تحویل قطعی کارگاه</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {toPersianDigits(metrics.delivered)}
          </div>
        </div>
      </div>

      {metrics.critical > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-3 rounded-2xl text-xs flex items-center justify-between">
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
      <div className="bg-white dark:bg-[#1C1B18] p-4 rounded-2xl border border-[#E2DDD4] dark:border-[#2E2B26] space-y-4">
        {/* Main Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2DDD4] dark:border-[#2E2B26] pb-3">
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
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer min-h-[40px] ${
                  isSelected
                    ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#181818] shadow-xs'
                    : 'text-[#69655F] dark:text-[#A8A29E] hover:bg-[#F2EDE4] dark:hover:bg-[#25231F]'
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
              className="w-full text-xs pr-9 pl-3 py-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => handleSetCategoryFilter(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
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
              className="w-full text-xs p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
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
          <div className="bg-white dark:bg-[#1C1B18] p-8 rounded-2xl border border-[#E2DDD4] dark:border-[#2E2B26] text-center space-y-2">
            <Package className="w-10 h-10 text-[#A8A29E] mx-auto opacity-50" />
            <h4 className="text-sm font-bold text-[#212121] dark:text-white">هیچ درخواست متریالی با این فیلتر یافت نشد</h4>
            <p className="text-xs text-[#69655F] dark:text-[#A8A29E]">
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
                className="bg-white dark:bg-[#1C1B18] rounded-2xl border border-[#E2DDD4] dark:border-[#2E2B26] overflow-hidden shadow-2xs transition hover:border-[#C1A056]/50"
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

                    <div className="text-xs text-[#69655F] dark:text-[#A8A29E] flex items-center gap-2 flex-wrap">
                      <span>کارفرما: {req.customerName || '—'}</span>
                      <span>•</span>
                      <span>درخواست‌کننده: {req.requestedByUserName}</span>
                      <span>•</span>
                      <span>علت: {MATERIAL_REASON_LABELS[req.reason]}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-xl font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {MATERIAL_STATUS_LABELS[req.status]}
                    </span>

                    {/* Quick action buttons */}
                    {req.status !== 'DELIVERED_CONFIRMED' && req.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenDispatchModal(req)}
                        className="bg-[#212121] text-[#C1A056] hover:bg-[#C1A056] hover:text-[#212121] text-xs font-bold gap-1 min-h-[38px]"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>ارسال با پیک</span>
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal(req)}
                      className="text-xs text-[#69655F] dark:text-[#A8A29E] hover:text-[#212121] dark:hover:text-white p-2 rounded-lg border border-[#E2DDD4] dark:border-[#2E2B26] min-h-[38px] cursor-pointer"
                      title="تغییر وضعیت یا مسئول پیگیری"
                    >
                      وضعیت
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="text-[#69655F] dark:text-[#A8A29E] hover:text-[#212121] dark:hover:text-white p-2 rounded-lg min-h-[38px] cursor-pointer"
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
                    <span className="text-[11px] text-[#8E6F27] dark:text-[#E5CA8F]">
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
                          className="bg-white dark:bg-[#1E1D1A] p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-[#212121] dark:text-white">{b.title}</span>
                            <span className="font-mono text-[#8E6F27] dark:text-[#E5CA8F]">
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

                          <div className="flex items-center justify-between text-[11px] text-[#69655F] dark:text-[#A8A29E]">
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
                  <div className="p-4 sm:p-5 border-t border-[#E2DDD4] dark:border-[#2E2B26] space-y-4 bg-white dark:bg-[#1C1B18]">
                    {/* Dispatches history */}
                    <div>
                      <h4 className="text-xs font-black text-[#4A4742] dark:text-[#D5D0C7] mb-2">
                        سوابق ارسال با پیک / ناوگان:
                      </h4>

                      {(!req.dispatches || req.dispatches.length === 0) ? (
                        <p className="text-xs text-[#A8A29E] bg-[#FAF7F2] dark:bg-[#25231F] p-3 rounded-xl border border-dashed border-[#E2DDD4] dark:border-[#2E2B26]">
                          هنوز هیچ ارسالی برای این درخواست ثبت نشده است.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {req.dispatches.map((disp, dIdx) => (
                            <div
                              key={disp.id}
                              className="bg-[#FAF7F2] dark:bg-[#25231F] p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] space-y-2 text-xs"
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
                                  <span className="text-[11px] text-[#69655F] dark:text-[#A8A29E]">
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
                                    className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] hover:underline flex items-center gap-1 font-bold cursor-pointer py-1 px-2"
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
                                <p className="text-[11px] text-[#69655F] dark:text-[#A8A29E] bg-white dark:bg-[#1E1D1A] p-2 rounded-lg">
                                  توضیحات ارسال: {disp.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Follow-up officer & Action history */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E2DDD4] dark:border-[#2E2B26] text-xs">
                      <div>
                        <span className="font-bold text-[#4A4742] dark:text-[#D5D0C7] block mb-1">
                          مسئول پیگیری دفتر:
                        </span>
                        <div className="flex items-center gap-2 text-[#69655F] dark:text-[#A8A29E]">
                          <UserIcon className="w-4 h-4 text-[#C1A056]" />
                          <span>{req.assignedFollowUpUserName || 'تعیین نشده (ارجاع به همه)'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-[#4A4742] dark:text-[#D5D0C7] block mb-1">
                          یادداشت تکنسین سر کارگاه:
                        </span>
                        <p className="text-[#69655F] dark:text-[#A8A29E]">
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E2DDD4] dark:border-[#2E2B26]">
            <span className="text-xs text-[#69655F] dark:text-[#A8A29E]">
              نمایش {toPersianDigits((currentPage - 1) * ITEMS_PER_PAGE + 1)} تا{' '}
              {toPersianDigits(Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length))} از{' '}
              {toPersianDigits(filteredRequests.length)} درخواست
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[#E2DDD4] dark:border-[#2E2B26] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[36px] transition cursor-pointer"
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
                        ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#181818]'
                        : 'border border-[#E2DDD4] dark:border-[#2E2B26] hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] text-[#4A4742] dark:text-[#D5D0C7]'
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
                className="px-3 py-1.5 rounded-lg border border-[#E2DDD4] dark:border-[#2E2B26] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[36px] transition cursor-pointer"
              >
                بعدی
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DISPATCH DRAWER / MODAL */}
      {dispatchModalRequest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="bg-[#FAF7F2] dark:bg-[#1C1B18] w-full max-w-xl rounded-2xl shadow-2xl border border-[#E2DDD4] dark:border-[#2E2B26] overflow-hidden my-6">
            <div className="bg-[#212121] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
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
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
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
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
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
                      className="flex items-center justify-between gap-3 p-2.5 bg-white dark:bg-[#25231F] rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] text-xs"
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
                          className="w-16 p-1.5 rounded-lg text-center font-bold bg-[#FAF7F2] dark:bg-[#1C1B18] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056]"
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
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E2DDD4] dark:border-[#2E2B26]">
                <button
                  type="button"
                  onClick={() => setDispatchModalRequest(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] text-xs font-bold hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[44px] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition min-h-[44px] flex items-center gap-1.5 cursor-pointer shadow-md"
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
          <div className="bg-[#FAF7F2] dark:bg-[#1C1B18] w-full max-w-md rounded-2xl shadow-2xl border border-[#E2DDD4] dark:border-[#2E2B26] overflow-hidden my-6">
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
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
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
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#C1A056] min-h-[44px]"
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
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-[#25231F] border border-[#E2DDD4] dark:border-[#2E2B26] text-[#212121] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C1A056] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E2DDD4] dark:border-[#2E2B26]">
                <button
                  type="button"
                  onClick={() => setStatusModalRequest(null)}
                  className="px-4 py-2 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] text-xs font-bold hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] min-h-[44px] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#212121] text-[#C1A056] hover:bg-[#C1A056] hover:text-[#212121] text-xs font-black transition min-h-[44px] cursor-pointer"
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
          <div className="bg-white dark:bg-[#1C1B18] w-full max-w-lg rounded-2xl shadow-2xl border border-[#E2DDD4] dark:border-[#2E2B26] overflow-hidden my-6">
            <div className="bg-[#212121] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#C1A056]" />
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
              <pre className="bg-[#FAF7F2] dark:bg-[#121212] p-4 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] text-xs font-mono text-[#212121] dark:text-[#E2DDD4] whitespace-pre-wrap leading-relaxed select-all">
                {manifestText}
              </pre>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyManifest}
                  className="px-4 py-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] text-xs font-bold hover:bg-[#FAF7F2] dark:hover:bg-[#25231F] transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
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
                  className="px-5 py-2.5 rounded-xl bg-[#212121] text-[#C1A056] hover:bg-[#C1A056] hover:text-[#212121] text-xs font-black transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ حواله</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
