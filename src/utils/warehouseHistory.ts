import type { MaterialRequest, Project, Ticket, WarehouseCounts } from '../types';
import {
  formatJalali,
  formatJalaliDateTime,
  gregorianToJalali,
  jalaliToGregorian,
  localDateKey,
  PERSIAN_MONTH_NAMES,
} from './jalali';
import { formatProductCounts } from './productCounts';
import { addDaysToKey } from './warehouseLists';
import { buildCsv } from './reportExport';

/**
 * سوابق انبار: همه‌ی ورود و خروج‌ها در یک فهرست زمانی، برای بخش «سوابق و گزارش» انبار.
 * از داده‌هایی ساخته می‌شود که همین الان همگام می‌شوند (پروژه‌ها، درخواست‌های متریال، تیکت‌ها)،
 * پس جدول یا مایگریشن جدیدی لازم ندارد.
 */
export type WarehouseEventKind =
  | 'RECEIPT'
  | 'PARTIAL_RECEIPT'
  | 'PACKED'
  | 'HANDED_OVER'
  | 'MATERIAL_DISPATCH'
  | 'TICKET_SUPPLY';

export const WAREHOUSE_EVENT_LABELS: Record<WarehouseEventKind, string> = {
  RECEIPT: 'ورود کالا',
  PARTIAL_RECEIPT: 'ورود ناقص',
  PACKED: 'بستن بار',
  HANDED_OVER: 'تحویل بار به اکیپ',
  MATERIAL_DISPATCH: 'ارسال متریال',
  TICKET_SUPPLY: 'پاسخ به ارجاع',
};

/** ورودی به انبار در برابر خروجی از انبار */
export const OUTGOING_KINDS: WarehouseEventKind[] = ['HANDED_OVER', 'MATERIAL_DISPATCH', 'TICKET_SUPPLY'];

export interface WarehouseEvent {
  id: string;
  kind: WarehouseEventKind;
  at: string;
  dateKey: string;
  projectId?: string;
  projectCode: string;
  projectTitle: string;
  customerName?: string;
  teamName?: string;
  actorName?: string;
  /** تحویل‌گیرنده یا پیک */
  recipient?: string;
  /** شرح اقلام به فارسی */
  itemsText: string;
  counts?: WarehouseCounts;
  /** تعداد اقلام متریال ارسالی (جمع عددها) */
  materialQty?: number;
  notes?: string;
  /** وضعیت تکمیلی، مثل «تحویل در کارگاه تأیید شد» */
  status?: string;
  warn?: boolean;
}

const keyOf = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : localDateKey(d);
};

export function buildWarehouseHistory(
  projects: Project[],
  materialRequests: MaterialRequest[] = [],
  tickets: Ticket[] = []
): WarehouseEvent[] {
  const events: WarehouseEvent[] = [];
  const projectById = new Map(projects.map((p) => [p.id, p]));

  for (const p of projects) {
    const base = {
      projectId: p.id,
      projectCode: p.code || '',
      projectTitle: p.title,
      customerName: p.customerName,
      teamName: p.assignedTeamName,
    };
    const wc = p.technicalHandover?.warehouseConfirmation;
    if (wc?.confirmedAt && (wc.confirmed || wc.isPartial)) {
      const shortage =
        wc.receivedCounts && wc.expectedCounts
          ? (['shade', 'rail', 'curtain'] as const).some((k) => (wc.receivedCounts![k] || 0) < (wc.expectedCounts![k] || 0))
          : false;
      events.push({
        ...base,
        id: `rcpt-${p.id}`,
        kind: wc.confirmed ? 'RECEIPT' : 'PARTIAL_RECEIPT',
        at: wc.confirmedAt,
        dateKey: keyOf(wc.confirmedAt),
        actorName: wc.confirmedBy,
        counts: wc.receivedCounts,
        itemsText:
          formatProductCounts(wc.receivedCounts || {}) ||
          formatProductCounts({ shade: p.shadePanels, rail: p.railCount, curtain: p.curtainPanels }) ||
          '—',
        notes: [wc.shelfLocation ? `قفسه ${wc.shelfLocation}` : '', wc.notes || ''].filter(Boolean).join(' · ') || undefined,
        status: wc.isPartial
          ? 'منتظر بقیه‌ی بار'
          : wc.shortageAccepted
            ? 'تأیید با کسری'
            : wc.manualEntry
              ? 'ثبت دستی مدیر'
              : undefined,
        warn: Boolean(wc.isPartial || wc.shortageAccepted || shortage),
      });
    }
    const prep = p.warehousePrep;
    if (prep?.packedAt) {
      const counts = prep.packedCounts;
      events.push({
        ...base,
        id: `pack-${p.id}`,
        kind: 'PACKED',
        at: prep.packedAt,
        dateKey: keyOf(prep.packedAt),
        actorName: prep.packedByUserName,
        counts,
        itemsText:
          formatProductCounts(counts || { shade: p.shadePanels, rail: p.railCount, curtain: p.curtainPanels }) || '—',
        notes: prep.notes || undefined,
        status: prep.isPackedAndReady || prep.handedOverAt ? undefined : 'بار باز شد',
      });
    }
    if (prep?.handedOverAt) {
      const counts = prep.packedCounts || { shade: p.shadePanels || 0, rail: p.railCount || 0, curtain: p.curtainPanels || 0 };
      events.push({
        ...base,
        id: `hand-${p.id}`,
        kind: 'HANDED_OVER',
        at: prep.handedOverAt,
        dateKey: keyOf(prep.handedOverAt),
        actorName: prep.handedOverByName,
        recipient: prep.handedOverToName,
        counts,
        itemsText: formatProductCounts(counts) || '—',
        status: prep.handedOverVia === 'LEAD' ? 'تأیید سرپرست' : undefined,
      });
    }
  }

  for (const r of materialRequests) {
    const proj = projectById.get(r.projectId);
    for (const d of r.dispatches || []) {
      if (!d.dispatchedAt) continue;
      const titleOf = (itemId: string, fallback?: string) =>
        fallback || r.items.find((i) => i.id === itemId)?.title || 'قلم';
      const unitOf = (itemId: string, fallback?: string) =>
        fallback || r.items.find((i) => i.id === itemId)?.unit || '';
      events.push({
        id: `disp-${r.id}-${d.id}`,
        kind: 'MATERIAL_DISPATCH',
        at: d.dispatchedAt,
        dateKey: keyOf(d.dispatchedAt),
        projectId: r.projectId,
        projectCode: r.projectCode || proj?.code || '',
        projectTitle: r.projectTitle || proj?.title || '',
        customerName: r.customerName || proj?.customerName,
        teamName: r.assignedTeamName || proj?.assignedTeamName,
        actorName: d.dispatchedByUserName,
        recipient: [d.courierInfo, d.trackingCode ? `کد ${d.trackingCode}` : ''].filter(Boolean).join(' · ') || undefined,
        itemsText: d.items
          .map((i) => `${titleOf(i.itemId, i.title)} ${i.dispatchedQty}${unitOf(i.itemId, i.unit) ? ` ${unitOf(i.itemId, i.unit)}` : ''}`)
          .join('، '),
        materialQty: d.items.reduce((s, i) => s + (Number(i.dispatchedQty) || 0), 0),
        notes: d.notes || r.notes || undefined,
        status: d.receivedAtSiteConfirmed ? 'تحویل در کارگاه تأیید شد' : 'در مسیر کارگاه',
        warn: !d.receivedAtSiteConfirmed,
      });
    }
  }

  for (const t of tickets) {
    const isWarehouse = t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote);
    if (!isWarehouse || !t.resolvedAt || t.status !== 'RESOLVED') continue;
    const proj = projectById.get(t.projectId);
    events.push({
      id: `tick-${t.id}`,
      kind: 'TICKET_SUPPLY',
      at: t.resolvedAt,
      dateKey: keyOf(t.resolvedAt),
      projectId: t.projectId,
      projectCode: t.projectCode || proj?.code || '',
      projectTitle: t.projectTitle || proj?.title || '',
      customerName: proj?.customerName,
      teamName: t.assignedTeamName || proj?.assignedTeamName,
      actorName: t.verifiedByUserName || t.assignedUserName,
      itemsText: t.description,
      notes: t.resolutionNote || undefined,
    });
  }

  return events.filter((e) => e.dateKey).sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------------------
// بازه‌ی زمانی
// ---------------------------------------------------------------------------

export type HistoryRange = 'TODAY' | '7D' | 'MONTH' | 'PREV_MONTH' | 'ALL';

function jalaliMonthBounds(jy: number, jm: number): { from: string; to: string } {
  const start = jalaliToGregorian(jy, jm, 1);
  const ny = jm === 12 ? jy + 1 : jy;
  const nm = jm === 12 ? 1 : jm + 1;
  const next = jalaliToGregorian(ny, nm, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`;
  const to = addDaysToKey(`${next.gy}-${pad(next.gm)}-${pad(next.gd)}`, -1);
  return { from, to };
}

/** بازه‌ی تاریخ (کلید میلادی محلی، شامل دو سر) و عنوان فارسی آن */
export function historyRangeBounds(range: HistoryRange, todayKey: string): { from?: string; to?: string; label: string } {
  const [gy, gm, gd] = todayKey.split('-').map(Number);
  const { jy, jm } = gregorianToJalali(gy, gm, gd);
  switch (range) {
    case 'TODAY':
      return { from: todayKey, to: todayKey, label: `امروز ${formatJalali(todayKey)}` };
    case '7D':
      return { from: addDaysToKey(todayKey, -6), to: todayKey, label: '۷ روز اخیر' };
    case 'MONTH':
      return { ...jalaliMonthBounds(jy, jm), label: `${PERSIAN_MONTH_NAMES[jm - 1]} ${jy}` };
    case 'PREV_MONTH': {
      const py = jm === 1 ? jy - 1 : jy;
      const pm = jm === 1 ? 12 : jm - 1;
      return { ...jalaliMonthBounds(py, pm), label: `${PERSIAN_MONTH_NAMES[pm - 1]} ${py}` };
    }
    default:
      return { label: 'همه‌ی سوابق' };
  }
}

export function filterHistory(
  events: WarehouseEvent[],
  opts: { from?: string; to?: string; kinds?: WarehouseEventKind[]; query?: string }
): WarehouseEvent[] {
  const q = opts.query?.trim().toLowerCase();
  return events.filter((e) => {
    if (opts.from && e.dateKey < opts.from) return false;
    if (opts.to && e.dateKey > opts.to) return false;
    if (opts.kinds && opts.kinds.length && !opts.kinds.includes(e.kind)) return false;
    if (q) {
      const hay = [e.projectCode, e.projectTitle, e.customerName, e.teamName, e.actorName, e.recipient, e.itemsText, e.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface HistorySummary {
  byKind: Record<WarehouseEventKind, number>;
  /** جمع اقلام تحویل‌شده به اکیپ‌ها */
  handedOver: WarehouseCounts;
  /** جمع اقلام واردشده به انبار */
  received: WarehouseCounts;
  materialDispatches: number;
  materialQty: number;
  materialInTransit: number;
  projects: number;
}

export function summarizeHistory(events: WarehouseEvent[]): HistorySummary {
  const zero = (): WarehouseCounts => ({ shade: 0, rail: 0, curtain: 0 });
  const s: HistorySummary = {
    byKind: { RECEIPT: 0, PARTIAL_RECEIPT: 0, PACKED: 0, HANDED_OVER: 0, MATERIAL_DISPATCH: 0, TICKET_SUPPLY: 0 },
    handedOver: zero(),
    received: zero(),
    materialDispatches: 0,
    materialQty: 0,
    materialInTransit: 0,
    projects: 0,
  };
  const ids = new Set<string>();
  for (const e of events) {
    s.byKind[e.kind]++;
    if (e.projectId) ids.add(e.projectId);
    const add = (target: WarehouseCounts) => {
      if (!e.counts) return;
      target.shade += e.counts.shade || 0;
      target.rail += e.counts.rail || 0;
      target.curtain += e.counts.curtain || 0;
    };
    if (e.kind === 'HANDED_OVER') add(s.handedOver);
    if (e.kind === 'RECEIPT' || e.kind === 'PARTIAL_RECEIPT') add(s.received);
    if (e.kind === 'MATERIAL_DISPATCH') {
      s.materialDispatches++;
      s.materialQty += e.materialQty || 0;
      if (e.warn) s.materialInTransit++;
    }
  }
  s.projects = ids.size;
  return s;
}

// ---------------------------------------------------------------------------
// خروجی اکسل (CSV با BOM تا اکسل فارسی را درست نشان دهد)
// ---------------------------------------------------------------------------

export function historyToCsv(events: WarehouseEvent[]): string {
  const header = [
    'تاریخ و ساعت',
    'نوع',
    'کد پروژه',
    'پروژه',
    'مشتری',
    'اکیپ',
    'شید',
    'ریل',
    'پرده',
    'اقلام',
    'ثبت‌کننده',
    'تحویل‌گیرنده / پیک',
    'وضعیت',
    'یادداشت',
  ];
  const rows = events.map((e) => [
    formatJalaliDateTime(e.at),
    WAREHOUSE_EVENT_LABELS[e.kind],
    e.projectCode,
    e.projectTitle,
    e.customerName && e.customerName !== e.projectTitle ? e.customerName : '',
    e.teamName || '',
    e.counts?.shade ?? '',
    e.counts?.rail ?? '',
    e.counts?.curtain ?? '',
    e.itemsText,
    e.actorName || '',
    e.recipient || '',
    e.status || '',
    e.notes || '',
  ]);
  return buildCsv(header, rows);
}
