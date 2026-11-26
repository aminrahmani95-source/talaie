/**
 * گزارش‌های اکسل واقعی (xlsx) با چند برگه، راست‌به‌چپ، سربرگ ثابت، فیلتر، رنگ وضعیت و جمع با فرمول.
 * کتابخانه‌ی exceljs فقط موقع زدن دکمه بارگذاری می‌شود (حجم برنامه زیاد نمی‌شود).
 * سازنده‌ها خالص‌اند و Workbook برمی‌گردانند تا در تست هم خوانده شوند.
 */
import type ExcelJSNs from 'exceljs';
import type { Project, StuckIncident } from '../types';
import { formatJalali, formatJalaliDateTime, formatTimeOnly, getDayInfoFromDateKey, localDateKey, toEnglishDigits } from './jalali';
import { capacityUnits, formatProductCounts } from './productCounts';
import { isProjectScheduledOnDate } from './multiDay';
import { addDaysToKey } from './warehouseLists';
import {
  pct,
  PROJECT_STATUS_LABELS,
  QC_LABELS,
  REPORT_GROUP_LABELS,
  ReportRow,
  ReportSummary,
  STUCK_CATEGORY_LABELS,
  stuckIncidentsOf,
} from './projectsReport';
import { getWarehouseStage, WAREHOUSE_STAGE_LABELS } from './warehouseStatus';
import { HistorySummary, OUTGOING_KINDS, WAREHOUSE_EVENT_LABELS, WarehouseEvent } from './warehouseHistory';

type Workbook = ExcelJSNs.Workbook;
type Worksheet = ExcelJSNs.Worksheet;
type ExcelModule = typeof ExcelJSNs;

export async function loadExcel(): Promise<ExcelModule> {
  const mod: any = await import('exceljs');
  return (mod.default || mod) as ExcelModule;
}

// ---------------------------------------------------------------------------
// ظاهر مشترک
// ---------------------------------------------------------------------------
const FONT = 'Tahoma';
const GOLD = 'FFC5A059';
const DARK = 'FF1F2937';
const BORDER = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const GROUP_FILL: Record<string, string> = {
  DONE: 'FFD1FAE5',
  STUCK: 'FFFEE2E2',
  ACTIVE: 'FFDBEAFE',
  PLANNED: 'FFFEF3C7',
  CANCELLED: 'FFE5E7EB',
};

const latin = (v: unknown): string => (v === undefined || v === null ? '' : toEnglishDigits(String(v)));

function sheet(wb: Workbook, name: string, freezeRow = 0): Worksheet {
  return wb.addWorksheet(name, {
    views: [{ rightToLeft: true, state: freezeRow ? 'frozen' : 'normal', ySplit: freezeRow, xSplit: 0 }],
    properties: { defaultRowHeight: 20 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
}

function titleBlock(ws: Worksheet, title: string, lines: string[], span: number): number {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  t.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
  ws.getRow(1).height = 30;
  lines.forEach((line, i) => {
    ws.mergeCells(2 + i, 1, 2 + i, span);
    const c = ws.getCell(2 + i, 1);
    c.value = latin(line);
    c.font = { name: FONT, size: 10, color: { argb: 'FF4B5563' } };
    c.alignment = { horizontal: 'right', readingOrder: 'rtl' };
  });
  return 2 + lines.length + 1; // سطر بعدی آزاد (با یک سطر فاصله)
}

function sectionTitle(ws: Worksheet, row: number, text: string, span: number) {
  ws.mergeCells(row, 1, row, span);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { name: FONT, size: 12, bold: true, color: { argb: 'FF111827' } };
  c.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
  c.alignment = { horizontal: 'right', readingOrder: 'rtl' };
  ws.getRow(row).height = 24;
}

function headerRow(ws: Worksheet, row: number, headers: string[]) {
  const r = ws.getRow(row);
  headers.forEach((h, i) => {
    const c = r.getCell(i + 1);
    c.value = h;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    c.border = ALL_BORDERS;
  });
  r.height = 28;
}

function dataRow(ws: Worksheet, row: number, values: unknown[], opts: { fill?: string; bold?: boolean; numFmt?: Record<number, string> } = {}) {
  const r = ws.getRow(row);
  values.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = typeof v === 'string' ? latin(v) : (v as any);
    c.font = { name: FONT, size: 10, bold: opts.bold };
    c.border = ALL_BORDERS;
    c.alignment = {
      horizontal: typeof v === 'number' || (v && typeof v === 'object') ? 'center' : 'right',
      vertical: 'middle',
      wrapText: true,
      readingOrder: 'rtl',
    };
    if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    if (opts.numFmt?.[i + 1]) c.numFmt = opts.numFmt[i + 1];
  });
}

const colLetter = (n: number) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** سطر جمع با فرمول SUM برای ستون‌های عددی */
function totalsRow(ws: Worksheet, row: number, firstData: number, lastData: number, cols: number, sumCols: number[], label = 'جمع') {
  const values: unknown[] = Array.from({ length: cols }, () => '');
  values[0] = label;
  for (const c of sumCols) {
    const L = colLetter(c);
    values[c - 1] = lastData >= firstData ? { formula: `SUM(${L}${firstData}:${L}${lastData})` } : 0;
  }
  dataRow(ws, row, values, { fill: 'FFF3E8D0', bold: true });
}

function widths(ws: Worksheet, w: number[]) {
  w.forEach((width, i) => (ws.getColumn(i + 1).width = width));
}

export async function downloadWorkbook(wb: Workbook, fileBaseName: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // نیم‌فاصله و خط تیره‌ی بلند در نام فایل را مرورگر به _ تبدیل می‌کند؛ ساده‌اش می‌کنیم
  a.download = `${latin(fileBaseName)
    .replace(/[\u200c—–]/g, ' ')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const jDate = (key?: string) => (key ? latin(formatJalali(key)) : '');

// ---------------------------------------------------------------------------
// گزارش کلی پروژه‌ها (هفتگی / ماهانه / هر بازه)
// ---------------------------------------------------------------------------
export interface ProjectsWorkbookInput {
  title: string;
  rangeLabel: string;
  from?: string;
  to?: string;
  filtersText?: string;
  rows: ReportRow[];
  summary: ReportSummary;
  generatedAt?: Date;
}

export function buildProjectsWorkbook(ExcelJS: ExcelModule, input: ProjectsWorkbookInput): Workbook {
  const { rows, summary } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'گالری طلایی';
  wb.created = input.generatedAt || new Date();
  const headLines = [
    `بازه: ${input.rangeLabel}${input.from && input.to ? ` (${jDate(input.from)} تا ${jDate(input.to)})` : ''}`,
    ...(input.filtersText ? [input.filtersText] : []),
    `تهیه‌شده: ${latin(formatJalaliDateTime(input.generatedAt || new Date()))}`,
  ];

  // ===== برگه‌ی ۱: خلاصه
  {
    const ws = sheet(wb, 'خلاصه');
    widths(ws, [34, 16, 16, 16]);
    let r = titleBlock(ws, input.title, headLines, 4);

    sectionTitle(ws, r++, 'وضعیت پروژه‌ها', 4);
    headerRow(ws, r++, ['شاخص', 'تعداد', 'درصد از کل', '']);
    const totalRowRef = r;
    dataRow(ws, r++, ['کل پروژه‌های بازه', summary.total, 1, ''], { bold: true, numFmt: { 3: '0%' } });
    const groups: Array<[keyof ReportSummary['byGroup'], string]> = [
      ['DONE', 'تمام‌شده'],
      ['STUCK', 'متوقف'],
      ['ACTIVE', 'در جریان'],
      ['PLANNED', 'برنامه‌ریزی‌شده'],
      ['CANCELLED', 'لغوشده'],
    ];
    for (const [g, label] of groups) {
      dataRow(ws, r, [label, summary.byGroup[g], { formula: `IF($B$${totalRowRef}=0,0,B${r}/$B$${totalRowRef})` }, ''], {
        fill: GROUP_FILL[g],
        numFmt: { 3: '0%' },
      });
      r++;
    }
    r++;

    sectionTitle(ws, r++, 'کیفیت و زمان‌بندی', 4);
    headerRow(ws, r++, ['شاخص', 'مقدار', 'از', 'درصد']);
    dataRow(ws, r, ['تأیید QC (از کارهای تمام‌شده)', summary.qc.approved, summary.byGroup.DONE, { formula: `IF(C${r}=0,0,B${r}/C${r})` }], { numFmt: { 4: '0%' } });
    r++;
    dataRow(ws, r, ['منتظر QC', summary.qc.pending, summary.byGroup.DONE, { formula: `IF(C${r}=0,0,B${r}/C${r})` }], { numFmt: { 4: '0%' } });
    r++;
    dataRow(ws, r, ['رد QC', summary.qc.rejected, summary.byGroup.DONE, { formula: `IF(C${r}=0,0,B${r}/C${r})` }], {
      numFmt: { 4: '0%' },
      fill: summary.qc.rejected ? GROUP_FILL.STUCK : undefined,
    });
    r++;
    dataRow(ws, r, ['اتمام به‌موقع', summary.onTime, summary.measured, { formula: `IF(C${r}=0,0,B${r}/C${r})` }], { numFmt: { 4: '0%' } });
    r++;
    dataRow(ws, r++, ['میانگین تأخیر کارهای دیرشده (روز)', summary.avgLateDays, '', ''], { numFmt: { 2: '0.0' } });
    dataRow(ws, r++, ['تعداد کل توقف‌ها', summary.stuckIncidents, '', '']);
    dataRow(ws, r++, ['رضایت مشتری (از 5)', summary.satisfactionCount ? summary.avgSatisfaction : '—', summary.satisfactionCount || '', ''], {
      numFmt: { 2: '0.0' },
    });
    r++;

    sectionTitle(ws, r++, 'اقلام: برنامه و نصب‌شده', 4);
    headerRow(ws, r++, ['محصول', 'برنامه‌ریزی‌شده', 'نصب‌شده', 'درصد نصب']);
    const prodFirst = r;
    for (const [k, label] of [
      ['shade', 'شید'],
      ['rail', 'ریل'],
      ['curtain', 'پرده'],
    ] as const) {
      dataRow(ws, r, [label, summary.planned[k], summary.installed[k], { formula: `IF(B${r}=0,0,C${r}/B${r})` }], { numFmt: { 4: '0%' } });
      r++;
    }
    totalsRow(ws, r, prodFirst, r - 1, 4, [2, 3]);
    ws.getCell(r, 4).value = { formula: `IF(B${r}=0,0,C${r}/B${r})` };
    ws.getCell(r, 4).numFmt = '0%';
    r += 2;

    sectionTitle(ws, r++, 'دلایل توقف', 4);
    headerRow(ws, r++, ['دلیل', 'تعداد', 'سهم', '']);
    const stFirst = r;
    if (summary.stuckByCategory.length === 0) {
      dataRow(ws, r++, ['توقفی ثبت نشده', 0, 0, ''], { numFmt: { 3: '0%' } });
    } else {
      const lastRef = stFirst + summary.stuckByCategory.length - 1;
      for (const c of summary.stuckByCategory) {
        dataRow(ws, r, [c.label, c.count, { formula: `IF(SUM($B$${stFirst}:$B$${lastRef})=0,0,B${r}/SUM($B$${stFirst}:$B$${lastRef}))` }, ''], {
          numFmt: { 3: '0%' },
        });
        r++;
      }
    }
  }

  // ===== برگه‌ی ۲: اکیپ‌ها
  {
    const ws = sheet(wb, 'اکیپ‌ها', 1);
    const headers = ['اکیپ', 'کل کارها', 'تمام‌شده', 'متوقف', 'در جریان', 'برنامه‌ریزی‌شده', 'شید نصب‌شده', 'ریل نصب‌شده', 'پرده نصب‌شده', 'اتمام به‌موقع', 'قابل سنجش', 'درصد به‌موقع', 'رد QC', 'تعداد توقف'];
    widths(ws, [22, 10, 10, 10, 10, 13, 12, 12, 12, 12, 11, 12, 9, 11]);
    headerRow(ws, 1, headers);
    let r = 2;
    for (const t of summary.byTeam) {
      dataRow(
        ws,
        r,
        [t.teamName, t.total, t.done, t.stuck, t.active, t.planned, t.installed.shade, t.installed.rail, t.installed.curtain, t.onTime, t.measured, { formula: `IF(K${r}=0,"—",J${r}/K${r})` }, t.qcRejected, t.stuckIncidents],
        { numFmt: { 12: '0%' }, fill: r % 2 ? undefined : 'FFF9FAFB' }
      );
      r++;
    }
    totalsRow(ws, r, 2, r - 1, headers.length, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14]);
    ws.getCell(r, 12).value = { formula: `IF(K${r}=0,"—",J${r}/K${r})` };
    ws.getCell(r, 12).numFmt = '0%';
    if (r > 2) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: r - 1, column: headers.length } };
  }

  // ===== برگه‌ی ۳: پروژه‌ها
  {
    const ws = sheet(wb, 'پروژه‌ها', 1);
    const headers = [
      'کد', 'پروژه', 'مشتری', 'تلفن', 'آدرس', 'فروشنده', 'اکیپ', 'تاریخ شروع', 'تاریخ پایان', 'وضعیت', 'دسته',
      'شید', 'ریل', 'پرده', 'ظرفیت (لت)', 'تاریخ اتمام', 'تأخیر (روز)', 'به‌موقع', 'QC', 'امتیاز QC', 'رضایت مشتری',
      'تعداد توقف', 'آخرین دلیل توقف', 'شرح توقف', 'وضعیت انبار',
    ];
    widths(ws, [11, 26, 18, 14, 30, 14, 16, 12, 12, 14, 13, 7, 7, 7, 10, 12, 10, 9, 11, 9, 11, 9, 18, 30, 14]);
    headerRow(ws, 1, headers);
    let r = 2;
    for (const row of rows) {
      const p = row.project;
      const stage = getWarehouseStage(p);
      dataRow(
        ws,
        r,
        [
          p.code || '',
          p.title,
          p.customerName && p.customerName !== p.title ? p.customerName : '',
          p.customerPhone || '',
          p.address || '',
          p.salesRepName || '',
          row.teamName,
          jDate(row.startKey),
          row.endKey && row.endKey !== row.startKey ? jDate(row.endKey) : '',
          PROJECT_STATUS_LABELS[p.status] || p.status,
          REPORT_GROUP_LABELS[row.group],
          row.counts.shade,
          row.counts.rail,
          row.counts.curtain,
          capacityUnits(row.counts),
          jDate(row.completedKey),
          row.onTime === false ? row.lateDays : row.onTime ? 0 : '',
          row.onTime === null ? '' : row.onTime ? 'بله' : 'خیر',
          row.group === 'DONE' ? QC_LABELS[p.qcStatus] || '' : '',
          p.qcStatus === 'APPROVED' && p.qcScore ? p.qcScore : '',
          p.customerSatisfaction || '',
          row.stuckCount,
          row.lastStuck ? STUCK_CATEGORY_LABELS[row.lastStuck.category] || '' : '',
          row.lastStuck?.description || '',
          stage === 'NONE' ? '' : WAREHOUSE_STAGE_LABELS[stage],
        ],
        { fill: GROUP_FILL[row.group] }
      );
      r++;
    }
    totalsRow(ws, r, 2, r - 1, headers.length, [12, 13, 14, 15, 22]);
    if (r > 2) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: r - 1, column: headers.length } };
  }

  // ===== برگه‌ی ۴: توقف‌ها
  {
    const ws = sheet(wb, 'توقف‌ها', 1);
    const headers = ['کد', 'پروژه', 'اکیپ', 'تاریخ توقف', 'ساعت', 'دلیل', 'شرح', 'وضعیت', 'تاریخ رفع', 'مدت (ساعت)', 'در مهلت 72 ساعت', 'رفع‌کننده', 'توضیح رفع'];
    widths(ws, [11, 26, 16, 12, 8, 18, 34, 10, 12, 11, 13, 16, 34]);
    headerRow(ws, 1, headers);
    let r = 2;
    const now = Date.now();
    const incidents: Array<{ p: Project; inc: StuckIncident }> = [];
    for (const row of rows) for (const inc of stuckIncidentsOf(row.project)) incidents.push({ p: row.project, inc });
    incidents
      .filter(({ inc }) => {
        const k = inc.stuckAt ? localDateKey(new Date(inc.stuckAt)) : '';
        return !input.from || !input.to || !k || (k >= input.from && k <= input.to);
      })
      .sort((a, b) => String(b.inc.stuckAt).localeCompare(String(a.inc.stuckAt)))
      .forEach(({ p, inc }) => {
        const start = new Date(inc.stuckAt).getTime();
        const end = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : now;
        const hours = isNaN(start) ? '' : Math.round(((end - start) / 3_600_000) * 10) / 10;
        const resolved = inc.resolutionStatus === 'RESOLVED';
        const limit = inc.targetMaxHours || 72;
        dataRow(
          ws,
          r++,
          [
            p.code || '',
            p.title,
            p.assignedTeamName || '',
            inc.stuckAt ? jDate(localDateKey(new Date(inc.stuckAt))) : '',
            inc.stuckAt ? latin(formatTimeOnly(inc.stuckAt)) : '',
            STUCK_CATEGORY_LABELS[inc.category] || 'سایر',
            inc.description || '',
            resolved ? 'رفع شد' : 'باز',
            inc.resolvedAt ? jDate(localDateKey(new Date(inc.resolvedAt))) : '',
            hours,
            hours === '' ? '' : (hours as number) <= limit ? 'بله' : 'خیر',
            inc.resolvedBy || '',
            inc.resolutionNote || '',
          ],
          { fill: resolved ? undefined : GROUP_FILL.STUCK, numFmt: { 10: '0.0' } }
        );
      });
    if (r === 2) dataRow(ws, r++, ['در این بازه توقفی ثبت نشده', '', '', '', '', '', '', '', '', '', '', '', '']);
    else ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: r - 1, column: headers.length } };
  }

  // ===== برگه‌ی ۵: روزبه‌روز
  {
    const ws = sheet(wb, 'روزبه‌روز', 1);
    const headers = ['تاریخ', 'روز', 'کارهای برنامه‌ریزی‌شده', 'تمام‌شده', 'شید نصب‌شده', 'ریل نصب‌شده', 'پرده نصب‌شده', 'توقف جدید', 'توقف رفع‌شده'];
    widths(ws, [13, 11, 15, 11, 12, 12, 12, 11, 12]);
    headerRow(ws, 1, headers);
    let from = input.from;
    let to = input.to;
    if (!from || !to) {
      const keys = rows.flatMap((x) => [x.startKey, x.endKey, x.completedKey]).filter(Boolean) as string[];
      keys.sort();
      from = keys[0];
      to = keys[keys.length - 1];
    }
    let r = 2;
    // برای بازه‌های بیش از یک هفته، جمع هر هفته (شنبه تا جمعه) هم در برگه‌ی جدا
    const weeks: Array<{ start: string; end: string; v: number[] }> = [];
    if (from && to) {
      const projects = rows.map((x) => x.project).filter((p) => p.status !== 'CANCELLED');
      let day = from;
      let guard = 0;
      while (day <= to && guard++ < 400) {
        const scheduled = projects.filter((p) => isProjectScheduledOnDate(p, day)).length;
        const doneRows = rows.filter((x) => x.completedKey === day);
        const sum = (k: 'shade' | 'rail' | 'curtain') => doneRows.reduce((s, x) => s + x.counts[k], 0);
        let newStuck = 0;
        let resolvedStuck = 0;
        for (const p of projects) {
          for (const inc of stuckIncidentsOf(p)) {
            if (inc.stuckAt && localDateKey(new Date(inc.stuckAt)) === day) newStuck++;
            if (inc.resolvedAt && localDateKey(new Date(inc.resolvedAt)) === day) resolvedStuck++;
          }
        }
        const info = getDayInfoFromDateKey(day);
        const isFriday = info?.persianDayName === 'جمعه';
        dataRow(ws, r++, [jDate(day), info?.persianDayName || '', scheduled, doneRows.length, sum('shade'), sum('rail'), sum('curtain'), newStuck, resolvedStuck], {
          fill: isFriday ? 'FFF3F4F6' : undefined,
        });
        const vals = [doneRows.length, sum('shade'), sum('rail'), sum('curtain'), newStuck, resolvedStuck];
        if (!weeks.length || info?.persianDayName === 'شنبه') weeks.push({ start: day, end: day, v: [0, 0, 0, 0, 0, 0] });
        const w = weeks[weeks.length - 1];
        w.end = day;
        vals.forEach((x, i) => (w.v[i] += x));
        day = addDaysToKey(day, 1);
      }
    }
    totalsRow(ws, r, 2, r - 1, headers.length, [4, 5, 6, 7, 8, 9]);

    if (weeks.length > 1) {
      const wsW = sheet(wb, 'هفته‌به‌هفته', 1);
      const wh = ['هفته', 'از', 'تا', 'تمام‌شده', 'شید نصب‌شده', 'ریل نصب‌شده', 'پرده نصب‌شده', 'توقف جدید', 'توقف رفع‌شده'];
      widths(wsW, [10, 13, 13, 11, 12, 12, 12, 11, 12]);
      headerRow(wsW, 1, wh);
      let wr = 2;
      weeks.forEach((w, i) => dataRow(wsW, wr++, [`هفته ${i + 1}`, jDate(w.start), jDate(w.end), ...w.v]));
      totalsRow(wsW, wr, 2, wr - 1, wh.length, [4, 5, 6, 7, 8, 9]);
    }
  }

  return wb;
}

// ---------------------------------------------------------------------------
// سوابق انبار
// ---------------------------------------------------------------------------
export interface WarehouseWorkbookInput {
  title: string;
  rangeLabel: string;
  from?: string;
  to?: string;
  events: WarehouseEvent[];
  summary: HistorySummary;
  generatedAt?: Date;
}

export function buildWarehouseWorkbook(ExcelJS: ExcelModule, input: WarehouseWorkbookInput): Workbook {
  const { events, summary } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'گالری طلایی';

  // ===== خلاصه
  {
    const ws = sheet(wb, 'خلاصه');
    widths(ws, [34, 14, 14, 14, 14]);
    let r = titleBlock(
      ws,
      input.title,
      [
        `بازه: ${input.rangeLabel}${input.from && input.to ? ` (${jDate(input.from)} تا ${jDate(input.to)})` : ''}`,
        `تهیه‌شده: ${latin(formatJalaliDateTime(input.generatedAt || new Date()))}`,
      ],
      5
    );
    sectionTitle(ws, r++, 'کارها', 5);
    headerRow(ws, r++, ['نوع', 'تعداد', 'شید', 'ریل', 'پرده']);
    dataRow(ws, r++, ['ورود کالا (کامل و ناقص)', summary.byKind.RECEIPT + summary.byKind.PARTIAL_RECEIPT, summary.received.shade, summary.received.rail, summary.received.curtain]);
    dataRow(ws, r++, ['  از این تعداد ورود ناقص', summary.byKind.PARTIAL_RECEIPT, '', '', ''], {
      fill: summary.byKind.PARTIAL_RECEIPT ? GROUP_FILL.STUCK : undefined,
    });
    dataRow(ws, r++, ['بستن بار', summary.byKind.PACKED, '', '', '']);
    dataRow(ws, r++, ['تحویل بار به اکیپ', summary.byKind.HANDED_OVER, summary.handedOver.shade, summary.handedOver.rail, summary.handedOver.curtain]);
    dataRow(ws, r++, ['ارسال متریال', summary.materialDispatches, '', '', '']);
    dataRow(ws, r++, ['  تعداد اقلام ارسال‌شده', summary.materialQty, '', '', '']);
    dataRow(ws, r++, ['  ارسال‌های هنوز تأییدنشده در کارگاه', summary.materialInTransit, '', '', ''], {
      fill: summary.materialInTransit ? GROUP_FILL.PLANNED : undefined,
    });
    dataRow(ws, r++, ['پاسخ به ارجاع‌های انبار', summary.byKind.TICKET_SUPPLY, '', '', '']);
    dataRow(ws, r++, ['پروژه‌های درگیر', summary.projects, '', '', ''], { bold: true });
  }

  // ===== همه‌ی رویدادها
  {
    const ws = sheet(wb, 'رویدادها', 1);
    const headers = ['تاریخ', 'ساعت', 'نوع', 'جهت', 'کد', 'پروژه', 'مشتری', 'اکیپ', 'شید', 'ریل', 'پرده', 'اقلام', 'ثبت‌کننده', 'تحویل‌گیرنده / پیک', 'وضعیت', 'یادداشت'];
    widths(ws, [12, 8, 15, 9, 11, 24, 16, 16, 7, 7, 7, 34, 15, 20, 18, 30]);
    headerRow(ws, 1, headers);
    let r = 2;
    for (const e of events) {
      const out = OUTGOING_KINDS.includes(e.kind);
      dataRow(
        ws,
        r++,
        [
          jDate(e.dateKey),
          latin(formatTimeOnly(e.at)),
          WAREHOUSE_EVENT_LABELS[e.kind],
          out ? 'خروج' : 'ورود/داخلی',
          e.projectCode,
          e.projectTitle,
          e.customerName && e.customerName !== e.projectTitle ? e.customerName : '',
          e.teamName || '',
          e.counts ? e.counts.shade : '',
          e.counts ? e.counts.rail : '',
          e.counts ? e.counts.curtain : '',
          e.itemsText,
          e.actorName || '',
          e.recipient || '',
          e.status || '',
          e.notes || '',
        ],
        { fill: e.warn ? GROUP_FILL.PLANNED : undefined }
      );
    }
    totalsRow(ws, r, 2, r - 1, headers.length, [9, 10, 11]);
    if (r > 2) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: r - 1, column: headers.length } };
  }

  // ===== ریز اقلام متریال ارسالی
  {
    const ws = sheet(wb, 'اقلام متریال', 1);
    const headers = ['تاریخ', 'کد', 'پروژه', 'اکیپ', 'قلم', 'تعداد', 'واحد', 'پیک / رهگیری', 'ارسال‌کننده', 'وضعیت تحویل'];
    widths(ws, [12, 11, 24, 16, 26, 8, 10, 22, 15, 20]);
    headerRow(ws, 1, headers);
    let r = 2;
    for (const e of events.filter((x) => x.kind === 'MATERIAL_DISPATCH')) {
      for (const it of e.items || []) {
        dataRow(ws, r++, [jDate(e.dateKey), e.projectCode, e.projectTitle, e.teamName || '', it.title, it.qty, it.unit, e.recipient || '', e.actorName || '', e.status || ''], {
          fill: e.warn ? GROUP_FILL.PLANNED : undefined,
        });
      }
    }
    totalsRow(ws, r, 2, r - 1, headers.length, [6]);
    if (r > 2) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: r - 1, column: headers.length } };
  }

  // ===== تحویل به اکیپ‌ها به تفکیک اکیپ
  {
    const ws = sheet(wb, 'تحویل به اکیپ‌ها', 1);
    const headers = ['اکیپ', 'تعداد تحویل', 'شید', 'ریل', 'پرده', 'پروژه‌ها'];
    widths(ws, [20, 12, 9, 9, 9, 50]);
    headerRow(ws, 1, headers);
    const byTeam = new Map<string, { n: number; s: number; rl: number; c: number; codes: string[] }>();
    for (const e of events.filter((x) => x.kind === 'HANDED_OVER')) {
      const k = e.teamName || e.recipient || 'نامشخص';
      const t = byTeam.get(k) || { n: 0, s: 0, rl: 0, c: 0, codes: [] };
      t.n++;
      t.s += e.counts?.shade || 0;
      t.rl += e.counts?.rail || 0;
      t.c += e.counts?.curtain || 0;
      t.codes.push(e.projectCode);
      byTeam.set(k, t);
    }
    let r = 2;
    for (const [team, t] of byTeam) dataRow(ws, r++, [team, t.n, t.s, t.rl, t.c, t.codes.join('، ')]);
    totalsRow(ws, r, 2, r - 1, headers.length, [2, 3, 4, 5]);
  }

  return wb;
}

/** پیام کوتاه برای بعد از ساخت فایل */
export const describeCounts = (c: { shade: number; rail: number; curtain: number }) => formatProductCounts(c) || '—';
export { pct };
