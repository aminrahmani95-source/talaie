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
  ChevronRight,
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
  currentUser,
  onViewProposal,
  onOpenToolChecklist,
  onOpenTicketModal,
  onOpenCompletionModal,
  onUpdateStatus,
}) => {
  const isLead = project.leadTechnicianId === currentUser.id || currentUser.role === 'LEAD_TECHNICIAN';

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition space-y-4">
      {/* Top Bar: Time, Code, Status */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg">
            {project.code}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-blue-700">
            <Clock className="w-3.5 h-3.5" />
            <span>ساعت {toPersianDigits(project.scheduledTime)}</span>
          </div>
        </div>

        <span
          className={`text-[11px] px-3 py-1 rounded-full font-bold ${
            project.status === 'COMPLETED'
              ? 'bg-emerald-100 text-emerald-800'
              : project.status === 'IN_PROGRESS'
              ? 'bg-amber-100 text-amber-800 animate-pulse'
              : project.status === 'EN_ROUTE'
              ? 'bg-sky-100 text-sky-800'
              : 'bg-slate-100 text-slate-700'
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
        <h3 className="font-black text-base text-slate-900 leading-snug">{project.title}</h3>
        <p className="text-xs text-slate-500 mt-1">کارفرما: {project.customerName}</p>
      </div>

      {/* Address & Quick Actions (Call & Route) */}
      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2.5">
        <div className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>{project.address || 'آدرس ثبت نشده است'}</span>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
          {project.customerPhone && (
            <a
              href={`tel:${project.customerPhone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
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
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>مسیریابی نقشه</span>
            </a>
          ) : (
            <a
              href={`https://nshn.ir/search/${encodeURIComponent(project.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>مسیریابی نشان</span>
            </a>
          )}
        </div>
      </div>

      {/* Technical Specifications: Panels */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-blue-700 block">شید</span>
          <span className="font-black text-sm text-blue-950 font-mono">
            {toPersianDigits(project.shadePanels)} لت
          </span>
        </div>
        <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-purple-700 block">پرده</span>
          <span className="font-black text-sm text-purple-950 font-mono">
            {toPersianDigits(project.curtainPanels)} لت
          </span>
        </div>
      </div>

      {/* Mechanism & Special Notes */}
      {(project.mechanismType || project.specialNotes) && (
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs text-slate-700 space-y-1">
          {project.mechanismType && (
            <div>
              <span className="font-bold text-slate-900">نوع مکانیزم: </span>
              <span>{project.mechanismType}</span>
            </div>
          )}
          {project.specialNotes && (
            <div className="text-amber-900 bg-amber-50/60 p-2 rounded-xl mt-1 text-[11px] leading-relaxed">
              <span className="font-bold">نکته فروش: </span>
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
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold transition"
        >
          <FileText className="w-4 h-4 text-amber-600" />
          <span>عکس پروپوزال فروش</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenToolChecklist(project)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition"
        >
          <Wrench className="w-4 h-4 text-blue-600" />
          <span>چک‌لیست ابزار ({project.isFullTools ? 'فول' : toPersianDigits(project.toolsRequired.length)})</span>
        </button>
      </div>

      {/* Workflow Progress Status Actions (for Lead / Technicians) */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        {project.status === 'SCHEDULED' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'EN_ROUTE')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
          >
            <Car className="w-4 h-4" />
            حرکت به سمت پروژه (اعلام شروع مسیر)
          </button>
        )}

        {project.status === 'EN_ROUTE' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(project.id, 'IN_PROGRESS')}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            رسیدم سر پروژه / شروع نصب
          </button>
        )}

        {project.status === 'IN_PROGRESS' && (
          <button
            type="button"
            onClick={() => onOpenCompletionModal(project)}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            ثبت اتمام نصب و ارسال عکس به کیوسی
          </button>
        )}

        {project.status === 'COMPLETED' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 text-center font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            گزارش اتمام نصب ثبت شد و در انتظار بررسی کیوسی است
          </div>
        )}

        {/* Emergency Ticket Button */}
        <button
          type="button"
          onClick={() => onOpenTicketModal(project)}
          className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          اعلام کسری قطعه، آسیب پارچه یا خرابی سر پروژه
        </button>
      </div>

      {/* QC Evaluation Review Card (if QC has reviewed this project) */}
      {project.qcStatus === 'APPROVED' && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-900 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              تاییدیه و امتیاز مسئول کیوسی:
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= (project.qcScore || 5)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
          {project.qcNotes && (
            <p className="text-purple-950 text-[11px] leading-relaxed italic bg-white/70 p-2 rounded-xl">
              «{project.qcNotes}»
            </p>
          )}
        </div>
      )}
    </div>
  );
};
