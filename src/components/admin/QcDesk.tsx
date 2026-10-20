import React, { useState } from 'react';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  projects: Project[];
  users: User[];
  onUpdateProject: (project: Project) => void;
  onViewProposal: (project: Project) => void;
}

export const QcDesk: React.FC<Props> = ({
  projects,
  users,
  onUpdateProject,
  onViewProposal,
}) => {
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // QC Form states
  const [qcScore, setQcScore] = useState<number>(5);
  const [qcNotes, setQcNotes] = useState<string>('');
  const [isEditingApproved, setIsEditingApproved] = useState<boolean>(false);

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

  const handleSelectProject = (p: Project) => {
    setSelectedProjectId(p.id);
    setQcScore(p.qcScore || 5);
    setQcNotes(p.qcNotes || '');
    setIsEditingApproved(false);
  };

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const updated: Project = {
      ...selectedProject,
      status: 'COMPLETED',
      qcStatus: 'APPROVED',
      qcScore,
      qcNotes: qcNotes.trim() || 'نصب با رعایت کامل استانداردها و تایید واحد کنترل کیفیت گالری طلایی انجام شد.',
      qcReviewedAt: new Date().toLocaleDateString('fa-IR'),
      qcReviewedBy: 'مدیر کیوسی',
    };

    onUpdateProject(updated);
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

    alert('تاییدیه کنترل کیفیت با موفقیت ثبت شد و نمره کیفی تکنسین‌ها منظور گردید.');
  };

  const handleReject = () => {
    if (!selectedProject) return;
    const reason = prompt('لطفاً دلیل عدم تایید یا دستور اصلاح را برای تکنسین بنویسید:');
    if (!reason) return;

    const updated: Project = {
      ...selectedProject,
      status: 'IN_PROGRESS', // Send back to in progress so technician can fix
      qcStatus: 'REJECTED',
      qcNotes: reason,
      qcReviewedAt: new Date().toLocaleDateString('fa-IR'),
      qcReviewedBy: 'مدیر کیوسی',
    };

    onUpdateProject(updated);
    alert('وضعیت به "عدم تایید کیفی / نیاز به اصلاح" تغییر یافت.');
  };

  // Shortcut for QC manager to mark project as completed & ready for QC directly
  const handleMarkAsReadyForQc = (p: Project) => {
    const updated: Project = {
      ...p,
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completionNotes: p.completionNotes || 'تکمیل نصب تایید شده توسط مدیر کیوسی جهت بررسی نهایی.',
    };
    onUpdateProject(updated);
    handleSelectProject(updated);
    alert(`پروژه ${p.title} به وضعیت «اتمام نصب / در انتظار کیوسی» منتقل شد و هم‌اکنون آماده ارزیابی است.`);
  };

  const getUserName = (id?: string) => {
    if (!id) return '';
    return users.find((u) => u.id === id)?.name || '';
  };

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
              بررسی عکس‌های ارسالی تکنسین‌ها، تطبیق با پروپوزال فروش گالری طلایی و ثبت نمره کیفی
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
              <span>در انتظار تایید کیوسی</span>
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
              ? 'هیچ پروژه‌ای در انتظار تایید کیوسی نیست'
              : filter === 'APPROVED'
              ? 'هنوز پروژه‌ای تایید کیفی نشده است'
              : 'پروژه‌ای در این بخش وجود ندارد'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {filter === 'PENDING'
              ? 'پروژه‌هایی که تکنسین‌ها نصب آن‌ها را تمام کنند در این بخش قرار می‌گیرند. همچنین در تب «همه پروژه‌ها» می‌توانید هر پروژه‌ای را مستقیماً به بررسی کیوسی ارسال کنید.'
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
          {/* Projects List on the Left Column */}
          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                لیست پروژه‌ها ({toPersianDigits(relevantProjects.length)} مورد):
              </h3>
              {filter === 'ALL' && (
                <span className="text-[10px] text-[#A88738] dark:text-[#C1A056] font-bold">
                  (در انتظار کیوسی در صدر لیست)
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
              {relevantProjects.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                const leadName = getUserName(p.leadTechnicianId);
                const awaitingQc = isAwaitingQc(p);
                const isApproved = p.qcStatus === 'APPROVED';
                const isRejected = p.qcStatus === 'REJECTED';

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
                          ? '✓ تایید کیوسی'
                          : isRejected
                          ? '⚠️ نیاز به اصلاح'
                          : awaitingQc
                          ? '⏳ در انتظار تایید کیوسی'
                          : p.status === 'IN_PROGRESS'
                          ? '⚙️ در حال نصب'
                          : p.status === 'EN_ROUTE'
                          ? '🚗 در مسیر'
                          : '📅 برنامه‌ریزی شده'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#212121] dark:text-white leading-tight">{p.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-1">{p.address}</p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D] text-[11px] text-slate-600 dark:text-zinc-400">
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

                <div className="flex items-center gap-2">
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

              {/* Technician Statement & Completion Report */}
              <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#C1A056]" />
                    اظهارات و عکس‌های ارسالی تکنسین نصب:
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    وضعیت نصب:{' '}
                    <span className="font-bold text-[#212121] dark:text-white">
                      {selectedProject.status === 'COMPLETED'
                        ? 'اتمام نصب'
                        : selectedProject.status === 'IN_PROGRESS'
                        ? 'در حال اجرا'
                        : 'برنامه‌ریزی'}
                    </span>
                  </span>
                </div>

                {selectedProject.completionNotes ? (
                  <p className="text-xs text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#161616] p-3 rounded-xl border border-[#E8E4DC] dark:border-[#2D2D2D] leading-relaxed">
                    «{selectedProject.completionNotes}»
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">هنوز توضیحی توسط تکنسین نوشته نشده است.</p>
                )}

                {/* Completion Photos */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-2">عکس‌های ثبت‌شده بعد از نصب:</div>
                  {selectedProject.completionPhotos && selectedProject.completionPhotos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedProject.completionPhotos.map((photo, i) => (
                        <a
                          key={i}
                          href={photo}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-24 h-24 rounded-2xl overflow-hidden border border-[#E8E4DC] dark:border-[#333333] shadow-xs hover:opacity-90"
                        >
                          <img src={photo} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#A88738] dark:text-[#C1A056] bg-[#FAF7F2] dark:bg-[#181818] p-3 rounded-xl border border-[#C1A056]/30">
                      تکنسین هنوز عکسی از اتمام کار آپلود نکرده است.
                    </div>
                  )}
                </div>
              </div>

              {/* Action 1: If project is NOT yet completed, provide quick action for QC Manager */}
              {!isAwaitingQc(selectedProject) && selectedProject.qcStatus !== 'APPROVED' && (
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-amber-900 dark:text-amber-200">
                      این پروژه هنوز به عنوان «اتمام نصب» اعلام نشده است
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      برای فعال‌شدن ارزیابی کیفی، می‌توانید مستقیماً آن را به وضعیت اتمام نصب و آماده کیوسی ببرید.
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkAsReadyForQc(selectedProject)}
                    className="px-4 py-2 bg-[#212121] text-[#C1A056] rounded-xl text-xs font-bold hover:bg-[#333333] transition shrink-0 border border-[#C1A056]/30"
                  >
                    ⚡ تایید اتمام کار و باز کردن بررسی کیوسی
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
                      امتیاز کیفی: {toPersianDigits(selectedProject.qcScore || 5)} از ۵
                    </span>
                  </div>

                  {selectedProject.qcNotes && (
                    <div className="bg-white dark:bg-[#161616] p-3 rounded-xl border border-[#E8E4DC] dark:border-[#2D2D2D] text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                      <span className="font-bold text-[#212121] dark:text-white block mb-1">اظهارنظر مسئول کیوسی:</span>
                      «{selectedProject.qcNotes}»
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                    تایید شده توسط {selectedProject.qcReviewedBy || 'مدیر کیوسی'} در تاریخ {selectedProject.qcReviewedAt}
                  </div>
                </div>
              )}

              {/* Action 3: Active QC Evaluation Form (shown if awaiting QC, or editing an approved project) */}
              {(isAwaitingQc(selectedProject) || isEditingApproved || selectedProject.qcStatus === 'REJECTED') && (
                <form onSubmit={handleApprove} className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-5 border border-[#C1A056]/40 space-y-4">
                  <h4 className="text-xs font-bold text-[#212121] dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C1A056]" />
                    ارزیابی و نظر مسئول کیوسی (QC):
                  </h4>

                  {/* Star rating in authentic Gold */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      امتیاز کیفی به عملکرد تکنسین‌ها (از ۱ تا ۵ ستاره):
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
                              star <= qcScore
                                ? 'text-[#C1A056] fill-[#C1A056]'
                                : 'text-slate-300 dark:text-zinc-600'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-[#212121] dark:text-white mr-2">
                        {toPersianDigits(qcScore)} از ۵ ستاره
                      </span>
                    </div>
                  </div>

                  {/* QC Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      نظر نهایی مسئول کیوسی اضافه بر اظهارات نصاب:
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
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-3 px-4 rounded-xl bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold transition shadow-md text-xs flex items-center justify-center gap-2 border border-[#C1A056]/30"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      تایید نهایی کیفی و ثبت در سابقه
                    </button>

                    <button
                      type="button"
                      onClick={handleReject}
                      className="py-3 px-4 rounded-xl bg-white dark:bg-[#181818] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-900/50 transition text-xs flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      عدم تایید / نیاز به اصلاح
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
