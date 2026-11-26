import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Eye,
  Layers,
  Loader2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import type { MaterialRequest, Project, User, WarehouseCounts } from '../../types';
import { Sheet } from '../ui/Sheet';
import { CloudImage } from '../common/CloudImage';
import { WarehouseStageBadge } from './WarehouseStageBadge';
import { formatJalali, formatJalaliDateTime, toPersianDigits } from '../../utils/jalali';
import { formatProductCounts, projectProductCounts } from '../../utils/productCounts';
import { relativeDayLabel } from '../../utils/warehouseLists';
import { getDisplayName } from '../../utils/technicianName';
import {
  countsChangedSincePacking,
  countsChangedSinceReceipt,
  diffCounts,
  formatCountDiffs,
  getWarehouseStage,
  isGoodsInWarehouse,
  PRODUCT_KEYS,
  receiptShortages,
  WarehouseAction,
} from '../../utils/warehouseStatus';
import { MATERIAL_STATUS_LABELS } from '../../utils/materialRequests';

export type WarehouseFlowView = 'DETAILS' | 'RECEIPT' | 'PACK' | 'HAND_OVER' | 'REVOKE';

export interface WarehouseFlowState {
  projectId: string;
  view: WarehouseFlowView;
  /** بعد از بستن فرم، به برگه‌ی جزئیات برگردد */
  fromDetails?: boolean;
}

interface Props {
  state: WarehouseFlowState | null;
  onChange: (next: WarehouseFlowState | null) => void;
  projects: Project[];
  users?: User[];
  materialRequests?: MaterialRequest[];
  todayKey: string;
  onAction?: (projectId: string, action: WarehouseAction) => Promise<void>;
  onViewProposal?: (project: Project) => void;
  onOpenTicketModal?: (project: Project) => void;
}

const sectionCls = 'bg-sunken border border-line rounded-lg p-3 space-y-2';
const sectionTitleCls = 'text-xs font-black text-ink-2 flex items-center gap-1.5';
const inputCls =
  'w-full text-sm p-2.5 rounded-lg border border-line bg-canvas text-ink placeholder-ink-3 focus:border-brand focus:outline-none min-h-[44px]';

const CountStepper: React.FC<{
  label: string;
  expected: number;
  value: number;
  onChange: (n: number) => void;
}> = ({ label, expected, value, onChange }) => {
  const diff = value - expected;
  return (
    <div
      className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
        diff < 0 ? 'border-rose-500/50 bg-rose-500/5' : diff > 0 ? 'border-amber-500/50 bg-amber-500/5' : 'border-line bg-canvas'
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-black text-ink">{label}</div>
        <div className="text-[12px] text-ink-3">
          سفارش: <span className="tabular-nums font-bold">{toPersianDigits(expected)}</span>
          {diff < 0 && <span className="text-rose-600 dark:text-rose-300 font-bold"> · {toPersianDigits(-diff)} کم</span>}
          {diff > 0 && <span className="text-amber-700 dark:text-amber-300 font-bold"> · {toPersianDigits(diff)} اضافه</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0" dir="ltr">
        <button
          type="button"
          aria-label={`کم کردن ${label}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-10 h-10 rounded-lg border border-line bg-surface text-ink flex items-center justify-center cursor-pointer active:scale-95"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          aria-label={`تعداد ${label} رسیده`}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-14 h-10 text-center rounded-lg border border-line bg-canvas text-ink font-black tabular-nums"
        />
        <button
          type="button"
          aria-label={`زیاد کردن ${label}`}
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 rounded-lg border border-line bg-surface text-ink flex items-center justify-center cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const CheckRow: React.FC<{ checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }> = ({
  checked,
  onChange,
  children,
}) => (
  <label
    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer min-h-[44px] ${
      checked ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-line bg-canvas'
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 w-5 h-5 rounded accent-brand shrink-0"
    />
    <span className="text-sm text-ink leading-6">{children}</span>
  </label>
);

/** خلاصه‌ی ابزار پروژه برای انبار */
function toolsSummary(p: Project): { main: string; extras: string[] } {
  const extras = [...(p.specialTools || [])];
  if (p.customToolsNotes?.trim()) extras.push(p.customToolsNotes.trim());
  if (p.isFullTools || !p.toolsRequired?.length) return { main: 'فول ابزار', extras };
  return { main: p.toolsRequired.join('، '), extras };
}

export const WarehouseProjectFlow: React.FC<Props> = ({
  state,
  onChange,
  projects,
  users = [],
  materialRequests = [],
  todayKey,
  onAction,
  onViewProposal,
  onOpenTicketModal,
}) => {
  // همیشه نسخه‌ی زنده‌ی پروژه: اگر مدیر یا سرپرست همزمان چیزی را عوض کند، برگه همان لحظه به‌روز می‌شود
  const project = state ? projects.find((p) => p.id === state.projectId) || null : null;
  const view = state?.view;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // فرم ورود کالا
  const [received, setReceived] = useState<WarehouseCounts>({ shade: 0, rail: 0, curtain: 0 });
  const [goodsHealthy, setGoodsHealthy] = useState(false);
  const [shelf, setShelf] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');

  // فرم بستن بار
  const [packChecks, setPackChecks] = useState<Record<string, boolean>>({});
  const [toolsChecked, setToolsChecked] = useState(false);
  const [packNotes, setPackNotes] = useState('');

  // تحویل به اکیپ
  const [handToName, setHandToName] = useState('');

  const lead = project?.leadTechnicianId ? users.find((u) => u.id === project.leadTechnicianId) : undefined;
  const leadName = lead ? getDisplayName(lead.name) || lead.name : '';

  // هر بار که فرمی باز می‌شود، از روی داده‌ی فعلی پروژه پر شود
  const formKey = state ? `${state.projectId}:${state.view}` : '';
  useEffect(() => {
    if (!project || !view) return;
    setError('');
    setBusy(false);
    const expected = projectProductCounts(project);
    if (view === 'RECEIPT') {
      const wc = project.technicalHandover?.warehouseConfirmation;
      setReceived(wc?.receivedCounts ? { ...wc.receivedCounts } : expected);
      setGoodsHealthy(Boolean(wc?.confirmed));
      setShelf(wc?.shelfLocation || '');
      setReceiptNotes(wc?.notes || '');
    } else if (view === 'PACK') {
      setPackChecks({});
      setToolsChecked(false);
      setPackNotes(project.warehousePrep?.notes || '');
    } else if (view === 'HAND_OVER') {
      setHandToName(leadName || project.assignedTeamName || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const close = () => {
    if (state && state.view !== 'DETAILS' && state.fromDetails) {
      onChange({ projectId: state.projectId, view: 'DETAILS' });
    } else {
      onChange(null);
    }
  };
  const goTo = (v: WarehouseFlowView) => state && onChange({ projectId: state.projectId, view: v, fromDetails: true });

  const run = async (action: WarehouseAction) => {
    if (!project || !onAction) return;
    setBusy(true);
    setError('');
    try {
      await onAction(project.id, action);
      close();
    } catch (err: any) {
      setError(err?.message || 'ثبت نشد. دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  };

  const projectMaterials = useMemo(
    () =>
      project
        ? materialRequests
            .filter((r) => r.projectId === project.id)
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        : [],
    [materialRequests, project]
  );

  if (!state || !project) return null;

  const expected = projectProductCounts(project);
  const productRows = PRODUCT_KEYS.filter(({ key }) => expected[key] > 0);
  const stage = getWarehouseStage(project);
  const day = relativeDayLabel(project.scheduledDate, todayKey);
  const wc = project.technicalHandover?.warehouseConfirmation;
  const prep = project.warehousePrep;
  const shortages = receiptShortages(project);
  const changedAfterReceipt = countsChangedSinceReceipt(project);
  const changedAfterPack = countsChangedSincePacking(project);
  const tools = toolsSummary(project);
  const subtitle = [project.code, project.customerName && project.customerName !== project.title ? project.customerName : '']
    .filter(Boolean)
    .join(' · ');

  // ------------------------------------------------------------------ جزئیات
  if (view === 'DETAILS') {
    const footer = onAction ? (
      <div className="flex flex-wrap items-center gap-2">
        {(stage === 'AWAITING' || stage === 'PARTIAL') && (
          <button type="button" onClick={() => goTo('RECEIPT')} className={primaryBtn}>
            <ArrowDownToLine className="w-4 h-4" />
            <span>{stage === 'PARTIAL' ? 'تکمیل ورود کالا' : 'ثبت ورود کالا'}</span>
          </button>
        )}
        {stage === 'IN_STOCK' && (
          <>
            <button type="button" onClick={() => goTo('PACK')} className={primaryBtn}>
              <Package className="w-4 h-4" />
              <span>بستن بار</span>
            </button>
            {wc?.confirmed && (
              <button type="button" onClick={() => goTo('RECEIPT')} className={secondaryBtn}>
                ویرایش رسید
              </button>
            )}
          </>
        )}
        {stage === 'PACKED' && (
          <>
            <button type="button" onClick={() => goTo('HAND_OVER')} className={primaryBtn}>
              <Truck className="w-4 h-4" />
              <span>تحویل بار به اکیپ</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('بار باز شود؟ پروژه به «کالا در انبار» برمی‌گردد و باید دوباره بسته شود.')) {
                  void run({ kind: 'UNPACK' });
                }
              }}
              className={secondaryBtn}
            >
              باز کردن بار
            </button>
          </>
        )}
        {onOpenTicketModal && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onOpenTicketModal(project);
            }}
            className={`${secondaryBtn} text-rose-600 dark:text-rose-300 border-rose-500/40`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>گزارش نقص</span>
          </button>
        )}
      </div>
    ) : undefined;

    return (
      <Sheet isOpen onClose={() => onChange(null)} title={project.title} subtitle={subtitle} size="lg" footer={footer}>
        <div className="space-y-3">
          {/* وضعیت و زمان */}
          <div className="flex flex-wrap items-center gap-2">
            <WarehouseStageBadge project={project} />
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-md border border-line bg-canvas text-ink-2">
              {project.scheduledDate
                ? `نصب ${day.text ? `${day.text} · ` : ''}${formatJalali(project.scheduledDate)}${
                    project.scheduledTime ? ` · ساعت ${toPersianDigits(project.scheduledTime)}` : ''
                  }`
                : 'تاریخ نصب تعیین نشده'}
            </span>
            {project.isForceMajeure && (
              <span className="text-[12px] font-bold px-2 py-0.5 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                فوری
              </span>
            )}
          </div>

          {error && <p className="text-xs text-rose-600 dark:text-rose-300 font-bold">{error}</p>}

          {(changedAfterReceipt.length > 0 || changedAfterPack.length > 0) && (
            <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-lg p-2.5 leading-6">
              <strong>تعداد سفارش بعد از ثبت انبار تغییر کرده:</strong>{' '}
              {formatCountDiffs(changedAfterPack.length ? changedAfterPack : changedAfterReceipt, 'change')}. بار را
              دوباره بشمارید{stage === 'PACKED' ? ' و در صورت نیاز باز و دوباره ببندید' : ''}.
            </div>
          )}

          {/* اقلام سفارش */}
          <section className={sectionCls}>
            <h4 className={sectionTitleCls}>
              <Layers className="w-4 h-4 text-brand-ink" />
              <span>اقلام سفارش</span>
            </h4>
            {productRows.length === 0 ? (
              <p className="text-xs text-ink-3">تعداد اقلام برای این پروژه ثبت نشده است.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {productRows.map(({ key, label }) => {
                  const got = wc?.receivedCounts?.[key];
                  const short = got !== undefined && got < expected[key];
                  return (
                    <div
                      key={key}
                      className={`rounded-lg border p-2.5 text-center ${
                        short ? 'border-rose-500/50 bg-rose-500/5' : 'border-line bg-canvas'
                      }`}
                    >
                      <div className="text-2xl font-black text-ink tabular-nums leading-none">
                        {toPersianDigits(expected[key])}
                      </div>
                      <div className="text-xs font-bold text-ink-2 mt-1">{label}</div>
                      {got !== undefined && (
                        <div
                          className={`text-[11px] mt-1 font-bold ${
                            short ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          رسیده: {toPersianDigits(got)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="text-xs text-ink-2 flex flex-wrap gap-x-3 gap-y-1">
              {project.mechanismType && <span>مکانیزم: <strong className="text-ink">{project.mechanismType}</strong></span>}
              {project.approximateArea ? <span>متراژ: <strong className="text-ink">{toPersianDigits(project.approximateArea)} متر</strong></span> : null}
              {project.salesRepName && <span>فروش: {project.salesRepName}</span>}
            </div>
            {project.specialNotes?.trim() && (
              <p className="text-xs text-ink bg-amber-500/10 border border-amber-500/30 rounded-md p-2 leading-6 whitespace-pre-line">
                <span className="font-bold">توضیحات سفارش: </span>
                {project.specialNotes}
              </p>
            )}
          </section>

          {/* پروپوزال */}
          <section className={sectionCls}>
            <div className="flex items-center justify-between gap-2">
              <h4 className={sectionTitleCls}>
                <Eye className="w-4 h-4 text-brand-ink" />
                <span>پروپوزال و نقشه ({toPersianDigits(project.proposalImages?.length || 0)})</span>
              </h4>
              {project.proposalImages?.length && onViewProposal ? (
                <button
                  type="button"
                  onClick={() => onViewProposal(project)}
                  className="text-xs font-bold text-brand-ink hover:underline cursor-pointer min-h-[36px] px-1"
                >
                  نمایش بزرگ
                </button>
              ) : null}
            </div>
            {project.proposalImages?.length ? (
              <div className="grid grid-cols-4 gap-2">
                {project.proposalImages.slice(0, 8).map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => onViewProposal?.(project)}
                    className="aspect-square rounded-md overflow-hidden border border-line bg-canvas cursor-pointer"
                    aria-label={img.title || 'پروپوزال'}
                  >
                    <CloudImage src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-3">پروپوزالی بارگذاری نشده است.</p>
            )}
          </section>

          {/* اکیپ و محل */}
          <section className={sectionCls}>
            <h4 className={sectionTitleCls}>
              <Users className="w-4 h-4 text-brand-ink" />
              <span>اکیپ و محل نصب</span>
            </h4>
            <div className="text-xs text-ink-2 space-y-1.5">
              <div>
                اکیپ: <strong className="text-ink">{project.assignedTeamName || 'تعیین نشده'}</strong>
                {leadName && <> · سرپرست: <strong className="text-ink">{leadName}</strong></>}
                {lead?.phone && (
                  <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-brand-ink font-bold mr-2" dir="ltr">
                    <Phone className="w-3 h-3" />
                    {lead.phone}
                  </a>
                )}
              </div>
              {project.address && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" />
                  <span>{project.address}</span>
                </div>
              )}
            </div>
          </section>

          {/* ابزار */}
          <section className={sectionCls}>
            <h4 className={sectionTitleCls}>
              <Wrench className="w-4 h-4 text-brand-ink" />
              <span>ابزار همراه بار</span>
            </h4>
            <p className="text-xs text-ink font-bold">{tools.main}</p>
            {tools.extras.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tools.extras.map((t, i) => (
                  <span key={i} className="text-[12px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-ink">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* سوابق انبار */}
          <section className={sectionCls}>
            <h4 className={sectionTitleCls}>
              <Package className="w-4 h-4 text-brand-ink" />
              <span>سوابق انبار</span>
            </h4>
            <ol className="space-y-2 text-xs">
              <TimelineItem
                done={Boolean(wc?.confirmed)}
                warn={Boolean(wc?.isPartial)}
                title={wc?.confirmed ? 'ورود کالا تأیید شد' : wc?.isPartial ? 'ورود ناقص ثبت شد' : 'ورود کالا: هنوز ثبت نشده'}
              >
                {(wc?.confirmed || wc?.isPartial) && (
                  <>
                    <div>
                      {wc?.confirmedBy || '—'} · {formatJalaliDateTime(wc?.confirmedAt)}
                      {wc?.manualEntry && ' · ثبت دستی در فرم مأموریت'}
                    </div>
                    {wc?.receivedCounts && <div>شمارش: {formatProductCounts(wc.receivedCounts) || '—'}</div>}
                    {shortages.length > 0 && (
                      <div className="text-rose-600 dark:text-rose-300 font-bold">
                        کسری: {formatCountDiffs(shortages, 'shortage')}
                        {wc?.shortageAccepted && ' (با کسری تأیید شد)'}
                      </div>
                    )}
                    {wc?.shelfLocation && <div>جای کالا: {wc.shelfLocation}</div>}
                    {wc?.notes && <div>یادداشت: {wc.notes}</div>}
                  </>
                )}
              </TimelineItem>
              <TimelineItem
                done={Boolean(prep?.isPackedAndReady || prep?.handedOverAt)}
                title={prep?.isPackedAndReady || prep?.packedAt ? 'بار بسته شد' : 'بستن بار: هنوز انجام نشده'}
              >
                {prep?.packedAt && (
                  <>
                    <div>
                      {prep.packedByUserName || '—'} · {formatJalaliDateTime(prep.packedAt)}
                    </div>
                    {prep.notes && <div>یادداشت: {prep.notes}</div>}
                  </>
                )}
              </TimelineItem>
              <TimelineItem
                done={Boolean(prep?.handedOverAt)}
                title={prep?.handedOverAt ? 'بار تحویل اکیپ شد' : 'تحویل به اکیپ: هنوز انجام نشده'}
              >
                {prep?.handedOverAt && (
                  <div>
                    {prep.handedOverToName ? `به ${prep.handedOverToName}` : ''}
                    {prep.handedOverVia === 'LEAD' ? ' (تأیید سرپرست)' : prep.handedOverByName ? ` · ثبت: ${prep.handedOverByName}` : ''} ·{' '}
                    {formatJalaliDateTime(prep.handedOverAt)}
                  </div>
                )}
              </TimelineItem>
            </ol>
          </section>

          {/* درخواست‌های متریال این پروژه */}
          {projectMaterials.length > 0 && (
            <section className={sectionCls}>
              <h4 className={sectionTitleCls}>
                <Truck className="w-4 h-4 text-brand-ink" />
                <span>درخواست‌های متریال این پروژه ({toPersianDigits(projectMaterials.length)})</span>
              </h4>
              <ul className="space-y-1.5">
                {projectMaterials.slice(0, 6).map((r) => (
                  <li key={r.id} className="text-xs bg-canvas border border-line rounded-md p-2 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink truncate">
                        {r.items.map((i) => `${i.title} (${toPersianDigits(i.requestedQty)})`).join('، ')}
                      </span>
                      <span className="text-[11px] text-ink-3 shrink-0">{formatJalali(r.createdAt)}</span>
                    </div>
                    <div className="text-[12px] text-ink-2">{MATERIAL_STATUS_LABELS[r.status]}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Sheet>
    );
  }

  // ------------------------------------------------------------------ ورود کالا
  if (view === 'RECEIPT') {
    const receiptDiffs = diffCounts(expected, received);
    const hasShortage = receiptDiffs.some((d) => d.actual < d.expected);
    const submit = (mode: 'FULL' | 'PARTIAL' | 'ACCEPT_SHORTAGE') => {
      if (mode !== 'PARTIAL' && !goodsHealthy) {
        setError('سالم بودن بسته‌بندی و اقلام را تأیید کنید. اگر خرابی هست «گزارش نقص» بزنید.');
        return;
      }
      if (mode === 'ACCEPT_SHORTAGE' && !receiptNotes.trim()) {
        setError('برای تأیید با کسری، در یادداشت بنویسید بقیه‌ی بار کی می‌رسد یا چه تصمیمی گرفته شد.');
        return;
      }
      void run({
        kind: 'RECEIPT',
        receivedCounts: productRows.length ? received : undefined,
        shelfLocation: shelf,
        notes: receiptNotes,
        partial: mode === 'PARTIAL',
        acceptShortage: mode === 'ACCEPT_SHORTAGE',
      });
    };

    return (
      <Sheet
        isOpen
        onClose={close}
        title="ثبت ورود کالا به انبار"
        subtitle={subtitle}
        size="md"
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {!hasShortage ? (
              <button type="button" disabled={busy} onClick={() => submit('FULL')} className={primaryBtn}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>تأیید ورود کامل کالا</span>
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => submit('PARTIAL')} className={primaryBtn}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                  <span>ثبت ورود ناقص (منتظر بقیه)</span>
                </button>
                <button type="button" disabled={busy} onClick={() => submit('ACCEPT_SHORTAGE')} className={secondaryBtn}>
                  تأیید با کسری
                </button>
              </>
            )}
            <button type="button" onClick={close} className={ghostBtn}>
              انصراف
            </button>
            {wc?.confirmed && (
              <button
                type="button"
                onClick={() => onChange({ projectId: project.id, view: 'REVOKE', fromDetails: state.fromDetails })}
                className={`${ghostBtn} text-rose-600 dark:text-rose-300 mr-auto`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>لغو ورود</span>
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          {changedAfterReceipt.length > 0 && (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-lg p-2.5">
              تعداد سفارش بعد از ثبت قبلی تغییر کرده ({formatCountDiffs(changedAfterReceipt, 'change')})؛ دوباره بشمارید.
            </p>
          )}
          {productRows.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-2">تعدادی که واقعاً رسیده را بشمارید:</p>
              {productRows.map(({ key, label }) => (
                <CountStepper
                  key={key}
                  label={label}
                  expected={expected[key]}
                  value={received[key]}
                  onChange={(n) => setReceived((prev) => ({ ...prev, [key]: n }))}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-3 bg-canvas border border-line rounded-lg p-2.5">
              تعداد اقلام در پروژه ثبت نشده؛ فقط سلامت بار را تأیید کنید.
            </p>
          )}

          <CheckRow checked={goodsHealthy} onChange={setGoodsHealthy}>
            بسته‌بندی، پارچه، پروفیل‌ها و موتورها سالم است و با سفارش می‌خواند.
          </CheckRow>

          <input
            type="text"
            value={shelf}
            onChange={(e) => setShelf(e.target.value)}
            placeholder="جای کالا در انبار (اختیاری)، مثلاً ردیف B قفسه ۴"
            aria-label="جای کالا در انبار"
            className={inputCls}
          />
          <textarea
            rows={2}
            value={receiptNotes}
            onChange={(e) => setReceiptNotes(e.target.value)}
            placeholder={hasShortage ? 'بقیه‌ی بار کی می‌رسد؟ (برای تأیید با کسری الزامی)' : 'یادداشت (اختیاری)، مثلاً ۲ کارتن ریل + ۳ بسته پارچه'}
            aria-label="یادداشت ورود کالا"
            className={`${inputCls} resize-none`}
          />

          {hasShortage && (
            <p className="text-[12px] text-ink-2 leading-6 bg-canvas border border-line rounded-lg p-2.5">
              <strong className="text-rose-600 dark:text-rose-300">بار کامل نیست.</strong> «ورود ناقص» یعنی پروژه منتظر بقیه
              می‌ماند و اکیپ اعزام نمی‌شود. «تأیید با کسری» یعنی اکیپ با همین بار می‌رود و مدیر هشدار می‌بیند.
            </p>
          )}
          {error && <p className="text-xs text-rose-600 dark:text-rose-300 font-bold">{error}</p>}
        </div>
      </Sheet>
    );
  }

  // ------------------------------------------------------------------ لغو ورود
  if (view === 'REVOKE') {
    return (
      <Sheet
        isOpen
        onClose={close}
        title="لغو تأیید ورود کالا"
        subtitle={subtitle}
        size="sm"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run({ kind: 'REVOKE_RECEIPT' })}
              className={`${primaryBtn} bg-rose-600 hover:bg-rose-700 text-white`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              <span>لغو ورود کالا</span>
            </button>
            <button type="button" onClick={close} className={ghostBtn}>
              انصراف
            </button>
          </div>
        }
      >
        <p className="text-sm text-ink leading-7">
          پروژه به «منتظر ورود کالا» برمی‌گردد و تا تأیید دوباره، اکیپ نمی‌تواند حرکت کند.
          {prep?.isPackedAndReady && ' بار بسته‌شده هم باز می‌شود.'}
        </p>
        {error && <p className="text-xs text-rose-600 dark:text-rose-300 font-bold mt-2">{error}</p>}
      </Sheet>
    );
  }

  // ------------------------------------------------------------------ بستن بار
  if (view === 'PACK') {
    const goodsIn = isGoodsInWarehouse(project);
    const allProductsChecked = productRows.every(({ key }) => packChecks[key]);
    const ready = goodsIn && allProductsChecked && toolsChecked;
    return (
      <Sheet
        isOpen
        onClose={close}
        title="بستن بار اکیپ"
        subtitle={subtitle}
        size="md"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!goodsIn) {
                  setError('اول ورود کالای این پروژه را ثبت کنید.');
                  return;
                }
                if (!ready) {
                  setError('همه‌ی اقلام و ابزار را تیک بزنید تا مطمئن شوید چیزی جا نمانده.');
                  return;
                }
                void run({ kind: 'PACK', notes: packNotes, packedCounts: expected, toolsPacked: true });
              }}
              className={`${primaryBtn} ${ready ? '' : 'opacity-60'}`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              <span>بار آماده است</span>
            </button>
            <button type="button" onClick={close} className={ghostBtn}>
              انصراف
            </button>
          </div>
        }
      >
        <div className="space-y-2.5">
          {!goodsIn && (
            <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-lg p-2.5 flex items-center justify-between gap-2">
              <span>کالای این پروژه هنوز وارد انبار نشده است.</span>
              <button type="button" onClick={() => goTo('RECEIPT')} className="font-bold underline cursor-pointer shrink-0">
                ثبت ورود کالا
              </button>
            </div>
          )}
          <p className="text-xs text-ink-2">هر قلم را موقع بار زدن تیک بزنید:</p>
          {productRows.map(({ key, label }) => (
            <CheckRow key={key} checked={Boolean(packChecks[key])} onChange={(v) => setPackChecks((p) => ({ ...p, [key]: v }))}>
              <strong className="tabular-nums">{toPersianDigits(expected[key])}</strong> {label}
            </CheckRow>
          ))}
          <CheckRow checked={toolsChecked} onChange={setToolsChecked}>
            ابزار: <strong>{tools.main}</strong>
            {tools.extras.length > 0 && <span className="block text-[12px] text-ink-2">+ {tools.extras.join('، ')}</span>}
          </CheckRow>
          {project.proposalImages?.length ? (
            <button
              type="button"
              onClick={() => onViewProposal?.(project)}
              className="text-xs font-bold text-brand-ink hover:underline cursor-pointer min-h-[36px]"
            >
              دیدن پروپوزال برای تطبیق رنگ و ابعاد
            </button>
          ) : null}
          <input
            type="text"
            value={packNotes}
            onChange={(e) => setPackNotes(e.target.value)}
            placeholder="یادداشت بار (اختیاری)، مثلاً ۳ کارتن + ریل جدا"
            aria-label="یادداشت بار"
            className={inputCls}
          />
          {error && <p className="text-xs text-rose-600 dark:text-rose-300 font-bold">{error}</p>}
        </div>
      </Sheet>
    );
  }

  // ------------------------------------------------------------------ تحویل به اکیپ
  if (view === 'HAND_OVER') {
    return (
      <Sheet
        isOpen
        onClose={close}
        title="تحویل بار به اکیپ"
        subtitle={subtitle}
        size="sm"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run({ kind: 'HAND_OVER', via: 'WAREHOUSE', toName: handToName })}
              className={primaryBtn}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              <span>تحویل داده شد</span>
            </button>
            <button type="button" onClick={close} className={ghostBtn}>
              انصراف
            </button>
          </div>
        }
      >
        <div className="space-y-2.5">
          <p className="text-xs text-ink-2">
            {formatProductCounts(expected) || 'بار پروژه'} · {tools.main}
          </p>
          <input
            type="text"
            value={handToName}
            onChange={(e) => setHandToName(e.target.value)}
            placeholder="تحویل‌گیرنده (سرپرست یا راننده)"
            aria-label="تحویل‌گیرنده"
            className={inputCls}
          />
          {error && <p className="text-xs text-rose-600 dark:text-rose-300 font-bold">{error}</p>}
        </div>
      </Sheet>
    );
  }

  return null;
};

const TimelineItem: React.FC<{ done: boolean; warn?: boolean; title: string; children?: React.ReactNode }> = ({
  done,
  warn,
  title,
  children,
}) => (
  <li className="flex items-start gap-2">
    <span
      className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
        done ? 'bg-emerald-500' : warn ? 'bg-rose-500' : 'bg-line-strong'
      }`}
    />
    <div className="min-w-0 space-y-0.5">
      <div className={`font-bold ${done ? 'text-ink' : 'text-ink-3'}`}>{title}</div>
      {children && <div className="text-ink-2 space-y-0.5">{children}</div>}
    </div>
  </li>
);

const primaryBtn =
  'min-h-[44px] px-4 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50';
const secondaryBtn =
  'min-h-[44px] px-3 rounded-lg border border-line bg-canvas hover:bg-raised text-ink text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer';
const ghostBtn =
  'min-h-[44px] px-3 rounded-lg text-ink-2 hover:text-ink text-xs font-bold flex items-center justify-center gap-1 cursor-pointer';
