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
  PauseCircle,
} from 'lucide-react';

export interface StatusPillProps {
  status?: ProjectStatus;
  qcStatus?: QCStatus;
  isExceptionalCompletion?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  qcStatus,
  isExceptionalCompletion = false,
  label: customLabel,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1.5' : 'text-xs px-2.5 py-1 gap-1.5';

  // Handle QC Status if provided explicitly or alone
  if (qcStatus && qcStatus !== 'NOT_STARTED') {
    switch (qcStatus) {
      case 'APPROVED':
        return (
          <span
            className={`inline-flex items-center font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses} ${className}`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{customLabel || (isExceptionalCompletion ? 'تایید QC (کسری اقلام)' : 'تایید QC')}</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span
            className={`inline-flex items-center font-bold rounded bg-rose-500/15 text-rose-300 border border-rose-500/40 ${sizeClasses} ${className}`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span>{customLabel || (isExceptionalCompletion ? 'رد استثنا — نیازمند تکمیل' : 'نیاز به اصلاح')}</span>
          </span>
        );
      case 'PENDING':
        return (
          <span
            className={`inline-flex items-center font-bold rounded ${
              isExceptionalCompletion
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
            } ${sizeClasses} ${className}`}
          >
            {isExceptionalCompletion ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            ) : (
              <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            )}
            <span>{customLabel || (isExceptionalCompletion ? 'اتمام استثنایی (در انتظار QC)' : 'در انتظار QC')}</span>
          </span>
        );
      default:
        break;
    }
  }

  // Handle Project Status
  switch (status) {
    case 'SCHEDULED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded bg-[#1C232D] text-[#9BA7B6] border border-[#2D3748] ${sizeClasses} ${className}`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0 text-[#637184]" />
          <span>{customLabel || 'برنامه‌ریزی‌شده'}</span>
        </span>
      );

    case 'EN_ROUTE':
      return (
        <span
          className={`inline-flex items-center font-bold rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 ${sizeClasses} ${className}`}
        >
          <Truck className="w-3.5 h-3.5 shrink-0 text-sky-400" />
          <span>{customLabel || 'در مسیر'}</span>
        </span>
      );

    case 'IN_PROGRESS':
      return (
        <span
          className={`inline-flex items-center font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 ${sizeClasses} ${className}`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>{customLabel || 'در حال نصب'}</span>
        </span>
      );

    case 'PAUSED':
      return (
        <span
          className={`inline-flex items-center font-bold rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 ${sizeClasses} ${className}`}
        >
          <PauseCircle className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
          <span>{customLabel || 'نیمه‌کاره — ادامه روز بعد'}</span>
        </span>
      );

    case 'STUCK':
      return (
        <span
          className={`inline-flex items-center font-bold rounded bg-rose-500/15 text-rose-300 border border-rose-500/40 ${sizeClasses} ${className}`}
        >
          <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{customLabel || 'متوقف'}</span>
        </span>
      );

    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>{customLabel || 'اتمام نصب'}</span>
        </span>
      );

    default:
      if (qcStatus === 'NOT_STARTED') {
        return (
          <span
            className={`inline-flex items-center font-medium rounded bg-[#151B23] text-[#637184] border border-[#212835] ${sizeClasses} ${className}`}
          >
            <MinusCircle className="w-3.5 h-3.5 shrink-0 text-[#637184]" />
            <span>{customLabel || 'شروع‌نشده'}</span>
          </span>
        );
      }
      return customLabel ? (
        <span
          className={`inline-flex items-center font-medium rounded bg-[#151B23] text-[#9BA7B6] border border-[#212835] ${sizeClasses} ${className}`}
        >
          <span>{customLabel}</span>
        </span>
      ) : null;
  }
};
