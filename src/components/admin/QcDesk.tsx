import React, { useState, useEffect } from 'react';
import { Project, User } from '../../types';
import {
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  Camera,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  Wrench,
  RotateCcw,
  PenTool,
  SlidersHorizontal,
  Flame,
  CheckSquare,
  ZoomIn,
  X,
  Printer,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits, getTodayPersianString, formatJalali } from '../../utils/jalali';
import { ActiveJobTimer } from '../ActiveJobTimer';
import { QcRejectModal } from './QcRejectModal';
import { CloudImage } from '../common/CloudImage';

interface Props {
  projects: Project[];
  users: User[];
  currentUser?: User;
  onPatchProject: (id: string, patch: Partial<Project>) => void;
  onViewProposal: (project: Project) => void;
  onOpenCertificate?: (project: Project) => void;
  onOpenEvaluation?: (project: Project) => void;
}

export const QcDesk: React.FC<Props> = ({
  projects,
  users,
  currentUser,
  onPatchProject,
  onViewProposal,
  onOpenCertificate,
  onOpenEvaluation,
}) => {
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // QC Form states
  const [qcScore, setQcScore] = useState<number | null>(null);
  const [qcNotes, setQcNotes] = useState<string>('');
  const [isEditingApproved, setIsEditingApproved] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);

  // Helper: check if project is strictly waiting for QC review
  const isAwaitingQc = (p: Project) => {
    return (
      (p.status === 'COMPLETED' || p.qcStatus === 'PENDING') &&
      p.qcStatus !== 'APPROVED' &&
      p.qcStatus !== 'REJECTED'
    );
  };

  // Counts for each tab
  const pendingCount = projects.filter(isAwaitingQc).length;
  const approvedCount = projects.filter((p) => p.qcStatus === 'APPROVED').length;
  const rejectedCount = projects.filter((p) => p.qcStatus === 'REJECTED').length;
  const allCount = projects.length;

  // Filter projects based on active tab
  const relevantProjects = projects
    .filter((p) => {
      if (filter === 'PENDING') return isAwaitingQc(p);
      if (filter === 'APPROVED') return p.qcStatus === 'APPROVED';
      if (filter === 'REJECTED') return p.qcStatus === 'REJECTED';
      return true; // 'ALL' shows all projects
    })
    .sort((a, b) => {
      // In 'ALL' view, prioritize projects awaiting QC at the very top!
      if (filter === 'ALL') {
        const aPending = isAwaitingQc(a) ? 1 : 0;
        const bPending = isAwaitingQc(b) ? 1 : 0;
        if (bPending !== aPending) return bPending - aPending;
      }
      return 0;
    });

  const selectedProject =
    relevantProjects.find((p) => p.id === selectedProjectId) || relevantProjects[0];

  useEffect(() => {
    if (selectedProject) {
      setQcScore(selectedProject.qcScore || null);
      setQcNotes(selectedProject.qcNotes || '');
    }
  }, [selectedProject?.id]);

  const canApprove =
    Boolean(selectedProject) &&
    Boolean(qcScore) &&
    ((selectedProject.status === 'COMPLETED' && selectedProject.qcStatus === 'PENDING') ||
      (isEditingApproved && selectedProject.qcStatus === 'APPROVED'));

  const handleSelectProject = (p: Project) => {
    setSelectedProjectId(p.id);
    setQcScore(p.qcScore || null);
    setQcNotes(p.qcNotes || '');
    setIsEditingApproved(false);
  };

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !canApprove || !qcScore) return;

    const patch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'APPROVED',
      qcScore,
      qcNotes: qcNotes.trim() || 'نصب با رعایت کامل استانداردهای گالری طلایی انجام و تایید شد.',
      qcReviewedAt: new Date().toISOString(),
      qcReviewedBy: currentUser?.name || 'مسئول QC',
    };

    onPatchProject(selectedProject.id, patch);
    setIsEditingApproved(false);

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#C1A056', '#212121', '#FAF7F2'],
      });
    } catch {
      // Ignore
    }
  };

  const handleOpenReject = () => {
    if (!selectedProject) return;
    setIsRejectModalOpen(true);
  };

  const handleRejectSubmit = (reason: string, newScheduledDate?: string) => {
    if (!selectedProject) return;

    const patch: Partial<Project> = {
      status: 'IN_PROGRESS', // Send back to in progress so technician can fix
      qcStatus: 'REJECTED',
      qcNotes: reason,
      reworkStartedAt: new Date().toISOString(),
      qcReviewedAt: new Date().toISOString(),
      qcReviewedBy: currentUser?.name || 'مسئول QC',
      ...(newScheduledDate ? { scheduledDate: newScheduledDate } : {}),
    };

    onPatchProject(selectedProject.id, patch);
    setIsRejectModalOpen(false);
  };

  // Shortcut for QC manager to mark project as completed & ready for QC directly
  const handleMarkAsReadyForQc = (p: Project) => {
    const patch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completedAt: new Date().toISOString(),
      completionNotes: p.completionNotes || 'تکمیل نصب تایید شده توسط مسئول QC جهت بررسی نهایی.',
    };
    onPatchProject(p.id, patch);
    alert(`پروژه ${p.title} به وضعیت «اتمام نصب / در انتظار QC» منتقل شد و هم‌اکنون آماده ارزیابی است.`);
  };

  const getUserName = (id?: string) => {
    if (!id) return '';
    return users.find((u) => u.id === id)?.name || '';
  };

  const beforePhotos = (selectedProject?.beforePhotos || []).filter((p) => Boolean(p && p.trim() !== ''));
  const afterPhotos = (selectedProject?.afterPhotos || selectedProject?.completionPhotos || []).filter((p) => Boolean(p && p.trim() !== ''));
  const checklist = selectedProject?.handoverChecklist;

  return (
    <div className="space-y-6">
      {/* Top Banner with talaei.ir Obsidian & Gold */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-[#C1A056]/30">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#C1A056]" />
              <h2 className="text-xl font-black text-white">میز کار نظارت و کنترل کیفیت (QC Desk)</h2>
            </div>
            <p className="text-xs text-[#E8E4DC] mt-1">
              بررسی عکس‌های قبل و بعد، تطبیق با استانداردهای طلایی، استعلام امضای کارفرما و ثبت نمره کیفی
            </p>
          </div>

          {/* Synchronized Filter Tabs with Live Counts */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/10 p-1.5 rounded-full border border-white/10">
            <button
              onClick={() => setFilter('PENDING')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                filter === 'PENDING' ? 'bg-[#C1A056] text-[#212121] shadow-xs' : 'text-white hover:text-[#C1A056]'
              }`}
            >
              <span>در انتظار تایید QC</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filter === 'PENDING' ? 'bg-[#212121] text-[#C1A056]' : 'bg-[#C1A056] text-[#212121]'
              }`}>
                {toPersianDigits(pendingCount)}
              </span>
            </button>

            <button
              onClick={() => setFilter('APPROVED')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                filter === 'APPROVED' ? 'bg-[#C1A056] text-[#212121] shadow-xs' : 'text-white hover:text-[#C1A056]'
              }`}
            >
              <span>تایید شده‌ها</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filter === 'APPROVED' ? 'bg-[#212121] text-[#C1A056]' : 'bg-white/20 text-white'
              }`}>
                {toPersianDigits(approvedCount)}
              </span>
            </button>

            {rejectedCount > 0 && (
              <button
                onClick={() => setFilter('REJECTED')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                  filter === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-300 hover:text-white'
                }`}
              >
                <span>نیاز به اصلاح</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20 text-white">
                  {toPersianDigits(rejectedCount)}
                </span>
              </button>
            )}

            <button
              onClick={() => setFilter('ALL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                filter === 'ALL' ? 'bg-[#C1A056] text-[#212121] shadow-xs' : 'text-white hover:text-[#C1A056]'
              }`}
            >
              <span>همه پروژه‌ها</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filter === 'ALL' ? 'bg-[#212121] text-[#C1A056]' : 'bg-white/20 text-white'
              }`}>
                {toPersianDigits(allCount)}
              </span>
            </button>
          </div>
        </div>
      </div>

      {relevantProjects.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-12 text-center border border-[#E8E4DC] dark:border-[#2C2C2C] shadow-xs max-w-lg mx-auto">
          <ShieldCheck className="w-16 h-16 text-[#C1A056]/50 mx-auto mb-3" />
          <h3 className="font-bold text-[#212121] dark:text-white text-base">
            {filter === 'PENDING'
              ? 'هیچ پروژه‌ای در انتظار تایید QC نیست'
              : filter === 'APPROVED'
              ? 'هنوز پروژه‌ای تایید کیفی نشده است'
              : 'پروژه‌ای در این بخش وجود ندارد'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {filter === 'PENDING'
              ? 'پروژه‌هایی که تکنسین‌ها نصب آن‌ها را تمام کنند در این بخش قرار می‌گیرند. همچنین در تب «همه پروژه‌ها» می‌توانید هر پروژه‌ای را مستقیماً به بررسی QC ارسال کنید.'
              : 'از تب‌های بالا می‌توانید وضعیت‌های دیگر را بررسی کنید.'}
          </p>
          {filter === 'PENDING' && (
            <button
              onClick={() => setFilter('ALL')}
              className="mt-4 px-4 py-2 bg-[#212121] text-[#C1A056] rounded-full text-xs font-bold hover:bg-[#333333] transition"
            >
              مشاهده تب همه پروژه‌ها
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project List Column */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 px-1">
              لیست پروژه‌ها ({toPersianDigits(relevantProjects.length)} مورد):
            </h3>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {relevantProjects.map((p) => {
                const isSelected = selectedProject && selectedProject.id === p.id;
                const leadName = getUserName(p.leadTechnicianId);
                const awaitingQc = isAwaitingQc(p);
                const isApproved = p.qcStatus === 'APPROVED';
                const isRejected = p.qcStatus === 'REJECTED';
                const totalPhotos = (p.beforePhotos?.length || 0) + ((p.afterPhotos || p.completionPhotos)?.length || 0);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p)}
                    className={`p-4 rounded-2xl border cursor-pointer transition select-none relative ${
                      isSelected
                        ? 'border-[#C1A056] bg-[#FAF7F2] dark:bg-[#252525] shadow-xs ring-2 ring-[#C1A056]/30'
                        : awaitingQc
                        ? 'border-[#C1A056]/60 bg-white dark:bg-[#1E1E1E] hover:border-[#C1A056]'
                        : 'border-[#E8E4DC] dark:border-[#2C2C2C] bg-white dark:bg-[#1C1C1C] hover:border-[#C1A056]/40'
                    }`}
                  >
                    {/* Glowing highlight indicator for pending items */}
                    {awaitingQc && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C1A056] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#C1A056]"></span>
                      </span>
                    )}

                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="font-mono font-bold text-slate-600 dark:text-zinc-300 bg-[#FAF7F2] dark:bg-[#151515] px-1.5 py-0.5 rounded border border-[#E8E4DC] dark:border-[#333333]">
                        {p.code}
                      </span>

                      {/* Precise Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          isApproved
                            ? 'bg-[#194840]/15 text-[#194840] dark:bg-[#194840]/30 dark:text-emerald-400 border border-[#194840]/30'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                            : awaitingQc
                            ? 'bg-[#C1A056] text-[#212121] font-black shadow-2xs'
                            : p.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                            : p.status === 'EN_ROUTE'
                            ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40'
                            : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {isApproved
                          ? '✓ تایید QC'
                          : isRejected
                          ? '⚠️ نیاز به اصلاح'
                          : awaitingQc
                          ? '⏳ در انتظار تایید QC'
                          : p.status === 'IN_PROGRESS'
                          ? '⚙️ در حال نصب'
                          : p.status === 'EN_ROUTE'
                          ? '🚗 در مسیر'
                          : '📅 برنامه‌ریزی شده'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#212121] dark:text-white leading-tight">{p.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-1">{p.address}</p>

                    {/* QC Feature Badges (Photos, Signature, Checklist) */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {totalPhotos > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-[#161616] text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-800 font-mono">
                          <Camera className="w-3 h-3 text-[#C1A056]" />
                          <span>{toPersianDigits(totalPhotos)} عکس</span>
                        </span>
                      )}

                      {p.customerSignature && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 font-bold">
                          <PenTool className="w-3 h-3" />
                          <span>امضا شده</span>
                        </span>
                      )}

                      {p.handoverChecklist &&
                        (['floorProtectiveClothUsed', 'cradleBracketsSecured', 'remoteTested', 'leveled', 'ironedPleated', 'cleaned'] as const).every(
                          (k) => p.handoverChecklist?.[k] === true
                        ) && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-[#C1A056]/15 text-[#8B6D20] dark:text-[#E2C37E] px-2 py-0.5 rounded-md border border-[#C1A056]/30 font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            <span>۶ استاندارد ✓</span>
                          </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D] text-[11px] text-slate-600 dark:text-zinc-400">
                      <span>سرپرست: {leadName}</span>
                      <span className="font-mono">
                        {toPersianDigits(p.shadePanels)} شید / {toPersianDigits(p.curtainPanels)} پرده
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Project QC Review Workspace on the Right Column */}
          {selectedProject && (
            <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1C] rounded-3xl border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs p-6 space-y-6">
              {/* Project Head */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8E4DC] dark:border-[#2D2D2D] gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-[#FAF7F2] dark:bg-[#222222] border border-[#E8E4DC] dark:border-[#333333] px-2 py-0.5 rounded text-slate-700 dark:text-zinc-300">
                      {selectedProject.code}
                    </span>
                    <h3 className="font-black text-lg text-[#212121] dark:text-white">{selectedProject.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{selectedProject.address}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {onOpenEvaluation && (
                    <button
                      onClick={() => onOpenEvaluation(selectedProject)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF7F2] dark:bg-[#222222] border border-[#C1A056] text-[#A88738] dark:text-[#C1A056] hover:bg-[#F5EFEB] dark:hover:bg-[#2A2A2A] font-bold text-xs transition self-start shadow-2xs active:scale-95"
                    >
                      <Award className="w-4 h-4 text-[#C1A056]" />
                      <span>ارزیابی ۳۶۰ درجه نصاب</span>
                      {selectedProject.evaluations && selectedProject.evaluations.length > 0 && (
                        <span className="bg-[#C1A056] text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                          {toPersianDigits(selectedProject.evaluations.length)}
                        </span>
                      )}
                    </button>
                  )}

                  {onOpenCertificate && (
                    <button
                      onClick={() => onOpenCertificate(selectedProject)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#212121] dark:bg-[#C1A056] border border-[#C1A056] text-[#C1A056] dark:text-[#212121] hover:bg-[#333333] dark:hover:bg-[#a88738] font-bold text-xs transition self-start shadow-xs active:scale-95"
                    >
                      <Printer className="w-4 h-4" />
                      <span>شناسنامه و چاپ PDF</span>
                    </button>
                  )}

                  {selectedProject.proposalImages && selectedProject.proposalImages.length > 0 && (
                    <button
                      onClick={() => onViewProposal(selectedProject)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FAF7F2] dark:bg-[#222222] border border-[#C1A056] text-[#212121] dark:text-white hover:bg-[#F5EFEB] dark:hover:bg-[#2A2A2A] font-bold text-xs transition self-start"
                    >
                      <FileText className="w-4 h-4 text-[#C1A056]" />
                      <span>مشاهده پروپوزال فروش</span>
                    </button>
                  )}
                </div>
              </div>

              {/* On-Site Job Timer & Duration Card */}
              <ActiveJobTimer
                status={selectedProject.status}
                startedAt={selectedProject.startedAt}
                completedAt={selectedProject.completedAt}
              />

              {/* PILLAR 1: BEFORE & AFTER PHOTO INSPECTION */}
              <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-5 border border-[#E8E4DC] dark:border-[#2D2D2D] space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#212121] dark:text-white flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#C1A056]" />
                    <span>آلبوم عکس‌های مقایسه‌ای «قبل از نصب» و «بعد از اتمام کار»:</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {toPersianDigits(beforePhotos.length)} عکس قبل / {toPersianDigits(afterPhotos.length)} عکس بعد
                  </span>
                </div>

                {/* Technician note quote */}
                {selectedProject.completionNotes ? (
                  <p className="text-xs text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#161616] p-3 rounded-xl border border-[#E8E4DC] dark:border-[#2D2D2D] leading-relaxed">
                    <span className="font-bold text-[#212121] dark:text-white block mb-0.5">اظهارات تکنسین نصب:</span>
                    «{selectedProject.completionNotes}»
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">هنوز توضیحی توسط تکنسین نوشته نشده است.</p>
                )}

                {/* Split Comparison Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Before Photos */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span>عکس‌های قبل از نصب (پنجره خام و زیرسازی):</span>
                    </div>

                    {beforePhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {beforePhotos.map((photo, i) => (
                          <div
                            key={i}
                            onClick={() => setPreviewImage(photo)}
                            className="relative h-28 rounded-xl overflow-hidden border border-amber-500/40 cursor-pointer shadow-2xs group"
                          >
                            <CloudImage src={photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <ZoomIn className="w-5 h-5" />
                            </div>
                            <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] text-white px-1.5 py-0.5 rounded font-bold">
                              قبل #{toPersianDigits(i + 1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 dark:text-zinc-500 bg-white dark:bg-[#161616] p-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 text-center">
                        عکسی از قبل از شروع ثبت نشده است.
                      </div>
                    )}
                  </div>

                  {/* After Photos */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span>عکس‌های بعد از نصب (پرده و شید نهایی):</span>
                    </div>

                    {afterPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {afterPhotos.map((photo, i) => (
                          <div
                            key={i}
                            onClick={() => setPreviewImage(photo)}
                            className="relative h-28 rounded-xl overflow-hidden border border-emerald-500/40 cursor-pointer shadow-2xs group"
                          >
                            <CloudImage src={photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <ZoomIn className="w-5 h-5" />
                            </div>
                            <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] text-white px-1.5 py-0.5 rounded font-bold">
                              بعد #{toPersianDigits(i + 1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[#A88738] dark:text-[#C1A056] bg-white dark:bg-[#161616] p-3 rounded-xl border border-dashed border-[#C1A056]/30 text-center">
                        هنوز عکس اتمام کار آپلود نشده است.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PILLAR 2: CUSTOMER DIGITAL SIGNATURE & PILLAR 3: HANDOVER CHECKLIST */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Signature Certificate Card */}
                <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-1.5">
                      <PenTool className="w-4 h-4 text-[#C1A056]" />
                      <span>امضای دیجیتال و رضایت کارفرما:</span>
                    </h4>
                    {selectedProject.customerSignature ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                        ✓ تایید رسمی در محل
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                        در انتظار امضا
                      </span>
                    )}
                  </div>

                  {selectedProject.customerSignature ? (
                    <div className="bg-white dark:bg-[#161616] p-3.5 rounded-xl border border-[#C1A056]/30 space-y-2 shadow-2xs">
                      <div className="h-24 bg-[#FAF7F2] dark:bg-[#121212] rounded-lg border border-dashed border-[#C1A056]/40 p-2 flex items-center justify-center">
                        <CloudImage
                          src={selectedProject.customerSignature}
                          alt="امضای کارفرما"
                          className="max-h-full max-w-full object-contain filter dark:invert"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="font-bold text-[#212121] dark:text-white">
                          {selectedProject.customerName}
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                selectedProject.customerSatisfaction && s <= selectedProject.customerSatisfaction
                                  ? 'text-[#C1A056] fill-[#C1A056]'
                                  : 'text-slate-300 dark:text-zinc-600'
                              }`}
                            />
                          ))}
                          <span className="text-[10px] text-slate-500 font-bold mr-1">
                            {selectedProject.customerSatisfaction
                              ? `${toPersianDigits(selectedProject.customerSatisfaction)} از 5`
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#161616] p-4 rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 text-center">
                      امضای کارفرما برای این پروژه هنوز ثبت نشده است.
                    </div>
                  )}
                </div>

                {/* White-Glove Handover Checklist Card */}
                <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-[#C1A056]" />
                      <span>چک‌لیست استانداردهای طلایی تحویل:</span>
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { key: 'floorProtectiveClothUsed', label: 'استفاده از آستری محافظ کف (لوکس طلایی)', icon: Sparkles },
                      { key: 'cradleBracketsSecured', label: 'مهاربندی کرپی‌ها و عودت به وانت لجستیک', icon: CheckCircle2 },
                      { key: 'remoteTested', label: 'تست حرکت روان ریل، موتور هوشمند و ریموت', icon: SlidersHorizontal },
                      { key: 'leveled', label: 'تراز و شاقول بودن قاب و پایه‌ها', icon: Sparkles },
                      { key: 'ironedPleated', label: 'اتوکشی و فرم‌دهی پلیسه‌ها', icon: Flame },
                      { key: 'cleaned', label: 'نظافت کامل محل و جمع‌آوری ضایعات', icon: CheckCircle2 },
                    ].map((item) => {
                      const IconComp = item.icon;
                      const isChecked = checklist?.[item.key as keyof typeof checklist] === true;
                      const isMissing = !checklist || checklist[item.key as keyof typeof checklist] === undefined;
                      const note = (checklist as any)?.handoverChecklistNotes?.[item.key];

                      return (
                        <div
                          key={item.key}
                          className="flex flex-col p-2 rounded-lg bg-white dark:bg-[#161616] border border-[#E8E4DC] dark:border-zinc-800 text-[11px] gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                              <IconComp className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.label}</span>
                            </span>
                            <span
                              className={`font-bold ${
                                isChecked
                                  ? 'text-emerald-600'
                                  : isMissing
                                  ? 'text-slate-400'
                                  : 'text-amber-600'
                              }`}
                            >
                              {isChecked ? '✓ تایید' : isMissing ? 'ثبت نشده' : 'عدم اجرا'}
                            </span>
                          </div>
                          {!isChecked && note && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded">
                              علت: {note}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Personnel 360 Evaluations Section (if any) */}
              {selectedProject.evaluations && selectedProject.evaluations.length > 0 && (
                <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#C1A056]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#C1A056]" />
                      <span>سوابق ارزیابی ۳۶۰ درجه پرسنل برای این پروژه:</span>
                    </h4>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {toPersianDigits(selectedProject.evaluations.length)} ارزیابی ثبت شده
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedProject.evaluations.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 bg-white dark:bg-[#161616] rounded-xl border border-[#E8E4DC] dark:border-zinc-800 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#212121] dark:text-white">{ev.userName}</span>
                          <span className="text-[10px] text-slate-400">{ev.evaluatedAt}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-1 border-t border-slate-100 dark:border-zinc-800">
                          <div>
                            <span className="text-slate-400 block">فنی</span>
                            <span className="font-bold text-[#C1A056]">⭐ {toPersianDigits(ev.technicalScore)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">رفتاری</span>
                            <span className="font-bold text-[#C1A056]">⭐ {toPersianDigits(ev.behavioralScore)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">نظافت</span>
                            <span className="font-bold text-[#C1A056]">⭐ {toPersianDigits(ev.cleanlinessScore)}</span>
                          </div>
                        </div>
                        {ev.criticalIncidentNote && (
                          <div className="text-[10px] text-slate-600 dark:text-zinc-400 bg-[#FAF7F2] dark:bg-[#202020] p-1.5 rounded mt-1 italic">
                            «{ev.criticalIncidentNote}»
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action 1: If project is IN_PROGRESS, provide quick action for QC Manager to mark ready for QC */}
              {selectedProject.status === 'IN_PROGRESS' && (
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-amber-900 dark:text-amber-200">
                      این پروژه در حال حاضر «در حال نصب» است
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      برای فعال‌شدن ارزیابی کیفی، می‌توانید مستقیماً آن را به وضعیت اتمام نصب و آماده QC ببرید.
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkAsReadyForQc(selectedProject)}
                    className="px-4 py-2 bg-[#212121] text-[#C1A056] rounded-xl text-xs font-bold hover:bg-[#333333] transition shrink-0 border border-[#C1A056]/30"
                  >
                    ⚡ تایید اتمام کار و باز کردن بررسی QC
                  </button>
                </div>
              )}

              {/* Action 2: If project is already APPROVED and not editing, show verified badge with Edit option */}
              {selectedProject.qcStatus === 'APPROVED' && !isEditingApproved && (
                <div className="bg-[#194840]/10 dark:bg-[#194840]/20 border border-[#194840]/30 dark:border-[#194840]/40 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#194840] dark:text-emerald-400 font-black text-sm">
                      <CheckCircle2 className="w-5 h-5 text-[#194840] dark:text-emerald-400" />
                      <span>این پروژه با تایید رسمی واحد کنترل کیفیت (QC) ثبت شده است</span>
                    </div>
                    <button
                      onClick={() => setIsEditingApproved(true)}
                      className="text-xs font-bold text-[#A88738] dark:text-[#C1A056] hover:underline"
                    >
                      ویرایش ارزیابی و نمره
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= (selectedProject.qcScore || 5)
                            ? 'text-[#C1A056] fill-[#C1A056]'
                            : 'text-slate-300 dark:text-zinc-600'
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-[#212121] dark:text-white mr-2">
                      امتیاز کیفی: {toPersianDigits(selectedProject.qcScore || 5)} از 5
                    </span>
                  </div>

                  {selectedProject.qcNotes && (
                    <div className="bg-white dark:bg-[#161616] p-3 rounded-xl border border-[#E8E4DC] dark:border-[#2D2D2D] text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                      <span className="font-bold text-[#212121] dark:text-white block mb-1">اظهارنظر مسئول QC:</span>
                      «{selectedProject.qcNotes}»
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                    تایید شده توسط {selectedProject.qcReviewedBy || 'مسئول QC'} در تاریخ {formatJalali(selectedProject.qcReviewedAt)}
                  </div>
                </div>
              )}

              {/* Action 3: Active QC Evaluation Form (shown if awaiting QC, or editing an approved project) */}
              {(isAwaitingQc(selectedProject) || isEditingApproved || selectedProject.qcStatus === 'REJECTED') && (
                <form onSubmit={handleApprove} className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-5 border border-[#C1A056]/40 space-y-4">
                  <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C1A056]" />
                    ارزیابی و نظر مسئول QC:
                  </h4>

                  {/* Star rating in authentic Gold */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      امتیاز کیفی به عملکرد تکنسین‌ها (از 1 تا 5 ستاره):
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setQcScore(star)}
                          className="p-1 transition hover:scale-110"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              qcScore && star <= qcScore
                                ? 'text-[#C1A056] fill-[#C1A056]'
                                : 'text-slate-300 dark:text-zinc-600'
                            }`}
                          />
                        </button>
                      ))}
                      {qcScore ? (
                        <span className="text-xs font-bold text-[#212121] dark:text-white mr-2">
                          {toPersianDigits(qcScore)} از 5 ستاره
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mr-2">
                          (لطفاً امتیاز را انتخاب کنید)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* QC Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      نظر نهایی مسئول QC اضافه بر اظهارات نصاب:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="مثال: نصب با رعایت تراز لیزری و بدون چروک در پارچه شید تحویل شد. نحوه جمع‌شو و عملکرد موتور سامفی در ویدیوی ارسالی تست گردید و مورد تایید است."
                      value={qcNotes}
                      onChange={(e) => setQcNotes(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#161616] dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>

                  {/* Status Actions */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={!canApprove}
                        className="flex-1 py-3 px-4 rounded-xl bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold transition shadow-md text-xs flex items-center justify-center gap-2 border border-[#C1A056]/30 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        تایید نهایی کیفی و ثبت در سابقه
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenReject}
                        className="py-3 px-4 rounded-xl bg-white dark:bg-[#181818] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-900/50 transition text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        عدم تایید / نیاز به اصلاح
                      </button>
                    </div>
                    {!canApprove && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {!qcScore
                          ? 'برای تایید نهایی، ابتدا باید امتیاز کیفی (۱ تا ۵ ستاره) را انتخاب کنید.'
                          : 'تایید نهایی کیفی فقط برای پروژه‌های با وضعیت «نصب شده (COMPLETED)» و «در انتظار تایید (PENDING)» مجاز است.'}
                      </p>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* QC Rejection Modal */}
      {selectedProject && (
        <QcRejectModal
          project={selectedProject}
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          onSubmit={handleRejectSubmit}
        />
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 left-0 text-white hover:text-red-400 p-2 rounded-full bg-white/10"
              aria-label="بستن"
            >
              <X className="w-6 h-6" />
            </button>
            <CloudImage
              src={previewImage}
              alt="بزرگ‌نمایی عکس QC"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
