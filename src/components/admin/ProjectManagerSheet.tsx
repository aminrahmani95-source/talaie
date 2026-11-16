import React, { useEffect, useMemo, useState } from 'react';
import {
  Info,
  Activity,
  FileText,
  History,
  Undo2,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Pencil,
  Award,
  X,
  Loader2,
  AlertTriangle,
  CalendarRange,
  Clock,
  Layers,
  Plus,
  Check,
  ArrowRightLeft,
} from 'lucide-react';
import { Project, ProjectAuditRecord, ProjectStatus, QCStatus, Ticket, User, InstallationTeam } from '../../types';
import { Sheet, Button, StatusPill, SegmentedControl, Badge } from '../ui';
import { CloudImage } from '../common/CloudImage';
import {
  canRevertOneStep,
  getFullResetPatch,
  getRevertOneStep,
  isDeleteCodeConfirmed,
  ResetMode,
} from '../../utils/managerActions';
import { formatAuditDiff, getQcStatusPersianLabel, getStatusPersianLabel } from '../../utils/auditDiff';
import { formatJalali, formatJalaliDateTime, toPersianDigits, getUpcomingDays } from '../../utils/jalali';
import { calculateWorkSessionsSummary, getMultiDayTotalDays, isProjectMultiDay } from '../../utils/multiDay';
import { getDisplayName } from '../../utils/technicianName';
import {
  calculateActivityProgress,
  getEffectiveProjectPlan,
  createPlanAmendment,
  reviewPlanAmendment,
} from '../../utils/planProgress';
import {
  canTransferProjectTeam,
  createTeamTransferPayload,
  getProjectTransferHistory,
} from '../../utils/teamTransfer';

type TabId = 'info' | 'status' | 'docs' | 'history';
type PhotoField = 'beforePhotos' | 'afterPhotos' | 'completionPhotos';

const ALL_STATUSES: ProjectStatus[] = [
  'MEASUREMENT_PENDING',
  'SCHEDULED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'PAUSED',
  'STUCK',
  'COMPLETED',
  'CANCELLED',
];
const ALL_QC: QCStatus[] = ['NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED'];

export interface ProjectManagerSheetProps {
  project: Project;
  users: User[];
  tickets: Ticket[];
  teams?: InstallationTeam[];
  currentUser: User;
  isOnline: boolean;
  onClose: () => void;
  onEditInfo: (project: Project) => void;
  /** Applies a manager patch. `_auditReason` (if any) is recorded in the history and never stored on the project. */
  onApplyPatch: (projectId: string, patch: Record<string, unknown>, successMessage: string) => Promise<void>;
  onDeleteProject?: (projectId: string, options: { reason: string; deleteTicketsAndFiles: boolean }) => Promise<void>;
  onOpenCertificate: (project: Project) => void;
  onViewProposal: (project: Project) => void;
  fetchAudit: (projectId: string) => Promise<ProjectAuditRecord[]>;
}

const sectionCls =
  'rounded-lg border border-[#212835] bg-[#111620] p-4 space-y-3';
const inputCls =
  'w-full rounded-md border border-[#212835] bg-[#0D1117] px-3 py-2.5 text-sm text-[#F0F4F8] focus:outline-none focus:ring-2 focus:ring-[#C5A059] focus:border-[#C5A059]';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-dashed border-[#212835] last:border-0">
    <span className="text-[#637184] shrink-0">{label}</span>
    <span className="font-bold text-[#F0F4F8] text-left break-words min-w-0">{children}</span>
  </div>
);

export const ProjectManagerSheet: React.FC<ProjectManagerSheetProps> = ({
  project,
  users,
  tickets,
  teams = [],
  currentUser,
  isOnline,
  onClose,
  onEditInfo,
  onApplyPatch,
  onDeleteProject,
  onOpenCertificate,
  onViewProposal,
  fetchAudit,
}) => {
  const [tab, setTab] = useState<TabId>('status');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // status tab
  const [resetMode, setResetMode] = useState<ResetMode>('KEEP_DOCS');
  const [confirmReset, setConfirmReset] = useState(false);
  const [manualStatus, setManualStatus] = useState<ProjectStatus>(project.status);
  const [manualQc, setManualQc] = useState<QCStatus>(project.qcStatus);

  // docs tab
  const [notesDraft, setNotesDraft] = useState(project.completionNotes || '');

  // history tab
  const [audit, setAudit] = useState<ProjectAuditRecord[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteAll, setDeleteAll] = useState(true);

  // plan amendment state
  const [showAddAmendment, setShowAddAmendment] = useState(false);
  const [amendActivityId, setAmendActivityId] = useState('');
  const [amendNewQty, setAmendNewQty] = useState('');
  const [amendReason, setAmendReason] = useState('');

  // team transfer state (Phase P2.2)
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferNewDate, setTransferNewDate] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  useEffect(() => {
    setManualStatus(project.status);
    setManualQc(project.qcStatus);
  }, [project.status, project.qcStatus]);

  useEffect(() => {
    setNotesDraft(project.completionNotes || '');
  }, [project.completionNotes]);

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      setAudit(await fetchAudit(project.id));
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') void loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, project.updatedAt]);

  const userName = (id?: string) => getDisplayName(users.find((u) => u.id === id)?.name) || '—';
  const projectTickets = useMemo(() => tickets.filter((t) => t.projectId === project.id), [tickets, project.id]);
  const revert = getRevertOneStep(project);
  const reasonTrim = reason.trim();
  const reasonOk = reasonTrim.length >= 3;
  const multiDay = isProjectMultiDay(project);
  const work = calculateWorkSessionsSummary(project.workSessions || [], project.startedAt, project.completedAt);

  const run = async (patch: Record<string, unknown>, msg: string, autoReason: string) => {
    setBusy(true);
    try {
      await onApplyPatch(project.id, { ...patch, _auditReason: reasonTrim || autoReason }, msg);
      setReason('');
      setConfirmReset(false);
    } finally {
      setBusy(false);
    }
  };

  const isQcManager = currentUser.role === 'QC_MANAGER';
  const plan = useMemo(() => getEffectiveProjectPlan(project), [project]);
  const progressList = useMemo(() => calculateActivityProgress(project), [project]);

  const handleAddAmendment = async () => {
    if (!amendActivityId || !amendNewQty || !amendReason.trim()) return;
    const act = plan.find((a) => a.id === amendActivityId);
    if (!act) return;

    const newQtyNum = parseFloat(amendNewQty);
    if (isNaN(newQtyNum) || newQtyNum < 0) return;

    const amendment = createPlanAmendment(
      act.id,
      act.title,
      act.plannedQuantity,
      newQtyNum,
      amendReason.trim(),
      currentUser,
      isQcManager ? 'APPROVED' : 'PENDING'
    );

    const existingAmendments = project.planAmendments || [];
    const updatedAmendments = [...existingAmendments, amendment];

    await run(
      { planAmendments: updatedAmendments },
      'اصلاحیه طرح با موفقیت ثبت شد.',
      `اصلاحیه طرح: تغییر مقدار ${act.title} به ${newQtyNum} (${amendReason.trim()})`
    );

    setShowAddAmendment(false);
    setAmendActivityId('');
    setAmendNewQty('');
    setAmendReason('');
  };

  const handleReviewAmendment = async (amendmentId: string, status: 'APPROVED' | 'REJECTED') => {
    const updatedAmendments = reviewPlanAmendment(
      project.planAmendments || [],
      amendmentId,
      status,
      currentUser,
      reasonTrim || undefined
    );
    await run(
      { planAmendments: updatedAmendments },
      status === 'APPROVED' ? 'اصلاحیه طرح تایید شد.' : 'اصلاحیه طرح رد شد.',
      `بررسی اصلاحیه طرح: ${status === 'APPROVED' ? 'تایید' : 'رد'}`
    );
  };

  const handleExecuteTeamTransfer = async () => {
    if (!targetTeamId || !transferReason.trim()) return;
    const targetTeam = teams.find((t) => t.id === targetTeamId);
    if (!targetTeam) return;

    const targetSupervisor = users.find((u) => u.id === targetTeam.supervisorId);
    const targetMembers = users.filter((u) => u.teamId === targetTeam.id);

    try {
      setBusy(true);
      const { patch } = createTeamTransferPayload({
        project,
        targetTeam,
        targetSupervisor,
        targetTeamMembers: targetMembers,
        currentUser,
        reason: transferReason,
        notes: transferNotes,
        newScheduledDate: transferNewDate || undefined,
      });

      await run(
        patch as unknown as Record<string, unknown>,
        `پروژه با موفقیت به «${targetTeam.name}» منتقل شد.`,
        `انتقال رسمی اکیپ: ${transferReason.trim()}`
      );
      setShowTransferForm(false);
      setTransferReason('');
      setTargetTeamId('');
      setTransferNewDate('');
      setTransferNotes('');
    } catch (err: any) {
      alert(err.message || 'خطا در انتقال اکیپ');
    } finally {
      setBusy(false);
    }
  };

  const reasonBox = (required: boolean) => (
    <div className="space-y-1.5">
      <label htmlFor="pm-reason" className="block text-xs font-bold text-[#F0F4F8]">
        دلیل تغییر {required ? <span className="text-rose-500">*</span> : <span className="font-normal text-[#8A8378]">(اختیاری)</span>}
      </label>
      <textarea
        id="pm-reason"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="مثلاً: تکنسین اشتباهی «اتمام کار» را زده بود"
        className={inputCls}
      />
      <p className="text-[11px] text-[#8A8378]">این دلیل همراه با نام شما در «تاریخچه» پروژه ثبت می‌شود.</p>
    </div>
  );

  // ----------------------------------------------------------------- tabs
  const infoTab = (
    <div className="space-y-4">
      <div className={sectionCls}>
        <Row label="کد پروژه">{project.code}</Row>
        <Row label="عنوان">{project.title}</Row>
        <Row label="مشتری">{project.customerName || '—'}</Row>
        <Row label="تلفن مشتری"><span dir="ltr">{project.customerPhone || '—'}</span></Row>
        <Row label="آدرس">{project.address || '—'}</Row>
        <Row label="تاریخ اجرا">
          {formatJalali(project.scheduledDate)} {project.scheduledTime ? `— ${project.scheduledTime}` : ''}
        </Row>
        {multiDay && (
          <Row label="تاریخ پایان">
            {formatJalali(project.endDate)} ({toPersianDigits(getMultiDayTotalDays(project))} روزه)
          </Row>
        )}
        <Row label="سرپرست">{userName(project.leadTechnicianId)}</Row>
        <Row label="اکیپ">
          {(project.assignedTechnicianIds || []).map((id) => userName(id)).join('، ') || '—'}
        </Row>
        <Row label="لت‌ها">
          {toPersianDigits(project.shadePanels || 0)} شید، {toPersianDigits(project.curtainPanels || 0)} پرده
        </Row>
        <Row label="تیکت‌ها">{toPersianDigits(projectTickets.length)}</Row>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Pencil className="w-4 h-4" />} onClick={() => onEditInfo(project)}>
          ویرایش اطلاعات، تاریخ و اکیپ
        </Button>
        {project.proposalImages?.length > 0 && (
          <Button variant="secondary" onClick={() => onViewProposal(project)}>
            پروپوزال
          </Button>
        )}
      </div>

      {/* Original Installation Plan & Progress */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Layers className="w-4 h-4 text-[#C5A059]" /> اقلام اجرایی طرح و پیشرفت واقعی
          </div>
          {isQcManager && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowAddAmendment((v) => !v)}
            >
              ثبت اصلاحیه طرح
            </Button>
          )}
        </div>

        {/* Add Amendment Form (QC Manager only) */}
        {showAddAmendment && (
          <div className="rounded-md border border-[#C5A059]/40 bg-[#111620] p-3 space-y-3">
            <div className="text-xs font-bold text-[#F0F4F8]">ثبت اصلاحیه طرح نصب (کنترل کیفی)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="space-y-1">
                <span className="font-bold">انتخاب فعالیت:</span>
                <select
                  className={inputCls}
                  value={amendActivityId}
                  onChange={(e) => setAmendActivityId(e.target.value)}
                >
                  <option value="">-- انتخاب فعالیت --</option>
                  {plan.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} (مبنا: {toPersianDigits(a.plannedQuantity)} {a.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-bold">مقدار جدید نهایی:</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputCls}
                  value={amendNewQty}
                  onChange={(e) => setAmendNewQty(e.target.value)}
                  placeholder="مثال: 14"
                />
              </label>
            </div>
            <label className="space-y-1 text-xs block">
              <span className="font-bold">علت اصلاحیه (الزامی برای ثبت در سابقه):</span>
              <input
                type="text"
                className={inputCls}
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                placeholder="مثال: افزایش ۲ لت پرده سالن به درخواست کارفرما"
              />
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !amendActivityId || !amendNewQty || !amendReason.trim()}
                onClick={handleAddAmendment}
              >
                ثبت و تایید اصلاحیه
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddAmendment(false);
                  setAmendActivityId('');
                  setAmendNewQty('');
                  setAmendReason('');
                }}
              >
                انصراف
              </Button>
            </div>
          </div>
        )}

        {/* Plan Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="border-b border-[#E2DDD4] dark:border-[#333] text-[#637184]">
                <th className="py-2 px-1">فعالیت</th>
                <th className="py-2 px-1">طرح مبنا</th>
                <th className="py-2 px-1">اصلاحیه</th>
                <th className="py-2 px-1">برنامه نهایی</th>
                <th className="py-2 px-1">انجام شده</th>
                <th className="py-2 px-1">باقیمانده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DDD4]/60 dark:divide-[#282828]">
              {progressList.map((item) => (
                <tr key={item.activityId} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="py-2 px-1 font-bold text-[#F0F4F8]">
                    {item.title}
                  </td>
                  <td className="py-2 px-1 font-mono">
                    {toPersianDigits(item.baselineQuantity)} {item.unit}
                  </td>
                  <td className="py-2 px-1 font-mono">
                    {item.amendmentDelta !== 0 ? (
                      <span className={item.amendmentDelta > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {item.amendmentDelta > 0 ? '+' : ''}{toPersianDigits(item.amendmentDelta)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-1 font-mono font-bold text-[#C5A059]">
                    {toPersianDigits(item.effectivePlannedQuantity)}
                  </td>
                  <td className="py-2 px-1 font-mono font-bold text-emerald-600">
                    {toPersianDigits(item.totalCompletedQuantity)}
                  </td>
                  <td className="py-2 px-1 font-mono">
                    {item.isOverCompleted ? (
                      <span className="text-amber-600 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                        +{toPersianDigits(item.overCompletedQuantity)} مازاد
                      </span>
                    ) : item.remainingQuantity === 0 ? (
                      <span className="text-emerald-600 font-bold">تکمیل ✓</span>
                    ) : (
                      <span className="text-[#637184]">
                        {toPersianDigits(item.remainingQuantity)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Amendments List (if any) */}
        {(project.planAmendments || []).length > 0 && (
          <div className="pt-2 border-t border-[#212835] space-y-2">
            <div className="text-xs font-bold text-[#637184]">سوابق اصلاحیه‌های طرح:</div>
            {(project.planAmendments || []).map((am) => (
              <div key={am.id} className="rounded-md bg-white dark:bg-[#1E1E1E] p-2.5 border border-[#E2DDD4] dark:border-[#333] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {am.activityTitle}: {toPersianDigits(am.previousQuantity)} ← {toPersianDigits(am.newQuantity)}
                  </span>
                  <Badge variant={am.status === 'APPROVED' ? 'gold' : am.status === 'REJECTED' ? 'danger' : 'default'}>
                    {am.status === 'APPROVED' ? 'تایید شده' : am.status === 'REJECTED' ? 'رد شده' : 'در انتظار بررسی QC'}
                  </Badge>
                </div>
                <div className="text-[11px] text-[#637184]">
                  علت: {am.reason} ({getDisplayName(am.requestedByUserName)} در {formatJalaliDateTime(am.requestedAt)})
                </div>
                {am.status === 'PENDING' && isQcManager && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => handleReviewAmendment(am.id, 'APPROVED')} disabled={busy}>
                      تایید اصلاحیه
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleReviewAmendment(am.id, 'REJECTED')} disabled={busy}>
                      رد اصلاحیه
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Transfer History (Phase P2.2) */}
      {(project.teamTransfers || []).length > 0 && (
        <div className={sectionCls}>
          <div className="flex items-center gap-2 font-bold text-sm">
            <ArrowRightLeft className="w-4 h-4 text-[#C5A059]" /> سابقه انتقال بین اکیپ‌ها (فاز P2.2)
          </div>
          <div className="space-y-2">
            {(project.teamTransfers || []).map((trf) => (
              <div
                key={trf.id}
                className="rounded-md bg-white dark:bg-[#1E1E1E] p-3 border border-[#E2DDD4] dark:border-[#333] text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#F0F4F8]">
                    از «{trf.fromTeamName}» ← به «{trf.toTeamName}»
                  </span>
                  <Badge variant={trf.receivingLeadConfirmed ? 'gold' : 'default'}>
                    {trf.receivingLeadConfirmed ? 'تایید سرپرست مقصد ✓' : 'در انتظار تایید تحویل'}
                  </Badge>
                </div>
                <div className="text-[#637184]">
                  علت: {trf.reason} (توسط {getDisplayName(trf.transferredByUserName)} در {formatJalaliDateTime(trf.transferredAt)})
                </div>
                {trf.notes && (
                  <div className="text-[#637184] text-[11px]">
                    یادداشت فنی: {trf.notes}
                  </div>
                )}
                {trf.handoverInventory && trf.handoverInventory.length > 0 && (
                  <div className="text-[11px] text-[#8A8378] pt-1 border-t border-dashed border-[#212835]">
                    صورت‌جلسه اقلام تحویلی: {trf.handoverInventory.map((i) => `${i.activityTitle} (${toPersianDigits(i.remainingQuantity)} ${i.unit})`).join('، ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const statusTab = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#637184]">وضعیت فعلی:</span>
        <StatusPill status={project.status} size="md" />
        <StatusPill status={project.status} qcStatus={project.qcStatus} size="md" />
      </div>

      {reasonBox(false)}

      {canRevertOneStep(project) && (
        <div className={sectionCls}>
          <div className="flex items-center gap-2 font-bold text-sm">
            <Undo2 className="w-4 h-4 text-[#C5A059]" /> برگرداندن به مرحله قبل
          </div>
          <p className="text-xs text-[#637184]">{revert.description}</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(
                { status: revert.nextStatus, ...revert.extraPatch },
                `وضعیت به «${getStatusPersianLabel(revert.nextStatus)}» برگشت.`,
                revert.description
              )
            }
          >
            یک مرحله به عقب
          </Button>
        </div>
      )}

      <div className={sectionCls}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <RotateCcw className="w-4 h-4 text-[#C5A059]" /> بازنشانی کامل به «برنامه‌ریزی‌شده»
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="reset-mode"
              className="mt-1 accent-[#C1A056]"
              checked={resetMode === 'KEEP_DOCS'}
              onChange={() => setResetMode('KEEP_DOCS')}
            />
            <span>نگه داشتن گزارش و عکس‌های اجرا</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="reset-mode"
              className="mt-1 accent-rose-600"
              checked={resetMode === 'CLEAR_ALL'}
              onChange={() => setResetMode('CLEAR_ALL')}
            />
            <span>پاک کردن گزارش، عکس‌ها، امضا، چک‌لیست و زمان‌ها</span>
          </label>
        </div>
        {!confirmReset ? (
          <Button variant={resetMode === 'CLEAR_ALL' ? 'danger' : 'secondary'} disabled={busy} onClick={() => setConfirmReset(true)}>
            بازنشانی کامل
          </Button>
        ) : (
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3 space-y-2">
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
              {resetMode === 'CLEAR_ALL'
                ? 'همه‌ی گزارش‌ها، عکس‌ها، امضا و زمان‌های کار این پروژه پاک می‌شود. مطمئنید؟'
                : 'پروژه به «برنامه‌ریزی‌شده» برمی‌گردد و از صف QC خارج می‌شود. مطمئنید؟'}
            </p>
            {!reasonOk && <p className="text-[11px] text-rose-700 dark:text-rose-300">برای بازنشانی، دلیل تغییر را بنویسید.</p>}
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={busy || !reasonOk}
                onClick={() =>
                  run(
                    getFullResetPatch(project, resetMode, reasonTrim) as unknown as Record<string, unknown>,
                    'پروژه به «برنامه‌ریزی‌شده» بازنشانی شد.',
                    reasonTrim
                  )
                }
              >
                بله، بازنشانی کن
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                انصراف
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Team Transfer Section (Phase P2.2) */}
      {canTransferProjectTeam(currentUser) && (
        <div className={sectionCls}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ArrowRightLeft className="w-4 h-4 text-[#C5A059]" /> انتقال رسمی به اکیپ دیگر (فاز P2.2)
            </div>
            <Button
              variant={showTransferForm ? 'ghost' : 'secondary'}
              size="sm"
              icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
              onClick={() => setShowTransferForm((v) => !v)}
            >
              {showTransferForm ? 'بستن فرم' : 'انتقال اکیپ'}
            </Button>
          </div>

          <p className="text-xs text-[#637184]">
            اکیپ جاری: <span className="font-bold text-[#F0F4F8]">{project.assignedTeamName || 'بدون اکیپ'}</span>
          </p>

          {showTransferForm && (
            <div className="rounded-md border border-[#C5A059]/40 bg-[#111620] p-3 space-y-3">
              <div className="text-xs font-bold text-[#F0F4F8]">
                انتقال رسمی پروژه و صورت‌جلسه تحویل اقلام باقیمانده (فاز P2.2)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="space-y-1">
                  <span className="font-bold">انتخاب اکیپ مقصد: <span className="text-rose-500">*</span></span>
                  <select
                    className={inputCls}
                    value={targetTeamId}
                    onChange={(e) => setTargetTeamId(e.target.value)}
                  >
                    <option value="">-- انتخاب اکیپ مقصد --</option>
                    {teams
                      .filter((t) => t.id !== project.assignedTeamId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-bold">تاریخ جدید اعزام (اختیاری):</span>
                  <select
                    className={inputCls}
                    value={transferNewDate}
                    onChange={(e) => setTransferNewDate(e.target.value)}
                  >
                    <option value="">بدون تغییر ({formatJalali(project.scheduledDate, 'تعیین‌نشده')})</option>
                    {getUpcomingDays(120).map((d) => (
                      <option key={d.dateKey} value={d.dateKey}>
                        {d.isToday ? 'امروز' : d.dayOffset === 1 ? 'فردا' : d.persianDayName} - {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-xs block">
                <span className="font-bold">علت رسمی انتقال اکیپ: <span className="text-rose-500">*</span></span>
                <input
                  type="text"
                  className={inputCls}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="مثال: توقف کار اکیپ ۱ ناشی از تداخل برنامه، اعزام اکیپ ۲ برای تکمیل شیدها"
                />
              </label>

              <label className="space-y-1 text-xs block">
                <span className="font-bold">یادداشت فنی تحویل کار (اختیاری):</span>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="نکات فنی برای سرپرست جدید..."
                />
              </label>

              {/* Preview of remaining inventory */}
              <div className="rounded-lg bg-white dark:bg-[#161616] p-2.5 border border-[#212835] text-xs space-y-1.5">
                <div className="font-bold text-[#637184]">
                  صورت‌جلسه اقلام باقیمانده کار تحویلی به اکیپ جدید:
                </div>
                <div className="space-y-1">
                  {calculateActivityProgress(project).map((act) => (
                    <div key={act.activityId} className="flex justify-between text-[11px]">
                      <span>{act.title}:</span>
                      <span className="font-bold text-[#C5A059]">
                        {toPersianDigits(Math.max(0, act.remainingQuantity))} {act.unit} باقیمانده
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !targetTeamId || !transferReason.trim()}
                  onClick={handleExecuteTeamTransfer}
                >
                  ثبت انتقال رسمی و ایجاد صورت‌جلسه
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowTransferForm(false);
                    setTargetTeamId('');
                    setTransferReason('');
                    setTransferNewDate('');
                    setTransferNotes('');
                  }}
                >
                  انصراف
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={sectionCls}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-[#C5A059]" /> کنترل کیفی (QC)
        </div>
        {project.isExceptionalCompletion && project.exceptionalCompletionDetails && (
          <div className="p-3 bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 rounded-md text-xs space-y-1 text-rose-800 dark:text-rose-200">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>پروژه دارای اعلام «اتمام استثنایی با کسری اقلام» است</span>
            </div>
            <p className="text-[11px] text-[#9BA7B6]">
              دلیل تکنسین: «{project.exceptionalCompletionDetails.documentedReason}»
            </p>
            <div className="text-[11px] text-[#637184] pt-0.5">
              اقلام کسری: {project.exceptionalCompletionDetails.remainingActivities.map(a => `${a.title} (${toPersianDigits(a.remainingQuantity)} ${a.unit})`).join('، ')}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {project.qcStatus === 'APPROVED' ? (
            <Button
              variant="secondary"
              icon={<ShieldOff className="w-4 h-4" />}
              disabled={busy}
              onClick={() =>
                run(
                  { qcStatus: 'PENDING', qcReviewedAt: null, qcReviewedBy: null },
                  'تایید QC لغو شد و پروژه دوباره در صف بررسی است.',
                  'لغو تایید QC'
                )
              }
            >
              لغو تایید QC
            </Button>
          ) : (
            <Button
              icon={<ShieldCheck className="w-4 h-4" />}
              disabled={busy || project.status !== 'COMPLETED'}
              onClick={() =>
                run(
                  {
                    qcStatus: 'APPROVED',
                    qcReviewedAt: new Date().toISOString(),
                    qcReviewedBy: getDisplayName(currentUser.name) || 'مسئول QC',
                  },
                  'پروژه تایید QC شد.',
                  'تایید QC توسط مدیر'
                )
              }
            >
              تایید QC
            </Button>
          )}
        </div>
        {project.status !== 'COMPLETED' && project.qcStatus !== 'APPROVED' && (
          <p className="text-[11px] text-[#8A8378]">تایید QC فقط برای پروژه‌ی «اتمام کار» فعال است. برای امتیازدهی از «میز QC» استفاده کنید.</p>
        )}
      </div>

      <details className={sectionCls}>
        <summary className="cursor-pointer font-bold text-sm select-none">تغییر دستی وضعیت (پیشرفته)</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <label className="space-y-1 text-xs font-bold">
            <span>وضعیت پروژه</span>
            <select className={inputCls} value={manualStatus} onChange={(e) => setManualStatus(e.target.value as ProjectStatus)}>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{getStatusPersianLabel(s)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold">
            <span>وضعیت QC</span>
            <select className={inputCls} value={manualQc} onChange={(e) => setManualQc(e.target.value as QCStatus)}>
              {ALL_QC.map((s) => (
                <option key={s} value={s}>{getQcStatusPersianLabel(s)}</option>
              ))}
            </select>
          </label>
        </div>
        {!reasonOk && <p className="text-[11px] text-[#8A8378]">برای تغییر دستی، دلیل تغییر را بنویسید.</p>}
        <Button
          variant="secondary"
          disabled={busy || !reasonOk || (manualStatus === project.status && manualQc === project.qcStatus)}
          onClick={() =>
            run({ status: manualStatus, qcStatus: manualQc }, 'وضعیت پروژه تغییر کرد.', reasonTrim)
          }
        >
          اعمال وضعیت
        </Button>
      </details>
    </div>
  );

  const removePhoto = (field: PhotoField, idx: number) => {
    const list = [...((project[field] as string[] | undefined) || [])];
    list.splice(idx, 1);
    void run({ [field]: list }, 'عکس حذف شد.', 'حذف عکس توسط مدیر');
  };

  const photoGroup = (field: PhotoField, title: string) => {
    const list = (project[field] as string[] | undefined) || [];
    if (list.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="text-xs font-bold text-[#637184]">
          {title} ({toPersianDigits(list.length)})
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {list.map((src, i) => (
            <div key={`${field}-${i}`} className="relative aspect-square rounded-md overflow-hidden bg-[#EFEBE4] dark:bg-[#222]">
              <CloudImage src={src} alt={title} className="w-full h-full object-cover" />
              <button
                type="button"
                aria-label="حذف عکس"
                disabled={busy}
                onClick={() => removePhoto(field, i)}
                className="absolute top-1 left-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-rose-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const docsTab = (
    <div className="space-y-4">
      <div className={sectionCls}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <Clock className="w-4 h-4 text-[#C5A059]" /> زمان کار
        </div>
        <p className="text-sm">{work && work.totalSeconds > 0 ? work.text : 'هنوز زمانی ثبت نشده است.'}</p>
        {(project.workSessions || []).length > 0 && (
          <ul className="text-xs space-y-1 text-[#637184]">
            {(project.workSessions || []).map((s, i) => (
              <li key={i}>
                {formatJalali(s.date)} — {getDisplayName(s.byUserName)}: {formatJalaliDateTime(s.startedAt)} تا{' '}
                {s.endedAt ? formatJalaliDateTime(s.endedAt) : 'در حال انجام'}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(project.dailyLogs || []).length > 0 && (
        <div className={sectionCls}>
          <div className="flex items-center gap-2 font-bold text-sm">
            <CalendarRange className="w-4 h-4 text-[#C5A059]" /> گزارش‌های روزانه
          </div>
          {(project.dailyLogs || []).map((log) => (
            <div key={log.id} className="rounded-md bg-white dark:bg-[#1C1C1C] border border-[#212835] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">
                  {formatJalali(log.date)} — {getDisplayName(log.byUserName)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      { dailyLogs: (project.dailyLogs || []).filter((l) => l.id !== log.id) },
                      'گزارش روزانه حذف شد.',
                      'حذف گزارش روزانه توسط مدیر'
                    )
                  }
                  className="text-xs text-rose-600 hover:underline min-h-[32px] px-2"
                >
                  حذف
                </button>
              </div>
              {log.activityProgress && log.activityProgress.length > 0 && (
                <div className="bg-[#FAF7F2] dark:bg-[#141414] rounded-lg p-2.5 border border-[#E2DDD4]/60 dark:border-[#282828] space-y-1.5">
                  <div className="text-[11px] font-bold text-[#637184]">پیشرفت کار ثبت‌شده در این شیفت:</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {log.activityProgress.map((ap) => (
                      <span key={ap.activityId} className="bg-white dark:bg-[#1E1E1E] px-2 py-0.5 rounded border border-[#E2DDD4] dark:border-[#333] font-mono font-bold text-[#181818] dark:text-zinc-200">
                        {ap.activityTitle}: {toPersianDigits(ap.completedQuantity)} {ap.unit}
                      </span>
                    ))}
                  </div>
                  {log.supervisorConfirmed && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> تایید شده توسط سرپرست ({getDisplayName(log.supervisorConfirmedBy)})
                    </div>
                  )}
                  {!log.supervisorConfirmed && (isQcManager || project.leadTechnicianId === currentUser.id) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const updatedLogs = (project.dailyLogs || []).map((l) =>
                            l.id === log.id
                              ? {
                                  ...l,
                                  supervisorConfirmed: true,
                                  supervisorConfirmedBy: getDisplayName(currentUser.name) || 'سرپرست اکیپ',
                                  supervisorConfirmedAt: new Date().toISOString(),
                                }
                              : l
                          );
                          await run({ dailyLogs: updatedLogs }, 'گزارش روزانه توسط سرپرست تایید شد.', 'تایید گزارش روزانه توسط سرپرست');
                        }}
                        className="text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 font-bold cursor-pointer"
                      >
                        ✓ تایید این گزارش توسط سرپرست
                      </button>
                    </div>
                  )}
                </div>
              )}
              {log.note && <p className="text-sm whitespace-pre-wrap">{log.note}</p>}
              {log.photos?.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {log.photos.map((src, i) => (
                    <CloudImage key={i} src={src} alt="عکس گزارش روزانه" className="w-full aspect-square object-cover rounded-lg" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={sectionCls}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <FileText className="w-4 h-4 text-[#C5A059]" /> گزارش اتمام کار
        </div>
        {project.isExceptionalCompletion && project.exceptionalCompletionDetails && (
          <div className="bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/40 rounded-md p-3 text-xs space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>اتمام استثنایی با کسری اقلام اجرایی (تحویل ناقص پروژه)</span>
            </div>
            <p className="text-xs text-[#F0F4F8] leading-relaxed">
              <span className="font-bold text-rose-600 block mb-0.5">علت مستند عدم اجرای اقلام باقیمانده:</span>
              «{project.exceptionalCompletionDetails.documentedReason}»
            </p>
            <div className="pt-1 text-[11px] text-[#637184]">
              اقلام اجرا‌نشده: {project.exceptionalCompletionDetails.remainingActivities.map(a => `${a.title} (${toPersianDigits(a.remainingQuantity)} ${a.unit})`).join('، ')}
            </div>
          </div>
        )}
        <textarea rows={3} className={inputCls} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="یادداشت اتمام کار" />
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || notesDraft === (project.completionNotes || '')}
          onClick={() => run({ completionNotes: notesDraft.trim() || null }, 'گزارش اتمام کار ذخیره شد.', 'ویرایش گزارش اتمام کار')}
        >
          ذخیره‌ی گزارش
        </Button>
        {photoGroup('beforePhotos', 'عکس‌های قبل از نصب')}
        {photoGroup('afterPhotos', 'عکس‌های بعد از نصب')}
        {photoGroup('completionPhotos', 'عکس‌های اتمام کار')}
        {project.customerSignature && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#637184]">امضای مشتری</div>
            <CloudImage src={project.customerSignature} alt="امضای مشتری" className="h-20 bg-white rounded-lg border border-[#E2DDD4] p-1" />
          </div>
        )}
        {typeof project.customerSatisfaction === 'number' && (
          <Row label="رضایت مشتری">{toPersianDigits(project.customerSatisfaction)} از ۵</Row>
        )}
      </div>

      {project.status === 'COMPLETED' && (
        <Button variant="secondary" icon={<Award className="w-4 h-4" />} onClick={() => onOpenCertificate(project)}>
          گواهی تحویل
        </Button>
      )}
    </div>
  );

  const historyTab = (
    <div className="space-y-3">
      {!isOnline && (
        <p className="text-xs text-amber-700 dark:text-amber-300">برای دیدن تاریخچه باید آنلاین باشید.</p>
      )}
      {auditLoading && (
        <div className="flex items-center gap-2 text-sm text-[#6B6459]">
          <Loader2 className="w-4 h-4 animate-spin" /> در حال دریافت تاریخچه…
        </div>
      )}
      {!auditLoading && audit && audit.length === 0 && (
        <p className="text-sm text-[#637184]">
          هنوز تغییری ثبت نشده است. (تاریخچه از زمان اجرای مایگریشن ۰۰۸ ثبت می‌شود.)
        </p>
      )}
      {!auditLoading && audit && audit.length > 0 && (
        <ol className="relative border-r-2 border-[#E2DDD4] dark:border-[#333] pr-4 space-y-4">
          {audit.map((rec) => (
            <li key={rec.id} className="relative">
              <span className="absolute -right-[23px] top-1.5 w-3 h-3 rounded-full bg-[#C1A056] ring-4 ring-white dark:ring-[#1C1C1C]" />
              <div className="text-xs text-[#637184]">
                {formatJalaliDateTime(rec.changed_at)} — <span className="font-bold">{getDisplayName(rec.changed_by_name || undefined) || 'سیستم'}</span>
              </div>
              <ul className="mt-1 text-sm list-disc pr-4 space-y-0.5">
                {formatAuditDiff(rec.old_data, rec.new_data, rec.action).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              {rec.reason && (
                <div className="mt-1 text-xs rounded-lg bg-[#FAF3E3] dark:bg-[#2A2418] text-[#7A5F22] dark:text-[#E3C77F] px-2 py-1 inline-block">
                  دلیل: {rec.reason}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <Button variant="ghost" size="sm" onClick={() => void loadAudit()} disabled={auditLoading}>
        به‌روزرسانی تاریخچه
      </Button>
    </div>
  );

  const deletePanel = (
    <div className="rounded-lg border-2 border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
        <AlertTriangle className="w-5 h-5" /> حذف کامل پروژه — قابل برگشت نیست
      </div>
      <p className="text-xs text-rose-800 dark:text-rose-300">
        برای تایید، کد پروژه <span className="font-black" dir="ltr">{project.code}</span> را تایپ کنید.
      </p>
      <input
        dir="ltr"
        value={deleteCode}
        onChange={(e) => setDeleteCode(e.target.value)}
        placeholder={project.code}
        className={inputCls}
        aria-label="کد پروژه برای تایید حذف"
      />
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" className="mt-1 accent-rose-600" checked={deleteAll} onChange={(e) => setDeleteAll(e.target.checked)} />
        <span>
          حذف تیکت‌ها و عکس‌های این پروژه
          {projectTickets.length > 0 && <Badge variant="danger" className="mr-1">{toPersianDigits(projectTickets.length)} تیکت</Badge>}
        </span>
      </label>
      {reasonBox(true)}
      <div className="flex gap-2">
        <Button
          variant="danger"
          icon={<Trash2 className="w-4 h-4" />}
          disabled={busy || !reasonOk || !isDeleteCodeConfirmed(deleteCode, project.code)}
          onClick={async () => {
            if (!onDeleteProject) return;
            setBusy(true);
            try {
              await onDeleteProject(project.id, { reason: reasonTrim, deleteTicketsAndFiles: deleteAll });
            } finally {
              setBusy(false);
            }
          }}
        >
          حذف همیشگی
        </Button>
        <Button variant="ghost" onClick={() => setShowDelete(false)}>
          انصراف
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title="مدیریت کامل پروژه"
      subtitle={`${project.code} — ${project.title}`}
      size="xl"
      footer={
        showDelete ? undefined : (
          <div className="flex items-center justify-between gap-2 w-full">
            {onDeleteProject && (
              <Button variant="ghost" className="text-rose-600" icon={<Trash2 className="w-4 h-4" />} onClick={() => { setShowDelete(true); setReason(''); }}>
                حذف کامل پروژه
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} className={!onDeleteProject ? 'mr-auto' : undefined}>
              بستن
            </Button>
          </div>
        )
      }
    >
      {showDelete ? (
        deletePanel
      ) : (
        <div className="space-y-4">
          <SegmentedControl<TabId>
            ariaLabel="بخش‌های مدیریت پروژه"
            value={tab}
            onChange={setTab}
            className="w-full"
            options={[
              { value: 'info', label: 'اطلاعات', icon: <Info className="w-4 h-4" /> },
              { value: 'status', label: 'وضعیت و QC', icon: <Activity className="w-4 h-4" /> },
              { value: 'docs', label: 'گزارش و مدارک', icon: <FileText className="w-4 h-4" /> },
              { value: 'history', label: 'تاریخچه', icon: <History className="w-4 h-4" /> },
            ]}
          />
          {busy && (
            <div className="flex items-center gap-2 text-xs text-[#6B6459]">
              <Loader2 className="w-4 h-4 animate-spin" /> در حال ثبت…
            </div>
          )}
          {tab === 'info' && infoTab}
          {tab === 'status' && statusTab}
          {tab === 'docs' && docsTab}
          {tab === 'history' && historyTab}
        </div>
      )}
    </Sheet>
  );
};

export default ProjectManagerSheet;
