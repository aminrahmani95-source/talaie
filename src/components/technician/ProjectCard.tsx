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
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  project: Project;
  currentUser: User;
  onViewProposal: (project: Project) => void;
  onOpenToolChecklist: (project: Project) => void;
  onOpenTicketModal: (project: Project) => void;
  onOpenCompletionModal: (project: Project) => void;
  onUpdateStatus: (projectId: string, newStatus: Project['status']) => void;
}

export const ProjectCard: React.FC<Props> = ({
  project,
  onViewProposal,
  onOpenToolChecklist,
  onOpenTicketModal,
  onOpenCompletionModal,
  onUpdateStatus,
}) => {
  return (
    <div className="bg-white rounded-3xl p-5 border border-[#E8E4DC] shadow-xs hover:border-[#C1A056]/50 transition space-y-4">
      {/* Top Bar: Time, Code, Status */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DC]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold bg-[#FAF7F2] border border-[#E8E4DC] text-slate-700 px-2 py-0.5 rounded-lg">
            {project.code}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-[#212121]">
            <Clock className="w-3.5 h-3.5 text-[#C1A056]" />
            <span>ساعت {toPersianDigits(project.scheduledTime)}</span>
          </div>
        </div>

        <span
          className={`text-[11px] px-3 py-1 rounded-full font-bold ${
            project.status === 'COMPLETED'
              ? 'bg-[#194840]/15 text-[#194840]'
              : project.status === 'IN_PROGRESS'
              ? 'bg-amber-100 text-amber-900 animate-pulse'
              : project.status === 'EN_ROUTE'
              ? 'bg-blue-100 text-blue-900'
              : 'bg-[#FAF7F2] text-slate-700 border border-[#E8E4DC]'
          }`}
        >
          {project.status === 'COMPLETED'
            ? '✓ نصب پایان یافته'
            : project.status === 'IN_PROGRESS'
            ? '⚙️ در حال نصب در محل'
            : project.status === 'EN_ROUTE'
            ? '🚗 در مسیر پروژه'
            : 'برنامه‌ریزی شده'}
        </span>
      </div>

      {/* Title & Customer */}
      <div>
        <h3 className="font-black text-base text-[#212121] leading-snug">{project.title}</h3>
        <p className="text-xs text-[#71717A] mt-1">کارفرما: {project.customerName}</p>
      </div>

      {/* Address & Quick Actions (Call & Route) */}
      <div className="bg-[#FAF7F2] rounded-2xl p-3.5 border border-[#E8E4DC] space-y-2.5">
        <div className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
          <MapPin className="w-4 h-4 text-[#C1A056] shrink-0 mt-0.5" />
          <span>{project.address || 'آدرس ثبت نشده است'}</span>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-[#E8E4DC]">
          {project.customerPhone && (
            <a
              href={`tel:${project.customerPhone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-xl text-xs font-bold shadow-xs transition border border-[#C1A056]/30"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>تماس با مشتری</span>
            </a>
          )}

          {project.locationUrl ? (
            <a
              href={project.locationUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-[#212121] border border-[#E8E4DC] rounded-xl text-xs font-bold shadow-xs transition"
            >
              <Navigation className="w-3.5 h-3.5 text-[#C1A056]" />
              <span>مسیریابی نقشه</span>
            </a>
          ) : (
            <a
              href={`https://nshn.ir/search/${encodeURIComponent(project.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-[#212121] border border-[#E8E4DC] rounded-xl text-xs font-bold transition"
            >
              <Navigation className="w-3.5 h-3.5 text-[#C1A056]" />
              <span>مسیریابی نشان</span>
            </a>
          )}
        </div>
      </div>

      {/* Technical Specifications: Panels */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-[#FAF7F2] border border-[#E8E4DC] rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-slate-500 block">شید</span>
          <span className="font-black text-sm text-[#212121] font-mono">
            {toPersianDigits(project.shadePanels)} لت
          </span>
        </div>
        <div className="bg-[#FAF7F2] border border-[#C1A056]/30 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-[#A88738] block">پرده</span>
          <span className="font-black text-sm text-[#C1A056] font-mono">
            {toPersianDigits(project.curtainPanels)} لت
          </span>
        </div>
      </div>

      {/* Mechanism & Special Notes */}
      {(project.mechanismType || project.specialNotes) && (
        <div className="bg-[#FAF7F2] rounded-2xl p-3 border border-[#E8E4DC] text-xs text-slate-700 space-y-1">
          {project.mechanismType && (
            <div>
              <span className="font-bold text-[#212121]">نوع مکانیزم: </span>
              <span>{project.mechanismType}</span>
            </div>
          )}
          {project.specialNotes && (
            <div className="text-[#A88738] bg-white p-2 rounded-xl mt-1 text-[11px] leading-relaxed border border-[#E8E4DC]">
              <span className="font-bold text-[#212121]">نکته فروش: </span>
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
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#FAF7F2] hover:bg-[#F5EFEB] border border-[#C1A056]/50 text-[#A88738] rounded-2xl text-xs font-bold transition"
        >
          <FileText className="w-4 h-4 text-[#C1A056]" />
          <span>عکس پروپوزال فروش</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenToolChecklist(project)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#FAF7F2] hover:bg-[#F5EFEB] border border-[#E8E4DC] text-[#212121] rounded-2xl text-xs font-bold transition"
        >
          <Wrench className="w-4 h-4 text-[#C1A056]" />
          <span>چک‌لیست ابزار ({project.isFullTools ? 'فول' : toPersianDigits(project.toolsRequired.length)})</span>
        </button>
      </div>

      {/* Workflow Progress Status Actions */}
      <div className="pt-2 border-t border-[#E8E4DC] space-y-2">
        {project.status === 'SCHEDULED' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'EN_ROUTE')}
            className="w-full py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 border border-[#C1A056]/30"
          >
            <Car className="w-4 h-4" />
            حرکت به سمت پروژه (اعلام شروع مسیر)
          </button>
        )}

        {project.status === 'EN_ROUTE' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'IN_PROGRESS')}
            className="w-full py-3 bg-gradient-to-r from-[#C1A056] to-[#A88738] text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            رسیدم سر پروژه / شروع نصب
          </button>
        )}

        {project.status === 'IN_PROGRESS' && (
          <button
            type="button"
            onClick={() => onOpenCompletionModal(project)}
            className="w-full py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-2xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2 border border-[#C1A056]/40"
          >
            <CheckCircle2 className="w-4 h-4 text-[#C1A056]" />
            ثبت اتمام نصب و ارسال عکس به کیوسی
          </button>
        )}

        {project.status === 'COMPLETED' && (
          <div className="bg-[#FAF7F2] border border-[#C1A056]/40 rounded-2xl p-3 text-xs text-[#212121] text-center font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C1A056]" />
            گزارش اتمام نصب ثبت شد و در انتظار بررسی کیوسی است
          </div>
        )}

        {/* Emergency Ticket Button */}
        <button
          type="button"
          onClick={() => onOpenTicketModal(project)}
          className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          اعلام کسری قطعه، آسیب پارچه یا خرابی سر پروژه
        </button>
      </div>

      {/* QC Evaluation Review Card */}
      {project.qcStatus === 'APPROVED' && (
        <div className="bg-[#FAF7F2] border border-[#C1A056]/50 rounded-2xl p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#212121] flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-[#C1A056]" />
              تاییدیه و امتیاز مسئول کیوسی:
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= (project.qcScore || 5)
                      ? 'text-[#C1A056] fill-[#C1A056]'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
          {project.qcNotes && (
            <p className="text-slate-700 text-[11px] leading-relaxed italic bg-white p-2 rounded-xl border border-[#E8E4DC]">
              «{project.qcNotes}»
            </p>
          )}
        </div>
      )}
    </div>
  );
};
