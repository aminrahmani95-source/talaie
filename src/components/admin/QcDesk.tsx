import React, { useState, useEffect, useMemo } from 'react';
import {
  Project,
  User,
  QCDefect,
  QCDefectSeverity,
  QCDefectCategory,
  QCQualityScoreCriteria,
} from '../../types';
import {
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  Camera,
  FileText,
  Clock,
  SlidersHorizontal,
  X,
  Printer,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings2,
  AlertTriangle,
  Plus,
  Check,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits, formatJalali } from '../../utils/jalali';
import { calculateWorkSessionsSummary } from '../../utils/multiDay';
import { ActiveJobTimer } from '../ActiveJobTimer';
import { QcRejectModal } from './QcRejectModal';
import { CloudImage } from '../common/CloudImage';
import { PageHeader } from '../ui/PageHeader';
import { getDisplayName } from '../../utils/technicianName';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusPill } from '../ui/StatusPill';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { triggerToast } from '../Toast';
import {
  calculateQualityScore,
  DEFAULT_QC_CHECKLIST_ITEMS,
  createQCInspectionPayload,
  createDefectVerificationPayload,
  isAwaitingQc,
  getHandoverEvidence,
} from '../../utils/qcWorkflow';

/** Quality criteria are stored on the latest QC inspection record (not on the project root). */
function getLatestQualityCriteria(project: Project) {
  const inspections = project.qcInspections || [];
  for (let i = inspections.length - 1; i >= 0; i--) {
    const criteria = inspections[i]?.qualityScoreDetails?.criteria;
    if (criteria) return criteria;
  }
  return undefined;
}

interface Props {
  projects: Project[];
  users: User[];
  currentUser?: User;
  selectedProjectId?: string | null;
  onSelectProject?: (id: string) => void;
  onPatchProject: (id: string, patch: Partial<Project>) => void;
  onViewProposal: (project: Project) => void;
  onOpenCertificate?: (project: Project) => void;
  onOpenEvaluation?: (project: Project) => void;
  onManageProject?: (project: Project) => void;
}

type FilterTab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export const QcDesk: React.FC<Props> = ({
  projects,
  users,
  currentUser,
  selectedProjectId: externalSelectedProjectId,
  onSelectProject: externalOnSelectProject,
  onPatchProject,
  onViewProposal,
  onOpenCertificate,
  onOpenEvaluation,
  onManageProject,
}) => {
  const [filter, setFilter] = useState<FilterTab>('PENDING');
  const [internalSelectedProjectId, setInternalSelectedProjectId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Sync external/internal selection
  const selectedProjectId = externalSelectedProjectId ?? internalSelectedProjectId;
  const setSelectedProjectId = (id: string | null) => {
    setInternalSelectedProjectId(id);
    if (id && externalOnSelectProject) {
      externalOnSelectProject(id);
    }
  };

  // QC Form states
  const [qcScore, setQcScore] = useState<number | null>(null);
  const [qcNotes, setQcNotes] = useState<string>('');
  const [isEditingApproved, setIsEditingApproved] = useState<boolean>(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [isDailyLogsOpen, setIsDailyLogsOpen] = useState<boolean>(true);

  // Phase P3 States
  const [qualityCriteria, setQualityCriteria] = useState<QCQualityScoreCriteria>({
    levelingScore: 5,
    fabricFinishScore: 5,
    mechanicsScore: 5,
    cleanlinessScore: 5,
    complianceScore: 5,
  });

  const [checklistState, setChecklistState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    DEFAULT_QC_CHECKLIST_ITEMS.forEach((item) => {
      init[item.id] = true;
    });
    return init;
  });

  const [isDefectsOpen, setIsDefectsOpen] = useState<boolean>(true);
  const [isInspectionsHistoryOpen, setIsInspectionsHistoryOpen] = useState<boolean>(false);
  const [showAddDefect, setShowAddDefect] = useState<boolean>(false);
  const [newDefectDesc, setNewDefectDesc] = useState<string>('');
  const [newDefectSeverity, setNewDefectSeverity] = useState<QCDefectSeverity>('MAJOR');
  const [newDefectCategory, setNewDefectCategory] = useState<QCDefectCategory>('LEVELING');
  const [newDefectLocation, setNewDefectLocation] = useState<string>('');

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
      const criteria = getLatestQualityCriteria(selectedProject) || {
        levelingScore: 5,
        fabricFinishScore: 5,
        mechanicsScore: 5,
        cleanlinessScore: 5,
        complianceScore: 5,
      };
      setQualityCriteria(criteria);
      const calculated = calculateQualityScore(criteria).overallScore;
      setQcScore(selectedProject.qcScore || calculated || 5);
      setQcNotes(selectedProject.qcNotes || '');
    }
  }, [selectedProject?.id]);

  const isQcManager = currentUser?.role === 'QC_MANAGER';
  const isCeo = currentUser?.role === 'CEO';
  const canApproveRole = isQcManager || isCeo;

  const unresolvedCriticalDefects = useMemo(() => {
    if (!selectedProject || !Array.isArray(selectedProject.qcDefects)) return [];
    return selectedProject.qcDefects.filter(
      (d) => d && d.severity === 'CRITICAL' && d.status !== 'RESOLVED' && d.status !== 'VERIFIED'
    );
  }, [selectedProject]);

  const hasCriticalDefects = unresolvedCriticalDefects.length > 0;

  // لیست شفاف و واضح پیش‌نیازهای تایید QC
  const approvalPrerequisites = useMemo(() => {
    return [
      {
        id: 'role',
        title: 'صلاحیت نقش کاربری',
        met: canApproveRole,
        message: canApproveRole
          ? 'نقش کاربری مجاز به تایید کنترل کیفی است.'
          : 'تایید نهایی کیفی فقط در صلاحیت مدیر ارشد QC یا مدیرعامل است.',
      },
      {
        id: 'status',
        title: 'آمادگی وضعیت پروژه برای QC',
        met: Boolean(
          selectedProject &&
            (isAwaitingQc(selectedProject) ||
              (isEditingApproved && selectedProject.qcStatus === 'APPROVED'))
        ),
        message: 'پروژه باید در صف بررسی کنترل کیفیت (اتمام نصب یا PENDING) باشد.',
      },
      {
        id: 'defects',
        title: 'بررسی عدم‌انطباق و نقص بحرانی',
        met: !hasCriticalDefects,
        message: hasCriticalDefects
          ? `پروژه دارای ${toPersianDigits(unresolvedCriticalDefects.length)} نقص بحرانی حل‌نشده است (${unresolvedCriticalDefects.map((d) => d.description).join('، ')}). ابتدا باید رفع و تایید شود.`
          : 'هیچ نقص بحرانی حل‌نشده‌ای در کارگاه ثبت نشده است.',
      },
      {
        id: 'evidence',
        title: 'مدارک تحویل (عکس و امضا)',
        met: Boolean(
          selectedProject &&
            (isEditingApproved ||
              getHandoverEvidence(selectedProject).exempt ||
              (getHandoverEvidence(selectedProject).hasPhotos && getHandoverEvidence(selectedProject).hasAcceptance))
        ),
        message: (() => {
          if (!selectedProject) return '';
          const ev = getHandoverEvidence(selectedProject);
          if (ev.exempt) return 'پروژه سوابق قدیمی است و از شرط مدارک معاف است.';
          if (ev.hasPhotos && ev.hasAcceptance) return 'عکس اتمام کار و امضا/صورت‌جلسه تحویل ثبت شده است.';
          const missing = [!ev.hasPhotos && 'عکس بعد از نصب', !ev.hasAcceptance && 'امضای مشتری یا علت عدم امضا'].filter(Boolean);
          return `برای تایید نهایی، ${missing.join(' و ')} باید توسط سرپرست ثبت شود.`;
        })(),
      },
      {
        id: 'score',
        title: 'امتیاز ارزیابی کیفی',
        met: Boolean(qcScore && qcScore >= 1),
        message: 'امتیاز کیفی پنج‌گانه محاسبه شده است.',
      },
    ];
  }, [canApproveRole, selectedProject, isEditingApproved, hasCriticalDefects, unresolvedCriticalDefects, qcScore]);

  const unmetPrerequisites = approvalPrerequisites.filter((p) => !p.met);
  const canApprove = unmetPrerequisites.length === 0;

  const handleSelectProject = (p: Project) => {
    setSelectedProjectId(p.id);
    const criteria = getLatestQualityCriteria(p) || {
      levelingScore: 5,
      fabricFinishScore: 5,
      mechanicsScore: 5,
      cleanlinessScore: 5,
      complianceScore: 5,
    };
    setQualityCriteria(criteria);
    const calculated = calculateQualityScore(criteria).overallScore;
    setQcScore(p.qcScore || calculated || 5);
    setQcNotes(p.qcNotes || '');
    setIsEditingApproved(false);
    setIsMobileDetailOpen(true);
    setShowAddDefect(false);
    setNewDefectDesc('');
    setNewDefectLocation('');
  };

  const handleApprove = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProject || !currentUser) {
      triggerToast('error', 'پروژه یا کاربر جهت تایید مشخص نشده است.');
      return;
    }

    if (!canApprove) {
      const first = unmetPrerequisites[0];
      triggerToast('warning', `پیش‌نیاز تایید QC: ${first.message}`);
      return;
    }

    const defaultNote = selectedProject.isExceptionalCompletion
      ? `تایید اتمام استثنایی با کسری اقلام توسط مدیر QC. اقلام باقیمانده: ${selectedProject.exceptionalCompletionDetails?.remainingActivities.map(a => `${a.title} (${toPersianDigits(a.remainingQuantity)} ${a.unit})`).join('، ')} (دلیل مستند تکنسین: ${selectedProject.exceptionalCompletionDetails?.documentedReason})`
      : 'نصب با رعایت کامل استانداردهای گالری طلایی انجام و تایید شد.';

    const checklistItems = DEFAULT_QC_CHECKLIST_ITEMS.map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      passed: checklistState[item.id] ?? true,
    }));

    const calculatedQuality = calculateQualityScore(qualityCriteria);

    const { patch } = createQCInspectionPayload({
      project: selectedProject,
      user: currentUser,
      result: 'PASS',
      checklist: checklistItems,
      qualityScoreDetails: calculatedQuality,
      overallScore: qcScore || calculatedQuality.overallScore,
      notes: qcNotes.trim() || defaultNote,
    });

    onPatchProject(selectedProject.id, patch);
    setIsEditingApproved(false);
    setIsMobileDetailOpen(false);
    triggerToast('success', `تایید نهایی QC پروژه «${selectedProject.code || selectedProject.title}» با موفقیت ثبت شد.`);

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#C5A059', '#0D1117', '#151B23'],
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
    if (!selectedProject || !currentUser) return;

    const checklistItems = DEFAULT_QC_CHECKLIST_ITEMS.map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      passed: checklistState[item.id] ?? false,
    }));

    const calculatedQuality = calculateQualityScore(qualityCriteria);

    const { patch } = createQCInspectionPayload({
      project: selectedProject,
      user: currentUser,
      result: 'FAIL',
      checklist: checklistItems,
      qualityScoreDetails: calculatedQuality,
      overallScore: qcScore || 2,
      notes: reason,
      reworkScheduledDate: newScheduledDate,
    });

    onPatchProject(selectedProject.id, patch);
    setIsRejectModalOpen(false);
    setIsMobileDetailOpen(false);
  };

  const handleVerifyDefect = (defectId: string) => {
    if (!selectedProject || !currentUser || !isQcManager) return;
    try {
      const patch = createDefectVerificationPayload({
        project: selectedProject,
        defectId,
        user: currentUser,
        verificationNotes: 'تایید راستی‌آزمایی رفع نقص توسط مسئول QC',
      });
      onPatchProject(selectedProject.id, patch);
    } catch (err: any) {
      alert(err.message || 'خطا در تایید رفع نقص');
    }
  };

  const handleAddDefect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !currentUser || !newDefectDesc.trim()) return;

    const newDefect: QCDefect = {
      id: `def-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      description: newDefectDesc.trim(),
      category: newDefectCategory,
      severity: newDefectSeverity,
      location: newDefectLocation.trim() || undefined,
      assignedTeamId: selectedProject.assignedTeamId,
      assignedTeamName: selectedProject.assignedTeamName,
      createdAt: new Date().toISOString(),
      createdByUserId: currentUser.id,
      createdByUserName: currentUser.name,
      status: 'OPEN',
    };

    const nextDefects = [...(selectedProject.qcDefects || []), newDefect];
    onPatchProject(selectedProject.id, {
      qcDefects: nextDefects,
      updatedAt: new Date().toISOString(),
    });

    setNewDefectDesc('');
    setNewDefectLocation('');
    setShowAddDefect(false);
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
    return getDisplayName(u?.name);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black bg-canvas text-brand-ink border border-line px-2 py-0.5 rounded whitespace-nowrap">
                {selectedProject.code}
              </span>
              <h3 className="font-black text-base sm:text-lg text-ink">
                {selectedProject.title}
              </h3>
            </div>
            <p className="text-xs text-ink-3 mt-1">{selectedProject.address}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onManageProject && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onManageProject(selectedProject)}
                icon={<Settings2 className="w-4 h-4" />}
              >
                مدیریت کامل
              </Button>
            )}
            {onOpenEvaluation && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenEvaluation(selectedProject)}
                icon={<Award className="w-4 h-4 text-brand-ink" />}
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

        {/* Timer & Multi-Day Work Summary */}
        <ActiveJobTimer
          status={selectedProject.status}
          startedAt={selectedProject.startedAt}
          completedAt={selectedProject.completedAt}
          reworkStartedAt={selectedProject.reworkStartedAt}
          workSessions={selectedProject.workSessions}
        />

        {selectedProject.workSessions && selectedProject.workSessions.length > 0 && (() => {
          const sessionSummary = calculateWorkSessionsSummary(selectedProject.workSessions);
          return sessionSummary ? (
            <div className="flex items-center justify-between bg-surface px-3.5 py-2.5 rounded-md border border-brand/30 text-xs font-bold text-brand-ink ">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-ink" />
                <span>مجموع زمان کار:</span>
              </span>
              <span>{sessionSummary.text}</span>
            </div>
          ) : null;
        })()}

        {/* Daily Logs Timeline (Collapsible) for Multi-Day Projects */}
        {selectedProject.dailyLogs && selectedProject.dailyLogs.length > 0 && (
          <div className="bg-sunken rounded-lg p-4 border border-line space-y-3">
            <button
              type="button"
              onClick={() => setIsDailyLogsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-right cursor-pointer select-none"
            >
              <h4 className="text-xs font-black text-ink flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-ink" />
                <span>گزارش‌های روزانه کار ({toPersianDigits(selectedProject.dailyLogs.length)} روز ثبت‌شده):</span>
              </h4>
              <div className="text-ink-3">
                {isDailyLogsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isDailyLogsOpen && (
              <div className="space-y-3 pt-1">
                {selectedProject.dailyLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="bg-sunken p-3 rounded-md border border-line space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-ink-3">
                      <span className="font-bold text-ink">
                        {formatJalali(log.date)}
                      </span>
                      <span>توسط: {log.byUserName}</span>
                    </div>
                    <p className="text-ink-2 leading-relaxed">
                      {log.note}
                    </p>
                    {log.photos && log.photos.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                        {log.photos.map((photo, pIdx) => (
                          <div
                            key={pIdx}
                            className="relative h-20 rounded-lg overflow-hidden border border-line"
                          >
                            <CloudImage
                              src={photo}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= مدارک تحویل از کارگاه: عکس، امضا و چک‌لیست در یک بخش ================= */}
        {(() => {
          const HANDOVER_ITEMS = [
            { key: 'floorProtectiveClothUsed', label: 'آستری محافظ کف' },
            { key: 'cradleBracketsSecured', label: 'مهاربندی کرپی‌ها و عودت' },
            { key: 'remoteTested', label: 'تست ریل، موتور و ریموت' },
            { key: 'leveled', label: 'تراز و شاقول بودن قاب و پایه‌ها' },
            { key: 'ironedPleated', label: 'اتوکشی و فرم‌دهی پلیسه‌ها' },
            { key: 'cleaned', label: 'نظافت محل و جمع‌آوری ضایعات' },
          ];
          const notes = ((checklist as any)?.handoverChecklistNotes || {}) as Record<string, string>;
          const confirmedCount = HANDOVER_ITEMS.filter((i) => checklist?.[i.key as keyof typeof checklist] === true).length;
          const openItems = HANDOVER_ITEMS.filter((i) => checklist?.[i.key as keyof typeof checklist] !== true);
          const acceptance = selectedProject.customerAcceptance;
          const signature = selectedProject.customerSignature || acceptance?.signature;
          const absenceReason = selectedProject.unavailabilityReason || acceptance?.unavailabilityReason;
          const signer = acceptance?.representativeName || selectedProject.representativeName || selectedProject.customerName;
          const chip = (ok: boolean, text: string) => (
            <span
              className={`px-2 py-0.5 rounded-full text-[12px] font-bold ${
                ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {ok ? '✓' : '!'} {text}
            </span>
          );
          const thumbs = (list: string[], offset: number, tag: string) =>
            list.map((photo, i) => (
              <button
                type="button"
                key={`${tag}-${i}`}
                onClick={() => setPreviewPhotoIndex(offset + i)}
                aria-label={`عکس ${tag} ${toPersianDigits(i + 1)}`}
                className="relative w-20 h-20 rounded-md overflow-hidden border border-line cursor-pointer group shrink-0"
              >
                <CloudImage src={photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[10px] text-white px-1 rounded">
                  {tag}
                </span>
              </button>
            ));

          return (
            <section className="bg-sunken rounded-lg p-4 border border-line space-y-3" aria-label="مدارک تحویل">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-black text-ink flex items-center gap-2">
                  <Camera className="w-4 h-4 text-brand-ink" />
                  مدارک تحویل از کارگاه
                </h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {chip(afterPhotos.length > 0, `${toPersianDigits(afterPhotos.length)} عکس بعد`)}
                  {chip(Boolean(signature || absenceReason), signature ? 'امضا' : absenceReason ? 'عدم حضور مستند' : 'بدون امضا')}
                  {chip(confirmedCount === HANDOVER_ITEMS.length, `چک‌لیست ${toPersianDigits(confirmedCount)}/${toPersianDigits(HANDOVER_ITEMS.length)}`)}
                </div>
              </div>

              {selectedProject.isExceptionalCompletion && selectedProject.exceptionalCompletionDetails && (
                <div className="bg-rose-500/10 border border-rose-500/40 rounded-md p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    اتمام استثنایی با کسری اقلام
                  </div>
                  <p className="text-ink">«{selectedProject.exceptionalCompletionDetails.documentedReason}»</p>
                  <p className="text-[12px] text-ink-3">
                    اجرا‌نشده:{' '}
                    {selectedProject.exceptionalCompletionDetails.remainingActivities
                      .map((a) => `${a.title} (${toPersianDigits(a.remainingQuantity)} ${a.unit})`)
                      .join('، ')}
                  </p>
                </div>
              )}

              {selectedProject.completionNotes && (
                <p className="text-xs text-ink-2 leading-relaxed">
                  <span className="font-bold text-ink">توضیح تکنسین: </span>«{selectedProject.completionNotes}»
                </p>
              )}

              {/* عکس‌ها: یک ردیف، قبل و بعد با برچسب */}
              {beforePhotos.length + afterPhotos.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {thumbs(afterPhotos, beforePhotos.length, 'بعد')}
                  {thumbs(beforePhotos, 0, 'قبل')}
                </div>
              ) : (
                <p className="text-xs text-ink-3">هیچ عکسی ثبت نشده است.</p>
              )}

              {/* امضا یا دلیل عدم حضور (همان صورت‌جلسه‌ی تحویل) */}
              {signature ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="h-14 w-36 bg-white rounded-md border border-line p-1 flex items-center justify-center">
                    <CloudImage src={signature} alt="امضای تحویل‌گیرنده" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="text-xs text-ink-2 space-y-0.5">
                    <div>
                      تحویل‌گیرنده: <strong className="text-ink">{signer}</strong>
                      {acceptance?.representativeRole ? ` (${acceptance.representativeRole})` : ''}
                    </div>
                    {selectedProject.customerSatisfaction ? (
                      <div className="flex items-center gap-0.5" aria-label={`رضایت ${selectedProject.customerSatisfaction} از ۵`}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= (selectedProject.customerSatisfaction || 0) ? 'text-brand-ink fill-brand' : 'text-ink-3'}`}
                          />
                        ))}
                      </div>
                    ) : null}
                    {acceptance?.acceptedAt && <div className="text-ink-3">{formatJalali(acceptance.acceptedAt)}</div>}
                  </div>
                </div>
              ) : absenceReason ? (
                <p className="text-xs p-2 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300">
                  <span className="font-bold">کارفرما حضور نداشت: </span>«{absenceReason}»
                </p>
              ) : null}

              {/* چک‌لیست: فقط موارد تاییدنشده نمایش داده می‌شود */}
              {!checklist ? (
                <p className="text-xs text-ink-3">چک‌لیست تحویل ثبت نشده است.</p>
              ) : openItems.length > 0 ? (
                <ul className="text-xs space-y-1">
                  {openItems.map((i) => (
                    <li key={i.key} className="text-amber-700 dark:text-amber-300">
                      ✗ {i.label}
                      {notes[i.key] ? <span className="text-ink-3"> — علت: {notes[i.key]}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })()}

        {/* Defect Management & Corrective Actions Tracker (Phase P3) */}
        <div className="bg-sunken rounded-lg p-4 border border-line space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsDefectsOpen((prev) => !prev)}
              className="flex items-center gap-2 text-right cursor-pointer select-none font-black text-xs text-ink"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                نقص‌های کیفی
                {(selectedProject.qcDefects || []).length > 0
                  ? ` (${toPersianDigits((selectedProject.qcDefects || []).length)})`
                  : ': ندارد'}
              </span>
              {isDefectsOpen ? <ChevronUp className="w-4 h-4 text-ink-3" /> : <ChevronDown className="w-4 h-4 text-ink-3" />}
            </button>

            {isQcManager && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddDefect((prev) => !prev)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                ثبت نقص جدید
              </Button>
            )}
          </div>

          {/* Form to add new Defect */}
          {showAddDefect && isQcManager && (
            <form onSubmit={handleAddDefect} className="bg-sunken p-3.5 rounded-md border border-amber-300 dark:border-amber-800/40 space-y-3">
              <div className="font-bold text-xs text-ink flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>ثبت مورد جدید عدم‌انطباق کیفی:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block mb-1 font-semibold text-ink-2">شدت نقص (Severity):</label>
                  <select
                    value={newDefectSeverity}
                    onChange={(e) => setNewDefectSeverity(e.target.value as QCDefectSeverity)}
                    className="w-full p-2 rounded-lg border border-line bg-sunken"
                  >
                    <option value="CRITICAL">بحرانی (CRITICAL) — مانع تایید نهایی</option>
                    <option value="MAJOR">عمده (MAJOR)</option>
                    <option value="MINOR">جزیی (MINOR)</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-semibold text-ink-2">دسته‌بندی نقص:</label>
                  <select
                    value={newDefectCategory}
                    onChange={(e) => setNewDefectCategory(e.target.value as QCDefectCategory)}
                    className="w-full p-2 rounded-lg border border-line bg-sunken"
                  >
                    <option value="LEVELING">تراز و شاقول بودن</option>
                    <option value="FABRIC">کیفیت پارچه و اتو</option>
                    <option value="MOTOR_REMOTE">موتور و ریموت</option>
                    <option value="HARDWARE">کرپی‌ها و اتصالات</option>
                    <option value="CLEANLINESS">نظافت کارگاه</option>
                    <option value="DAMAGE">آسیب به محل نصب</option>
                    <option value="OTHER">سایر موارد</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-semibold text-ink-2">موقعیت/پنجره (اختیاری):</label>
                  <input
                    type="text"
                    placeholder="مثلاً پنجره سالن اصلی"
                    value={newDefectLocation}
                    onChange={(e) => setNewDefectLocation(e.target.value)}
                    className="w-full p-2 rounded-lg border border-line bg-sunken text-ink placeholder-ink-3 outline-none focus:border-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-ink-2">شرح دقیق عدم‌انطباق:</label>
                <textarea
                  rows={2}
                  required
                  placeholder="شرح دقیق نقص کیفی و علت عدم پذیرش..."
                  value={newDefectDesc}
                  onChange={(e) => setNewDefectDesc(e.target.value)}
                  className="w-full p-2 rounded-lg text-xs border border-line bg-sunken text-ink placeholder-ink-3 outline-none focus:border-brand"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddDefect(false)}>
                  انصراف
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  ثبت نقص کیفی
                </Button>
              </div>
            </form>
          )}

          {/* List of Defects */}
          {isDefectsOpen && (
            <div className="space-y-2">
              {(selectedProject.qcDefects && selectedProject.qcDefects.length > 0) ? (
                selectedProject.qcDefects.map((defect) => (
                  <div
                    key={defect.id}
                    className={`p-3 rounded-md border text-xs space-y-1.5 transition ${
                      defect.severity === 'CRITICAL'
                        ? 'bg-rose-500/10 border-rose-500/40 dark:bg-rose-950/20'
                        : defect.severity === 'MAJOR'
                        ? 'bg-amber-500/10 border-amber-500/40 dark:bg-amber-950/20'
                        : 'bg-blue-500/10 border-blue-500/30 dark:bg-blue-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[12px] ${
                            defect.severity === 'CRITICAL'
                              ? 'bg-rose-600 text-white'
                              : defect.severity === 'MAJOR'
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {defect.severity === 'CRITICAL' ? 'بحرانی' : defect.severity === 'MAJOR' ? 'عمده' : 'جزیی'}
                        </span>
                        <span className="font-bold text-ink">
                          {defect.description}
                        </span>
                        {defect.location && (
                          <span className="text-ink-3 text-[12px]">({defect.location})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[12px] ${
                            defect.status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : defect.status === 'RESOLVED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {defect.status === 'VERIFIED'
                            ? 'تایید راستی‌آزمایی QC'
                            : defect.status === 'RESOLVED'
                            ? 'رفع‌شده توسط اکیپ'
                            : defect.status === 'IN_PROGRESS'
                            ? 'در حال اصلاح'
                            : 'باز'}
                        </span>

                        {isQcManager && defect.status === 'RESOLVED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleVerifyDefect(defect.id)}
                            icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
                          >
                            تایید رفع نقص
                          </Button>
                        )}
                      </div>
                    </div>

                    {defect.resolutionNotes && (
                      <div className="p-2 bg-sunken rounded-lg border border-line text-[12px] text-ink">
                        <span className="font-bold text-blue-600 block mb-0.5">گزارش رفع نقص توسط اکیپ ({defect.resolvedByUserName}):</span>
                        «{defect.resolutionNotes}»
                      </div>
                    )}

                    {defect.verificationNotes && defect.status === 'VERIFIED' && (
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/40 text-[12px] text-emerald-800 dark:text-emerald-300">
                        <span className="font-bold block mb-0.5">تایید راستی‌آزمایی مدیر QC ({defect.verifiedByUserName}):</span>
                        «{defect.verificationNotes}»
                      </div>
                    )}
                  </div>
                ))
              ) : null}
            </div>
          )}
        </div>

        {/* Historical Inspections Timeline (Phase P3) */}
        {selectedProject.qcInspections && selectedProject.qcInspections.length > 0 && (
          <div className="bg-sunken rounded-lg p-4 border border-line space-y-3">
            <button
              type="button"
              onClick={() => setIsInspectionsHistoryOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-right cursor-pointer select-none font-black text-xs text-ink"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-ink" />
                <span>تاریخچه نوبت‌های بازرسی QC ({toPersianDigits(selectedProject.qcInspections.length)} بازرسی ثبت‌شده):</span>
              </span>
              {isInspectionsHistoryOpen ? <ChevronUp className="w-4 h-4 text-ink-3" /> : <ChevronDown className="w-4 h-4 text-ink-3" />}
            </button>

            {isInspectionsHistoryOpen && (
              <div className="space-y-2.5 pt-1">
                {selectedProject.qcInspections.map((insp, idx) => (
                  <div
                    key={insp.id || idx}
                    className="p-3 bg-sunken rounded-md border border-line text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[12px] ${
                            insp.result === 'PASS'
                              ? 'bg-emerald-600 text-white'
                              : insp.result === 'FAIL'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          {insp.result === 'PASS' ? 'تایید (PASS)' : insp.result === 'FAIL' ? 'عدم تایید (FAIL)' : 'مشروط (CONDITIONAL)'}
                        </span>
                        <span className="font-bold text-ink">
                          نوبت #{toPersianDigits(idx + 1)} — {formatJalali(insp.inspectionDate)}
                        </span>
                      </div>
                      <span className="text-ink-3 text-[12px]">بازرس: {insp.inspectorUserName}</span>
                    </div>

                    {insp.overallScore && (
                      <div className="text-[12px] text-ink-2">
                        امتیاز کیفی بازرسی: <strong className="text-ink">{toPersianDigits(insp.overallScore)} از 5</strong>
                      </div>
                    )}

                    {insp.notes && (
                      <p className="text-[12px] text-ink bg-canvas p-2 rounded-lg">
                        «{insp.notes}»
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action: If IN_PROGRESS, allow manager to mark ready for QC */}
        {selectedProject.status === 'IN_PROGRESS' && (
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-amber-900 dark:text-amber-200">
                این پروژه در حال حاضر «در حال نصب» است
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
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
          <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>این پروژه با تایید رسمی کنترل کیفیت (QC) ثبت شده است</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingApproved(true)}
                className="text-xs font-bold text-brand-ink hover:underline cursor-pointer"
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
                      ? 'text-brand-ink fill-brand'
                      : 'text-ink-3'
                  }`}
                />
              ))}
              <span className="text-xs font-bold text-ink mr-2">
                {toPersianDigits(selectedProject.qcScore || 5)} از 5
              </span>
            </div>

            {selectedProject.qcNotes && (
              <div className="bg-sunken p-3 rounded-md border border-line text-xs text-ink-2 leading-relaxed">
                <span className="font-bold text-ink block mb-1">نظر مسئول QC:</span>
                «{selectedProject.qcNotes}»
              </div>
            )}
          </div>
        )}

        {/* QC Evaluation, Quality Scoring & Decision Form */}
        {(isAwaitingQc(selectedProject) || isEditingApproved || selectedProject.qcStatus === 'REJECTED') && (
          <form onSubmit={handleApprove} className="bg-sunken rounded-lg p-4 border border-brand/40 space-y-4">
            <h4 className="text-xs font-bold text-ink flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-ink" />
              <span>ارزیابی و بازرسی کنترل کیفی نهایی:</span>
            </h4>

            {!canApproveRole && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs text-amber-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  شما با نقش کاربری فعلی به این برگه دسترسی دارید؛ تایید نهایی کنترل کیفی و صدور صورت‌جلسه رسمی منحصراً در صلاحیت مدیر کنترل کیفی (QC) یا مدیرعامل است.
                </span>
              </div>
            )}

            {/* Critical Defect Gate Warning */}
            {hasCriticalDefects && (
              <div className="p-3 bg-rose-500/15 border border-rose-500 rounded-md text-xs flex items-start gap-2 text-rose-200">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">تأیید نهایی QC مسدود است:</span>
                  پروژه دارای عدم‌انطباق یا نقص بحرانی (CRITICAL) حل‌نشده است ({unresolvedCriticalDefects.map(d => d.description).join('، ')}). تا پیش از ثبت رفع نقص توسط اکیپ و تایید راستی‌آزمایی اصلاح توسط مدیر QC، صدور تایید نهایی ممکن نیست.
                </div>
              </div>
            )}

            {/* Quality Scoring Criteria (5-Criteria Internal Scoring) */}
            <div className="bg-sunken p-3.5 rounded-md border border-line space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-brand-ink" />
                  <span>امتیاز کیفیت (۱ تا ۵):</span>
                </label>
                <div className="text-xs bg-sunken px-2.5 py-1 rounded-lg border border-brand/30 font-bold text-brand-ink">
                  نمره: {toPersianDigits(calculateQualityScore(qualityCriteria).overallScore)} از ۵
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  { key: 'levelingScore', label: 'تراز و شاقول', val: qualityCriteria.levelingScore },
                  { key: 'fabricFinishScore', label: 'کیفیت پارچه و اتو', val: qualityCriteria.fabricFinishScore },
                  { key: 'mechanicsScore', label: 'مکانیک، موتور و ریموت', val: qualityCriteria.mechanicsScore },
                  { key: 'cleanlinessScore', label: 'نظافت و حفاظت کف', val: qualityCriteria.cleanlinessScore },
                  { key: 'complianceScore', label: 'انطباق با طرح', val: qualityCriteria.complianceScore },
                ].map((crit) => (
                  <div key={crit.key} className="flex items-center justify-between p-2 rounded-lg bg-sunken">
                    <span className="text-ink-2 text-[12px]">{crit.label}:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            const nextCrit = { ...qualityCriteria, [crit.key]: s };
                            setQualityCriteria(nextCrit);
                            const score = calculateQualityScore(nextCrit).overallScore;
                            setQcScore(Math.round(score));
                          }}
                          className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs cursor-pointer transition ${
                            crit.val === s
                              ? 'bg-brand text-on-brand font-black'
                              : 'bg-sunken text-ink-3 border border-line'
                          }`}
                        >
                          {toPersianDigits(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checklist Toggles */}
            <div className="bg-sunken p-3.5 rounded-md border border-line space-y-2">
              <label className="block text-xs font-bold text-ink">
                بازرسی استانداردها <span className="font-normal text-ink-3">(همه تایید؛ روی مورد معیوب بزنید)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {DEFAULT_QC_CHECKLIST_ITEMS.map((item) => {
                  const isPassed = checklistState[item.id] ?? true;
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        setChecklistState((prev) => ({ ...prev, [item.id]: !isPassed }))
                      }
                      role="checkbox"
                      aria-checked={isPassed}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setChecklistState((prev) => ({ ...prev, [item.id]: !isPassed }));
                        }
                      }}
                      className={`px-2.5 py-2 rounded-md flex items-center gap-2 cursor-pointer transition select-none ${
                        isPassed ? 'text-ink-2 hover:bg-raised' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <span className={`font-black shrink-0 ${isPassed ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPassed ? '✓' : '✗'}
                      </span>
                      <span className="text-[12px] leading-snug">{item.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QC Notes */}
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                توضیحات و نکات کنترلی مسئول بازرسی:
              </label>
              <textarea
                rows={2}
                placeholder="توضیحات نهایی جهت درج در صورت‌جلسه بازرسی QC..."
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-md border border-line focus:ring-2 focus:ring-brand bg-sunken text-ink placeholder-ink-3 outline-none"
              />
            </div>

            {/* پیش‌نیازها: فقط موارد ناقص نمایش داده می‌شود؛ موارد همیشه‌سبز (مثل نقش کاربر) دیگر فهرست نمی‌شوند */}
            {unmetPrerequisites.length > 0 ? (
              <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs space-y-1.5">
                <div className="font-bold text-ink flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  برای تایید نهایی این موارد کم است:
                </div>
                {unmetPrerequisites.map((req) => (
                  <div key={req.id} className="text-amber-800 dark:text-amber-300">
                    • <span className="font-bold">{req.title}:</span> {req.message}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> همه‌ی پیش‌نیازهای تایید آماده است.
              </p>
            )}

            {/* Sticky Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="flex-1"
                icon={<CheckCircle2 className="w-4 h-4" />}
                disabled={!canApprove}
                disabledReason={unmetPrerequisites.length > 0 ? `پیش‌نیاز تکمیل‌نشده: ${unmetPrerequisites[0].message}` : undefined}
              >
                {hasCriticalDefects
                  ? 'تأیید مسدود (نقص بحرانی حل‌نشده)'
                  : selectedProject.isExceptionalCompletion
                  ? 'تأیید تحویل ناقص و اتمام استثنایی'
                  : 'تایید نهایی کیفی و ثبت در سابقه'}
              </Button>

              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleOpenReject}
                icon={<XCircle className="w-4 h-4" />}
              >
                {selectedProject.isExceptionalCompletion
                  ? 'رد استثنا و الزام به تکمیل'
                  : 'نیاز به اصلاح / رد بازرسی'}
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
        title="کنترل کیفیت"
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
        <div className="bg-surface rounded-lg p-8 text-center border border-line  max-w-md mx-auto">
          <ShieldCheck className="w-12 h-12 text-brand-ink mx-auto mb-2 opacity-50" />
          <h3 className="font-bold text-sm text-ink">
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
            <div className="text-xs font-bold text-ink-3 px-1">
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
                    className={`p-3.5 rounded-lg border cursor-pointer transition select-none relative ${
                      isSelected
                        ? 'border-brand bg-raised ring-2 ring-brand/30'
                        : awaitingQc
                        ? 'border-brand/50 bg-surface hover:border-brand'
                        : 'border-line bg-surface hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-black text-xs text-brand-ink">
                        {p.code}
                      </span>
                      <StatusPill status={p.status} qcStatus={p.qcStatus} size="sm" />
                    </div>

                    <h4 className="font-bold text-xs sm:text-sm text-ink leading-snug line-clamp-1">
                      {p.title}
                    </h4>
                    <p className="text-xs text-ink-3 mt-0.5 line-clamp-1">
                      {p.customerName}
                    </p>

                    {/* Metadata Pills */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap text-xs">
                      {totalPhotos > 0 && (
                        <span className="inline-flex items-center gap-1 bg-sunken text-ink-2 px-2 py-0.5 rounded-md border border-line">
                          <Camera className="w-3 h-3 text-brand-ink" />
                          <span>{toPersianDigits(totalPhotos)} عکس</span>
                        </span>
                      )}
                      {p.customerSignature && (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30 font-bold">
                          امضا شده
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-line text-xs text-ink-3">
                      <div className="flex items-center gap-1">
                        <Avatar name={leadName || 'سرپرست'} id={leadUser?.id} size="sm" />
                        <span className="truncate max-w-[90px]">{leadName || 'سرپرست'}</span>
                      </div>
                      <span>
                        {toPersianDigits(p.shadePanels)} شید / {toPersianDigits(p.curtainPanels)} پرده
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Right Detail Pane (hidden on mobile, shown >= 1024px) */}
          <div className="hidden lg:block lg:col-span-2 bg-surface rounded-lg border border-line  p-5">
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
            <div className="w-full flex items-center justify-between text-ink pb-3">
              <span className="text-xs">
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
                className="max-h-[75vh] max-w-full rounded-md shadow-2xl object-contain bg-black"
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
