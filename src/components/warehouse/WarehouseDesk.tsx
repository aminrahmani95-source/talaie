import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { toPersianDigits, getUpcomingDays, getTodayPersianString, formatJalali } from '../../utils/jalali';

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
}

export const WarehouseDesk: React.FC<Props> = ({
  currentUser,
  projects,
  tickets,
  onConfirmPacking,
  onResolveTicket,
}) => {
  const [activeTab, setActiveTab] = useState<'PACKING' | 'TICKETS'>('PACKING');
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

  // Tomorrow and upcoming days
  const tomorrowKey = useMemo(() => getUpcomingDays(7)[1]?.dateKey || '', []);
  const todayKey = useMemo(() => getUpcomingDays(7)[0]?.dateKey || '', []);

  // Filter projects for tomorrow / upcoming that need packing
  const upcomingDispatchProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        p.status === 'SCHEDULED' ||
        (p.status === 'IN_PROGRESS' && p.endDate && p.endDate >= todayKey)
    );
  }, [projects, todayKey]);

  // Warehouse tickets: tickets assigned to warehouse or open tickets
  const warehouseTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'OPEN');
  }, [tickets]);

  const handlePackingSubmit = async (projectId: string) => {
    setProcessingId(projectId);
    try {
      await onConfirmPacking(projectId, packingNotes[projectId]);
    } finally {
      setProcessingId(null);
    }
  };

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
      <div className="bg-[#151B23] rounded-2xl p-5 border border-[#212835] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#F0F4F8] flex items-center gap-2">
            <span>میز کار انبار و لجستیک تامین قطعات</span>
            <span className="text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
              انبار مرکزی طلائیه
            </span>
          </h2>
          <p className="text-xs text-[#9BA7B6] mt-1">
            بسته‌بندی و آماده‌سازی بارهای مأموریت‌های فردا و رسیدگی فوری به تیکت‌های کسری سر پروژه
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-[#0D1117] p-1.5 rounded-xl border border-[#212835] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('PACKING')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'PACKING'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>بسته‌بندی بارهای فردا ({toPersianDigits(upcomingDispatchProjects.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TICKETS')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'TICKETS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>تیکت‌های فوری کسری سر پروژه ({toPersianDigits(warehouseTickets.length)})</span>
          </button>
        </div>
      </div>

      {/* ===================== TAB 1: PRE-DISPATCH PACKING ===================== */}
      {activeTab === 'PACKING' && (
        <div className="space-y-4">
          <div className="bg-[#111620] p-4 rounded-xl border border-purple-500/20 text-xs text-purple-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              با زدن دکمه «تایید بسته‌بندی»، در تقویم مدیر فنی یک چراغ سبز روشن می‌شود و مدیر از تکمیل بار مأموریت فردا مطمئن خواهد شد.
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
                          <span className="text-xs text-[#9BA7B6] font-bold">
                            تاریخ نصب: {formatJalali(p.scheduledDate)}
                          </span>
                          {p.isForceMajeure && (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded">
                              فورس‌ماژور 🔥
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-[#F0F4F8] mt-1">{p.title}</h4>
                      </div>

                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        isPacked
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                      }`}>
                        {isPacked ? 'بسته‌بندی شد ✅' : 'در انتظار آماده‌سازی'}
                      </span>
                    </div>

                    {/* Technical details of the items to pack */}
                    <div className="p-3 bg-[#0D1117] rounded-xl border border-[#212835] text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[#F0F4F8] font-bold">
                        <span>اقلام سفارش:</span>
                        <span className="text-[#C5A059]">
                          {p.shadePanels > 0 && `${toPersianDigits(p.shadePanels)} لت شید`}
                          {p.shadePanels > 0 && p.curtainPanels > 0 && ' • '}
                          {p.curtainPanels > 0 && `${toPersianDigits(p.curtainPanels)} لت پرده`}
                        </span>
                      </div>
                      {p.mechanismType && (
                        <p className="text-[11px] text-[#9BA7B6]">
                          مکانیزم: <strong className="text-[#F0F4F8]">{p.mechanismType}</strong>
                        </p>
                      )}
                      {p.specialTools && p.specialTools.length > 0 && (
                        <div className="pt-1 border-t border-[#212835] flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                          <Wrench className="w-3.5 h-3.5 text-amber-400" />
                          <span>ابزار ویژه همراه: {p.specialTools.join('، ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    {isPacked ? (
                      <div className="text-xs text-emerald-400 font-bold flex items-center justify-between pt-1">
                        <span>آماده تحویل در انبار (توسط {p.warehousePrep?.packedByUserName})</span>
                        <span className="text-[10px] text-[#637184] font-mono">
                          {p.warehousePrep?.packedAt?.slice(11, 16)}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={packingNotes[p.id] || ''}
                          onChange={(e) =>
                            setPackingNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="یادداشت بسته‌بندی یا شماره قفسه (اختیاری)..."
                          className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] outline-none"
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handlePackingSubmit(p.id)}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>تایید بسته‌بندی و اعلام آمادگی بار به مدیر ✅</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: URGENT SITE TICKETS ===================== */}
      {activeTab === 'TICKETS' && (
        <div className="space-y-4">
          {warehouseTickets.length === 0 ? (
            <div className="bg-[#151B23] rounded-2xl p-10 text-center border border-[#212835] text-xs text-[#9BA7B6]">
              هیچ تیکت باز یا کسری اعلام‌شده‌ای از سر پروژه‌ها وجود ندارد.
            </div>
          ) : (
            <div className="space-y-3">
              {warehouseTickets.map((t) => (
                <div
                  key={t.id}
                  className="bg-[#151B23] rounded-2xl p-5 border border-[#212835] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                          کسری سر کارگاه
                        </span>
                        <h4 className="text-sm font-black text-[#F0F4F8]">{t.projectTitle || 'پروژه'}</h4>
                      </div>
                      <p className="text-xs text-[#9BA7B6] mt-1">{t.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTicket(t);
                        setActionType('SUPPLIED');
                        setTicketError('');
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
                    >
                      <Package className="w-4 h-4" />
                      <span>رسیدگی و تعیین وضعیت</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ticket Response Modal (3 Actions: Supplied / Courier / Delayed) */}
      {selectedTicket && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-[#151B23] rounded-2xl max-w-lg w-full p-6 border border-purple-500/40 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[#212835] pb-3">
              <h3 className="text-sm sm:text-base font-black text-[#F0F4F8]">
                رسیدگی به کسری سر پروژه ({selectedTicket.projectTitle || 'پروژه'})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9BA7B6] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Action Selector */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActionType('SUPPLIED')}
                className={`p-3 rounded-xl border text-center transition font-bold cursor-pointer ${
                  actionType === 'SUPPLIED'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-[#111620] border-[#212835] text-[#9BA7B6]'
                }`}
              >
                ۱. تامین شد (انبار)
              </button>
              <button
                type="button"
                onClick={() => setActionType('DISPATCHED_COURIER')}
                className={`p-3 rounded-xl border text-center transition font-bold cursor-pointer ${
                  actionType === 'DISPATCHED_COURIER'
                    ? 'bg-purple-500/15 border-purple-500 text-purple-300'
                    : 'bg-[#111620] border-[#212835] text-[#9BA7B6]'
                }`}
              >
                ۲. ارسال با پیک
              </button>
              <button
                type="button"
                onClick={() => setActionType('DELAYED')}
                className={`p-3 rounded-xl border text-center transition font-bold cursor-pointer ${
                  actionType === 'DELAYED'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                    : 'bg-[#111620] border-[#212835] text-[#9BA7B6]'
                }`}
              >
                ۳. عدم امکان فوری
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
                      placeholder="مثال: فردا ساعت ۱۲ ظهر یا تاریخ ۲۸ آبان"
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
