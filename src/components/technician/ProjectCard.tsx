import React from 'react';
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
}) => {
  return (
    <div className="bg-white dark:bg-[#1C1C1C] rounded-3xl p-5 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs hover:border-[#C1A056]/50 dark:hover:border-[#C1A056]/50 transition space-y-4">
      {/* Top Bar: Time, Code, Status */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DC] dark:border-[#2D2D2D]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold bg-[#FAF7F2] dark:bg-[#222222] border border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 px-2.5 py-1 rounded-lg">
            {project.code}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-[#212121] dark:text-white">
            <Clock className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
            <span>ساعت {toPersianDigits(project.scheduledTime)}</span>
          </div>
        </div>

        <span
          className={`text-[11px] px-3 py-1 rounded-full font-bold ${
            project.status === 'COMPLETED'
              ? 'bg-[#194840]/15 text-[#194840] dark:bg-[#194840]/30 dark:text-emerald-400'
              : project.status === 'IN_PROGRESS'
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 animate-pulse'
              : project.status === 'EN_ROUTE'
              ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300'
              : 'bg-[#FAF7F2] dark:bg-[#252525] text-slate-700 dark:text-zinc-300 border border-[#E8E4DC] dark:border-[#333333]'
          }`}
        >
          {project.status === 'COMPLETED'
            ? '✓ نصب پایان یافته'
            : project.status === 'IN_PROGRESS'
            ? 'در حال نصب در محل'
            : project.status === 'EN_ROUTE'
            ? 'در مسیر پروژه'
            : 'برنامه‌ریزی شده'}
        </span>
      </div>

      {/* On-Site Active Job Timer / Completion Duration */}
      <ActiveJobTimer
        status={project.status}
        startedAt={project.startedAt}
        completedAt={project.completedAt}
      />

      {/* Title & Customer */}
      <div>
        <h3 className="font-black text-base text-[#212121] dark:text-white leading-snug">{project.title}</h3>
        <p className="text-xs text-[#71717A] dark:text-zinc-400 mt-1">کارفرما: {project.customerName}</p>
      </div>

      {/* Address & Quick Actions (Call & Route) */}
      <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-3.5 border border-[#E8E4DC] dark:border-[#2D2D2D] space-y-2.5">
        <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
          <MapPin className="w-4 h-4 text-[#C1A056] shrink-0 mt-0.5" aria-hidden="true" />
          <span>{project.address || 'آدرس ثبت نشده است'}</span>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
          {project.customerPhone && (
            <a
              href={`tel:${project.customerPhone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#212121] dark:bg-[#252525] hover:bg-[#333333] text-[#C1A056] rounded-xl text-xs font-bold shadow-xs transition border border-[#C1A056]/30 active:scale-95 min-h-[44px]"
              aria-label={`تماس با شماره ${project.customerPhone}`}
            >
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تماس با مشتری</span>
            </a>
          )}

          {project.locationUrl ? (
            <a
              href={project.locationUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#222222] text-[#212121] dark:text-white border border-[#E8E4DC] dark:border-[#333333] rounded-xl text-xs font-bold shadow-xs transition active:scale-95 min-h-[44px]"
            >
              <Navigation className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
              <span>مسیریابی نقشه</span>
            </a>
          ) : (
            <a
              href={`https://nshn.ir/search/${encodeURIComponent(project.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#222222] text-[#212121] dark:text-white border border-[#E8E4DC] dark:border-[#333333] rounded-xl text-xs font-bold transition active:scale-95 min-h-[44px]"
            >
              <Navigation className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
              <span>مسیریابی نشان</span>
            </a>
          )}
        </div>
      </div>

      {/* Technical Specifications: Panels */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#E8E4DC] dark:border-[#2D2D2D] rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">شید</span>
          <span className="font-black text-sm text-[#212121] dark:text-white font-mono">
            {toPersianDigits(project.shadePanels)} لت
          </span>
        </div>
        <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#C1A056]/30 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-[#A88738] dark:text-[#C1A056] block">پرده</span>
          <span className="font-black text-sm text-[#C1A056] font-mono">
            {toPersianDigits(project.curtainPanels)} لت
          </span>
        </div>
      </div>

      {/* Mechanism & Special Notes */}
      {(project.mechanismType || project.specialNotes) && (
        <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-3 border border-[#E8E4DC] dark:border-[#2D2D2D] text-xs text-slate-700 dark:text-zinc-300 space-y-1">
          {project.mechanismType && (
            <div>
              <span className="font-bold text-[#212121] dark:text-white">نوع مکانیزم: </span>
              <span>{project.mechanismType}</span>
            </div>
          )}
          {project.specialNotes && (
            <div className="text-[#A88738] dark:text-[#C1A056] bg-white dark:bg-[#161616] p-2.5 rounded-xl mt-1 text-[11px] leading-relaxed border border-[#E8E4DC] dark:border-[#333333]">
              <span className="font-bold text-[#212121] dark:text-white">نکته فروش: </span>
              {project.specialNotes}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons: Proposal & Tool Checklist */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onViewProposal(project)}
          className="flex items-center justify-center gap-1.5 py-3 px-3 bg-[#FAF7F2] dark:bg-[#202020] hover:bg-[#F5EFEB] dark:hover:bg-[#282828] border border-[#C1A056]/50 text-[#A88738] dark:text-[#C1A056] rounded-2xl text-xs font-bold transition active:scale-95 min-h-[44px]"
        >
          <FileText className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
          <span>عکس پروپوزال فروش</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenToolChecklist(project)}
          className="flex items-center justify-center gap-1.5 py-3 px-3 bg-[#FAF7F2] dark:bg-[#202020] hover:bg-[#F5EFEB] dark:hover:bg-[#282828] border border-[#E8E4DC] dark:border-[#333333] text-[#212121] dark:text-zinc-200 rounded-2xl text-xs font-bold transition active:scale-95 min-h-[44px]"
        >
          <Wrench className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
          <span>چک‌لیست ابزار ({project.isFullTools ? 'فول' : toPersianDigits(project.toolsRequired.length)})</span>
        </button>
      </div>

      {/* Workflow Progress Status Actions */}
      <div className="pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D] space-y-2">
        {project.status === 'SCHEDULED' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'EN_ROUTE')}
            className="w-full py-3.5 bg-[#212121] dark:bg-[#252525] hover:bg-[#333333] text-[#C1A056] rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 border border-[#C1A056]/30 active:scale-98 min-h-[48px]"
          >
            <Car className="w-4 h-4" aria-hidden="true" />
            حرکت به سمت پروژه (اعلام شروع مسیر)
          </button>
        )}

        {project.status === 'EN_ROUTE' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'IN_PROGRESS')}
            className="w-full py-3.5 bg-gradient-to-r from-[#C1A056] to-[#A88738] text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-98 min-h-[48px]"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            رسیدم سر پروژه / شروع نصب
          </button>
        )}

        {project.status === 'IN_PROGRESS' && (
          <button
            type="button"
            onClick={() => onOpenCompletionModal(project)}
            className="w-full py-3.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-2xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2 border border-[#C1A056]/40 active:scale-98 min-h-[48px]"
          >
            <CheckCircle2 className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
            ثبت اتمام نصب و ارسال عکس به QC
          </button>
        )}

        {project.status === 'COMPLETED' && (
          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#C1A056]/40 rounded-2xl p-3 text-xs text-[#212121] dark:text-zinc-200 text-center font-bold flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>گزارش اتمام نصب ثبت شد و در انتظار بررسی QC است</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400 font-normal">
              {project.customerSignature && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✍️ امضای کارفرما ثبت شد</span>
              )}
              {((project.afterPhotos?.length || 0) + (project.beforePhotos?.length || 0) > 0) && (
                <span>📷 {toPersianDigits((project.afterPhotos?.length || 0) + (project.beforePhotos?.length || 0))} عکس</span>
              )}
              {project.handoverChecklist && Object.values(project.handoverChecklist).every(Boolean) && (
                <span className="text-[#A88738] dark:text-[#C1A056] font-bold">🛡️ 4 استاندارد طلایی ✓</span>
              )}
            </div>

            {onOpenCertificate && (
              <button
                type="button"
                onClick={() => onOpenCertificate(project)}
                className="w-full mt-1 py-2 px-3 bg-white dark:bg-[#161616] hover:bg-[#FAF7F2] dark:hover:bg-[#202020] border border-[#C1A056]/50 text-[#C1A056] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>مشاهده شناسنامه تحویل و چاپ PDF</span>
              </button>
            )}
          </div>
        )}

        {/* Emergency Ticket Button */}
        <button
          type="button"
          onClick={() => onOpenTicketModal(project)}
          className="w-full py-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-98 min-h-[44px]"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          اعلام کسری قطعه، آسیب پارچه یا خرابی سر پروژه
        </button>
      </div>

      {/* QC Evaluation Review Card */}
      {project.qcStatus === 'APPROVED' && (
        <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#C1A056]/50 rounded-2xl p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#212121] dark:text-white flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              تاییدیه و امتیاز مسئول QC:
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= (project.qcScore || 5)
                      ? 'text-[#C1A056] fill-[#C1A056]'
                      : 'text-slate-300 dark:text-zinc-600'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
          {project.qcNotes && (
            <p className="text-slate-700 dark:text-zinc-300 text-[11px] leading-relaxed italic bg-white dark:bg-[#161616] p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#2D2D2D]">
              «{project.qcNotes}»
            </p>
          )}
        </div>
      )}
    </div>
  );
};
