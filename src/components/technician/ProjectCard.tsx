import React, { useState, useMemo } from 'react';
import { Project, User, ProjectStatus, MaterialRequest, Ticket } from '../../types';
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
  Camera,
  Flame,
} from 'lucide-react';
import { toPersianDigits, localDateKey, getDayInfoFromDateKey } from '../../utils/jalali';
import { ActiveJobTimer } from '../ActiveJobTimer';
import { StatusPill } from '../ui/StatusPill';
import { getMultiDayProgress } from '../../utils/multiDay';
import { calculateActivityProgress } from '../../utils/planProgress';
import { getLatestTeamTransfer, isPendingTransferAcknowledgment, hasPendingTransfer } from '../../utils/teamTransfer';
import { PreInstallPhotoModal } from './PreInstallPhotoModal';
import { CloudImage } from '../common/CloudImage';

interface Props {
  project: Project;
  currentUser: User;
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onOpenDailyLogModal?: (project: Project) => void;
  onUpdateStatus: (projectId: string, from: ProjectStatus, to: ProjectStatus) => void;
  onSavePreInstallPhotosAndStart?: (projectId: string, photos: string[]) => Promise<void> | void;
  onOpenCertificate?: (project: Project) => void;
  onReportStuck?: (project: Project) => void;
  onConfirmTransfer?: (project: Project) => void;
  materialRequests?: MaterialRequest[];
  onOpenMaterialModal?: (project: Project) => void;
  onConfirmMaterialReceipt?: (request: MaterialRequest, dispatchId: string) => void;
  onResolveDefect?: (projectId: string, defectId: string, resolutionNotes: string, photos?: string[]) => void;
  tickets?: Ticket[];
  isTransitioning?: boolean;
  /** another job of this person that is already en route / in progress */
  busyWith?: Project;
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
  onSavePreInstallPhotosAndStart,
  onOpenCertificate,
  onReportStuck,
  onConfirmTransfer,
  materialRequests = [],
  onOpenMaterialModal,
  onConfirmMaterialReceipt,
  onResolveDefect,
  tickets = [],
  isTransitioning = false,
  busyWith,
}) => {
  const activeTicket = useMemo(() => {
    return (tickets || []).find(
      (t) =>
        t.projectId === project.id &&
        (t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote))
    );
  }, [tickets, project.id]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPreInstallModalOpen, setIsPreInstallModalOpen] = useState(false);
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

  // One tap used to start a mission planned for another day, or a second job while
  // the first was still open. Ask first in those two cases; a normal start is still one tap.
  const handleStartTravel = () => {
    const warnings: string[] = [];
    if (isScheduled && project.scheduledDate && project.scheduledDate > todayYmd) {
      const day = getDayInfoFromDateKey(project.scheduledDate);
      warnings.push(
        `این مأموریت برای ${day ? `${day.persianDayName} ${toPersianDigits(day.persianDayNum)} ${day.persianMonthName}` : 'روز دیگری'} برنامه‌ریزی شده، نه امروز.`,
      );
    }
    if (busyWith) {
      warnings.push(`کار «${busyWith.customerName || busyWith.id}» هنوز باز است (${busyWith.status === 'EN_ROUTE' ? 'در مسیر' : 'در حال نصب'}).`);
    }
    if (warnings.length > 0 && !confirm(`${warnings.join('\n')}\n\nبا این حال حرکت به محل ثبت شود؟`)) return;
    onUpdateStatus(project.id, isPaused ? 'PAUSED' : 'SCHEDULED', 'EN_ROUTE');
  };
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
      className={`bg-surface rounded-lg p-4 sm:p-5 relative transition-all duration-150 space-y-3.5 border shadow-xs ${
        isInProgress
          ? 'border-brand ring-1 ring-brand/30'
          : isStuck
          ? 'border-rose-500/60 ring-1 ring-rose-500/20'
          : 'border-line hover:border-line-strong'
      }`}
    >
      {/* Top Bar: Code, Scheduled Time, and Status Pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold bg-canvas text-brand-ink border border-line-strong px-2 py-0.5 rounded">
            {project.code}
          </span>
          {multiDayProgress && (
            <span className="text-xs bg-brand/15 text-brand-soft border border-brand/30 font-bold px-2 py-0.5 rounded">
              {multiDayProgress.badgeText}
            </span>
          )}
          {project.isForceMajeure && (
            <span className="flex items-center gap-1 text-[12px] bg-rose-600/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-black animate-pulse">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>فورس‌ماژور</span>
            </span>
          )}
          <div className="flex items-center gap-1 text-xs font-bold text-ink-2">
            <Clock className="w-3.5 h-3.5 text-brand-ink" />
            <span className="font-mono">{toPersianDigits(project.scheduledTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isTransitioning && (
            <span className="text-[12px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold animate-pulse">
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
        <div className="bg-rose-500/15 border border-rose-500/40 rounded-md p-3 text-xs space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-rose-300 font-bold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>نیاز به اصلاح (بازگشت از کنترل کیفیت)</span>
            </span>
          </div>
          {project.qcNotes && (
            <div className="bg-canvas p-2 rounded border border-rose-500/30 text-ink text-xs leading-relaxed">
              <span className="font-bold text-rose-400 block mb-0.5">نکات QC:</span>
              «{project.qcNotes}»
            </div>
          )}
        </div>
      )}

      {/* Special Tools Assigned Banner */}
      {project.specialTools && project.specialTools.length > 0 && (
        <div className="bg-raised border border-brand/40 rounded-md p-2.5 text-xs flex items-center justify-between text-brand-soft">
          <div className="flex items-center gap-2 font-bold">
            <Wrench className="w-4 h-4 text-brand-ink shrink-0" />
            <span>ابزار ویژه تحویلی این مأموریت: {project.specialTools.join('، ')}</span>
          </div>
          <span className="text-[11px] bg-brand/20 text-brand-ink px-2 py-0.5 rounded font-bold shrink-0">
            همراه خودرو
          </span>
        </div>
      )}

      {/* Active Warehouse & Courier Referral Section */}
      {activeTicket && (
        <div className="bg-[#191426] border border-purple-500/40 rounded-md p-3 text-xs space-y-1.5 text-purple-200">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold text-purple-300">
              <Package className="w-4 h-4 text-purple-400 shrink-0" />
              <span>وضعیت ارجاع و تامین از انبار:</span>
            </span>
            <span className="text-[11px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 font-bold">
              {activeTicket.resolutionNote?.includes('پیک') ? 'ارسال با پیک 🚚' : 'در دست اقدام انبار ⏳'}
            </span>
          </div>
          <p className="text-[12px] text-purple-200/90 leading-relaxed">
            {activeTicket.referralNote || activeTicket.description}
          </p>
          {activeTicket.resolutionNote && (
            <p className="text-[12px] font-mono bg-purple-950/60 p-2 rounded border border-purple-500/30 text-brand-soft">
              پاسخ انبار: {activeTicket.resolutionNote}
            </p>
          )}
        </div>
      )}

      {/* Inter-Team Handover Dossier (from previous crew) */}
      {project.interTeamHandover && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-md p-3 text-xs space-y-2 text-sky-200">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400 shrink-0" />
              <span>صورت‌جلسه کارگاه تحویلی از «{project.interTeamHandover.fromTeamName}»</span>
            </span>
            <span className="text-[11px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-bold">
              ادامه مأموریت
            </span>
          </div>
          <div className="text-[12px] text-ink space-y-1.5 bg-canvas p-2.5 rounded border border-sky-500/20 leading-relaxed">
            <p>
              <strong className="text-emerald-400">اقدامات انجام‌شده: </strong>
              {project.interTeamHandover.completedWork}
            </p>
            <p>
              <strong className="text-amber-400">کارهای باقیمانده: </strong>
              {project.interTeamHandover.remainingWork}
            </p>
            {project.interTeamHandover.requiredParts && (
              <p>
                <strong className="text-purple-400">قطعات مورد نیاز: </strong>
                {project.interTeamHandover.requiredParts}
              </p>
            )}
          </div>
          {project.interTeamHandover.photos && project.interTeamHandover.photos.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              {project.interTeamHandover.photos.map((ph, i) => (
                <div key={i} className="w-12 h-12 rounded overflow-hidden shrink-0 border border-line">
                  <CloudImage
                    src={ph}
                    alt={`عکس تحویل ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QC Defects Section (Phase P3) */}
      {project.qcDefects && project.qcDefects.length > 0 && (
        <div className="bg-sunken border border-line rounded-md p-3 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-ink">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>عدم‌انطباق‌ها و ایرادات اعلامی QC ({toPersianDigits(project.qcDefects.length)})</span>
            </span>
            <span className="text-[12px] text-ink-2">
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
                ? { bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40', label: 'بحرانی' }
                : isMajor
                ? { bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: 'عمده' }
                : { bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40', label: 'جزئی' };

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
                  className={`p-2.5 rounded border text-xs space-y-1.5 ${
                    isVerified
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : isResolved
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                      : isCritical
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                      : 'bg-surface border-line-strong text-ink'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${severityBadge.bg}`}>
                        {severityBadge.label}
                      </span>
                      <span className="text-[12px] font-medium text-ink-2">
                        [{categoryLabel}]
                      </span>
                      {defect.location && (
                        <span className="text-[12px] text-ink-2">
                          ({defect.location})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold">
                      {isVerified ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          تایید نهایی QC
                        </span>
                      ) : isResolved ? (
                        <span className="text-sky-400">
                          رفع‌شده (در انتظار تایید QC)
                        </span>
                      ) : (
                        <span className="text-amber-400">
                          در انتظار رفع توسط تکنسین
                        </span>
                      )}
                    </span>
                  </div>

                  <p className="font-medium text-xs leading-relaxed text-ink">
                    {defect.description}
                  </p>

                  {defect.resolutionNotes && (
                    <div className="text-[12px] bg-stone-100 dark:bg-stone-900/60 p-1.5 rounded text-stone-600 dark:text-stone-300">
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
                          className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-sunken text-stone-900 text-ink resize-none"
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
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-md p-3 text-xs text-sky-200 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-sky-400 shrink-0" />
              <span>انتقال‌یافته از «{latestTransfer.fromTeamName}»</span>
            </span>
            <span className="text-[12px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-bold">
              در انتظار تایید تحویل
            </span>
          </div>
          <p className="text-[12px] text-ink-2">
            علت انتقال: {latestTransfer.reason}
          </p>
          {latestTransfer.handoverInventory && latestTransfer.handoverInventory.length > 0 && (
            <div className="text-[12px] text-ink-2 pt-1 border-t border-dashed border-sky-500/30">
              اقلام باقیمانده کار: {latestTransfer.handoverInventory.map((i) => `${i.activityTitle} (${toPersianDigits(i.remainingQuantity)} ${i.unit})`).join('، ')}
            </div>
          )}
          {isLead && onConfirmTransfer && (
            <button
              type="button"
              onClick={() => onConfirmTransfer(project)}
              className="w-full mt-1 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تایید تحویل‌گیری پروژه و صورت‌جلسه کار سر کارگاه</span>
            </button>
          )}
        </div>
      )}

      {/* Team Transfer Manager Override Strip (Phase P2.2 Hardening) */}
      {latestTransfer && latestTransfer.isManagerOverride && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-md p-3 text-xs text-purple-200 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-purple-400 shrink-0" />
              <span>انتقال به اکیپ با تایید استثنایی مدیر QC</span>
            </span>
            <span className="text-[12px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
              رفع انسداد مدیریتی
            </span>
          </div>
          <p className="text-[12px] text-ink-2">
            دلیل رفع انسداد: {latestTransfer.managerOverrideReason} (توسط {latestTransfer.managerOverrideByUserName})
          </p>
        </div>
      )}

      {/* Active Material Deliveries / Pending Receipt Confirmation (Phase P2.3) */}
      {pendingMaterialDispatches.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-md p-3 text-xs text-purple-200 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-purple-400 shrink-0" />
              <span>محموله متریال ارسالی در مسیر کارگاه</span>
            </span>
            <span className="text-[12px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
              ارسال با پیک
            </span>
          </div>
          {pendingMaterialDispatches.map(({ request, dispatch }) => (
            <div
              key={dispatch.id}
              className="bg-sunken p-2.5 rounded border border-purple-500/30 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300">
                  پیک / راننده: {dispatch.courierInfo}
                </span>
                {dispatch.trackingCode && (
                  <span className="text-[12px] text-brand-ink font-mono">
                    کد: {dispatch.trackingCode}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-ink-2">
                اقلام: {dispatch.items.map((i: any) => `${i.title} (${toPersianDigits(i.dispatchedQty)} ${i.unit || ''})`).join('، ')}
              </div>
              {onConfirmMaterialReceipt && (
                <button
                  type="button"
                  onClick={() => setConfirmingReceiptTarget({ request, dispatch })}
                  className="w-full mt-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99]"
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
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs text-amber-200 space-y-1 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-amber-400 shrink-0" />
              <span>پروژه نیمه‌کاره (آماده ادامه در شیفت یا روز کاری بعدی)</span>
            </span>
            <span className="text-[12px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
              ادامه با همان اکیپ
            </span>
          </div>
          <p className="text-[12px] text-ink-2">
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
        <h3 className="font-black text-sm sm:text-base text-ink leading-tight">
          {project.title}
        </h3>
        <div className="text-xs text-ink-2 flex items-center gap-2 flex-wrap">
          {project.customerName && project.customerName !== project.title && (
            <span className="font-bold text-ink">{project.customerName}</span>
          )}
          <span className="flex items-center gap-1 truncate max-w-xs">
            <MapPin className="w-3.5 h-3.5 text-brand-ink shrink-0" />
            <span className="truncate">{project.address}</span>
          </span>
        </div>
      </div>

      {/* Technical Summary & Itemized Plan Progress */}
      <div className="bg-sunken rounded-md p-3 border border-line space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-ink-2">
            <Layers className="w-4 h-4 text-brand-ink shrink-0" />
            <span className="font-bold text-ink">برنامه و پیشرفت نصب</span>
          </div>

          {project.mechanismType && (
            <span className="text-xs text-brand-ink font-bold truncate max-w-[170px]">
              {project.mechanismType}
            </span>
          )}
        </div>

        {progressList.length > 0 ? (
          <div className="space-y-2 pt-1 border-t border-line">
            {progressList.map((item) => {
              const pct = Math.min(100, Math.round(item.progressPercent));
              return (
                <div key={item.activityId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2 font-medium truncate">
                      {item.title}
                    </span>
                    <span className="font-mono text-xs font-bold text-ink">
                      {toPersianDigits(item.totalCompletedQuantity)} / {toPersianDigits(item.effectivePlannedQuantity)} {item.unit}
                      {item.isOverCompleted && (
                        <span className="mr-1 text-[12px] text-amber-400 font-bold">
                          (+{toPersianDigits(item.overCompletedQuantity)} مازاد)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-raised h-1.5 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.isOverCompleted
                          ? 'bg-amber-500'
                          : pct === 100
                          ? 'bg-emerald-500'
                          : 'bg-brand'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-ink-2">
            {project.shadePanels > 0 && `${toPersianDigits(project.shadePanels)} لت شید`}
            {project.shadePanels > 0 && project.curtainPanels > 0 && ' • '}
            {project.curtainPanels > 0 && `${toPersianDigits(project.curtainPanels)} لت پرده`}
          </div>
        )}
      </div>

      {/* Action Row: فقط کارهایی که برای این پروژه واقعاً ممکن است (بدون کاشی خاموش «بدون تلفن») */}
      <div className="flex gap-2 text-xs">
        {project.customerPhone && (
          <a
            href={`tel:${project.customerPhone}`}
            aria-label={`تماس تلفنی با مشتری ${project.customerName || ''}`}
            className="flex-1 flex flex-col items-center justify-center p-2 rounded-md bg-raised hover:bg-hover border border-line-strong text-ink transition min-h-[48px] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            title={`تماس با ${project.customerPhone}`}
          >
            <Phone className="w-4 h-4 text-brand-ink mb-0.5" />
            <span className="text-xs font-bold">تماس</span>
          </a>
        )}

        {(project.locationUrl || project.address) && (
          <a
            href={
              project.locationUrl ||
              `https://nshn.ir/search/${encodeURIComponent(project.address)}`
            }
            target="_blank"
            rel="noreferrer"
            aria-label={`مسیریابی آدرس ${project.address}`}
            className="flex-1 flex flex-col items-center justify-center p-2 rounded-md bg-raised hover:bg-hover border border-line-strong text-ink transition min-h-[48px] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            title="مسیریابی با نشان / بلد"
          >
            <Navigation className="w-4 h-4 text-brand-ink mb-0.5" />
            <span className="text-xs font-bold">مسیریابی</span>
          </a>
        )}

        {(project.proposalImages?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => onViewProposal(project)}
            aria-label="مشاهده پروپوزال و نقشه"
            className="flex-1 flex flex-col items-center justify-center p-2 rounded-md bg-raised hover:bg-hover border border-line-strong text-ink transition min-h-[48px] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <FileText className="w-4 h-4 text-brand-ink mb-0.5" />
            <span className="text-xs font-bold">پروپوزال</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenToolChecklist(project)}
          aria-label="چک‌لیست ابزار مورد نیاز"
          className="flex-1 flex flex-col items-center justify-center p-2 rounded-md bg-raised hover:bg-hover border border-line-strong text-ink transition min-h-[48px] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Wrench className="w-4 h-4 text-brand-ink mb-0.5" />
          <span className="text-xs font-bold">ابزار</span>
        </button>
      </div>

      {/* ONE BIG OBVIOUS PRIMARY ACTION BUTTON (Unmissable in sunlight) */}
      <div className="pt-1">
        {projectHasPendingTransfer ? (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-md text-center space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {isLead
                  ? 'پروژه در انتظار تایید رسمی تحویل‌گیری است'
                  : 'پروژه در انتظار تایید رسمی تحویل‌گیری توسط سرپرست اکیپ است'}
              </span>
            </div>
            <p className="text-[12px] text-ink-2 leading-relaxed">
              {isLead
                ? 'تا زمان ثبت تایید صورت‌جلسه اقلام تحویلی در کادر بالا، دکمه‌های اعزام و شروع کار مسدود می‌باشند.'
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
                  onClick={handleStartTravel}
                  className="w-full py-3.5 px-4 bg-surface hover:bg-raised disabled:opacity-50 text-brand-ink rounded-md text-sm font-bold shadow-xs transition flex items-center justify-center gap-2.5 border border-brand active:scale-[0.99] min-h-[48px] cursor-pointer"
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
                    className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Play className="w-4 h-4 text-amber-400" />
                    <span>در محل پروژه هستم (شروع مستقیم ادامه نصب)</span>
                  </button>
                )}
              </div>
            )}

            {isEnRoute && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isTransitioning}
                  onClick={() => setIsPreInstallModalOpen(true)}
                  className="w-full py-3.5 px-4 bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-brand rounded-md text-sm font-black shadow-lg shadow-brand/20 transition flex items-center justify-center gap-2.5 active:scale-[0.99] min-h-[48px] cursor-pointer border border-brand"
                >
                  {isTransitioning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-on-brand" />
                  )}
                  <span>
                    {isTransitioning ? 'در حال ثبت...' : 'رسیدم سر کارگاه (ثبت الزامی عکس‌های قبل نصب)'}
                  </span>
                </button>
              </div>
            )}

            {isInProgress && (
              <div className="space-y-2.5">
                {/* Fast Action Toolbar during Installation: سه راه جدا برای سه مشکل متفاوت */}
                <div className={`grid gap-2 ${onOpenMaterialModal && onReportStuck ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {onOpenMaterialModal && (
                    <button
                      type="button"
                      onClick={() => onOpenMaterialModal(project)}
                      className="py-2.5 px-2 bg-sunken hover:bg-raised rounded-md text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-95 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand text-purple-700 dark:text-purple-300 border border-purple-500/40"
                    >
                      <Package className="w-4 h-4" />
                      <span>درخواست متریال</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenTicketModal(project)}
                    className="py-2.5 px-2 bg-sunken hover:bg-raised rounded-md text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-95 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand text-amber-700 dark:text-amber-300 border border-amber-500/40"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>ثبت ایراد</span>
                  </button>
                  {onReportStuck && (
                    <button
                      type="button"
                      onClick={() => onReportStuck(project)}
                      className="py-2.5 px-2 bg-sunken hover:bg-raised rounded-md text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-95 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand text-rose-700 dark:text-rose-300 border border-rose-500/40"
                    >
                      <AlertOctagon className="w-4 h-4" />
                      <span>اعلام توقف</span>
                    </button>
                  )}
                </div>

                {isBeforeEndDate ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onOpenDailyLogModal?.(project)}
                      className="w-full py-2.5 px-4 bg-surface hover:bg-raised text-brand-ink border border-brand rounded-md text-xs sm:text-sm font-bold shadow-xs transition flex items-center justify-center gap-2 active:scale-[0.99] min-h-[44px] cursor-pointer"
                    >
                      <Moon className="w-4 h-4 text-brand-ink" />
                      <span>پایان شیفت امروز (ثبت پیشرفت و ادامه در روز بعد)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCompletionModal(project)}
                      className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-on-brand rounded-md text-xs sm:text-sm font-black shadow-xs transition flex items-center justify-center gap-2 active:scale-[0.99] min-h-[46px] cursor-pointer border border-brand"
                    >
                      <CheckCircle2 className="w-4 h-4 text-on-brand" />
                      <span>نصب کل پروژه امروز تمام شد؟ ثبت اتمام کامل و ارسال به QC</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onOpenCompletionModal(project)}
                      className="w-full py-3.5 px-4 bg-brand hover:bg-brand-hover text-on-brand rounded-md text-sm font-black shadow-lg shadow-brand/20 transition flex items-center justify-center gap-2.5 active:scale-[0.99] min-h-[48px] cursor-pointer border border-brand"
                    >
                      <CheckCircle2 className="w-5 h-5 text-on-brand" />
                      <span>ثبت اتمام کار و ارسال به QC</span>
                    </button>
                    {/* a one-day job that runs over had no way to log today's work and continue tomorrow */}
                    {onOpenDailyLogModal && (
                      <button
                        type="button"
                        onClick={() => onOpenDailyLogModal(project)}
                        className="w-full py-2.5 px-4 text-ink-2 hover:text-ink hover:bg-raised rounded-md text-xs font-bold transition flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                      >
                        <Moon className="w-4 h-4" aria-hidden="true" />
                        <span>کار امروز تمام نشد؟ ثبت پیشرفت و ادامه در روز بعد</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isStuck && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-md p-3 text-xs text-rose-300">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>پروژه متوقف است — در حال پیگیری توسط مسئولین فنی</span>
            </div>
            {(project.stuckIncident?.description || (project.stuckIncidents && project.stuckIncidents[project.stuckIncidents.length - 1]?.description)) && (
              <p className="mt-1 text-xs text-ink-2">
                علت: {project.stuckIncident?.description || project.stuckIncidents?.[project.stuckIncidents.length - 1]?.description}
              </p>
            )}
          </div>
        )}

        {isCompleted && (
          <div
            className={`border rounded-md p-3 text-xs flex items-center justify-between ${
              project.isExceptionalCompletion
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {project.isExceptionalCompletion ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
                className="px-3 py-1.5 min-h-[38px] bg-raised border border-brand/40 text-brand-ink rounded-md text-xs font-bold hover:bg-hover transition cursor-pointer flex items-center justify-center shrink-0"
              >
                شناسنامه تحویل
              </button>
            )}
          </div>
        )}
      </div>

      {/* Secondary Actions: وقتی کار در جریان است همه‌ی این‌ها بالاتر روی کارت هستند */}
      {!isInProgress && (
        <div className="pt-1 flex items-center justify-between border-t border-line text-xs">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            className="flex items-center gap-1 text-ink-2 hover:text-ink py-1.5 px-2 rounded transition cursor-pointer min-h-[40px]"
          >
            <MoreVertical className="w-3.5 h-3.5" />
            <span>اقدامات بیشتر</span>
          </button>

          {isMenuOpen && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenTicketModal(project)}
                className="text-xs text-amber-700 dark:text-amber-300 font-bold hover:underline cursor-pointer min-h-[40px] px-2 flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ثبت ایراد</span>
              </button>

              {onOpenMaterialModal && (
                <button
                  type="button"
                  onClick={() => onOpenMaterialModal(project)}
                  className="text-xs text-purple-700 dark:text-purple-300 font-bold hover:underline cursor-pointer min-h-[40px] px-2 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>درخواست متریال</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Material Receipt */}
      {confirmingReceiptTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl border border-purple-500/40 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-ink">
            <div className="flex items-center gap-2.5 text-purple-400">
              <Package className="w-6 h-6 shrink-0" />
              <h4 className="font-black text-sm text-ink">
                تایید دریافت فیزیکی بسته سر کارگاه
              </h4>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed">
              آیا اقلام زیر را به طور کامل از پیک تحویل گرفته و تطابق فیزیکی آن‌ها با کارگاه را تایید می‌نمایید؟
            </p>

            <div className="bg-canvas p-3 rounded-xl border border-line text-xs space-y-1.5">
              <div className="font-bold text-purple-300">
                پیک / راننده: {confirmingReceiptTarget.dispatch.courierInfo}
              </div>
              {confirmingReceiptTarget.dispatch.trackingCode && (
                <div className="text-[12px] text-brand-ink font-mono">
                  کد رهگیری: {confirmingReceiptTarget.dispatch.trackingCode}
                </div>
              )}
              <div className="pt-1.5 border-t border-line space-y-1">
                {confirmingReceiptTarget.dispatch.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[12px] text-ink-2">
                    <span>• {i.title}</span>
                    <span className="font-bold text-ink">
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
                className="px-3.5 py-2 rounded-xl border border-line bg-raised text-xs font-bold hover:bg-hover text-ink-2 hover:text-ink min-h-[44px] cursor-pointer transition"
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
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition min-h-[44px] flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید نهایی و تحویل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Installation Photos Mandatory Gate Modal */}
      <PreInstallPhotoModal
        project={project}
        isOpen={isPreInstallModalOpen}
        onClose={() => setIsPreInstallModalOpen(false)}
        onSubmit={async (photos) => {
          if (onSavePreInstallPhotosAndStart) {
            await onSavePreInstallPhotosAndStart(project.id, photos);
          } else {
            onUpdateStatus(project.id, 'EN_ROUTE', 'IN_PROGRESS');
          }
        }}
      />
    </div>
  );
};
