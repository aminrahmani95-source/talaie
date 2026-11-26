import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, FileSpreadsheet, Printer, Search, AlertOctagon, Users, Layers } from 'lucide-react';
import type { Project } from '../../types';
import { formatJalali, formatJalaliDateTime, localDateKey, toPersianDigits } from '../../utils/jalali';
import { formatProductCounts } from '../../utils/productCounts';
import { historyRangeBounds, HistoryRange } from '../../utils/warehouseHistory';
import { addDaysToKey } from '../../utils/warehouseLists';
import {
  buildProjectReport,
  pct,
  QC_LABELS,
  REPORT_GROUP_LABELS,
  REPORT_ROW_HEADERS,
  ReportGroup,
  reportRowCells,
  reportToCsv,
  STUCK_CATEGORY_LABELS,
  summarizeReport,
} from '../../utils/projectsReport';
import { downloadCsv, printHtmlReport } from '../../utils/reportExport';
import { StatusPill } from '../ui/StatusPill';
import { triggerToast } from '../Toast';

type Range = HistoryRange | 'NEXT_7D';
const RANGES: Range[] = ['TODAY', '7D', 'NEXT_7D', 'MONTH', 'PREV_MONTH', 'ALL'];
const GROUPS: ReportGroup[] = ['ALL', 'DONE', 'STUCK', 'ACTIVE', 'PLANNED', 'CANCELLED'];
const PAGE = 30;

function rangeBounds(r: Range, todayKey: string): { from?: string; to?: string; label: string } {
  if (r === 'NEXT_7D') return { from: todayKey, to: addDaysToKey(todayKey, 6), label: '۷ روز آینده' };
  if (r === 'ALL') return { label: 'همه‌ی زمان‌ها' };
  return historyRangeBounds(r, todayKey);
}

const card = 'bg-surface rounded-xl border border-line p-3 sm:p-4';
const cardTitle = 'text-sm font-black text-ink flex items-center gap-2 mb-3';

/**
 * گزارش کلی پروژه‌ها برای مدیر: برنامه‌ریزی‌شده، در جریان، تمام‌شده و متوقف در هر بازه،
 * با تفکیک اکیپ، محصول و دلیل توقف + خروجی اکسل و چاپ.
 */
export const ProjectsReport: React.FC<{
  projects: Project[];
  onOpenProject?: (project: Project) => void;
}> = ({ projects, onOpenProject }) => {
  const todayKey = localDateKey();
  const [range, setRange] = useState<Range>('MONTH');
  const [group, setGroup] = useState<ReportGroup>('ALL');
  const [teamKey, setTeamKey] = useState('ALL');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const bounds = useMemo(() => rangeBounds(range, todayKey), [range, todayKey]);
  // سطرهای بازه بدون فیلتر وضعیت (برای شمارنده‌ی دکمه‌ها و فهرست اکیپ‌ها)
  const rangeRows = useMemo(
    () => buildProjectReport(projects, { from: bounds.from, to: bounds.to, teamKey, query }),
    [projects, bounds, teamKey, query]
  );
  const rows = useMemo(() => (group === 'ALL' ? rangeRows : rangeRows.filter((r) => r.group === group)), [rangeRows, group]);
  const rangeSummary = useMemo(() => summarizeReport(rangeRows), [rangeRows]);
  const summary = useMemo(() => summarizeReport(rows), [rows]);
  const teamOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of buildProjectReport(projects, { from: bounds.from, to: bounds.to })) m.set(r.teamKey, r.teamName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fa'));
  }, [projects, bounds]);

  const title = `گزارش کلی پروژه‌ها — ${bounds.label}${group !== 'ALL' ? ` — ${REPORT_GROUP_LABELS[group]}` : ''}${
    teamKey !== 'ALL' ? ` — ${teamOptions.find(([k]) => k === teamKey)?.[1] || ''}` : ''
  }`;

  const summaryLines = [
    `کل پروژه‌ها: ${toPersianDigits(summary.total)} (تمام‌شده ${toPersianDigits(summary.byGroup.DONE)}، متوقف ${toPersianDigits(
      summary.byGroup.STUCK
    )}، در جریان ${toPersianDigits(summary.byGroup.ACTIVE)}، برنامه‌ریزی‌شده ${toPersianDigits(summary.byGroup.PLANNED)}، لغو ${toPersianDigits(
      summary.byGroup.CANCELLED
    )})`,
    `QC کارهای تمام‌شده: ${toPersianDigits(summary.qc.approved)} تأیید، ${toPersianDigits(summary.qc.pending)} منتظر، ${toPersianDigits(summary.qc.rejected)} رد`,
    `اتمام به‌موقع: ${toPersianDigits(pct(summary.onTime, summary.measured))}٪ (${toPersianDigits(summary.onTime)} از ${toPersianDigits(summary.measured)})${
      summary.avgLateDays ? ` — میانگین تأخیر ${toPersianDigits(summary.avgLateDays)} روز` : ''
    }`,
    `اقلام برنامه: ${formatProductCounts(summary.planned) || '—'} · نصب‌شده: ${formatProductCounts(summary.installed) || '—'}`,
    `توقف‌ها: ${toPersianDigits(summary.stuckIncidents)} مورد${
      summary.stuckByCategory.length ? ` (${summary.stuckByCategory.map((c) => `${c.label} ${toPersianDigits(c.count)}`).join('، ')})` : ''
    }`,
    ...(summary.satisfactionCount
      ? [`رضایت مشتری: ${toPersianDigits(summary.avgSatisfaction)} از ۵ (${toPersianDigits(summary.satisfactionCount)} نظر)`]
      : []),
  ];

  const exportCsv = () => {
    if (!rows.length) {
      triggerToast('info', 'در این بازه پروژه‌ای برای خروجی نیست.');
      return;
    }
    downloadCsv(title, reportToCsv(rows));
  };

  const print = () => {
    const ok = printHtmlReport(title, `تهیه‌شده ${formatJalaliDateTime(new Date())}`, [
      { title: 'خلاصه', lines: summaryLines },
      {
        title: 'به تفکیک اکیپ',
        table: {
          headers: ['اکیپ', 'کل', 'تمام‌شده', 'متوقف', 'در جریان', 'برنامه', 'نصب‌شده', 'به‌موقع', 'رد QC'],
          rows: summary.byTeam.map((t) => [
            t.teamName,
            toPersianDigits(t.total),
            toPersianDigits(t.done),
            toPersianDigits(t.stuck),
            toPersianDigits(t.active),
            toPersianDigits(t.planned),
            formatProductCounts(t.installed) || '—',
            t.measured ? `${toPersianDigits(pct(t.onTime, t.measured))}٪` : '—',
            toPersianDigits(t.qcRejected),
          ]),
        },
      },
      { title: 'فهرست پروژه‌ها', table: { headers: REPORT_ROW_HEADERS, rows: rows.map(reportRowCells) } },
    ]);
    if (!ok) triggerToast('error', 'چاپ در این مرورگر باز نشد. از «خروجی اکسل» استفاده کنید.');
  };

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] ${
      active ? 'bg-brand text-on-brand' : 'bg-canvas text-ink-2 hover:text-ink border border-line'
    }`;

  const maxStuck = Math.max(1, ...summary.stuckByCategory.map((c) => c.count));

  return (
    <div className="space-y-4">
      {/* فیلترها */}
      <div className={`${card} space-y-2.5`}>
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
              {r === 'TODAY' ? 'امروز' : rangeBounds(r, todayKey).label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {GROUPS.map((g) => (
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
              {REPORT_GROUP_LABELS[g]} ({toPersianDigits(g === 'ALL' ? rangeSummary.total : rangeSummary.byGroup[g])})
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={teamKey}
            onChange={(e) => setTeamKey(e.target.value)}
            aria-label="اکیپ"
            className="text-sm px-3 rounded-lg border border-line bg-canvas text-ink min-h-[42px] sm:w-48"
          >
            <option value="ALL">همه‌ی اکیپ‌ها</option>
            {teamOptions.map(([k, name]) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))}
          </select>
          <div className="relative grow">
            <Search className="w-4 h-4 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو: کد، مشتری، آدرس یا فروشنده"
              aria-label="جستجو در گزارش"
              className="w-full text-sm pr-9 pl-3 py-2 rounded-lg border border-line bg-canvas text-ink placeholder-ink-3 focus:border-brand focus:outline-none min-h-[42px]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="flex-1 sm:flex-none min-h-[42px] px-3 rounded-lg border border-line bg-canvas hover:bg-raised text-ink text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل</span>
            </button>
            <button
              type="button"
              onClick={print}
              className="flex-1 sm:flex-none min-h-[42px] px-3 rounded-lg border border-line bg-canvas hover:bg-raised text-ink text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-brand-ink" />
              <span>چاپ / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* شاخص‌ها */}
      <div className="grid grid-cols-2 @min-[700px]:grid-cols-3 @min-[1000px]:grid-cols-6 gap-2">
        <Kpi label="کل پروژه‌ها" value={toPersianDigits(summary.total)} detail={bounds.label} />
        <Kpi
          label="تمام‌شده"
          value={toPersianDigits(summary.byGroup.DONE)}
          tone="text-emerald-600 dark:text-emerald-300"
          detail={`QC: ${toPersianDigits(summary.qc.approved)} تأیید · ${toPersianDigits(summary.qc.pending)} منتظر · ${toPersianDigits(summary.qc.rejected)} رد`}
        />
        <Kpi
          label="متوقف"
          value={toPersianDigits(summary.byGroup.STUCK)}
          tone="text-rose-600 dark:text-rose-300"
          detail={`${toPersianDigits(summary.stuckIncidents)} بار توقف در کل`}
        />
        <Kpi label="در جریان" value={toPersianDigits(summary.byGroup.ACTIVE)} tone="text-sky-600 dark:text-sky-300" />
        <Kpi label="برنامه‌ریزی‌شده" value={toPersianDigits(summary.byGroup.PLANNED)} tone="text-amber-600 dark:text-amber-300" />
        <Kpi
          label="اتمام به‌موقع"
          value={summary.measured ? `${toPersianDigits(pct(summary.onTime, summary.measured))}٪` : '—'}
          detail={
            summary.measured
              ? `${toPersianDigits(summary.onTime)} از ${toPersianDigits(summary.measured)}${
                  summary.avgLateDays ? ` · تأخیر ${toPersianDigits(summary.avgLateDays)} روز` : ''
                }`
              : 'کار تمام‌شده‌ای نیست'
          }
        />
      </div>

      <div className="grid grid-cols-1 @min-[900px]:grid-cols-2 gap-3">
        {/* محصولات */}
        <section className={card}>
          <h3 className={cardTitle}>
            <Layers className="w-4 h-4 text-brand-ink" />
            اقلام: برنامه و نصب‌شده
          </h3>
          <div className="space-y-2.5">
            {(['shade', 'rail', 'curtain'] as const).map((k) => {
              const plan = summary.planned[k];
              const done = summary.installed[k];
              if (!plan && !done) return null;
              return (
                <div key={k} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink">{k === 'shade' ? 'شید' : k === 'rail' ? 'ریل' : 'پرده'}</span>
                    <span className="text-ink-2 tabular-nums">
                      {toPersianDigits(done)} نصب‌شده از {toPersianDigits(plan)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-sunken overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct(done, plan)}%` }} />
                  </div>
                </div>
              );
            })}
            {!summary.planned.shade && !summary.planned.rail && !summary.planned.curtain && (
              <p className="text-xs text-ink-3">در این بازه اقلامی ثبت نشده است.</p>
            )}
            {summary.satisfactionCount > 0 && (
              <p className="text-xs text-ink-2 pt-1 border-t border-line">
                رضایت مشتری: <strong className="text-ink">{toPersianDigits(summary.avgSatisfaction)} از ۵</strong> ({toPersianDigits(summary.satisfactionCount)} نظر)
              </p>
            )}
          </div>
        </section>

        {/* دلایل توقف */}
        <section className={card}>
          <h3 className={cardTitle}>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
            دلایل توقف ({toPersianDigits(summary.stuckIncidents)})
          </h3>
          {summary.stuckByCategory.length === 0 ? (
            <p className="text-xs text-ink-3">در این بازه توقفی ثبت نشده است.</p>
          ) : (
            <div className="space-y-2">
              {summary.stuckByCategory.map((c) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink">{c.label}</span>
                    <span className="font-bold text-ink tabular-nums">{toPersianDigits(c.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-sunken overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct(c.count, maxStuck)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* اکیپ‌ها */}
      {summary.byTeam.length > 0 && (
        <section className={card}>
          <h3 className={cardTitle}>
            <Users className="w-4 h-4 text-brand-ink" />
            به تفکیک اکیپ
          </h3>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="text-ink-3 text-right">
                  <th className="font-bold p-2">اکیپ</th>
                  <th className="font-bold p-2">کل</th>
                  <th className="font-bold p-2">تمام‌شده</th>
                  <th className="font-bold p-2">متوقف</th>
                  <th className="font-bold p-2">در جریان / برنامه</th>
                  <th className="font-bold p-2">نصب‌شده</th>
                  <th className="font-bold p-2">به‌موقع</th>
                  <th className="font-bold p-2">رد QC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.byTeam.map((t) => (
                  <tr key={t.teamKey}>
                    <td className="p-2 font-bold text-ink whitespace-nowrap">{t.teamName}</td>
                    <td className="p-2 tabular-nums">{toPersianDigits(t.total)}</td>
                    <td className="p-2 tabular-nums text-emerald-700 dark:text-emerald-300">{toPersianDigits(t.done)}</td>
                    <td className={`p-2 tabular-nums ${t.stuck ? 'text-rose-600 dark:text-rose-300 font-bold' : ''}`}>
                      {toPersianDigits(t.stuck)}
                      {t.stuckIncidents > t.stuck ? <span className="text-ink-3 font-normal"> ({toPersianDigits(t.stuckIncidents)} بار)</span> : null}
                    </td>
                    <td className="p-2 tabular-nums">
                      {toPersianDigits(t.active)} / {toPersianDigits(t.planned)}
                    </td>
                    <td className="p-2 text-ink-2">{formatProductCounts(t.installed) || '—'}</td>
                    <td className="p-2 tabular-nums">{t.measured ? `${toPersianDigits(pct(t.onTime, t.measured))}٪` : '—'}</td>
                    <td className={`p-2 tabular-nums ${t.qcRejected ? 'text-rose-600 dark:text-rose-300 font-bold' : ''}`}>
                      {toPersianDigits(t.qcRejected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* فهرست پروژه‌ها */}
      <section className="space-y-2">
        <h3 className="text-sm font-black text-ink flex items-center gap-2 px-1">
          <BarChart3 className="w-4 h-4 text-brand-ink" />
          پروژه‌ها ({toPersianDigits(rows.length)})
        </h3>
        {rows.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 text-center border border-line text-xs text-ink-2">
            در این بازه پروژه‌ای نیست.
            {range !== 'ALL' && (
              <button type="button" onClick={() => setRange('ALL')} className="block mx-auto mt-2 text-brand-ink font-bold hover:underline cursor-pointer min-h-[36px]">
                نمایش همه
              </button>
            )}
          </div>
        ) : (
          <ul className="bg-surface rounded-xl border border-line divide-y divide-line">
            {rows.slice(0, limit).map((r) => {
              const p = r.project;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpenProject?.(p)}
                    className="w-full text-right p-3 flex items-start gap-3 hover:bg-raised/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <div className="min-w-0 grow space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[12px] text-brand-ink font-bold">{p.code}</span>
                        <span className="text-sm font-bold text-ink truncate">{p.title}</span>
                        <StatusPill status={p.status} size="sm" />
                        {r.group === 'DONE' && p.qcStatus !== 'NOT_STARTED' && (
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md border ${
                              p.qcStatus === 'APPROVED'
                                ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                                : p.qcStatus === 'REJECTED'
                                  ? 'border-rose-500/40 text-rose-600 dark:text-rose-300'
                                  : 'border-line text-ink-2'
                            }`}
                          >
                            {QC_LABELS[p.qcStatus]}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-ink-2 flex flex-wrap gap-x-2">
                        <span>{r.teamName}</span>
                        <span>
                          {r.startKey
                            ? r.endKey && r.endKey !== r.startKey
                              ? `${formatJalali(r.startKey)} تا ${formatJalali(r.endKey)}`
                              : formatJalali(r.startKey)
                            : 'بدون تاریخ'}
                        </span>
                        <span>{formatProductCounts(r.counts) || '—'}</span>
                      </div>
                      {r.completedKey && (
                        <div className={`text-[12px] ${r.onTime === false ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-ink-3'}`}>
                          اتمام {formatJalali(r.completedKey)}
                          {r.onTime === false ? ` · ${toPersianDigits(r.lateDays)} روز تأخیر` : r.onTime ? ' · به‌موقع' : ''}
                        </div>
                      )}
                      {r.lastStuck && (
                        <div className={`text-[12px] ${r.group === 'STUCK' ? 'text-rose-600 dark:text-rose-300 font-bold' : 'text-ink-3'}`}>
                          توقف{r.stuckCount > 1 ? ` (${toPersianDigits(r.stuckCount)} بار)` : ''}: {STUCK_CATEGORY_LABELS[r.lastStuck.category] || ''}
                          {r.lastStuck.description ? ` — ${r.lastStuck.description}` : ''}
                        </div>
                      )}
                    </div>
                    {onOpenProject && <ChevronLeft className="w-4 h-4 text-ink-3 shrink-0 mt-1" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="w-full min-h-[44px] rounded-xl border border-line bg-surface text-xs font-bold text-ink-2 hover:text-ink cursor-pointer"
          >
            نمایش بیشتر ({toPersianDigits(rows.length - limit)} پروژه‌ی دیگر)
          </button>
        )}
      </section>
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; detail?: string; tone?: string }> = ({ label, value, detail, tone = 'text-ink' }) => (
  <div className="bg-surface rounded-xl border border-line p-3">
    <div className={`text-2xl font-black tabular-nums leading-none ${tone}`}>{value}</div>
    <div className="text-xs font-bold text-ink-2 mt-1.5">{label}</div>
    {detail ? <div className="text-[11px] text-ink-3 mt-0.5 leading-5">{detail}</div> : null}
  </div>
);
