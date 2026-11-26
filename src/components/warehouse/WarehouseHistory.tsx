import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ChevronLeft,
  FileSpreadsheet,
  Package,
  Printer,
  Search,
  Send,
  Truck,
  AlertTriangle,
  History,
} from 'lucide-react';
import type { MaterialRequest, Project, Ticket } from '../../types';
import { formatJalali, formatJalaliDateTime, formatTimeOnly, localDateKey, toPersianDigits } from '../../utils/jalali';
import { formatProductCounts } from '../../utils/productCounts';
import {
  buildWarehouseHistory,
  filterHistory,
  historyRangeBounds,
  HistoryRange,
  summarizeHistory,
  WAREHOUSE_EVENT_LABELS,
  WarehouseEvent,
  WarehouseEventKind,
} from '../../utils/warehouseHistory';
import { triggerToast } from '../Toast';
import { printHtmlReport } from '../../utils/reportExport';

type KindGroup = 'ALL' | 'IN' | 'LOAD' | 'MATERIAL';

const KIND_GROUPS: Record<KindGroup, { label: string; kinds?: WarehouseEventKind[] }> = {
  ALL: { label: 'همه' },
  IN: { label: 'ورود کالا', kinds: ['RECEIPT', 'PARTIAL_RECEIPT'] },
  LOAD: { label: 'بار و تحویل اکیپ', kinds: ['PACKED', 'HANDED_OVER'] },
  MATERIAL: { label: 'ارسال متریال', kinds: ['MATERIAL_DISPATCH', 'TICKET_SUPPLY'] },
};

const RANGES: HistoryRange[] = ['TODAY', '7D', 'MONTH', 'PREV_MONTH', 'ALL'];

const KIND_STYLE: Record<WarehouseEventKind, { icon: React.ReactNode; cls: string }> = {
  RECEIPT: { icon: <ArrowDownToLine className="w-3.5 h-3.5" />, cls: 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/40' },
  PARTIAL_RECEIPT: { icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40' },
  PACKED: { icon: <Package className="w-3.5 h-3.5" />, cls: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40' },
  HANDED_OVER: { icon: <Truck className="w-3.5 h-3.5" />, cls: 'bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/40' },
  MATERIAL_DISPATCH: { icon: <Send className="w-3.5 h-3.5" />, cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40' },
  TICKET_SUPPLY: { icon: <Send className="w-3.5 h-3.5" />, cls: 'bg-purple-500/15 text-purple-800 dark:text-purple-200 border-purple-500/40' },
};

const PAGE = 40;

export const WarehouseHistory: React.FC<{
  projects: Project[];
  materialRequests: MaterialRequest[];
  tickets: Ticket[];
  onOpenProject?: (projectId: string) => void;
}> = ({ projects, materialRequests, tickets, onOpenProject }) => {
  const [range, setRange] = useState<HistoryRange>('7D');
  const [group, setGroup] = useState<KindGroup>('ALL');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const todayKey = localDateKey();

  const allEvents = useMemo(
    () => buildWarehouseHistory(projects, materialRequests, tickets),
    [projects, materialRequests, tickets]
  );
  const bounds = useMemo(() => historyRangeBounds(range, todayKey), [range, todayKey]);
  const events = useMemo(
    () => filterHistory(allEvents, { from: bounds.from, to: bounds.to, kinds: KIND_GROUPS[group].kinds, query }),
    [allEvents, bounds, group, query]
  );
  const summary = useMemo(() => summarizeHistory(events), [events]);

  const byDay = useMemo(() => {
    const groups: Array<{ dateKey: string; items: WarehouseEvent[] }> = [];
    for (const e of events.slice(0, limit)) {
      const last = groups[groups.length - 1];
      if (last && last.dateKey === e.dateKey) last.items.push(e);
      else groups.push({ dateKey: e.dateKey, items: [e] });
    }
    return groups;
  }, [events, limit]);

  const reportTitle = `گزارش انبار — ${bounds.label}${group !== 'ALL' ? ` — ${KIND_GROUPS[group].label}` : ''}`;
  const summaryLines = [
    `تحویل بار به اکیپ: ${toPersianDigits(summary.byKind.HANDED_OVER)} بار${
      formatProductCounts(summary.handedOver) ? ` (${formatProductCounts(summary.handedOver)})` : ''
    }`,
    `ورود کالا: ${toPersianDigits(summary.byKind.RECEIPT + summary.byKind.PARTIAL_RECEIPT)} پروژه${
      formatProductCounts(summary.received) ? ` (${formatProductCounts(summary.received)})` : ''
    }${summary.byKind.PARTIAL_RECEIPT ? ` — ${toPersianDigits(summary.byKind.PARTIAL_RECEIPT)} ناقص` : ''}`,
    `ارسال متریال: ${toPersianDigits(summary.materialDispatches)} ارسال، ${toPersianDigits(summary.materialQty)} قلم${
      summary.materialInTransit ? ` — ${toPersianDigits(summary.materialInTransit)} هنوز تأیید تحویل نشده` : ''
    }`,
    `پاسخ به ارجاع‌های انبار: ${toPersianDigits(summary.byKind.TICKET_SUPPLY)}`,
  ];

  const [exporting, setExporting] = useState(false);
  // فایل اکسل واقعی: خلاصه، همه‌ی رویدادها، ریز اقلام متریال، تحویل به اکیپ‌ها
  const exportExcel = async () => {
    if (!events.length) {
      triggerToast('info', 'در این بازه موردی برای خروجی نیست.');
      return;
    }
    setExporting(true);
    try {
      const { loadExcel, buildWarehouseWorkbook, downloadWorkbook } = await import('../../utils/xlsxReports');
      const ExcelJS = await loadExcel();
      const wb = buildWarehouseWorkbook(ExcelJS, {
        title: `گزارش انبار — گالری طلایی${group !== 'ALL' ? ` — ${KIND_GROUPS[group].label}` : ''}`,
        rangeLabel: bounds.label,
        from: bounds.from,
        to: bounds.to,
        events,
        summary,
      });
      await downloadWorkbook(wb, `گزارش-انبار-${bounds.label}`);
      triggerToast('success', 'فایل اکسل گزارش انبار ساخته شد.');
    } catch (err: any) {
      triggerToast('error', `فایل اکسل ساخته نشد: ${err?.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  const printReport = () => {
    const ok = printHtmlReport(reportTitle, `تهیه‌شده ${formatJalaliDateTime(new Date())} · ${toPersianDigits(events.length)} رکورد`, [
      { lines: summaryLines },
      {
        table: {
          headers: ['زمان', 'نوع', 'پروژه', 'اقلام', 'ثبت‌کننده', 'تحویل‌گیرنده / پیک', 'وضعیت و یادداشت'],
          rows: events.map((e) => [
            formatJalaliDateTime(e.at),
            WAREHOUSE_EVENT_LABELS[e.kind],
            `${e.projectCode} ${e.projectTitle}`.trim(),
            e.itemsText,
            e.actorName || '',
            e.recipient || '',
            [e.status, e.notes].filter(Boolean).join(' · '),
          ]),
        },
      },
    ]);
    if (!ok) triggerToast('error', 'چاپ در این مرورگر باز نشد. از «خروجی اکسل» استفاده کنید.');
  };

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
      active ? 'bg-brand text-on-brand' : 'bg-canvas text-ink-2 hover:text-ink border border-line'
    }`;

  return (
    <div className="space-y-4">
      {/* فیلترها و خروجی */}
      <div className="bg-surface p-3 rounded-xl border border-line space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setLimit(PAGE);
              }}
              className={chip(range === r)}
            >
              {r === 'TODAY' ? 'امروز' : historyRangeBounds(r, todayKey).label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(Object.keys(KIND_GROUPS) as KindGroup[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={group === g}
              onClick={() => {
                setGroup(g);
                setLimit(PAGE);
              }}
              className={chip(group === g)}
            >
              {KIND_GROUPS[g].label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative grow">
            <Search className="w-4 h-4 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="جستجو: کد پروژه، مشتری، اکیپ، پیک یا قلم"
              aria-label="جستجو در سوابق انبار"
              className="w-full text-sm pr-9 pl-3 py-2 rounded-lg border border-line bg-canvas text-ink placeholder-ink-3 focus:border-brand focus:outline-none min-h-[42px]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void exportExcel()}
              disabled={exporting}
              className="flex-1 sm:flex-none min-h-[42px] px-3 rounded-lg border border-emerald-600/50 bg-emerald-600/10 hover:bg-emerald-600/20 text-ink text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{exporting ? 'در حال ساخت…' : 'فایل اکسل'}</span>
            </button>
            <button
              type="button"
              onClick={printReport}
              className="flex-1 sm:flex-none min-h-[42px] px-3 rounded-lg border border-line bg-canvas hover:bg-raised text-ink text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-brand-ink" />
              <span>چاپ / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* خلاصه‌ی بازه */}
      <div className="grid grid-cols-2 @min-[700px]:grid-cols-4 gap-2">
        <SummaryTile
          label="تحویل بار به اکیپ"
          value={summary.byKind.HANDED_OVER}
          detail={formatProductCounts(summary.handedOver)}
          tone="text-violet-600 dark:text-violet-300"
        />
        <SummaryTile
          label="ورود کالا"
          value={summary.byKind.RECEIPT + summary.byKind.PARTIAL_RECEIPT}
          detail={
            [formatProductCounts(summary.received), summary.byKind.PARTIAL_RECEIPT ? `${toPersianDigits(summary.byKind.PARTIAL_RECEIPT)} ناقص` : '']
              .filter(Boolean)
              .join(' · ')
          }
          tone="text-sky-600 dark:text-sky-300"
        />
        <SummaryTile
          label="ارسال متریال"
          value={summary.materialDispatches}
          detail={
            summary.materialDispatches
              ? `${toPersianDigits(summary.materialQty)} قلم${summary.materialInTransit ? ` · ${toPersianDigits(summary.materialInTransit)} در مسیر` : ''}`
              : ''
          }
          tone="text-amber-600 dark:text-amber-300"
        />
        <SummaryTile label="پروژه‌ها" value={summary.projects} detail={`${toPersianDigits(events.length)} رکورد`} tone="text-ink" />
      </div>

      {/* فهرست زمانی */}
      {events.length === 0 ? (
        <div className="bg-surface rounded-2xl p-10 text-center border border-line text-xs text-ink-2 space-y-2">
          <History className="w-8 h-8 text-ink-3 mx-auto" />
          <p className="font-bold">در این بازه سابقه‌ای ثبت نشده است.</p>
          {range !== 'ALL' && (
            <button type="button" onClick={() => setRange('ALL')} className="text-brand-ink font-bold hover:underline cursor-pointer min-h-[36px]">
              نمایش همه‌ی سوابق
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {byDay.map((day) => (
            <section key={day.dateKey} className="space-y-1.5">
              <h4 className="text-xs font-black text-ink-2 px-1 flex items-center justify-between">
                <span>{day.dateKey === todayKey ? 'امروز · ' : ''}{formatJalali(day.dateKey)}</span>
                <span className="font-normal text-ink-3">{toPersianDigits(day.items.length)} مورد</span>
              </h4>
              <ul className="bg-surface rounded-xl border border-line divide-y divide-line">
                {day.items.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => e.projectId && onOpenProject?.(e.projectId)}
                      className="w-full text-right p-3 flex items-start gap-3 hover:bg-raised/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="text-[12px] text-ink-3 tabular-nums w-10 shrink-0 pt-0.5">{formatTimeOnly(e.at)}</span>
                      <div className="min-w-0 grow space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md border ${KIND_STYLE[e.kind].cls}`}>
                            {KIND_STYLE[e.kind].icon}
                            {WAREHOUSE_EVENT_LABELS[e.kind]}
                          </span>
                          <span className="font-mono text-[12px] text-brand-ink font-bold">{e.projectCode}</span>
                          <span className="text-xs font-bold text-ink truncate">{e.projectTitle}</span>
                        </div>
                        <div className="text-xs text-ink">{e.itemsText}</div>
                        <div className="text-[12px] text-ink-2 flex flex-wrap gap-x-2">
                          {e.actorName && <span>ثبت: {e.actorName}</span>}
                          {e.recipient && <span>← {e.recipient}</span>}
                          {e.teamName && !e.recipient && <span>{e.teamName}</span>}
                        </div>
                        {(e.status || e.notes) && (
                          <div className={`text-[12px] ${e.warn ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-ink-3'}`}>
                            {[e.status, e.notes].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      {e.projectId && onOpenProject && <ChevronLeft className="w-4 h-4 text-ink-3 shrink-0 mt-1" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {events.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="w-full min-h-[44px] rounded-xl border border-line bg-surface text-xs font-bold text-ink-2 hover:text-ink cursor-pointer"
            >
              نمایش بیشتر ({toPersianDigits(events.length - limit)} مورد دیگر)
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const SummaryTile: React.FC<{ label: string; value: number; detail?: string; tone: string }> = ({ label, value, detail, tone }) => (
  <div className="bg-surface rounded-xl border border-line p-3">
    <div className={`text-2xl font-black tabular-nums leading-none ${value ? tone : 'text-ink-3'}`}>{toPersianDigits(value)}</div>
    <div className="text-xs font-bold text-ink-2 mt-1.5">{label}</div>
    {detail ? <div className="text-[11px] text-ink-3 mt-0.5 leading-5">{detail}</div> : null}
  </div>
);
