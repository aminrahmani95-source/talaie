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
  Wrench,
  PenTool,
  SlidersHorizontal,
  Flame,
  CheckSquare,
  ZoomIn,
  X,
  Printer,
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits, formatJalali } from '../../utils/jalali';
import { ActiveJobTimer } from '../ActiveJobTimer';
import { QcRejectModal } from './QcRejectModal';
import { CloudImage } from '../common/CloudImage';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusPill } from '../ui/StatusPill';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

interface Props {
  projects: Project[];
  users: User[];
  currentUser?: User;
  onPatchProject: (id: string, patch: Partial<Project>) => void;
  onViewProposal: (project: Project) => void;
  onOpenCertificate?: (project: Project) => void;
  onOpenEvaluation?: (project: Project) => void;
}

type FilterTab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export const QcDesk: React.FC<Props> = ({
  projects,
  users,
  currentUser,
  onPatchProject,
  onViewProposal,
  onOpenCertificate,
  onOpenEvaluation,
}) => {
  const [filter, setFilter] = useState<FilterTab>('PENDING');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // QC Form states
  const [qcScore, setQcScore] = useState<number | null>(null);
  const [qcNotes, setQcNotes] = useState<string>('');
  const [isEditingApproved, setIsEditingApproved] = useState<boolean>(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);

  // Helper: check if project is strictly waiting for QC review
  const isAwaitingQc = (p: Project) => {
    return (
      (p.status === 'COMPLETED' || p.qcStatus === 'PENDING') &&
      p.qcStatus !== 'APPROVED' &&
      p.qcStatus !== 'REJECTED'
    );
  };

  const pendingCount = projects.filter(isAwaitingQc).length;
  const approvedCount = projects.filter((p) => p.qcStatus === 'APPROVED').length;
  const rejectedCount = projects.filter((p) => p.qcStatus === 'REJECTED').length;
  const allCount = projects.length;

  const relevantProjects = projects
    .filter((p) => {
      if (filter === 'PENDING') return isAwaitingQc(p);
      if (filter === 'APPROVED') return p.qcStatus === 'APPROVED';
      if (filter === 'REJECTED') return p.qcStatus === 'REJECTED';
      return true;
    })
    .sort((a, b) => {
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
    setIsMobileDetailOpen(true);
  };

  const handleApprove = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
    setIsMobileDetailOpen(false);

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
      status: 'IN_PROGRESS',
      qcStatus: 'REJECTED',
      qcNotes: reason,
      reworkStartedAt: new Date().toISOString(),
      qcReviewedAt: new Date().toISOString(),
      qcReviewedBy: currentUser?.name || 'مسئول QC',
      ...(newScheduledDate ? { scheduledDate: newScheduledDate } : {}),
    };

    onPatchProject(selectedProject.id, patch);
    setIsRejectModalOpen(false);
    setIsMobileDetailOpen(false);
  };

  const handleMarkAsReadyForQc = (p: Project) => {
    const patch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completedAt: new Date().toISOString(),
      completionNotes: p.completionNotes || 'تکمیل نصب تایید شده توسط مسئول QC جهت بررسی نهایی.',
    };
    onPatchProject(p.id, patch);
  };

  const getUser = (id?: string) => {
    if (!id) return undefined;
    return users.find((u) => u.id === id);
  };

  const getUserName = (id?: string) => {
    const u = getUser(id);
    return u?.name.split(' (')[0] || '';
  };

  const beforePhotos = (selectedProject?.beforePhotos || []).filter((p) => Boolean(p && p.trim() !== ''));
  const afterPhotos = (selectedProject?.afterPhotos || selectedProject?.completionPhotos || []).filter((p) =>
    Boolean(p && p.trim() !== '')
  );
  const allProjectPhotos = [...beforePhotos, ...afterPhotos];
  const checklist = selectedProject?.handoverChecklist;

  // Render the inspector details
  const renderDetailWorkspace = () => {
    if (!selectedProject) return null;

    const leadUser = getUser(selectedProject.leadTechnicianId);
    const leadName = getUserName(selectedProject.leadTechnicianId);

    return (
      <div className="space-y-5">
        {/* Project Header Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2DDD4] dark:border-[#2C2C2C] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black bg-[#212121] text-[#E5CA8F] px-2 py-0.5 rounded-md">
                {selectedProject.code}
              </span>
              <h3 className="font-black text-base sm:text-lg text-[#181818] dark:text-[#F5F3EF]">
                {selectedProject.title}
              </h3>
            </div>
            <p className="text-xs text-[#69655F] dark:text-[#9E988D] mt-1">{selectedProject.address}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenEvaluation && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenEvaluation(selectedProject)}
                icon={<Award className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />}
              >
                ارزیابی پرسنل
              </Button>
            )}

            {onOpenCertificate && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenCertificate(selectedProject)}
                icon={<Printer className="w-4 h-4" />}
              >
                شناسنامه و PDF
              </Button>
            )}

            {selectedProject.proposalImages && selectedProject.proposalImages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewProposal(selectedProject)}
                icon={<FileText className="w-4 h-4" />}
              >
                پروپوزال
              </Button>
            )}
          </div>
        </div>

        {/* Timer */}
        <ActiveJobTimer
          status={selectedProject.status}
          startedAt={selectedProject.startedAt}
          completedAt={selectedProject.completedAt}
        />

        {/* Photos Grid: Before & After */}
        <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-2xl p-4 border border-[#E2DDD4] dark:border-[#2C2C2C] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-[#181818] dark:text-[#F5F3EF] flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
              <span>عکس‌های قبل و بعد از نصب:</span>
            </h4>
            <span className="text-[11px] text-[#69655F] dark:text-[#9E988D] font-mono">
              {toPersianDigits(beforePhotos.length)} قبل / {toPersianDigits(afterPhotos.length)} بعد
            </span>
          </div>

          {selectedProject.completionNotes ? (
            <p className="text-xs text-[#4A4742] dark:text-[#BDB8AF] bg-white dark:bg-[#141414] p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] leading-relaxed">
              <span className="font-bold text-[#181818] dark:text-[#F5F3EF] block mb-0.5">توضیح تکنسین:</span>
              «{selectedProject.completionNotes}»
            </p>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Before */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>عکس‌های قبل (پنجره خام و زیرسازی):</span>
              </div>
              {beforePhotos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {beforePhotos.map((photo, i) => (
                    <div
                      key={`before-${i}`}
                      onClick={() => setPreviewPhotoIndex(i)}
                      className="relative h-24 rounded-xl overflow-hidden border border-amber-500/40 cursor-pointer shadow-2xs group"
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
                <div className="text-xs text-[#69655F] dark:text-[#9E988D] bg-white dark:bg-[#141414] p-3 rounded-xl border border-dashed border-[#D2CCC0] dark:border-[#2C2C2C] text-center">
                  عکسی از قبل ثبت نشده است.
                </div>
              )}
            </div>

            {/* After */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>عکس‌های بعد (پرده و شید نهایی):</span>
              </div>
              {afterPhotos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {afterPhotos.map((photo, i) => (
                    <div
                      key={`after-${i}`}
                      onClick={() => setPreviewPhotoIndex(beforePhotos.length + i)}
                      className="relative h-24 rounded-xl overflow-hidden border border-emerald-500/40 cursor-pointer shadow-2xs group"
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
                <div className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] bg-white dark:bg-[#141414] p-3 rounded-xl border border-dashed border-[#C1A056]/30 text-center">
                  هنوز عکس اتمام کار آپلود نشده است.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Signature & 6-Item Handover Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Signature */}
          <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-2xl p-4 border border-[#E2DDD4] dark:border-[#2C2C2C] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
                <span>امضای دیجیتال و رضایت مشتری:</span>
              </h4>
              {selectedProject.customerSignature ? (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  ثبت شده
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                  در انتظار امضا
                </span>
              )}
            </div>

            {selectedProject.customerSignature ? (
              <div className="bg-white dark:bg-[#141414] p-3 rounded-xl border border-[#C1A056]/30 space-y-2 shadow-2xs">
                <div className="h-20 bg-white rounded-lg border border-dashed border-[#C1A056]/40 p-2 flex items-center justify-center">
                  <CloudImage
                    src={selectedProject.customerSignature}
                    alt="امضای مشتری"
                    className="max-h-full max-w-full object-contain filter"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="font-bold text-[#181818] dark:text-[#F5F3EF]">
                    {selectedProject.customerName}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          selectedProject.customerSatisfaction && s <= selectedProject.customerSatisfaction
                            ? 'text-[#C1A056] fill-[#C1A056]'
                            : 'text-zinc-300 dark:text-zinc-600'
                        }`}
                      />
                    ))}
                    <span className="text-[10px] text-[#69655F] dark:text-[#9E988D] font-bold mr-1 font-mono">
                      {selectedProject.customerSatisfaction
                        ? `${toPersianDigits(selectedProject.customerSatisfaction)} از 5`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#69655F] dark:text-[#9E988D] bg-white dark:bg-[#141414] p-4 rounded-xl border border-dashed border-[#D2CCC0] dark:border-[#2C2C2C] text-center">
                امضای مشتری هنوز ثبت نشده است.
              </div>
            )}
          </div>

          {/* 6 Standards Handover Checklist */}
          <div className="bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-2xl p-4 border border-[#E2DDD4] dark:border-[#2C2C2C] space-y-2.5">
            <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
              <span>چک‌لیست استانداردهای تحویل (۶ مورد):</span>
            </h4>

            <div className="space-y-1.5">
              {[
                { key: 'floorProtectiveClothUsed', label: 'آستری محافظ کف' },
                { key: 'cradleBracketsSecured', label: 'مهاربندی کرپی‌ها و عودت' },
                { key: 'remoteTested', label: 'تست ریل، موتور و ریموت' },
                { key: 'leveled', label: 'تراز و شاقول بودن قاب و پایه‌ها' },
                { key: 'ironedPleated', label: 'اتوکشی و فرم‌دهی پلیسه‌ها' },
                { key: 'cleaned', label: 'نظافت محل و جمع‌آوری ضایعات' },
              ].map((item) => {
                const isChecked = checklist?.[item.key as keyof typeof checklist] === true;
                const isMissing = !checklist || checklist[item.key as keyof typeof checklist] === undefined;
                const note = (checklist as any)?.handoverChecklistNotes?.[item.key];

                return (
                  <div
                    key={item.key}
                    className="flex flex-col p-2 rounded-lg bg-white dark:bg-[#141414] border border-[#E2DDD4] dark:border-[#2C2C2C] text-[11px] gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[#4A4742] dark:text-[#BDB8AF]">{item.label}</span>
                      <span
                        className={`font-bold ${
                          isChecked
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isMissing
                            ? 'text-zinc-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isChecked ? '✓ تایید' : isMissing ? 'ثبت نشده' : 'عدم اجرا'}
                      </span>
                    </div>
                    {!isChecked && note && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded">
                        علت: {note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action: If IN_PROGRESS, allow manager to mark ready for QC */}
        {selectedProject.status === 'IN_PROGRESS' && (
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-amber-900 dark:text-amber-200">
                این پروژه در حال حاضر «در حال نصب» است
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                برای فعال‌شدن ارزیابی کیفی، می‌توانید آن را به وضعیت اتمام کار ببرید.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleMarkAsReadyForQc(selectedProject)}
            >
              تایید اتمام کار و بررسی QC
            </Button>
          </div>
        )}

        {/* If already APPROVED and not editing */}
        {selectedProject.qcStatus === 'APPROVED' && !isEditingApproved && (
          <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>این پروژه با تایید رسمی کنترل کیفیت (QC) ثبت شده است</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingApproved(true)}
                className="text-xs font-bold text-[#8E6F27] dark:text-[#E5CA8F] hover:underline cursor-pointer"
              >
                ویرایش نمره و ارزیابی
              </button>
            </div>

            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= (selectedProject.qcScore || 5)
                      ? 'text-[#C1A056] fill-[#C1A056]'
                      : 'text-zinc-300 dark:text-zinc-600'
                  }`}
                />
              ))}
              <span className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] mr-2 font-mono">
                {toPersianDigits(selectedProject.qcScore || 5)} از 5
              </span>
            </div>

            {selectedProject.qcNotes && (
              <div className="bg-white dark:bg-[#141414] p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] text-xs text-[#4A4742] dark:text-[#BDB8AF] leading-relaxed">
                <span className="font-bold text-[#181818] dark:text-[#F5F3EF] block mb-1">نظر مسئول QC:</span>
                «{selectedProject.qcNotes}»
              </div>
            )}
          </div>
        )}

        {/* QC Evaluation & Decision Form */}
        {(isAwaitingQc(selectedProject) || isEditingApproved || selectedProject.qcStatus === 'REJECTED') && (
          <form onSubmit={handleApprove} className="bg-[#FAF7F2] dark:bg-[#1E1E1E] rounded-2xl p-4 border border-[#C1A056]/40 space-y-4">
            <h4 className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#8E6F27] dark:text-[#E5CA8F]" />
              <span>ارزیابی و تصمیم نهایی:</span>
            </h4>

            {/* Rating Stars */}
            <div>
              <label className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1.5">
                امتیاز کیفی به عملکرد اکیپ (۱ تا ۵ ستاره):
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setQcScore(star)}
                    className="p-1 transition hover:scale-110 cursor-pointer"
                    aria-label={`${star} ستاره`}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        qcScore && star <= qcScore
                          ? 'text-[#C1A056] fill-[#C1A056]'
                          : 'text-zinc-300 dark:text-zinc-600'
                      }`}
                    />
                  </button>
                ))}
                {qcScore ? (
                  <span className="text-xs font-bold text-[#181818] dark:text-[#F5F3EF] mr-2 font-mono">
                    {toPersianDigits(qcScore)} از 5
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mr-2">
                    (انتخاب امتیاز الزامی است)
                  </span>
                )}
              </div>
            </div>

            {/* QC Notes */}
            <div>
              <label className="block text-xs font-semibold text-[#4A4742] dark:text-[#BDB8AF] mb-1.5">
                توضیحات و نکات کنترلی:
              </label>
              <textarea
                rows={2}
                placeholder="توضیحات نهایی جهت ثبت در سابقه پروژه..."
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] focus:ring-2 focus:ring-[#C1A056] bg-white dark:bg-[#141414] dark:text-white"
              />
            </div>

            {/* Sticky Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!canApprove}
                className="flex-1"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                تایید نهایی کیفی و ثبت در سابقه
              </Button>

              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleOpenReject}
                icon={<XCircle className="w-4 h-4" />}
              >
                نیاز به اصلاح
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="کنترل کیفیت و ارزیابی"
        subtitle="بررسی مدارک نصب، عکس‌ها، استانداردهای تحویل و ثبت امتیاز"
        actions={
          <SegmentedControl
            options={[
              { id: 'PENDING', label: 'در انتظار بررسی', badge: pendingCount > 0 ? pendingCount : undefined },
              { id: 'APPROVED', label: 'تایید شده', badge: approvedCount > 0 ? approvedCount : undefined },
              ...(rejectedCount > 0
                ? [{ id: 'REJECTED', label: 'نیازمند اصلاح', badge: rejectedCount }]
                : []),
              { id: 'ALL', label: 'همه', badge: allCount },
            ]}
            value={filter}
            onChange={(val) => setFilter(val as FilterTab)}
            size="sm"
          />
        }
      />

      {/* Main Content Area */}
      {relevantProjects.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-8 text-center border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs max-w-md mx-auto">
          <ShieldCheck className="w-12 h-12 text-[#8E6F27] dark:text-[#E5CA8F] mx-auto mb-2 opacity-50" />
          <h3 className="font-bold text-sm text-[#181818] dark:text-white">
            {filter === 'PENDING'
              ? 'پروژه‌ای در انتظار بررسی QC نیست'
              : filter === 'APPROVED'
              ? 'هنوز پروژه‌ای تایید نشده است'
              : 'پروژه‌ای در این بخش یافت نشد'}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Projects List (Full width on mobile, 1 column on desktop) */}
          <div className="lg:col-span-1 space-y-2">
            <div className="text-xs font-bold text-[#69655F] dark:text-[#9E988D] px-1">
              لیست پروژه‌ها ({toPersianDigits(relevantProjects.length)} مورد):
            </div>

            <div className="space-y-2.5 max-h-[calc(100vh-14rem)] overflow-y-auto pr-0.5">
              {relevantProjects.map((p) => {
                const isSelected = selectedProject && selectedProject.id === p.id;
                const leadName = getUserName(p.leadTechnicianId);
                const leadUser = getUser(p.leadTechnicianId);
                const awaitingQc = isAwaitingQc(p);
                const totalPhotos =
                  (p.beforePhotos?.length || 0) + ((p.afterPhotos || p.completionPhotos)?.length || 0);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition select-none relative ${
                      isSelected
                        ? 'border-[#C1A056] bg-[#FAF7F2] dark:bg-[#202020] shadow-xs ring-2 ring-[#C1A056]/30'
                        : awaitingQc
                        ? 'border-[#C1A056]/60 bg-white dark:bg-[#1A1A1A] hover:border-[#C1A056]'
                        : 'border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] hover:border-[#C1A056]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono font-black text-xs text-[#8E6F27] dark:text-[#E5CA8F]">
                        {p.code}
                      </span>
                      <StatusPill status={p.status} qcStatus={p.qcStatus} size="sm" />
                    </div>

                    <h4 className="font-bold text-xs sm:text-sm text-[#181818] dark:text-[#F5F3EF] leading-snug line-clamp-1">
                      {p.title}
                    </h4>
                    <p className="text-[11px] text-[#69655F] dark:text-[#9E988D] mt-0.5 line-clamp-1">
                      {p.customerName}
                    </p>

                    {/* Metadata Pills */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                      {totalPhotos > 0 && (
                        <span className="inline-flex items-center gap-1 bg-[#FAF7F2] dark:bg-[#141414] text-[#4A4742] dark:text-[#BDB8AF] px-2 py-0.5 rounded-md border border-[#E2DDD4] dark:border-[#282828] font-mono">
                          <Camera className="w-3 h-3 text-[#8E6F27] dark:text-[#E5CA8F]" />
                          <span>{toPersianDigits(totalPhotos)} عکس</span>
                        </span>
                      )}
                      {p.customerSignature && (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30 font-bold">
                          امضا شده
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E2DDD4] dark:border-[#2C2C2C] text-[10px] text-[#69655F] dark:text-[#9E988D]">
                      <div className="flex items-center gap-1">
                        <Avatar name={leadName || 'سرپرست'} id={leadUser?.id} size="sm" />
                        <span className="truncate max-w-[90px]">{leadName || 'سرپرست'}</span>
                      </div>
                      <span className="font-mono">
                        {toPersianDigits(p.shadePanels)} شید / {toPersianDigits(p.curtainPanels)} پرده
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Right Detail Pane (hidden on mobile, shown >= 1024px) */}
          <div className="hidden lg:block lg:col-span-2 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs p-5">
            {renderDetailWorkspace()}
          </div>
        </div>
      )}

      {/* Mobile Detail Sheet (shown when project is clicked on mobile) */}
      <Sheet
        isOpen={isMobileDetailOpen}
        onClose={() => setIsMobileDetailOpen(false)}
        title={selectedProject ? `${selectedProject.code} — ${selectedProject.title}` : ''}
        size="lg"
      >
        <div className="p-2 pb-6">
          {renderDetailWorkspace()}
        </div>
      </Sheet>

      {/* QC Rejection Modal */}
      {selectedProject && (
        <QcRejectModal
          project={selectedProject}
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          onSubmit={handleRejectSubmit}
        />
      )}

      {/* Photo Lightbox Modal with Prev/Next Navigation */}
      {previewPhotoIndex !== null && allProjectPhotos[previewPhotoIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={() => setPreviewPhotoIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white pb-3">
              <span className="text-xs font-mono">
                عکس {toPersianDigits(previewPhotoIndex + 1)} از {toPersianDigits(allProjectPhotos.length)}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhotoIndex(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full flex items-center justify-center">
              {allProjectPhotos.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewPhotoIndex((idx) =>
                      idx !== null ? (idx > 0 ? idx - 1 : allProjectPhotos.length - 1) : 0
                    )
                  }
                  className="absolute right-2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                  aria-label="عکس بعدی"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              <CloudImage
                src={allProjectPhotos[previewPhotoIndex]}
                alt="بزرگ‌نمایی عکس کنترل کیفیت"
                className="max-h-[75vh] max-w-full rounded-xl shadow-2xl object-contain bg-black"
              />

              {allProjectPhotos.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewPhotoIndex((idx) =>
                      idx !== null ? (idx < allProjectPhotos.length - 1 ? idx + 1 : 0) : 0
                    )
                  }
                  className="absolute left-2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                  aria-label="عکس قبلی"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
