import React from 'react';
import { ArrowDownToLine, CheckCircle2, Package, Truck, AlertTriangle } from 'lucide-react';
import type { Project } from '../../types';
import {
  getWarehouseStage,
  WAREHOUSE_STAGE_LABELS,
  WAREHOUSE_STAGE_TONES,
  WarehouseStage,
} from '../../utils/warehouseStatus';

const ICONS: Record<WarehouseStage, React.ComponentType<{ className?: string }> | null> = {
  NONE: null,
  AWAITING: ArrowDownToLine,
  PARTIAL: AlertTriangle,
  IN_STOCK: CheckCircle2,
  PACKED: Package,
  HANDED_OVER: Truck,
};

/** نشان یکسان وضعیت انبار در همه‌ی داشبوردها */
export const WarehouseStageBadge: React.FC<{
  project: Project;
  size?: 'xs' | 'sm';
  /** پیشوند «انبار:» برای جاهایی که زمینه‌ی انبار مشخص نیست */
  withPrefix?: boolean;
  className?: string;
}> = ({ project, size = 'sm', withPrefix = false, className = '' }) => {
  const stage = getWarehouseStage(project);
  if (stage === 'NONE') return null;
  const Icon = ICONS[stage];
  const sizeCls = size === 'xs' ? 'text-[11px] px-1.5 py-0.5 gap-0.5' : 'text-[12px] px-2 py-0.5 gap-1';
  return (
    <span
      className={`inline-flex items-center font-bold rounded-md border whitespace-nowrap ${sizeCls} ${WAREHOUSE_STAGE_TONES[stage]} ${className}`}
      title={`وضعیت انبار: ${WAREHOUSE_STAGE_LABELS[stage]}`}
    >
      {Icon && <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>
        {withPrefix ? 'انبار: ' : ''}
        {WAREHOUSE_STAGE_LABELS[stage]}
      </span>
    </span>
  );
};
