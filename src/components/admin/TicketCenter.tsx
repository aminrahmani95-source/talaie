import React, { useState, useMemo } from 'react';
import { Portal } from '../ui/Portal';
import { Ticket, User } from '../../types';
import {
  CheckCircle2,
  User as UserIcon,
  X,
  ZoomIn,
  AlertOctagon,
  Truck,
  Send,
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
  onNavigateTab?: (tab: any) => void;
}

type TicketStatusFilter = 'ALL' | 'OPEN' | 'CRITICAL' | 'RESOLVED';

export const TicketCenter: React.FC<Props> = ({ tickets, onUpdateTicket, currentUser, users, onNavigateTab }) => {
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
    return (users || []).filter((u) => u.role === 'WAREHOUSE' && u.active !== false);
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
    setReferralTargetUserId(ticket.assignedUserId || warehouseUsers[0]?.id || '');
    setReferralNoteText(ticket.referralNote || '');
    setReferralUrgent(ticket.isBlocking ?? true);
  };

  const handleConfirmReferral = (ticket: Ticket) => {
    if (!referralNoteText.trim()) {
      setReferralError('لطفاً شرح اقلام مورد نیاز یا دستور ارسال پیک را بنویسید.');
      return;
    }

    const targetUser = warehouseUsers.find((u) => u.id === referralTargetUserId) || warehouseUsers[0];
    const targetName = targetUser ? getDisplayName(targetUser.name) : 'انبار';
    const senderName = currentUser ? getDisplayName(currentUser.name) : 'مدیریت و هماهنگی';
    const nowIso = new Date().toISOString();

    const updated: Ticket = {
      ...ticket,
      assignedRole: 'WAREHOUSE',
      assignedDepartment: 'انبار و تدارکات',
      assignedTeamName: 'انبار مرکزی و لجستیک',
      assignedUserId: targetUser?.id || undefined,
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
        title="تیکت‌ها"
        subtitle={`مهلت پاسخ ۷۲ ساعت${
          resolvedCount > 0
            ? ` · ${toPersianDigits(Math.round(slaMetrics.onTimeRate))}٪ در مهلت · میانگین حل ${toPersianDigits(slaMetrics.averageResolutionHours.toFixed(1))} ساعت`
            : ''
        }`}
      />

      {/* عددهای باز/بحرانی روی تب‌ها هست؛ اینجا فقط هشدار تاخیر، اگر باشد */}
      {slaMetrics.openOverdue > 0 && (
        <button
          type="button"
          onClick={() => setFilter('CRITICAL')}
          className="w-full text-right p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 cursor-pointer"
        >
          <AlertOctagon className="w-4 h-4 shrink-0" />
          {toPersianDigits(slaMetrics.openOverdue)} تیکت از مهلت ۷۲ ساعته گذشته است
        </button>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface rounded-lg p-4 border border-line space-y-3">
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
                    ? 'bg-brand text-on-brand shadow-xs'
                    : 'bg-sunken border border-line text-ink-2 hover:bg-raised hover:text-ink'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    tab.alert && tab.count > 0
                      ? 'bg-rose-500 text-white'
                      : isActive
                      ? 'bg-canvas text-brand-ink'
                      : 'bg-line text-ink-2'
                  }`}
                >
                  {toPersianDigits(tab.count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category & Search Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-line">
          {/* Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md border border-line bg-sunken text-ink focus:border-brand"
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
              className="w-full text-xs p-2.5 rounded-md border border-line bg-sunken text-ink focus:border-brand"
            />
          </div>
        </div>
      </div>

      {/* Ticket List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-surface rounded-lg p-10 text-center border border-line  max-w-md mx-auto">
          <CheckCircle2 className="w-12 h-12 text-brand-ink mx-auto mb-2 opacity-50" />
          <h3 className="font-bold text-sm text-ink">هیچ تیکتی با این فیلتر یافت نشد</h3>
          <p className="text-xs text-ink-3 mt-1">
            همه موارد پیگیری شده یا معیارهای جستجو را تغییر دهید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 @min-[700px]:grid-cols-2 gap-4">
          {filteredTickets.map((t) => {
            const slaStatus = getTicketSlaStatus(t);
            const slaConfig = SLA_STATUS_LABELS[slaStatus];
            const remainingHours = getRemainingSlaHours(t);
            const elapsedHours = getElapsedHours(t);

            return (
              <div
                key={t.id}
                className={`bg-surface rounded-lg p-4 border  space-y-3.5 transition ${
                  slaStatus === 'OPEN_OVERDUE'
                    ? 'border-rose-400 dark:border-rose-800 ring-2 ring-rose-500/15'
                    : t.isBlocking
                    ? 'border-amber-400 dark:border-amber-800 ring-1 ring-amber-500/20'
                    : 'border-line'
                }`}
              >
                {/* سربرگ: پروژه + یک ردیف برچسب (مسدودکننده، مهلت، دسته) */}
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-bold text-sm text-ink leading-tight">{t.projectTitle}</h4>
                    <span className="font-mono text-xs text-ink-3 shrink-0">{t.projectCode}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {t.isBlocking && t.status === 'OPEN' && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded bg-rose-600 text-white">مسدودکننده</span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${slaConfig.badgeCls}`}>
                      {t.status === 'OPEN'
                        ? remainingHours > 0
                          ? `${toPersianDigits(remainingHours)} ساعت مانده`
                          : `${toPersianDigits(Math.abs(remainingHours))} ساعت تاخیر`
                        : `حل‌شده در ${toPersianDigits(elapsedHours)} ساعت`}
                    </span>
                    <span className="text-[11px] text-ink-3 truncate">{getCategoryTitle(t)}</span>
                  </div>
                </div>

                <p className="text-xs text-ink-2 leading-relaxed">
                  {t.description}
                  {t.isBlocking && t.blockingReason && t.blockingReason !== t.description && (
                    <span className="block text-rose-600 dark:text-rose-400 mt-1">علت توقف: {t.blockingReason}</span>
                  )}
                </p>
                <p className="text-[11px] text-ink-3 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {getDisplayName(t.authorName)} · {formatJalaliDateTime(t.createdAt)}
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
                          className="relative w-14 h-14 rounded-md overflow-hidden border border-line block group cursor-pointer"
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

                {/* ارجاع به انبار: یک خط وضعیت + دستور */}
                {(t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote)) && (
                  <div className="rounded-md bg-purple-500/10 border border-purple-500/30 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        در دست انبار: {t.assignedUserName || 'انبار'}
                      </span>
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('materials')}
                          className="text-[12px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                        >
                          کارتابل انبار ←
                        </button>
                      )}
                    </div>
                    {t.referralNote && <p className="text-ink-2">{t.referralNote}</p>}
                    {(t.referredByUserName || t.referredAt) && (
                      <p className="text-[11px] text-ink-3">
                        {t.referredByUserName ? `ارجاع: ${t.referredByUserName}` : ''}
                        {t.referredAt ? ` · ${formatJalaliDateTime(t.referredAt)}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* Action History / Resolution Details */}
                {t.status === 'RESOLVED' && (
                  <div className="bg-sunken rounded-md p-3 border border-brand/30 text-xs text-ink space-y-1">
                    <div className="font-bold flex items-center justify-between text-brand-ink">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>اقدام انجام شده:</span>
                      </span>
                      {t.resolvedAt && (
                        <span className="text-[12px] text-ink-3 font-normal">
                          {formatJalaliDateTime(t.resolvedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-2">{t.resolutionNote}</p>
                    {t.verifiedByUserName && (
                      <span className="text-[11px] text-ink-2 block pt-1">
                        تایید توسط: {t.verifiedByUserName}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Form for Open Tickets */}
                {t.status === 'OPEN' && (
                  <div className="pt-2 border-t border-line space-y-2">
                    {/* If this ticket is being referred */}
                    {referringTicketId === t.id ? (
                      <div className="bg-sunken border border-purple-500/50 rounded-lg p-3.5 space-y-3">
                        <div className="flex items-center justify-between text-purple-300 font-bold text-xs pb-1 border-b border-line">
                          <span className="flex items-center gap-1.5">
                            <Truck className="w-4 h-4 text-purple-400" />
                            <span>ارجاع به مسئول انبار و لجستیک جهت ارسال پیک / قطعه</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setReferringTicketId(null)}
                            className="text-ink-2 hover:text-ink"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Warehouse Officer Selector */}
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-ink block">
                            انتخاب مسئول انبار و تامین:
                          </label>
                          <select
                            value={referralTargetUserId}
                            onChange={(e) => setReferralTargetUserId(e.target.value)}
                            className="w-full text-xs p-2 rounded-md border border-line bg-canvas text-ink"
                          >
                            {warehouseUsers.length === 0 && <option value="">همه‌ی مسئولان انبار</option>}
                            {warehouseUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {getDisplayName(u.name)} (مسئول انبار و لجستیک)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Referral Instructions Note */}
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-ink block">
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
                            className="w-full text-xs p-2.5 rounded-md border border-line bg-canvas text-ink focus:border-purple-500 focus:outline-none"
                          />
                          {referralError && (
                            <p className="text-[12px] text-rose-400 font-bold">{referralError}</p>
                          )}
                        </div>

                        {/* Urgent/Blocking Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-ink">
                          <input
                            type="checkbox"
                            checked={referralUrgent}
                            onChange={(e) => setReferralUrgent(e.target.checked)}
                            className="rounded border-line-strong text-purple-600 focus:ring-purple-500 w-4 h-4"
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
                      <div className="space-y-2 bg-sunken border border-line rounded-lg p-3">
                        <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>ثبت اقدام و بستن مستقیم تیکت توسط QC / مدیریت</span>
                        </div>
                        <textarea
                          rows={2}
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder="اقدام انجام شده جهت رفع مشکل و بستن تیکت را شرح دهید..."
                          className="w-full text-xs p-2.5 rounded-md border border-line bg-canvas text-ink"
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
        <Portal><div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-12 left-0 text-ink hover:text-rose-400 p-2 rounded-full bg-white/10 cursor-pointer"
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
        </div></Portal>
      )}
    </div>
  );
};
