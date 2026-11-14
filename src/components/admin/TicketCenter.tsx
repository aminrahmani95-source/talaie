import React, { useState, useMemo } from 'react';
import { Ticket, IssueCategory, SlaStatus, User } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  X,
  ZoomIn,
  AlertOctagon,
  Activity,
  Flame,
  Filter,
  Layers,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { toPersianDigits, formatJalaliDateTime } from '../../utils/jalali';
import { CloudImage } from '../common/CloudImage';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { getDisplayName } from '../../utils/technicianName';
import {
  computeSlaMetrics,
  getTicketSlaStatus,
  getRemainingSlaHours,
  getElapsedHours,
  SLA_STATUS_LABELS,
  ISSUE_CATEGORY_LABELS,
} from '../../utils/sla';

interface Props {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
  currentUser?: User;
}

type SlaFilterTab = 'ALL' | 'OPEN_IN_SLA' | 'OPEN_OVERDUE' | 'RESOLVED_IN_SLA' | 'RESOLVED_OVERDUE';

export const TicketCenter: React.FC<Props> = ({ tickets, onUpdateTicket, currentUser }) => {
  const [filter, setFilter] = useState<SlaFilterTab>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [blockingOnly, setBlockingOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Compute SLA Metrics
  const slaMetrics = useMemo(() => computeSlaMetrics(tickets), [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const slaStatus = getTicketSlaStatus(t);

      // SLA Status filter
      if (filter !== 'ALL' && slaStatus !== filter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) {
        return false;
      }

      // Blocking filter
      if (blockingOnly && !t.isBlocking) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = t.projectTitle?.toLowerCase().includes(q);
        const matchesCode = t.projectCode?.toLowerCase().includes(q);
        const matchesAuthor = t.authorName?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesAuthor && !matchesDesc) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, filter, categoryFilter, blockingOnly, searchQuery]);

  const handleResolve = (ticket: Ticket) => {
    if (!resolutionNote.trim()) {
      alert('لطفاً اقدام انجام شده جهت حل مشکل را بنویسید.');
      return;
    }

    const resolvedAt = new Date().toISOString();
    const updated: Ticket = {
      ...ticket,
      status: 'RESOLVED',
      resolutionNote: resolutionNote.trim(),
      resolvedAt,
      verifiedByUserId: currentUser?.id,
      verifiedByUserName: currentUser ? getDisplayName(currentUser.name) : undefined,
      actionHistory: [
        ...(ticket.actionHistory || []),
        {
          id: `act-${Date.now()}`,
          timestamp: resolvedAt,
          action: 'RESOLVED',
          byUserId: currentUser?.id || 'qc-mgr',
          byUserName: currentUser ? getDisplayName(currentUser.name) : 'مدیریت QC',
          note: resolutionNote.trim(),
        },
      ],
    };

    onUpdateTicket(updated);
    setResolvingId(null);
    setResolutionNote('');
  };

  const getCategoryTitle = (ticket: Ticket) => {
    if (ticket.category && ISSUE_CATEGORY_LABELS[ticket.category]) {
      return ISSUE_CATEGORY_LABELS[ticket.category];
    }
    switch (ticket.type) {
      case 'DEFICIENCY_FABRIC':
        return 'کسری یا آسیب پارچه';
      case 'DAMAGED_HARDWARE':
        return 'خرابی یراق‌آلات یا موتور';
      case 'WALL_ISSUE':
        return 'مشکل زیرسازی و دیوار/سقف';
      case 'MEASUREMENT_MISMATCH':
        return 'مغایرت ابعاد و متراژ';
      case 'CUSTOMER_ABSENT':
        return 'عدم حضور کارفرما';
      default:
        return 'سایر موارد فنی';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="مرکز تیکت‌ها و پایش SLA ۷۲ ساعته"
        subtitle="مدیریت یکپارچه نواقص اجرایی، خرابی‌های ابزار، تطابق استانداردها و حل بحران‌ها"
      />

      {/* KPI Performance Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: SLA Compliance */}
        <div className="bg-[#151B23] rounded-lg p-4 border border-[#212835]  space-y-2">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold">نرخ رعایت SLA ۷۲h</span>
            <Activity className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#F0F4F8]">
              %{toPersianDigits(slaMetrics.onTimeRate.toFixed(1))}
            </span>
            <span className="text-[10px] text-neutral-400">انطباق کلی</span>
          </div>
          <div className="w-full bg-[#111620] border border-[#212835] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                slaMetrics.onTimeRate >= 90
                  ? 'bg-emerald-500'
                  : slaMetrics.onTimeRate >= 75
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, slaMetrics.onTimeRate))}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Open Overdue */}
        <div className="bg-[#151B23] rounded-lg p-4 border border-[#212835]  space-y-2">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold">تیکت‌های بحرانی منقضی</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                slaMetrics.openOverdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {toPersianDigits(slaMetrics.openOverdue)}
            </span>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
              {slaMetrics.openOverdue > 0 ? 'عبور از ۷۲ ساعت' : 'صفر (عالی)'}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 block truncate">
            از مجموع {toPersianDigits(slaMetrics.openCount)} تیکت باز در سیستم
          </span>
        </div>

        {/* Metric 3: Avg Resolution Hours */}
        <div className="bg-[#151B23] rounded-lg p-4 border border-[#212835]  space-y-2">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold">میانگین زمان حل</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#F0F4F8]">
              {toPersianDigits(slaMetrics.averageResolutionHours.toFixed(1))}
            </span>
            <span className="text-[10px] text-neutral-400">ساعت</span>
          </div>
          <span className="text-[11px] text-neutral-400 block truncate">
            {toPersianDigits(slaMetrics.resolvedInSla)} مورد حل در موعد
          </span>
        </div>

        {/* Metric 4: Blocking Issues */}
        <div className="bg-[#151B23] rounded-lg p-4 border border-[#212835]  space-y-2">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold">مسدودکننده‌های عملیات</span>
            <AlertOctagon className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {toPersianDigits(tickets.filter((t) => t.status === 'OPEN' && t.isBlocking).length)}
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Blocking</span>
          </div>
          <span className="text-[11px] text-neutral-400 block truncate">نیاز به مداخله فوری سرپرست</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#151B23] rounded-lg p-4 border border-[#212835]  space-y-3">
        {/* SLA Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'همه تیکت‌ها', count: tickets.length },
            { id: 'OPEN_IN_SLA', label: 'باز در مهلت', count: slaMetrics.openInSla },
            { id: 'OPEN_OVERDUE', label: 'بحرانی منقضی', count: slaMetrics.openOverdue, alert: true },
            { id: 'RESOLVED_IN_SLA', label: 'حل به موقع', count: slaMetrics.resolvedInSla },
            { id: 'RESOLVED_OVERDUE', label: 'حل با تاخیر', count: slaMetrics.resolvedOverdue },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as SlaFilterTab)}
                className={`px-3 py-1.5 rounded-md font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#212121] dark:bg-[#C1A056] text-white dark:text-[#141414] '
                    : 'bg-[#111620] border border-[#212835] text-[#9BA7B6] hover:bg-[#1C232D] hover:text-[#F0F4F8]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    tab.alert && tab.count > 0
                      ? 'bg-rose-500 text-white'
                      : isActive
                      ? 'bg-white/20 text-current'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {toPersianDigits(tab.count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category & Search Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#212835]">
          {/* Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#111620] dark:text-white"
            >
              <option value="ALL">همه دسته‌بندی‌های ایراد (۸ گانه)</option>
              {Object.entries(ISSUE_CATEGORY_LABELS).map(([catKey, catLabel]) => (
                <option key={catKey} value={catKey}>
                  {catLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس پروژه، کد یا فرستنده..."
              className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#111620] dark:text-white"
            />
          </div>

          {/* Blocking Only Toggle */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={blockingOnly}
                onChange={(e) => setBlockingOnly(e.target.checked)}
                className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <AlertOctagon className="w-3.5 h-3.5" />
                فقط موارد مسدودکننده (Blocking)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Ticket List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-[#151B23] rounded-lg p-10 text-center border border-[#212835]  max-w-md mx-auto">
          <CheckCircle2 className="w-12 h-12 text-[#C5A059] mx-auto mb-2 opacity-50" />
          <h3 className="font-bold text-sm text-[#F0F4F8]">هیچ تیکتی با این فیلتر یافت نشد</h3>
          <p className="text-xs text-[#637184] mt-1">
            همه موارد پیگیری شده یا معیارهای جستجو را تغییر دهید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((t) => {
            const slaStatus = getTicketSlaStatus(t);
            const slaConfig = SLA_STATUS_LABELS[slaStatus];
            const remainingHours = getRemainingSlaHours(t);
            const elapsedHours = getElapsedHours(t);

            return (
              <div
                key={t.id}
                className={`bg-[#151B23] rounded-lg p-4 border  space-y-3.5 transition ${
                  slaStatus === 'OPEN_OVERDUE'
                    ? 'border-rose-400 dark:border-rose-800 ring-2 ring-rose-500/15'
                    : t.isBlocking
                    ? 'border-amber-400 dark:border-amber-800 ring-1 ring-amber-500/20'
                    : 'border-[#212835]'
                }`}
              >
                {/* Header: Category Badge + SLA Badge */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#111620] text-[#F0F4F8] border border-[#212835] line-clamp-1">
                    {getCategoryTitle(t)}
                  </span>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border shrink-0 ${slaConfig.badgeCls}`}>
                    {slaConfig.label}
                  </span>
                </div>

                {/* Project Title and Author */}
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-bold text-sm text-[#F0F4F8] leading-tight">
                      {t.projectTitle}
                    </h4>
                    <span className="font-mono text-xs text-neutral-400 shrink-0">{t.projectCode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#637184] mt-1">
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3 h-3 text-neutral-400" />
                      {getDisplayName(t.authorName)}
                    </span>
                    <span>•</span>
                    <span>{formatJalaliDateTime(t.createdAt)}</span>
                  </div>
                </div>

                {/* Blocking Alert Pill */}
                {t.isBlocking && (
                  <div className="p-2.5 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">مسدودکننده عملیات نصب (Blocking)</span>
                      {t.blockingReason && (
                        <span className="text-[11px] text-rose-600/90 dark:text-rose-300/90 mt-0.5 block">
                          علت: {t.blockingReason}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* SLA Countdown / Time Elapsed Banner */}
                <div className="p-2 rounded-md bg-[#111620] border border-[#212835] flex items-center justify-between text-xs">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span>وضعیت مهلت ۷۲h:</span>
                  </span>
                  {t.status === 'OPEN' ? (
                    remainingHours > 0 ? (
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {toPersianDigits(remainingHours)} ساعت باقی‌مانده
                      </span>
                    ) : (
                      <span className="font-bold text-rose-600 dark:text-rose-400 font-mono animate-pulse">
                        {toPersianDigits(Math.abs(remainingHours))} ساعت تاخیر بحرانی!
                      </span>
                    )
                  ) : (
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      حل شده در {toPersianDigits(elapsedHours)} ساعت
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-[#9BA7B6] bg-[#111620] p-3 rounded-md border border-[#212835] leading-relaxed">
                  {t.description}
                </p>

                {/* Photos */}
                {t.photos && t.photos.filter((p) => Boolean(p && p.trim() !== '')).length > 0 && (
                  <div className="flex items-center gap-2">
                    {t.photos
                      .filter((p) => Boolean(p && p.trim() !== ''))
                      .map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPreviewPhoto(p)}
                          className="relative w-14 h-14 rounded-md overflow-hidden border border-[#212835] block group cursor-pointer"
                          aria-label="مشاهده تصویر ضمیمه"
                        >
                          <CloudImage
                            src={p}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {/* Action History / Resolution Details */}
                {t.status === 'RESOLVED' && (
                  <div className="bg-[#111620] rounded-md p-3 border border-[#C5A059]/30 text-xs text-[#F0F4F8] space-y-1">
                    <div className="font-bold flex items-center justify-between text-[#C5A059]">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>اقدام انجام شده:</span>
                      </span>
                      {t.resolvedAt && (
                        <span className="text-[11px] text-[#637184] font-normal">
                          {formatJalaliDateTime(t.resolvedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9BA7B6]">{t.resolutionNote}</p>
                    {t.verifiedByUserName && (
                      <span className="text-[10px] text-neutral-400 block pt-1">
                        تایید توسط: {t.verifiedByUserName}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Form for Open Tickets */}
                {t.status === 'OPEN' && (
                  <div className="pt-2 border-t border-[#212835]">
                    {resolvingId === t.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder="اقدام انجام شده جهت رفع مشکل و بستن تیکت را شرح دهید..."
                          className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleResolve(t)}
                            icon={<CheckCircle2 className="w-4 h-4" />}
                            className="flex-1"
                          >
                            ثبت حل مشکل
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setResolvingId(null)}>
                            انصراف
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setResolvingId(t.id)}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        className="w-full"
                      >
                        اقدام و رفع مشکل
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox for Ticket Photo */}
      {previewPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-12 left-0 text-white hover:text-rose-400 p-2 rounded-full bg-white/10 cursor-pointer"
              aria-label="بستن"
            >
              <X className="w-6 h-6" />
            </button>
            <CloudImage
              src={previewPhoto}
              alt="عکس تیکت"
              className="max-h-[85vh] max-w-full rounded-lg shadow-2xl object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
