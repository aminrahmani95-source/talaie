import React, { useMemo } from 'react';
import { ChevronLeft, Package, Warehouse } from 'lucide-react';
import type { MaterialRequest, Project } from '../../types';
import { WarehouseStageBadge } from '../warehouse/WarehouseStageBadge';
import { warehouseAlert } from '../../utils/warehouseStatus';
import { MATERIAL_STATUS_COLORS, MATERIAL_STATUS_LABELS } from '../../utils/materialRequests';
import { formatJalali, localDateKey, toPersianDigits } from '../../utils/jalali';
import { formatProductCounts, projectProductCounts } from '../../utils/productCounts';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState } from '../ui/EmptyState';

const FINISHED = new Set(['COMPLETED', 'CANCELLED']);

/**
 * «وضعیت انبار» برای هماهنگ‌کننده‌ی جدا: فقط دیدن.
 * برای پروژه‌های اکیپ‌های خودش نشان می‌دهد بار رسیده، بسته شده یا تحویل اکیپ شده، و درخواست‌های
 * متریال در چه وضعی است. هیچ دکمه‌ی تغییری ندارد (ثبت و ارسال با انبار است).
 */
export const CoordinatorWarehouseView: React.FC<{
  projects: Project[];
  materialRequests: MaterialRequest[];
  onOpenProject?: (project: Project) => void;
}> = ({ projects, materialRequests, onOpenProject }) => {
  const todayKey = localDateKey();

  const rows = useMemo(() => {
    const byProject = new Map<string, MaterialRequest[]>();
    for (const r of materialRequests) {
      if (!r.projectId || r.status === 'CANCELLED') continue;
      const list = byProject.get(r.projectId) || [];
      list.push(r);
      byProject.set(r.projectId, list);
    }
    return projects
      .filter((p) => !FINISHED.has(p.status) || (byProject.get(p.id) || []).some((r) => r.status !== 'DELIVERED_CONFIRMED'))
      .map((p) => ({
        project: p,
        alert: warehouseAlert(p, todayKey),
        requests: (byProject.get(p.id) || []).filter((r) => r.status !== 'DELIVERED_CONFIRMED' || !FINISHED.has(p.status)),
      }))
      .sort((a, b) => {
        const rank = (x: typeof a) => (x.alert.level === 'urgent' ? 0 : x.alert.level ? 1 : x.requests.length ? 2 : 3);
        return rank(a) - rank(b) || (a.project.scheduledDate || '9999').localeCompare(b.project.scheduledDate || '9999');
      });
  }, [projects, materialRequests, todayKey]);

  const urgent = rows.filter((r) => r.alert.level === 'urgent').length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="وضعیت انبار"
        subtitle={
          urgent
            ? `${toPersianDigits(urgent)} پروژه نزدیک نصب است و بارش هنوز کامل نیست`
            : 'بار و درخواست‌های متریال پروژه‌های اکیپ‌های شما (فقط دیدن)'
        }
        icon={<Warehouse className="w-5 h-5" />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="پروژه‌ی بازی برای اکیپ‌های شما نیست"
          description="وقتی پروژه‌ای به اکیپ‌های شما سپرده شود، وضعیت بارش این‌جا دیده می‌شود."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ project: p, alert, requests }) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpenProject?.(p)}
                className={`w-full text-right rounded-xl border bg-surface p-3 sm:p-4 space-y-2 cursor-pointer hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  alert.level === 'urgent' ? 'border-rose-400/60' : alert.level ? 'border-amber-400/60' : 'border-line'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink-2">{p.code}</span>
                  <span className="font-extrabold text-sm text-ink truncate min-w-0 flex-1">{p.title || p.customerName}</span>
                  <WarehouseStageBadge project={p} />
                  <ChevronLeft className="w-4 h-4 text-ink-3 shrink-0" aria-hidden="true" />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2">
                  {p.scheduledDate && <span>نصب: {formatJalali(p.scheduledDate)}</span>}
                  {p.assignedTeamName && <span>{p.assignedTeamName}</span>}
                  <span>{formatProductCounts(projectProductCounts(p))}</span>
                </div>
                {alert.text && (
                  <p className={`text-xs font-bold ${alert.level === 'urgent' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {alert.text}
                  </p>
                )}
                {requests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {requests.map((r) => {
                      const c = MATERIAL_STATUS_COLORS[r.status];
                      return (
                        <span
                          key={r.id}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${c?.bg || ''} ${c?.text || ''} ${c?.border || 'border-line'}`}
                        >
                          متریال: {MATERIAL_STATUS_LABELS[r.status] || r.status}
                          {r.items?.length ? ` (${toPersianDigits(r.items.length)} قلم)` : ''}
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
