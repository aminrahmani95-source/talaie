import React, { useState, useMemo } from 'react';
import { Project, User, ProjectStatus, MaterialRequest } from '../../types';
import {
  Clock,
  MapPin,
  Phone,
  Navigation,
  FileText,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Car,
  Play,
  AlertOctagon,
  MoreVertical,
  Layers,
  Loader2,
  Moon,
  ArrowRightLeft,
  Package,
} from 'lucide-react';
import { toPersianDigits, localDateKey } from '../../utils/jalali';
import { ActiveJobTimer } from '../ActiveJobTimer';
import { StatusPill } from '../ui/StatusPill';
import { getMultiDayProgress } from '../../utils/multiDay';
import { calculateActivityProgress } from '../../utils/planProgress';
import { getLatestTeamTransfer, isPendingTransferAcknowledgment, hasPendingTransfer } from '../../utils/teamTransfer';

interface Props {
  project: Project;
  currentUser: User;
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onOpenDailyLogModal?: (project: Project) => void;
  onUpdateStatus: (projectId: string, from: ProjectStatus, to: ProjectStatus) => void;
  onOpenCertificate?: (project: Project) => void;
  onReportStuck?: (project: Project) => void;
  onConfirmTransfer?: (project: Project) => void;
  materialRequests?: MaterialRequest[];
  onOpenMaterialModal?: (project: Project) => void;
  onConfirmMaterialReceipt?: (request: MaterialRequest, dispatchId: string) => void;
  onResolveDefect?: (projectId: string, defectId: string, resolutionNotes: string, photos?: string[]) => void;
  isTransitioning?: boolean;
}

export const ProjectCard: React.FC<Props> = ({
  project,
  currentUser,
  onViewProposal,
  onOpenToolChecklist,
  onOpenTicketModal,
  onOpenCompletionModal,
  onOpenDailyLogModal,
  onUpdateStatus,
  onOpenCertificate,
  onReportStuck,
  onConfirmTransfer,
  materialRequests = [],
  onOpenMaterialModal,
  onConfirmMaterialReceipt,
  onResolveDefect,
  isTransitioning = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [resolvingDefectId, setResolvingDefectId] = useState<string | null>(null);
  const [resolvingNotes, setResolvingNotes] = useState<string>('');
  const [confirmingReceiptTarget, setConfirmingReceiptTarget] = useState<{
    request: MaterialRequest;
    dispatch: any;
  } | null>(null);

  const isStuck = project.status === 'STUCK';
  const isInProgress = project.status === 'IN_PROGRESS';
  const isEnRoute = project.status === 'EN_ROUTE';
  const isCompleted = project.status === 'COMPLETED';
  const isScheduled = project.status === 'SCHEDULED';
  const isPaused = project.status === 'PAUSED';
  const isRejected = project.qcStatus === 'REJECTED';

  const multiDayProgress = getMultiDayProgress(project);
  const todayYmd = localDateKey();
  const isBeforeEndDate = Boolean(project.endDate && todayYmd < project.endDate);
  const progressList = useMemo(() => calculateActivityProgress(project), [project]);
  const latestTransfer = getLatestTeamTransfer(project);
  const actualTeamId = currentUser.teamId;
  const isPendingTransfer = isPendingTransferAcknowledgment(project, currentUser, actualTeamId);
  const isLead =
    currentUser.id === project.leadTechnicianId &&
    currentUser.role === 'LEAD_TECHNICIAN' &&
    Boolean(actualTeamId && latestTransfer && actualTeamId === latestTransfer.toTeamId);
  const projectHasPendingTransfer = hasPendingTransfer(project);

  const pendingMaterialDispatches = useMemo(() => {
    const list: Array<{ request: MaterialRequest; dispatch: any }> = [];
    const projRequests = (materialRequests || []).filter((r) => r.projectId === project.id);
    for (const req of projRequests) {
      for (const d of req.dispatches || []) {
        if (!d.receivedAtSiteConfirmed) {
          list.push({ request: req, dispatch: d });
        }
      }
    }
    return list;
  }, [materialRequests, project.id]);

  return (
    <div
      className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 sm:p-5 relative transition-all duration-200 space-y-3.5 border shadow-2xs ${
        isInProgress
          ? 'border-[#C1A056] dark:border-[#C1A056] ring-2 ring-[#C1A056]/20'
          : isStuck
          ? 'border-rose-500/60 dark:border-rose-500/60'
          : 'border-[#E2DDD4] dark:border-[#2C2C2C]'
      }`}
    >
      {/* Top Bar: Code, Scheduled Time, and Status Pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black bg-[#212121] text-[#E5CA8F] px-2 py-0.5 rounded-md">
            {project.code}
          </span>
          {multiDayProgress && (
            <span className="text-xs bg-[#C1A056]/20 text-[#8E6F27] dark:text-[#E5CA8F] font-bold px-2 py-0.5 rounded-md">
              {multiDayProgress.badgeText}
            </span>
          )}
          <div className="flex items-center gap-1 text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF]">
            <Clock className="w-3.5 h-3.5 text-[#8E6F27] dark:text-[#E5CA8F]" />
            <span className="font-mono">{toPersianDigits(project.scheduledTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isTransitioning && (
            <span className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
              در صف ارسال
            </span>
          )}
          <StatusPill
            status={project.status}
            qcStatus={project.qcStatus}
            isExceptionalCompletion={project.isExceptionalCompletion}
            size="sm"
          />
        </div>
      </div>

      {/* QC Rejected Alert Strip (with notes immediately visible) */}
      {isRejected && (
        <div className="bg-rose-500/15 dark:bg-rose-950/40 border border-rose-500 rounded-xl p-3 text-xs space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 font-bold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>نیاز به اصلاح (بازگشت از کنترل کیفیت)</span>
            </span>
          </div>
          {project.qcNotes && (
            <div className="bg-white dark:bg-[#141414] p-2 rounded-lg border border-rose-200 dark:border-rose-900/50 text-[#181818] dark:text-zinc-200 text-xs leading-relaxed">
              <span className="font-bold text-rose-600 block mb-0.5">نکات QC:</span>
              «{project.qcNotes}»
            </div>
          )}
        </div>
      )}

      {/* QC Defects Section (Phase P3) */}
      {project.qcDefects && project.qcDefects.length > 0 && (
        <div className="bg-stone-50 dark:bg-[#1E1D1A] border border-stone-200 dark:border-stone-800 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-stone-800 dark:text-stone-200">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>عدم‌انطباق‌ها و ایرادات اعلامی QC ({toPersianDigits(project.qcDefects.length)})</span>
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              {toPersianDigits(project.qcDefects.filter((d) => d.status === 'RESOLVED' || d.status === 'VERIFIED').length)} از {toPersianDigits(project.qcDefects.length)} رفع‌شده
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {project.qcDefects.map((defect) => {
              const isResolved = defect.status === 'RESOLVED';
              const isVerified = defect.status === 'VERIFIED';
              const isPending = !isResolved && !isVerified;
              const isCritical = defect.severity === 'CRITICAL';
              const isMajor = defect.severity === 'MAJOR';

              const severityBadge = isCritical
                ? { bg: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30', label: 'بحرانی' }
                : isMajor
                ? { bg: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30', label: 'عمده' }
                : { bg: 'bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-500/30', label: 'جزئی' };

              const categoryLabel =
                defect.category === 'MOTOR_REMOTE' ? 'موتور و ریموت' :
                defect.category === 'FABRIC' ? 'پارچه و شید' :
                defect.category === 'LEVELING' ? 'تراز و مکانیزم' :
                defect.category === 'HARDWARE' ? 'یراق‌آلات و اتصالات' :
                defect.category === 'CLEANLINESS' ? 'تمیزی و لکه' :
                defect.category === 'DAMAGE' ? 'آسیب و شکستگی' : 'سایر';

              return (
                <div
                  key={defect.id}
                  className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                    isVerified
                      ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                      : isResolved
                      ? 'bg-blue-500/5 border-blue-500/30 text-blue-950 dark:text-blue-200'
                      : isCritical
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-950 dark:text-rose-200'
                      : 'bg-white dark:bg-[#141414] border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityBadge.bg}`}>
                        {severityBadge.label}
                      </span>
                      <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                        [{categoryLabel}]
                      </span>
                      {defect.location && (
                        <span className="text-[11px] text-stone-500 dark:text-stone-400">
                          ({defect.location})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold">
                      {isVerified ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          تایید نهایی QC
                        </span>
                      ) : isResolved ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          رفع‌شده (در انتظار تایید QC)
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          در انتظار رفع توسط تکنسین
                        </span>
                      )}
                    </span>
                  </div>

                  <p className="font-medium text-xs leading-relaxed text-[#181818] dark:text-zinc-200">
                    {defect.description}
                  </p>

                  {defect.resolutionNotes && (
                    <div className="text-[11px] bg-stone-100 dark:bg-stone-900/60 p-1.5 rounded text-stone-600 dark:text-stone-300">
                      <span className="font-bold">اقدام انجام‌شده: </span>
                      {defect.resolutionNotes}
                    </div>
                  )}

                  {isPending && onResolveDefect && (
                    resolvingDefectId === defect.id ? (
                      <div className="pt-2 space-y-2 border-t border-dashed border-stone-300 dark:border-stone-700">
                        <textarea
                          value={resolvingNotes}
                          onChange={(e) => setResolvingNotes(e.target.value)}
                          placeholder="توضیحات اقدام انجام‌شده برای رفع نقص (مثلاً: رگلاژ مجدد پایه، تعویض بست، تمیزکاری با اسپری)..."
                          className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1C1B18] text-stone-900 dark:text-white resize-none"
                          rows={2}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingDefectId(null);
                              setResolvingNotes('');
                            }}
                            className="px-2.5 py-1 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 cursor-pointer"
                          >
                            انصراف
                          </button>
                          <button
                            type="button"
                            disabled={!resolvingNotes.trim()}
                            onClick={() => {
                              if (!resolvingNotes.trim()) return;
                              onResolveDefect(project.id, defect.id, resolvingNotes.trim());
                              setResolvingDefectId(null);
                              setResolvingNotes('');
                            }}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer transition flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ثبت رفع نقص</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingDefectId(defect.id);
                          setResolvingNotes('');
                        }}
                        className="mt-1 w-full py-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>ثبت اقدام اصلاحی و رفع نقص</span>
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Transfer Handover Strip (Phase P2.2) */}
      {latestTransfer && isPendingTransfer && (
        <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-blue-600 shrink-0" />
              <span>انتقال‌یافته از «{latestTransfer.fromTeamName}»</span>
            </span>
            <span className="text-[11px] bg-blue-500/20 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-md font-bold">
              در انتظار تایید تحویل
            </span>
          </div>
          <p className="text-[11px] text-[#4A4742] dark:text-[#BDB8AF]">
            علت انتقال: {latestTransfer.reason}
          </p>
          {latestTransfer.handoverInventory && latestTransfer.handoverInventory.length > 0 && (
            <div className="text-[11px] text-[#555] dark:text-[#AAA] pt-1 border-t border-dashed border-blue-200 dark:border-blue-900">
              اقلام باقیمانده کار: {latestTransfer.handoverInventory.map((i) => `${i.activityTitle} (${toPersianDigits(i.remainingQuantity)} ${i.unit})`).join('، ')}
            </div>
          )}
          {isLead && onConfirmTransfer && (
            <button
              type="button"
              onClick={() => onConfirmTransfer(project)}
              className="w-full mt-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تایید تحویل‌گیری پروژه و صورت‌جلسه کار سر کارگاه</span>
            </button>
          )}
        </div>
      )}

      {/* Team Transfer Manager Override Strip (Phase P2.2 Hardening) */}
      {latestTransfer && latestTransfer.isManagerOverride && (
        <div className="bg-purple-500/10 dark:bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 text-xs text-purple-900 dark:text-purple-200 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-purple-600 shrink-0" />
              <span>انتقال به اکیپ با تایید استثنایی مدیر QC</span>
            </span>
            <span className="text-[11px] bg-purple-500/20 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-md font-bold">
              رفع انسداد مدیریتی
            </span>
          </div>
          <p className="text-[11px] text-[#4A4742] dark:text-[#BDB8AF]">
            دلیل رفع انسداد: {latestTransfer.managerOverrideReason} (توسط {latestTransfer.managerOverrideByUserName})
          </p>
        </div>
      )}

      {/* Active Material Deliveries / Pending Receipt Confirmation (Phase P2.3) */}
      {pendingMaterialDispatches.length > 0 && (
        <div className="bg-purple-500/10 dark:bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 text-xs text-purple-950 dark:text-purple-200 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-purple-600 shrink-0" />
              <span>محموله متریال ارسالی در مسیر کارگاه</span>
            </span>
            <span className="text-[11px] bg-purple-500/20 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-md font-bold">
              ارسال با پیک
            </span>
          </div>
          {pendingMaterialDispatches.map(({ request, dispatch }) => (
            <div
              key={dispatch.id}
              className="bg-white/80 dark:bg-[#1E1D1A]/80 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800/60 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900 dark:text-purple-300">
                  پیک / راننده: {dispatch.courierInfo}
                </span>
                {dispatch.trackingCode && (
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                    کد: {dispatch.trackingCode}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-stone-600 dark:text-stone-300">
                اقلام: {dispatch.items.map((i: any) => `${i.title} (${toPersianDigits(i.dispatchedQty)} ${i.unit || ''})`).join('، ')}
              </div>
              {onConfirmMaterialReceipt && (
                <button
                  type="button"
                  onClick={() => setConfirmingReceiptTarget({ request, dispatch })}
                  className="w-full mt-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تایید دریافت این بسته سر کارگاه</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paused (Multi-day Continuation) Strip */}
      {isPaused && (
        <div className="bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-amber-600 shrink-0" />
              <span>پروژه نیمه‌کاره (آماده ادامه در شیفت یا روز کاری بعدی)</span>
            </span>
            <span className="text-[11px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold">
              ادامه با همان اکیپ
            </span>
          </div>
          <p className="text-[11px] text-[#69655F] dark:text-[#9E988D]">
            گزارش‌های روزهای قبل ثبت و محفوظ است. با اعلام حرکت، پروژه به حالت فعال بازمی‌گردد.
          </p>
        </div>
      )}

      {/* Active Job Timer (Shows live stopwatch during installation) */}
      <ActiveJobTimer
        status={project.status}
        startedAt={project.startedAt}
        completedAt={project.completedAt}
        reworkStartedAt={project.reworkStartedAt}
        workSessions={project.workSessions}
      />

      {/* Title, Customer, and Address */}
      <div className="space-y-1">
        <h3 className="font-black text-sm sm:text-base text-[#181818] dark:text-white leading-tight">
          {project.title}
        </h3>
        <div className="text-xs text-[#69655F] dark:text-[#9E988D] flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[#181818] dark:text-[#F5F3EF]">
            {project.customerName}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 truncate max-w-xs">
            <MapPin className="w-3.5 h-3.5 text-[#8E6F27] dark:text-[#E5CA8F] shrink-0" />
            <span className="truncate">{project.address}</span>
          </span>
        </div>
      </div>

      {/* Technical Summary & Itemized Plan Progress */}
      <div className="bg-[#FAF7F2] dark:bg-[#141414] rounded-xl p-3 border border-[#E2DDD4] dark:border-[#282828] space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[#4A4742] dark:text-[#BDB8AF]">
            <Layers className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] shrink-0" />
            <span className="font-bold text-[#181818] dark:text-white">برنامه و پیشرفت نصب</span>
          </div>

          {project.mechanismType && (
            <span className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] font-bold truncate max-w-[170px]">
              {project.mechanismType}
            </span>
          )}
        </div>

        {progressList.length > 0 ? (
          <div className="space-y-2 pt-1 border-t border-[#E2DDD4]/60 dark:border-[#282828]">
            {progressList.map((item) => {
              const pct = Math.min(100, Math.round(item.progressPercent));
              return (
                <div key={item.activityId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#4A4742] dark:text-[#BDB8AF] font-medium truncate">
                      {item.title}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#181818] dark:text-zinc-200">
                      {toPersianDigits(item.totalCompletedQuantity)} / {toPersianDigits(item.effectivePlannedQuantity)} {item.unit}
                      {item.isOverCompleted && (
                        <span className="mr-1 text-[11px] text-amber-600 font-bold">
                          (+{toPersianDigits(item.overCompletedQuantity)} مازاد)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-[#E2DDD4] dark:bg-[#282828] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.isOverCompleted
                          ? 'bg-amber-500'
                          : pct === 100
                          ? 'bg-emerald-500'
                          : 'bg-[#C1A056]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[#69655F] dark:text-[#9E988D]">
            {project.shadePanels > 0 && `${toPersianDigits(project.shadePanels)} لت شید`}
            {project.shadePanels > 0 && project.curtainPanels > 0 && ' • '}
            {project.curtainPanels > 0 && `${toPersianDigits(project.curtainPanels)} لت پرده`}
          </div>
        )}
      </div>

      {/* Action Row: Large Icon Buttons (Call, Map Route, Proposal, Tools) - Min 44px */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {project.customerPhone ? (
          <a
            href={`tel:${project.customerPhone}`}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#EFEBE4] dark:hover:bg-[#252525] border border-[#E2DDD4] dark:border-[#2C2C2C] text-[#181818] dark:text-zinc-200 transition min-h-[48px] active:scale-95"
            title={`تماس با ${project.customerPhone}`}
          >
            <Phone className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] mb-0.5" />
            <span className="text-xs font-bold">تماس</span>
          </a>
        ) : (
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-60 min-h-[48px]">
            <Phone className="w-4 h-4 mb-0.5" />
            <span className="text-xs">بدون تلفن</span>
          </div>
        )}

        <a
          href={
            project.locationUrl ||
            `https://nshn.ir/search/${encodeURIComponent(project.address)}`
          }
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#EFEBE4] dark:hover:bg-[#252525] border border-[#E2DDD4] dark:border-[#2C2C2C] text-[#181818] dark:text-zinc-200 transition min-h-[48px] active:scale-95"
          title="مسیریابی هوشمند نشان / بلد"
        >
          <Navigation className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] mb-0.5" />
          <span className="text-xs font-bold">مسیریابی</span>
        </a>

        <button
          type="button"
          onClick={() => onViewProposal(project)}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#EFEBE4] dark:hover:bg-[#252525] border border-[#E2DDD4] dark:border-[#2C2C2C] text-[#181818] dark:text-zinc-200 transition min-h-[48px] active:scale-95 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] mb-0.5" />
          <span className="text-xs font-bold">پروپوزال</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenToolChecklist(project)}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#EFEBE4] dark:hover:bg-[#252525] border border-[#E2DDD4] dark:border-[#2C2C2C] text-[#181818] dark:text-zinc-200 transition min-h-[48px] active:scale-95 cursor-pointer"
        >
          <Wrench className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] mb-0.5" />
          <span className="text-xs font-bold">ابزار</span>
        </button>
      </div>

      {/* ONE BIG OBVIOUS PRIMARY ACTION BUTTON (Unmissable in sunlight) */}
      <div className="pt-1">
        {projectHasPendingTransfer ? (
          <div className="p-3.5 bg-amber-500/10 dark:bg-amber-950/25 border-2 border-dashed border-amber-500/40 rounded-xl text-center space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {isLead
                  ? 'پروژه در انتظار تایید رسمی تحویل‌گیری است'
                  : 'پروژه در انتظار تایید رسمی تحویل‌گیری توسط سرپرست اکیپ است'}
              </span>
            </div>
            <p className="text-[11px] text-[#69655F] dark:text-[#9E988D] leading-relaxed">
              {isLead
                ? 'تا زمان ثبت تایید صورت‌جلسه اقلام تحویلی در کادر آبی بالا، دکمه‌های اعزام و شروع کار مسدود می‌باشند.'
                : 'شروع یا ادامه کار نصب تا زمان ثبت تایید رسمی توسط سرپرست اکیپ مجاز نمی‌باشد.'}
            </p>
          </div>
        ) : (
          <>
            {(isScheduled || isPaused) && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isTransitioning}
                  onClick={() => onUpdateStatus(project.id, isPaused ? 'PAUSED' : 'SCHEDULED', 'EN_ROUTE')}
                  className="w-full py-4 px-4 bg-[#212121] hover:bg-[#2D2D2D] disabled:opacity-50 text-[#C1A056] rounded-xl text-sm font-black shadow-md transition flex items-center justify-center gap-2.5 border-2 border-[#C1A056] active:scale-[0.98] min-h-[50px] cursor-pointer"
                >
                  {isTransitioning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Car className="w-5 h-5" />
                  )}
                  <span>
                    {isTransitioning
                      ? 'در حال ثبت...'
                      : isPaused
                      ? 'ادامه کار (اعلام حرکت به محل)'
                      : 'حرکت به محل نصب (اعلام حرکت)'}
                  </span>
                </button>
                {isPaused && (
                  <button
                    type="button"
                    disabled={isTransitioning}
                    onClick={() => onUpdateStatus(project.id, 'PAUSED', 'IN_PROGRESS')}
                    className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Play className="w-4 h-4 text-amber-600" />
                    <span>در محل پروژه هستم (شروع مستقیم ادامه نصب)</span>
                  </button>
                )}
              </div>
            )}

            {isEnRoute && (
              <button
                type="button"
                disabled={isTransitioning}
                onClick={() => onUpdateStatus(project.id, 'EN_ROUTE', 'IN_PROGRESS')}
                className="w-full py-4 px-4 bg-[#C1A056] hover:bg-[#D4B56C] disabled:opacity-50 text-[#181818] rounded-xl text-sm font-black shadow-lg transition flex items-center justify-center gap-2.5 active:scale-[0.98] min-h-[50px] cursor-pointer"
              >
                {isTransitioning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>{isTransitioning ? 'در حال ثبت...' : 'رسیدم، شروع نصب'}</span>
              </button>
            )}

            {isInProgress && (
              isBeforeEndDate ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenDailyLogModal?.(project)}
                    className="w-full py-4 px-4 bg-[#212121] hover:bg-[#2D2D2D] text-[#C1A056] border-2 border-[#C1A056] rounded-xl text-sm font-black shadow-md transition flex items-center justify-center gap-2.5 active:scale-[0.98] min-h-[50px] cursor-pointer"
                  >
                    <Moon className="w-5 h-5 text-[#C1A056]" />
                    <span>پایان شیفت امروز (ثبت پیشرفت و ادامه در روز بعد)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCompletionModal(project)}
                    className="w-full py-3 px-4 bg-white dark:bg-[#1E1E1E] hover:bg-[#FAF7F2] dark:hover:bg-[#252525] text-[#181818] dark:text-zinc-200 border-2 border-[#C1A056]/50 hover:border-[#C1A056] rounded-xl text-xs font-black shadow-2xs transition flex items-center justify-center gap-2 active:scale-[0.98] min-h-[46px] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#C1A056]" />
                    <span>نصب کل پروژه امروز تمام شد؟ ثبت اتمام کامل و ارسال به QC</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenCompletionModal(project)}
                  className="w-full py-4 px-4 bg-[#C1A056] hover:bg-[#D4B56C] text-[#181818] rounded-xl text-sm font-black shadow-lg transition flex items-center justify-center gap-2.5 active:scale-[0.98] min-h-[50px] cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ثبت اتمام کار و ارسال به QC</span>
                </button>
              )
            )}
          </>
        )}

        {isStuck && (
          <div className="bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>پروژه متوقف است — در حال پیگیری توسط مسئولین فنی</span>
            </div>
            {project.stuckIncident?.description && (
              <p className="mt-1 text-xs text-[#69655F] dark:text-[#9E988D]">
                علت: {project.stuckIncident.description}
              </p>
            )}
          </div>
        )}

        {isCompleted && (
          <div
            className={`border rounded-xl p-3 text-xs flex items-center justify-between ${
              project.isExceptionalCompletion
                ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500/40 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {project.isExceptionalCompletion ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>
                {project.qcStatus === 'APPROVED'
                  ? project.isExceptionalCompletion
                    ? 'تایید نهایی QC با پذیرش کسری اقلام صادر شد'
                    : 'تایید نهایی QC صادر شد'
                  : project.isExceptionalCompletion
                  ? 'اتمام استثنایی با کسری اقلام — در انتظار تصمیم مدیر QC'
                  : 'اتمام نصب ثبت شد — در انتظار تایید QC'}
              </span>
            </div>
            {onOpenCertificate && (
              <button
                type="button"
                onClick={() => onOpenCertificate(project)}
                className="px-3 py-1.5 min-h-[44px] bg-white dark:bg-[#1E1E1E] border border-[#C1A056] text-[#8E6F27] dark:text-[#E5CA8F] rounded-lg text-xs font-bold hover:bg-[#FAF7F2] transition cursor-pointer flex items-center justify-center shrink-0"
              >
                شناسنامه تحویل
              </button>
            )}
          </div>
        )}
      </div>

      {/* Secondary Actions Menu (...) */}
      <div className="pt-1 flex items-center justify-between border-t border-[#E2DDD4] dark:border-[#2C2C2C] text-xs">
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="flex items-center gap-1 text-[#69655F] dark:text-[#9E988D] hover:text-[#181818] dark:hover:text-white py-2 px-3 rounded-lg transition cursor-pointer min-h-[44px]"
        >
          <MoreVertical className="w-3.5 h-3.5" />
          <span>سایر اقدامات و گزارش‌ها</span>
        </button>

        {isMenuOpen && (
          <div className="flex items-center gap-2">
            {isInProgress && onReportStuck && (
              <button
                type="button"
                onClick={() => onReportStuck(project)}
                className="text-xs text-rose-600 font-bold hover:underline cursor-pointer min-h-[44px] px-2 flex items-center"
              >
                گزارش توقف کار
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenTicketModal(project)}
              className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] font-bold hover:underline cursor-pointer min-h-[44px] px-2 flex items-center"
            >
              ثبت تیکت فوری
            </button>

            {onOpenMaterialModal && (
              <button
                type="button"
                onClick={() => onOpenMaterialModal(project)}
                className="text-xs text-indigo-700 dark:text-indigo-400 font-bold hover:underline cursor-pointer min-h-[44px] px-2 flex items-center gap-1"
              >
                <Package className="w-3.5 h-3.5" />
                <span>درخواست متریال</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Material Receipt */}
      {confirmingReceiptTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="bg-[#FAF7F2] dark:bg-[#1C1B18] w-full max-w-sm rounded-2xl shadow-2xl border border-purple-300 dark:border-purple-800/80 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-purple-700 dark:text-purple-400">
              <Package className="w-6 h-6 shrink-0" />
              <h4 className="font-black text-sm text-[#212121] dark:text-white">
                تایید دریافت فیزیکی بسته سر کارگاه
              </h4>
            </div>

            <p className="text-xs text-[#69655F] dark:text-[#A8A29E] leading-relaxed">
              آیا اقلام زیر را به طور کامل از پیک تحویل گرفته و تطابق فیزیکی آن‌ها با کارگاه را تایید می‌نمایید؟
            </p>

            <div className="bg-white dark:bg-[#25231F] p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] text-xs space-y-1.5">
              <div className="font-bold text-purple-950 dark:text-purple-300">
                پیک / راننده: {confirmingReceiptTarget.dispatch.courierInfo}
              </div>
              {confirmingReceiptTarget.dispatch.trackingCode && (
                <div className="text-[11px] text-[#8E6F27] dark:text-[#E5CA8F] font-mono">
                  کد رهگیری: {confirmingReceiptTarget.dispatch.trackingCode}
                </div>
              )}
              <div className="pt-1.5 border-t border-[#E2DDD4] dark:border-[#2E2B26] space-y-1">
                {confirmingReceiptTarget.dispatch.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px] text-[#4A4742] dark:text-[#D5D0C7]">
                    <span>• {i.title}</span>
                    <span className="font-bold">
                      {toPersianDigits(i.dispatchedQty)} {i.unit || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmingReceiptTarget(null)}
                className="px-3.5 py-2 rounded-xl border border-[#E2DDD4] dark:border-[#2E2B26] text-xs font-bold hover:bg-[#F2EDE4] dark:hover:bg-[#25231F] text-[#4A4742] dark:text-[#D5D0C7] min-h-[44px] cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onConfirmMaterialReceipt) {
                    onConfirmMaterialReceipt(
                      confirmingReceiptTarget.request,
                      confirmingReceiptTarget.dispatch.id
                    );
                  }
                  setConfirmingReceiptTarget(null);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition min-h-[44px] flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید نهایی و تحویل</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
