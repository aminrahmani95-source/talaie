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
} from 'lucide-react';
import { Project, ProjectAuditRecord, ProjectStatus, QCStatus, Ticket, User } from '../../types';
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
import { formatJalali, formatJalaliDateTime, toPersianDigits } from '../../utils/jalali';
import { calculateWorkSessionsSummary, getMultiDayTotalDays, isProjectMultiDay } from '../../utils/multiDay';
import { getDisplayName } from '../../utils/technicianName';

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
  currentUser: User;
  isOnline: boolean;
  onClose: () => void;
  onEditInfo: (project: Project) => void;
  /** Applies a manager patch. `_auditReason` (if any) is recorded in the history and never stored on the project. */
  onApplyPatch: (projectId: string, patch: Record<string, unknown>, successMessage: string) => Promise<void>;
  onDeleteProject: (projectId: string, options: { reason: string; deleteTicketsAndFiles: boolean }) => Promise<void>;
  onOpenCertificate: (project: Project) => void;
  onViewProposal: (project: Project) => void;
  fetchAudit: (projectId: string) => Promise<ProjectAuditRecord[]>;
}

const sectionCls =
  'rounded-2xl border border-[#E2DDD4] dark:border-[#333333] bg-[#FAF8F5] dark:bg-[#161616] p-4 space-y-3';
const inputCls =
  'w-full rounded-xl border border-[#E2DDD4] dark:border-[#333333] bg-white dark:bg-[#121212] px-3 py-2.5 text-sm text-[#181818] dark:text-[#F5F3EF] focus:outline-none focus:ring-2 focus:ring-[#C1A056]';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-dashed border-[#E2DDD4] dark:border-[#2A2A2A] last:border-0">
    <span className="text-[#6B6459] dark:text-[#A39E93] shrink-0">{label}</span>
    <span className="font-bold text-[#181818] dark:text-[#F5F3EF] text-left break-words min-w-0">{children}</span>
  </div>
);

export const ProjectManagerSheet: React.FC<ProjectManagerSheetProps> = ({
  project,
  users,
  tickets,
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

  const reasonBox = (required: boolean) => (
    <div className="space-y-1.5">
      <label htmlFor="pm-reason" className="block text-xs font-bold text-[#181818] dark:text-[#F5F3EF]">
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
    </div>
  );

  const statusTab = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#6B6459] dark:text-[#A39E93]">وضعیت فعلی:</span>
        <StatusPill status={project.status} size="md" />
        <StatusPill status={project.status} qcStatus={project.qcStatus} size="md" />
      </div>

      {reasonBox(false)}

      {canRevertOneStep(project) && (
        <div className={sectionCls}>
          <div className="flex items-center gap-2 font-bold text-sm">
            <Undo2 className="w-4 h-4 text-[#C1A056]" /> برگرداندن به مرحله قبل
          </div>
          <p className="text-xs text-[#6B6459] dark:text-[#A39E93]">{revert.description}</p>
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
          <RotateCcw className="w-4 h-4 text-[#C1A056]" /> بازنشانی کامل به «برنامه‌ریزی‌شده»
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
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3 space-y-2">
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

      <div className={sectionCls}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-[#C1A056]" /> کنترل کیفی (QC)
        </div>
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
        <div className="text-xs font-bold text-[#6B6459] dark:text-[#A39E93]">
          {title} ({toPersianDigits(list.length)})
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {list.map((src, i) => (
            <div key={`${field}-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-[#EFEBE4] dark:bg-[#222]">
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
          <Clock className="w-4 h-4 text-[#C1A056]" /> زمان کار
        </div>
        <p className="text-sm">{work && work.totalSeconds > 0 ? work.text : 'هنوز زمانی ثبت نشده است.'}</p>
        {(project.workSessions || []).length > 0 && (
          <ul className="text-xs space-y-1 text-[#6B6459] dark:text-[#A39E93]">
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
            <CalendarRange className="w-4 h-4 text-[#C1A056]" /> گزارش‌های روزانه
          </div>
          {(project.dailyLogs || []).map((log) => (
            <div key={log.id} className="rounded-xl bg-white dark:bg-[#1C1C1C] border border-[#E2DDD4] dark:border-[#2A2A2A] p-3 space-y-2">
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
          <FileText className="w-4 h-4 text-[#C1A056]" /> گزارش اتمام کار
        </div>
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
            <div className="text-xs font-bold text-[#6B6459] dark:text-[#A39E93]">امضای مشتری</div>
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
        <p className="text-sm text-[#6B6459] dark:text-[#A39E93]">
          هنوز تغییری ثبت نشده است. (تاریخچه از زمان اجرای مایگریشن ۰۰۸ ثبت می‌شود.)
        </p>
      )}
      {!auditLoading && audit && audit.length > 0 && (
        <ol className="relative border-r-2 border-[#E2DDD4] dark:border-[#333] pr-4 space-y-4">
          {audit.map((rec) => (
            <li key={rec.id} className="relative">
              <span className="absolute -right-[23px] top-1.5 w-3 h-3 rounded-full bg-[#C1A056] ring-4 ring-white dark:ring-[#1C1C1C]" />
              <div className="text-xs text-[#6B6459] dark:text-[#A39E93]">
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
    <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 space-y-3">
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
            <Button variant="ghost" className="text-rose-600" icon={<Trash2 className="w-4 h-4" />} onClick={() => { setShowDelete(true); setReason(''); }}>
              حذف کامل پروژه
            </Button>
            <Button variant="secondary" onClick={onClose}>
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
