import React, { useState } from 'react';
import { Project, User } from '../../types';
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
  Star,
  ShieldCheck,
  Printer,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';
import { ActiveJobTimer } from '../ActiveJobTimer';

interface Props {
  project: Project;
  currentUser: User;
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onUpdateStatus: (projectId: string, newStatus: Project['status']) => void;
  onOpenCertificate?: (project: Project) => void;
  onReportStuck?: (project: Project) => void;
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
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const isStuck = project.status === 'STUCK';
  const isInProgress = project.status === 'IN_PROGRESS';
  const isEnRoute = project.status === 'EN_ROUTE';
  const isCompleted = project.status === 'COMPLETED';
  const isPendingMeasurement = project.status === 'MEASUREMENT_PENDING';

  return (
    <div
      className={`luxury-card p-4 sm:p-5 relative overflow-hidden transition-all duration-200 space-y-4 ${
        isInProgress
          ? 'border-[#C1A056] dark:border-[#C1A056]/60 shadow-lg shadow-[#C1A056]/5'
          : isStuck
          ? 'border-rose-500/60 dark:border-rose-500/50'
          : 'border-[#E8E4DC] dark:border-[#282828]'
      }`}
    >
      {/* Top Accent Strip */}
      <div
        className={`absolute top-0 right-0 left-0 h-1 ${
          isInProgress
            ? 'bg-gradient-to-r from-[#C1A056] to-[#D5733A]'
            : isStuck
            ? 'bg-rose-600'
            : isCompleted
            ? 'bg-emerald-600'
            : 'bg-[#C1A056]/30'
        }`}
      />

      {/* Top Meta Bar: Code, Time, Status */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black bg-[#1E1E1E] text-[#C1A056] px-2.5 py-0.5 rounded-lg shadow-2xs">
            {project.code}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
            <span>ساعت {toPersianDigits(project.scheduledTime)}</span>
          </div>
        </div>

        {/* Refined Status Pill */}
        <span
          className={`text-[11px] px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
            isStuck
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 font-black animate-pulse'
              : isPendingMeasurement
              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
              : isCompleted
              ? project.qcStatus === 'APPROVED'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-[#C1A056]/20 text-[#A88738] dark:text-[#C1A056] border border-[#C1A056]/40'
              : isInProgress
              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 animate-pulse'
              : isEnRoute
              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
              : 'bg-[#FAF7F2] dark:bg-[#222222] text-slate-600 dark:text-zinc-400 border border-[#E8E4DC] dark:border-[#333333]'
          }`}
        >
          {isStuck && <AlertOctagon className="w-3.5 h-3.5" />}
          {isCompleted && project.qcStatus === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
          <span>
            {isStuck
              ? 'استاک (<72h)'
              : isPendingMeasurement
              ? 'کارشناسی فضا و متراژ دوم'
              : isCompleted
              ? project.qcStatus === 'APPROVED'
                ? '✓ تایید نهایی QC'
                : '⏳ در انتظار تایید QC'
              : isInProgress
              ? 'در حال نصب در محل'
              : isEnRoute
              ? 'در مسیر پروژه'
              : 'برنامه‌ریزی شده'}
          </span>
        </span>
      </div>

      {/* On-Site Active Job Timer (Shows live stopwatch during installation) */}
      <ActiveJobTimer
        status={project.status}
        startedAt={project.startedAt}
        completedAt={project.completedAt}
      />

      {/* Project Title & Customer */}
      <div className="space-y-1">
        <h3 className="font-black text-base sm:text-lg text-[#1E1E1E] dark:text-white leading-tight">
          {project.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 flex-wrap">
          <span className="font-bold text-slate-800 dark:text-zinc-200">
            کارفرما: {project.customerName}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 truncate max-w-xs">
            <MapPin className="w-3.5 h-3.5 text-[#C1A056] shrink-0" />
            <span className="truncate">{project.address}</span>
          </span>
        </div>
      </div>

      {/* Elegant Technical Specs Strip (Compact & Clean) */}
      <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-2xl p-2.5 px-3.5 border border-[#E8E4DC] dark:border-[#2D2D2D] flex items-center justify-between text-xs font-semibold gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
          <Layers className="w-4 h-4 text-[#C1A056] shrink-0" />
          <span>
            {project.shadePanels > 0 && `${toPersianDigits(project.shadePanels)} لت شید`}
            {project.shadePanels > 0 && project.curtainPanels > 0 && ' • '}
            {project.curtainPanels > 0 && `${toPersianDigits(project.curtainPanels)} لت پرده`}
          </span>
          {project.approximateArea && (
            <span className="text-zinc-400 font-normal">
              ({toPersianDigits(project.approximateArea)} م²)
            </span>
          )}
        </div>

        {project.mechanismType && (
          <span className="text-[11px] text-[#A88738] dark:text-[#C1A056] font-bold bg-white dark:bg-[#141414] px-2.5 py-0.5 rounded-lg border border-[#E8E4DC] dark:border-[#333333] truncate max-w-[180px]">
            {project.mechanismType}
          </span>
        )}
      </div>

      {/* Quick Action Buttons (Call, Map Route, Sales Proposal, Tools) */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {project.customerPhone ? (
          <a
            href={`tel:${project.customerPhone}`}
            className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#F2ECE1] dark:hover:bg-[#282828] border border-[#E8E4DC] dark:border-[#2E2E2E] text-slate-800 dark:text-zinc-200 transition min-h-[54px] active:scale-95"
            title={`تماس با ${project.customerPhone}`}
          >
            <Phone className="w-4 h-4 text-[#C1A056] mb-1" />
            <span className="text-[10px] font-bold">تماس</span>
          </a>
        ) : (
          <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-400 opacity-60 min-h-[54px]">
            <Phone className="w-4 h-4 mb-1" />
            <span className="text-[10px]">بدون شماره</span>
          </div>
        )}

        <a
          href={
            project.locationUrl ||
            `https://nshn.ir/search/${encodeURIComponent(project.address)}`
          }
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#F2ECE1] dark:hover:bg-[#282828] border border-[#E8E4DC] dark:border-[#2E2E2E] text-slate-800 dark:text-zinc-200 transition min-h-[54px] active:scale-95"
          title="مسیریابی هوشمند نشان / بلد"
        >
          <Navigation className="w-4 h-4 text-[#C1A056] mb-1" />
          <span className="text-[10px] font-bold">مسیریابی</span>
        </a>

        <button
          type="button"
          onClick={() => onViewProposal(project)}
          className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#F2ECE1] dark:hover:bg-[#282828] border border-[#E8E4DC] dark:border-[#2E2E2E] text-slate-800 dark:text-zinc-200 transition min-h-[54px] active:scale-95 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-[#C1A056] mb-1" />
          <span className="text-[10px] font-bold">پروپوزال</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenToolChecklist(project)}
          className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1E1E] hover:bg-[#F2ECE1] dark:hover:bg-[#282828] border border-[#E8E4DC] dark:border-[#2E2E2E] text-slate-800 dark:text-zinc-200 transition min-h-[54px] active:scale-95 cursor-pointer"
        >
          <Wrench className="w-4 h-4 text-[#C1A056] mb-1" />
          <span className="text-[10px] font-bold">
            {project.isFullTools ? 'فول ابزار' : `ابزار (${toPersianDigits(project.toolsRequired.length)})`}
          </span>
        </button>
      </div>

      {/* Primary Workflow Execution Buttons */}
      <div className="space-y-2 pt-1">
        {project.status === 'SCHEDULED' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'EN_ROUTE')}
            className="w-full py-3.5 px-4 bg-[#1E1E1E] hover:bg-[#282828] text-[#C1A056] rounded-2xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 border border-[#C1A056]/30 active:scale-[0.99] min-h-[48px] cursor-pointer"
          >
            <Car className="w-4 h-4" aria-hidden="true" />
            <span>حرکت به سمت پروژه (اعلام شروع مسیر)</span>
          </button>
        )}

        {project.status === 'EN_ROUTE' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'IN_PROGRESS')}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#D4B46A] hover:to-[#B8984B] text-[#121212] rounded-2xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2 active:scale-[0.99] min-h-[48px] cursor-pointer"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>رسیدم سر پروژه / شروع نصب</span>
          </button>
        )}

        {project.status === 'IN_PROGRESS' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onOpenCompletionModal(project)}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#D4B46A] hover:to-[#B8984B] text-[#121212] rounded-2xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2 active:scale-[0.99] min-h-[48px] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#121212]" aria-hidden="true" />
              <span>ثبت اتمام نصب و ارسال عکس به QC</span>
            </button>

            {onReportStuck && (
              <button
                type="button"
                onClick={() => onReportStuck(project)}
                className="w-full py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-bold border border-rose-500/30 transition flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span>اعلام توقف کار و کسری حاد (ثبت پرونده استاک &lt;72h)</span>
              </button>
            )}
          </div>
        )}

        {/* If Stuck: Show prominent notification banner */}
        {isStuck && (
          <div className="bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-200 font-black">
              <span className="flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>کار روی این پروژه متوقف است (پرونده استاک)</span>
              </span>
              <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-mono font-bold">
                KPI &lt; 72h
              </span>
            </div>
            <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
              دلیل توقف: {project.stuckIncident?.description || 'کسری قطعه، آسیب پارچه یا عدم آمادگی بستر'}
            </p>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-rose-500/20">
              پرونده در دسک رفع استاک تحت پیگیری مسئولین فنی (امین رحمانی / امین زهری) قرار دارد.
            </div>
          </div>
        )}

        {/* If Completed: Show success pill & Certificate shortcut */}
        {isCompleted && (
          <div className="bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3 text-xs text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>گزارش اتمام نصب ثبت شد و در انتظار تایید QC است</span>
            </div>

            {onOpenCertificate && (
              <button
                type="button"
                onClick={() => onOpenCertificate(project)}
                className="w-full py-2.5 px-3 bg-white dark:bg-[#1E1E1E] hover:bg-[#FAF7F2] dark:hover:bg-[#252525] border border-[#C1A056]/40 text-[#C1A056] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>مشاهده شناسنامه رسمی تحویل و پرینت PDF</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progressive Disclosure Accordion Toggle */}
      <div className="pt-1 border-t border-[#E8E4DC] dark:border-[#282828]">
        <button
          type="button"
          onClick={() => setIsDetailsOpen((prev) => !prev)}
          className="w-full py-1 text-[11px] text-[#A88738] dark:text-[#C1A056] hover:text-[#7A6124] font-bold flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>{isDetailsOpen ? 'بستن جزئیات تکمیلی' : 'مشاهده نکات فروش، آدرس کامل و تیکت اضطراری'}</span>
          {isDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Collapsible Content */}
        {isDetailsOpen && (
          <div className="pt-3 space-y-3 animate-in fade-in duration-150 text-xs">
            {/* Full Address */}
            <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-xl border border-[#E8E4DC] dark:border-[#2D2D2D] space-y-1">
              <span className="text-[10px] text-zinc-400 block font-bold">نشانی دقیق محل نصب:</span>
              <p className="text-slate-700 dark:text-zinc-200 leading-relaxed">{project.address}</p>
            </div>

            {/* Sales Notes */}
            {project.specialNotes && (
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-1">
                <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold block">
                  نکات ویژه واحد فروش:
                </span>
                <p className="text-amber-900 dark:text-amber-200 leading-relaxed text-[11px]">
                  {project.specialNotes}
                </p>
              </div>
            )}

            {/* Emergency Ticket Button */}
            <button
              type="button"
              onClick={() => onOpenTicketModal(project)}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>ثبت تیکت فوری کسری قطعه، آسیب پارچه یا خرابی</span>
            </button>

            {/* QC Review Note if Approved */}
            {project.qcStatus === 'APPROVED' && project.qcNotes && (
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-xl border border-[#C1A056]/30 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#C1A056]">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>تاییدیه و نظر مسئول QC:</span>
                  </span>
                  <span>⭐ {toPersianDigits(project.qcScore || 5)} از 5</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px] italic">«{project.qcNotes}»</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
