import React from 'react';
import { ProjectStatus, QCStatus } from '../../types';
import {
  Calendar,
  Truck,
  Wrench,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  MinusCircle,
} from 'lucide-react';

export interface StatusPillProps {
  status?: ProjectStatus;
  qcStatus?: QCStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  qcStatus,
  label: customLabel,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2.5 py-1 gap-1.5' : 'text-sm px-3 py-1.5 gap-2';

  // Handle QC Status if provided explicitly or alone
  if (qcStatus) {
    switch (qcStatus) {
      case 'APPROVED':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 ${sizeClasses} ${className}`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{customLabel || 'تایید QC'}</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60 animate-pulse ${sizeClasses} ${className}`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{customLabel || 'نیاز به اصلاح'}</span>
          </span>
        );
      case 'PENDING':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 ${sizeClasses} ${className}`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{customLabel || 'در انتظار QC'}</span>
          </span>
        );
      case 'NOT_STARTED':
      default:
        return (
          <span
            className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 ${sizeClasses} ${className}`}
          >
            <MinusCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>{customLabel || 'شروع‌نشده'}</span>
          </span>
        );
    }
  }

  // Handle Project Status
  switch (status) {
    case 'SCHEDULED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-zinc-800/80 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 ${sizeClasses} ${className}`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-zinc-400" />
          <span>{customLabel || 'برنامه‌ریزی‌شده'}</span>
        </span>
      );

    case 'EN_ROUTE':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-full bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 ${sizeClasses} ${className}`}
        >
          <Truck className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <span>{customLabel || 'در مسیر'}</span>
        </span>
      );

    case 'IN_PROGRESS':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-full bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 ${sizeClasses} ${className}`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{customLabel || 'در حال نصب'}</span>
        </span>
      );

    case 'STUCK':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-full bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60 ${sizeClasses} ${className}`}
        >
          <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{customLabel || 'متوقف'}</span>
        </span>
      );

    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{customLabel || 'اتمام نصب'}</span>
        </span>
      );

    default:
      return customLabel ? (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 ${sizeClasses} ${className}`}
        >
          <span>{customLabel}</span>
        </span>
      ) : null;
  }
};
