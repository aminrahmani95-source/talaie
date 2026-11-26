import type { Project, ProjectStatus, StuckCategory, StuckIncident, WarehouseCounts } from '../types';
import { formatJalali, localDateKey } from './jalali';
import { formatProductCounts, projectProductCounts } from './productCounts';
import { getCalendarDayDiff } from './multiDay';
import { buildCsv } from './reportExport';

/**
 * گزارش کلی پروژه‌ها برای داشبورد مدیر: همه‌ی کارهای برنامه‌ریزی‌شده و اجراشده در یک بازه،
 * تمام‌شده یا متوقف، به تفکیک اکیپ، دلیل توقف و محصول.
 */
export type ReportGroup = 'ALL' | 'PLANNED' | 'ACTIVE' | 'DONE' | 'STUCK' | 'CANCELLED';

export const REPORT_GROUP_LABELS: Record<ReportGroup, string> = {
  ALL: 'همه',
  PLANNED: 'برنامه‌ریزی‌شده',
  ACTIVE: 'در جریان',
  DONE: 'تمام‌شده',
  STUCK: 'متوقف',
  CANCELLED: 'لغوشده',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  MEASUREMENT_PENDING: 'منتظر اندازه‌گیری',
  SCHEDULED: 'برنامه‌ریزی‌شده',
  EN_ROUTE: 'در مسیر',
  IN_PROGRESS: 'در حال نصب',
  PAUSED: 'نیمه‌کاره',
  STUCK: 'متوقف',
  COMPLETED: 'تمام‌شده',
  CANCELLED: 'لغوشده',
};

export const STUCK_CATEGORY_LABELS: Record<StuckCategory, string> = {
  HARDWARE_SHORTAGE: 'کسری یراق / پایه',
  FABRIC_SHORTAGE: 'کسری پارچه',
  FABRIC_DEFECT: 'عیب پارچه',
  MEASUREMENT_MISMATCH: 'مغایرت اندازه',
  DRYWALL_SUBSTRUCTURE_ISSUE: 'زیرسازی / کناف',
  POWER_FAILURE: 'برق موتور',
  OTHER: 'سایر',
};

export const QC_LABELS: Record<string, string> = {
  NOT_STARTED: '—',
  PENDING: 'منتظر QC',
  APPROVED: 'تأیید QC',
  REJECTED: 'رد QC',
};

export function groupOfStatus(status: ProjectStatus): Exclude<ReportGroup, 'ALL'> {
  switch (status) {
    case 'COMPLETED':
      return 'DONE';
    case 'STUCK':
      return 'STUCK';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
    case 'PAUSED':
      return 'ACTIVE';
    default:
      return 'PLANNED';
  }
}

export function stuckIncidentsOf(p: Project): StuckIncident[] {
  if (Array.isArray(p.stuckIncidents) && p.stuckIncidents.length) return p.stuckIncidents;
  return p.stuckIncident ? [p.stuckIncident] : [];
}

const keyOf = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : localDateKey(d);
};

export interface ReportRow {
  project: Project;
  group: Exclude<ReportGroup, 'ALL'>;
  startKey?: string;
  endKey?: string;
  counts: WarehouseCounts;
  completedKey?: string;
  /** null یعنی قابل سنجش نیست (تمام نشده یا تاریخ ندارد) */
  onTime: boolean | null;
  lateDays: number;
  stuckCount: number;
  lastStuck?: StuckIncident;
  teamKey: string;
  teamName: string;
}

export function toReportRow(p: Project): ReportRow {
  const startKey = p.scheduledDate || undefined;
  const endKey = p.endDate && startKey && p.endDate > startKey ? p.endDate : startKey;
  const completedKey = p.status === 'COMPLETED' ? keyOf(p.completedAt) : undefined;
  let onTime: boolean | null = null;
  let lateDays = 0;
  if (completedKey && endKey) {
    lateDays = Math.max(0, getCalendarDayDiff(endKey, completedKey));
    onTime = lateDays === 0;
  }
  const incidents = stuckIncidentsOf(p);
  return {
    project: p,
    group: groupOfStatus(p.status),
    startKey,
    endKey,
    counts: projectProductCounts(p),
    completedKey,
    onTime,
    lateDays,
    stuckCount: incidents.length,
    lastStuck: incidents[incidents.length - 1],
    teamKey: p.assignedTeamId || 'NONE',
    teamName: p.assignedTeamName || 'بدون اکیپ',
  };
}

export interface ReportFilter {
  from?: string;
  to?: string;
  group?: ReportGroup;
  teamKey?: string;
  query?: string;
}

/**
 * پروژه‌هایی که بازه‌ی اجرایشان (تاریخ شروع تا پایان) با بازه‌ی گزارش هم‌پوشانی دارد،
 * یا در همان بازه تمام شده‌اند. پروژه‌ی بدون تاریخ فقط در «همه» دیده می‌شود.
 */
export function buildProjectReport(projects: Project[], f: ReportFilter): ReportRow[] {
  const q = f.query?.trim().toLowerCase();
  return projects
    .map(toReportRow)
    .filter((r) => {
      if (f.from || f.to) {
        const inWindow =
          Boolean(r.startKey) &&
          (!f.to || (r.startKey as string) <= f.to) &&
          (!f.from || (r.endKey as string) >= f.from);
        const finishedInWindow =
          Boolean(r.completedKey) && (!f.from || r.completedKey! >= f.from) && (!f.to || r.completedKey! <= f.to);
        if (!inWindow && !finishedInWindow) return false;
      }
      if (f.group && f.group !== 'ALL' && r.group !== f.group) return false;
      if (f.teamKey && f.teamKey !== 'ALL' && r.teamKey !== f.teamKey) return false;
      if (q) {
        const p = r.project;
        const hay = [p.code, p.title, p.customerName, p.address, p.assignedTeamName, p.salesRepName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        String(b.startKey || '').localeCompare(String(a.startKey || '')) ||
        String(a.project.code || '').localeCompare(String(b.project.code || ''))
    );
}

export interface TeamSummary {
  teamKey: string;
  teamName: string;
  total: number;
  done: number;
  stuck: number;
  active: number;
  planned: number;
  installed: WarehouseCounts;
  onTime: number;
  measured: number;
  qcRejected: number;
  stuckIncidents: number;
}

export interface ReportSummary {
  total: number;
  byGroup: Record<Exclude<ReportGroup, 'ALL'>, number>;
  qc: { approved: number; pending: number; rejected: number };
  planned: WarehouseCounts;
  installed: WarehouseCounts;
  onTime: number;
  measured: number;
  avgLateDays: number;
  stuckIncidents: number;
  stuckOpen: number;
  stuckByCategory: Array<{ category: StuckCategory; label: string; count: number }>;
  avgSatisfaction: number;
  satisfactionCount: number;
  byTeam: TeamSummary[];
}

const zero = (): WarehouseCounts => ({ shade: 0, rail: 0, curtain: 0 });
const addCounts = (t: WarehouseCounts, c: WarehouseCounts) => {
  t.shade += c.shade;
  t.rail += c.rail;
  t.curtain += c.curtain;
};

export function summarizeReport(rows: ReportRow[]): ReportSummary {
  const s: ReportSummary = {
    total: rows.length,
    byGroup: { PLANNED: 0, ACTIVE: 0, DONE: 0, STUCK: 0, CANCELLED: 0 },
    qc: { approved: 0, pending: 0, rejected: 0 },
    planned: zero(),
    installed: zero(),
    onTime: 0,
    measured: 0,
    avgLateDays: 0,
    stuckIncidents: 0,
    stuckOpen: 0,
    stuckByCategory: [],
    avgSatisfaction: 0,
    satisfactionCount: 0,
    byTeam: [],
  };
  const cats = new Map<StuckCategory, number>();
  const teams = new Map<string, TeamSummary>();
  let lateSum = 0;
  let lateCount = 0;
  let satSum = 0;

  for (const r of rows) {
    const p = r.project;
    s.byGroup[r.group]++;
    if (r.group !== 'CANCELLED') addCounts(s.planned, r.counts);
    if (r.group === 'DONE') {
      addCounts(s.installed, r.counts);
      if (p.qcStatus === 'APPROVED') s.qc.approved++;
      else if (p.qcStatus === 'REJECTED') s.qc.rejected++;
      else s.qc.pending++;
    }
    if (r.onTime !== null) {
      s.measured++;
      if (r.onTime) s.onTime++;
      else {
        lateSum += r.lateDays;
        lateCount++;
      }
    }
    for (const inc of stuckIncidentsOf(p)) {
      s.stuckIncidents++;
      cats.set(inc.category || 'OTHER', (cats.get(inc.category || 'OTHER') || 0) + 1);
    }
    if (r.group === 'STUCK') s.stuckOpen++;
    const sat = p.customerSatisfaction || p.customerSurvey?.csatScore;
    if (typeof sat === 'number' && sat > 0) {
      satSum += sat;
      s.satisfactionCount++;
    }

    let t = teams.get(r.teamKey);
    if (!t) {
      t = {
        teamKey: r.teamKey,
        teamName: r.teamName,
        total: 0,
        done: 0,
        stuck: 0,
        active: 0,
        planned: 0,
        installed: zero(),
        onTime: 0,
        measured: 0,
        qcRejected: 0,
        stuckIncidents: 0,
      };
      teams.set(r.teamKey, t);
    }
    t.total++;
    if (r.group === 'DONE') {
      t.done++;
      addCounts(t.installed, r.counts);
    }
    if (r.group === 'STUCK') t.stuck++;
    if (r.group === 'ACTIVE') t.active++;
    if (r.group === 'PLANNED') t.planned++;
    if (r.onTime !== null) {
      t.measured++;
      if (r.onTime) t.onTime++;
    }
    if (p.qcStatus === 'REJECTED') t.qcRejected++;
    t.stuckIncidents += r.stuckCount;
  }

  s.avgLateDays = lateCount ? Math.round((lateSum / lateCount) * 10) / 10 : 0;
  s.avgSatisfaction = s.satisfactionCount ? Math.round((satSum / s.satisfactionCount) * 10) / 10 : 0;
  s.stuckByCategory = [...cats.entries()]
    .map(([category, count]) => ({ category, label: STUCK_CATEGORY_LABELS[category] || 'سایر', count }))
    .sort((a, b) => b.count - a.count);
  s.byTeam = [...teams.values()].sort((a, b) => b.total - a.total);
  return s;
}

export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function reportRowCells(r: ReportRow): string[] {
  const p = r.project;
  const dates = r.startKey
    ? r.endKey && r.endKey !== r.startKey
      ? `${formatJalali(r.startKey)} تا ${formatJalali(r.endKey)}`
      : formatJalali(r.startKey)
    : 'بدون تاریخ';
  return [
    p.code || '',
    p.title,
    r.teamName,
    dates,
    PROJECT_STATUS_LABELS[p.status] || p.status,
    formatProductCounts(r.counts) || '—',
    r.completedKey ? formatJalali(r.completedKey) : '',
    r.onTime === null ? '' : r.onTime ? 'به‌موقع' : `${r.lateDays} روز تأخیر`,
    r.group === 'DONE' ? QC_LABELS[p.qcStatus] || '' : '',
    r.stuckCount ? `${r.stuckCount} بار${r.lastStuck ? ` — ${STUCK_CATEGORY_LABELS[r.lastStuck.category] || ''}: ${r.lastStuck.description || ''}` : ''}` : '',
  ];
}

export const REPORT_ROW_HEADERS = [
  'کد',
  'پروژه',
  'اکیپ',
  'تاریخ اجرا',
  'وضعیت',
  'اقلام',
  'تاریخ اتمام',
  'زمان‌بندی',
  'QC',
  'توقف',
];

export function reportToCsv(rows: ReportRow[]): string {
  const header = [...REPORT_ROW_HEADERS.slice(0, 5), 'شید', 'ریل', 'پرده', ...REPORT_ROW_HEADERS.slice(6), 'مشتری', 'فروش'];
  return buildCsv(
    header,
    rows.map((r) => {
      const c = reportRowCells(r);
      return [
        ...c.slice(0, 5),
        r.counts.shade,
        r.counts.rail,
        r.counts.curtain,
        ...c.slice(6),
        r.project.customerName && r.project.customerName !== r.project.title ? r.project.customerName : '',
        r.project.salesRepName || '',
      ];
    })
  );
}
