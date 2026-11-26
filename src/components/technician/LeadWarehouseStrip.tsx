import React, { useState } from 'react';
import { CheckCircle2, Loader2, Package, Truck, ArrowDownToLine, AlertTriangle } from 'lucide-react';
import type { Project } from '../../types';
import { formatJalaliDateTime } from '../../utils/jalali';
import {
  formatCountDiffs,
  getWarehouseStage,
  receiptShortages,
  WAREHOUSE_STAGE_TONES,
} from '../../utils/warehouseStatus';

/**
 * وضعیت بار این مأموریت از دید سرپرست: کالا رسیده؟ بار بسته شده؟ تحویل گرفتم.
 * همان داده‌ای که انبار و مدیر می‌بینند.
 */
export const LeadWarehouseStrip: React.FC<{
  project: Project;
  canConfirmPickup: boolean;
  onConfirmPickup?: (project: Project) => Promise<void> | void;
}> = ({ project, canConfirmPickup, onConfirmPickup }) => {
  const [busy, setBusy] = useState(false);
  const stage = getWarehouseStage(project);
  if (stage === 'NONE') return null;

  const wc = project.technicalHandover?.warehouseConfirmation;
  const prep = project.warehousePrep;
  const shortages = receiptShortages(project);

  let icon: React.ReactNode;
  let text: React.ReactNode;
  switch (stage) {
    case 'AWAITING':
      icon = <ArrowDownToLine className="w-4 h-4 shrink-0" />;
      text = 'کالای این کار هنوز به انبار نرسیده؛ تا تأیید انبار، اعلام حرکت ثبت نمی‌شود.';
      break;
    case 'PARTIAL':
      icon = <AlertTriangle className="w-4 h-4 shrink-0" />;
      text = `بخشی از کالا رسیده${shortages.length ? ` (کسری: ${formatCountDiffs(shortages, 'shortage')})` : ''}؛ انبار منتظر بقیه‌ی بار است.`;
      break;
    case 'IN_STOCK':
      icon = <CheckCircle2 className="w-4 h-4 shrink-0" />;
      text = (
        <>
          کالا در انبار است{wc?.shelfLocation ? ` (قفسه ${wc.shelfLocation})` : ''}؛ بار هنوز بسته نشده.
          {wc?.shortageAccepted && shortages.length > 0 && (
            <span className="block font-bold">کسری: {formatCountDiffs(shortages, 'shortage')}</span>
          )}
        </>
      );
      break;
    case 'PACKED':
      icon = <Package className="w-4 h-4 shrink-0" />;
      text = (
        <>
          بار آماده است{prep?.packedByUserName ? ` · ${prep.packedByUserName}` : ''}
          {prep?.notes ? <span className="block">{prep.notes}</span> : null}
        </>
      );
      break;
    case 'HANDED_OVER':
      icon = <Truck className="w-4 h-4 shrink-0" />;
      text = `بار تحویل شد${prep?.handedOverToName ? ` به ${prep.handedOverToName}` : ''} · ${formatJalaliDateTime(prep?.handedOverAt)}`;
      break;
  }

  return (
    <div className={`rounded-md border p-2.5 text-xs leading-6 space-y-2 ${WAREHOUSE_STAGE_TONES[stage]}`}>
      <div className="flex items-start gap-2">
        {icon}
        <div className="min-w-0 font-medium">{text}</div>
      </div>
      {stage === 'PACKED' && canConfirmPickup && onConfirmPickup && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirmPickup(project);
            } finally {
              setBusy(false);
            }
          }}
          className="w-full min-h-[44px] rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
          <span>بار را از انبار تحویل گرفتم</span>
        </button>
      )}
    </div>
  );
};
