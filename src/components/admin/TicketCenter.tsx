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
  Truck,
  Send,
  Package,
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
  users?: User[];
}

type TicketStatusFilter = 'ALL' | 'OPEN' | 'CRITICAL' | 'RESOLVED';

export const TicketCenter: React.FC<Props> = ({ tickets, onUpdateTicket, currentUser, users }) => {
  const [filter, setFilter] = useState<TicketStatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Referral to Warehouse states
  const [referringTicketId, setReferringTicketId] = useState<string | null>(null);
  const [referralTargetUserId, setReferralTargetUserId] = useState<string>('');
  const [referralNoteText, setReferralNoteText] = useState<string>('');
  const [referralUrgent, setReferralUrgent] = useState<boolean>(true);
  const [referralError, setReferralError] = useState<string>('');

  // Extract warehouse personnel
  const warehouseUsers = useMemo(() => {
    const list = (users || []).filter((u) => u.role === 'WAREHOUSE' && u.active !== false);
    if (list.length > 0) return list;
    return [
      {
        id: 'wh-davood',
        name: 'داوود حسینی',
        role: 'WAREHOUSE' as const,
        active: true,
      },
    ];
  }, [users]);

  // Compute SLA Metrics
  const slaMetrics = useMemo(() => computeSlaMetrics(tickets), [tickets]);

  // Filter counts
  const criticalCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'OPEN' && (t.isBlocking || getTicketSlaStatus(t) === 'OPEN_OVERDUE')).length;
  }, [tickets]);

  const openInSlaCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'OPEN' && !t.isBlocking && getTicketSlaStatus(t) !== 'OPEN_OVERDUE').length;
  }, [tickets]);

  const resolvedCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'RESOLVED').length;
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const isCritical = t.isBlocking || getTicketSlaStatus(t) === 'OPEN_OVERDUE';

      // Status filter
      if (filter === 'OPEN') {
        if (t.status !== 'OPEN' || isCritical) return false;
      } else if (filter === 'CRITICAL') {
        if (t.status !== 'OPEN' || !isCritical) return false;
      } else if (filter === 'RESOLVED') {
        if (t.status !== 'RESOLVED') return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) {
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
  }, [tickets, filter, categoryFilter, searchQuery]);

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

  const handleStartReferral = (ticket: Ticket) => {
    setReferringTicketId(ticket.id);
    setResolvingId(null);
    setReferralError('');
    setReferralTargetUserId(ticket.assignedUserId || warehouseUsers[0]?.id || 'wh-davood');
    setReferralNoteText(ticket.referralNote || '');
    setReferralUrgent(ticket.isBlocking ?? true);
  };

  const handleConfirmReferral = (ticket: Ticket) => {
    if (!referralNoteText.trim()) {
      setReferralError('لطفاً شرح اقلام مورد نیاز یا دستور ارسال پیک را بنویسید.');
      return;
    }

    const targetUser = warehouseUsers.find((u) => u.id === referralTargetUserId) || warehouseUsers[0];
    const targetName = targetUser ? getDisplayName(targetUser.name) : 'داوود حسینی (مسئول انبار)';
    const senderName = currentUser ? getDisplayName(currentUser.name) : 'مدیریت و هماهنگی';
    const nowIso = new Date().toISOString();

    const updated: Ticket = {
      ...ticket,
      assignedRole: 'WAREHOUSE',
      assignedDepartment: 'انبار و تدارکات',
      assignedTeamName: 'انبار مرکزی و لجستیک',
      assignedUserId: targetUser?.id || 'wh-davood',
      assignedUserName: targetName,
      referralNote: referralNoteText.trim(),
      referredAt: nowIso,
      referredByUserName: senderName,
      isBlocking: referralUrgent,
      blockingReason: referralUrgent
        ? (ticket.blockingReason || `کسری متریال سر پروژه: ${referralNoteText.trim()}`)
        : ticket.blockingReason,
      actionHistory: [
        ...(ticket.actionHistory || []),
        {
          id: `act-${Date.now()}`,
          timestamp: nowIso,
          action: 'REFERRED_TO_WAREHOUSE',
          byUserId: currentUser?.id || 'coord-mgr',
          byUserName: senderName,
          note: `ارجاع به ${targetName}: ${referralNoteText.trim()}${referralUrgent ? ' (ارسال فوری/بحرانی)' : ''}`,
        },
      ],
    };

    onUpdateTicket(updated);
    setReferringTicketId(null);
    setReferralNoteText('');
    setReferralError('');
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
        title="مرکز تیکت‌ها و پایش SLA 72 ساعته"
        subtitle="مدیریت یکپارچه نواقص اجرایی، خرابی‌های ابزار، تطابق استانداردها و حل بحران‌ها"
      />

      {/* KPI Performance Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: SLA Compliance */}
        <div className="bg-[#151B23] rounded-lg p-4 border border-[#212835]  space-y-2">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold">نرخ رعایت SLA 72h</span>
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
              {slaMetrics.openOverdue > 0 ? 'عبور از 72 ساعت' : 'صفر (عالی)'}
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
      <div className="bg-[#151B23] rounded-lg p-4 border border-[#212835] space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'همه تیکت‌ها', count: tickets.length },
            { id: 'OPEN', label: 'باز در مهلت', count: openInSlaCount },
            { id: 'CRITICAL', label: 'بحرانی و مسدودکننده', count: criticalCount, alert: true },
            { id: 'RESOLVED', label: 'حل‌شده', count: resolvedCount },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as TicketStatusFilter)}
                className={`px-3 py-1.5 rounded-md font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#C5A059] text-[#0D1117] shadow-xs'
                    : 'bg-[#111620] border border-[#212835] text-[#9BA7B6] hover:bg-[#1C232D] hover:text-[#F0F4F8]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    tab.alert && tab.count > 0
                      ? 'bg-rose-500 text-white'
                      : isActive
                      ? 'bg-[#0D1117] text-[#C5A059]'
                      : 'bg-[#212835] text-[#9BA7B6]'
                  }`}
                >
                  {toPersianDigits(tab.count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category & Search Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#212835]">
          {/* Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#111620] text-[#F0F4F8] focus:border-[#C5A059]"
            >
              <option value="ALL">همه دسته‌بندی‌های ایراد (8 گانه)</option>
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
              className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#111620] text-[#F0F4F8] focus:border-[#C5A059]"
            />
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
                    <span>وضعیت مهلت 72h:</span>
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

                {/* Referral to Warehouse Status Card */}
                {(t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote)) && (
                  <div className="bg-purple-950/25 border border-purple-500/40 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-purple-400" />
                        <span>ارجاع شده به انبار و لجستیک</span>
                      </span>
                      {t.referredAt && (
                        <span className="text-[10px] text-purple-400/80 font-normal">
                          {formatJalaliDateTime(t.referredAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#C5A059] bg-[#111620] px-2.5 py-1.5 rounded border border-[#212835]">
                      <span className="text-neutral-400">تحویل‌گیرنده اقدام:</span>
                      <span className="font-bold text-white flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-purple-400" />
                        {t.assignedUserName || 'داوود حسینی (مسئول انبار)'}
                      </span>
                    </div>
                    {t.referralNote && (
                      <div className="text-xs text-[#F0F4F8] bg-[#0D1117] p-2.5 rounded border border-purple-500/20 space-y-1">
                        <span className="text-[11px] text-purple-300 font-bold block">دستور اقدام و تامین قطعه:</span>
                        <p className="text-xs text-[#9BA7B6] leading-relaxed">{t.referralNote}</p>
                      </div>
                    )}
                    {t.referredByUserName && (
                      <span className="text-[10px] text-neutral-500 block">
                        ارسال‌شده توسط: {t.referredByUserName}
                      </span>
                    )}
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
                  <div className="pt-2 border-t border-[#212835] space-y-2">
                    {/* If this ticket is being referred */}
                    {referringTicketId === t.id ? (
                      <div className="bg-[#111620] border border-purple-500/50 rounded-lg p-3.5 space-y-3">
                        <div className="flex items-center justify-between text-purple-300 font-bold text-xs pb-1 border-b border-[#212835]">
                          <span className="flex items-center gap-1.5">
                            <Truck className="w-4 h-4 text-purple-400" />
                            <span>ارجاع به مسئول انبار و لجستیک جهت ارسال پیک / قطعه</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setReferringTicketId(null)}
                            className="text-neutral-400 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Warehouse Officer Selector */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-neutral-300 block">
                            انتخاب مسئول انبار و تامین:
                          </label>
                          <select
                            value={referralTargetUserId}
                            onChange={(e) => setReferralTargetUserId(e.target.value)}
                            className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#0D1117] text-white"
                          >
                            {warehouseUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {getDisplayName(u.name)} (مسئول انبار و لجستیک)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Referral Instructions Note */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-neutral-300 block">
                            دستور اقدام و شرح اقلام درخواستی: *
                          </label>
                          <textarea
                            rows={2}
                            value={referralNoteText}
                            onChange={(e) => {
                              setReferralNoteText(e.target.value);
                              if (referralError) setReferralError('');
                            }}
                            placeholder="مثال: کسری ۲ عدد براکت و رول پارچه - لطفاً سریعاً با پیک اسنپ به آدرس پروژه ارسال شود..."
                            className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] text-white focus:border-purple-500 focus:outline-none"
                          />
                          {referralError && (
                            <p className="text-[11px] text-rose-400 font-bold">{referralError}</p>
                          )}
                        </div>

                        {/* Urgent/Blocking Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-neutral-300">
                          <input
                            type="checkbox"
                            checked={referralUrgent}
                            onChange={(e) => setReferralUrgent(e.target.checked)}
                            className="rounded border-neutral-600 text-purple-600 focus:ring-purple-500 w-4 h-4"
                          />
                          <span>ارسال با اولویت فوری (اعلام به عنوان مانع کار نصاب)</span>
                        </label>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleConfirmReferral(t)}
                            className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>تایید و ارسال به کارتابل انبار</span>
                          </button>
                          <Button variant="ghost" size="sm" onClick={() => setReferringTicketId(null)}>
                            انصراف
                          </Button>
                        </div>
                      </div>
                    ) : resolvingId === t.id ? (
                      /* Direct Resolution Form */
                      <div className="space-y-2 bg-[#111620] border border-[#212835] rounded-lg p-3">
                        <div className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>ثبت اقدام و بستن مستقیم تیکت توسط QC / مدیریت</span>
                        </div>
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
                      /* Dual Action Buttons */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartReferral(t)}
                          className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer border border-purple-500/30"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>
                            {t.assignedRole === 'WAREHOUSE' ? 'ویرایش ارجاع به انبار' : 'ارجاع به انبار و لجستیک'}
                          </span>
                        </button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setResolvingId(t.id);
                            setReferringTicketId(null);
                          }}
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          className="w-full"
                        >
                          اقدام و رفع مستقیم
                        </Button>
                      </div>
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
