import React, { useState } from 'react';
import { Project, User, ProjectStatus } from '../../types';
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
  Printer,
  AlertOctagon,
  MoreVertical,
  Layers,
  Loader2,
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';
import { ActiveJobTimer } from '../ActiveJobTimer';
import { StatusPill } from '../ui/StatusPill';

interface Props {
  project: Project;
  currentUser: User;
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onUpdateStatus: (projectId: string, from: ProjectStatus, to: ProjectStatus) => void;
  onOpenCertificate?: (project: Project) => void;
  onReportStuck?: (project: Project) => void;
  isTransitioning?: boolean;
}

export const ProjectCard: React.FC<Props> = ({
  project,
  currentUser,
  onViewProposal,
  onOpenToolChecklist,
  onOpenTicketModal,
  onOpenCompletionModal,
  onUpdateStatus,
  onOpenCertificate,
  onReportStuck,
  isTransitioning = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isStuck = project.status === 'STUCK';
  const isInProgress = project.status === 'IN_PROGRESS';
  const isEnRoute = project.status === 'EN_ROUTE';
  const isCompleted = project.status === 'COMPLETED';
  const isScheduled = project.status === 'SCHEDULED';
  const isRejected = project.qcStatus === 'REJECTED';

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
          <div className="flex items-center gap-1 text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF]">
            <Clock className="w-3.5 h-3.5 text-[#8E6F27] dark:text-[#E5CA8F]" />
            <span className="font-mono">{toPersianDigits(project.scheduledTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isTransitioning && (
            <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
              در صف ارسال
            </span>
          )}
          <StatusPill status={project.status} qcStatus={project.qcStatus} size="sm" />
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
            <div className="bg-white dark:bg-[#141414] p-2 rounded-lg border border-rose-200 dark:border-rose-900/50 text-[#181818] dark:text-zinc-200 text-[11px] leading-relaxed">
              <span className="font-bold text-rose-600 block mb-0.5">نکات QC:</span>
              «{project.qcNotes}»
            </div>
          )}
        </div>
      )}

      {/* Active Job Timer (Shows live stopwatch during installation) */}
      <ActiveJobTimer
        status={project.status}
        startedAt={project.startedAt}
        completedAt={project.completedAt}
        reworkStartedAt={project.reworkStartedAt}
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

      {/* Technical Summary Chip */}
      <div className="bg-[#FAF7F2] dark:bg-[#141414] rounded-xl p-2 px-3 border border-[#E2DDD4] dark:border-[#282828] flex items-center justify-between text-xs font-semibold gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-[#4A4742] dark:text-[#BDB8AF]">
          <Layers className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] shrink-0" />
          <span>
            {project.shadePanels > 0 && `${toPersianDigits(project.shadePanels)} لت شید`}
            {project.shadePanels > 0 && project.curtainPanels > 0 && ' • '}
            {project.curtainPanels > 0 && `${toPersianDigits(project.curtainPanels)} لت پرده`}
          </span>
        </div>

        {project.mechanismType && (
          <span className="text-[11px] text-[#8E6F27] dark:text-[#E5CA8F] font-bold truncate max-w-[170px]">
            {project.mechanismType}
          </span>
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
            <span className="text-[10px] font-bold">تماس</span>
          </a>
        ) : (
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-60 min-h-[48px]">
            <Phone className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">بدون تلفن</span>
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
          <span className="text-[10px] font-bold">مسیریابی</span>
        </a>

        <button
          type="button"
          onClick={() => onViewProposal(project)}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#EFEBE4] dark:hover:bg-[#252525] border border-[#E2DDD4] dark:border-[#2C2C2C] text-[#181818] dark:text-zinc-200 transition min-h-[48px] active:scale-95 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] mb-0.5" />
          <span className="text-[10px] font-bold">پروپوزال</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenToolChecklist(project)}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#EFEBE4] dark:hover:bg-[#252525] border border-[#E2DDD4] dark:border-[#2C2C2C] text-[#181818] dark:text-zinc-200 transition min-h-[48px] active:scale-95 cursor-pointer"
        >
          <Wrench className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F] mb-0.5" />
          <span className="text-[10px] font-bold">ابزار</span>
        </button>
      </div>

      {/* ONE BIG OBVIOUS PRIMARY ACTION BUTTON (Unmissable in sunlight) */}
      <div className="pt-1">
        {isScheduled && (
          <button
            type="button"
            disabled={isTransitioning}
            onClick={() => onUpdateStatus(project.id, 'SCHEDULED', 'EN_ROUTE')}
            className="w-full py-4 px-4 bg-[#212121] hover:bg-[#2D2D2D] disabled:opacity-50 text-[#C1A056] rounded-xl text-sm font-black shadow-md transition flex items-center justify-center gap-2.5 border-2 border-[#C1A056] active:scale-[0.98] min-h-[50px] cursor-pointer"
          >
            {isTransitioning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Car className="w-5 h-5" />
            )}
            <span>{isTransitioning ? 'در حال ثبت...' : 'حرکت به محل نصب (اعلام حرکت)'}</span>
          </button>
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
          <button
            type="button"
            onClick={() => onOpenCompletionModal(project)}
            className="w-full py-4 px-4 bg-[#C1A056] hover:bg-[#D4B56C] text-[#181818] rounded-xl text-sm font-black shadow-lg transition flex items-center justify-center gap-2.5 active:scale-[0.98] min-h-[50px] cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>ثبت اتمام کار و ارسال به QC</span>
          </button>
        )}

        {isStuck && (
          <div className="bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>پروژه متوقف است — در حال پیگیری توسط مسئولین فنی</span>
            </div>
            {project.stuckIncident?.description && (
              <p className="mt-1 text-[11px] text-[#69655F] dark:text-[#9E988D]">
                علت: {project.stuckIncident.description}
              </p>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {project.qcStatus === 'APPROVED' ? 'تایید نهایی QC صادر شد' : 'اتمام نصب ثبت شد — در انتظار تایید QC'}
              </span>
            </div>
            {onOpenCertificate && (
              <button
                type="button"
                onClick={() => onOpenCertificate(project)}
                className="px-2.5 py-1 bg-white dark:bg-[#1E1E1E] border border-[#C1A056] text-[#8E6F27] dark:text-[#E5CA8F] rounded-lg text-[11px] font-bold hover:bg-[#FAF7F2] transition cursor-pointer"
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
          className="flex items-center gap-1 text-[#69655F] dark:text-[#9E988D] hover:text-[#181818] dark:hover:text-white py-1 px-2 rounded-lg transition cursor-pointer"
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
                className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
              >
                گزارش توقف کار
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenTicketModal(project)}
              className="text-[11px] text-[#8E6F27] dark:text-[#E5CA8F] font-bold hover:underline cursor-pointer"
            >
              ثبت تیکت فوری
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
