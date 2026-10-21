import React, { useState, useEffect } from 'react';
import { Clock, Play, CheckCircle2 } from 'lucide-react';
import { toPersianDigits, formatDuration, formatTimeOnly } from '../utils/jalali';
import { ProjectStatus } from '../types';

interface Props {
  status: ProjectStatus;
  startedAt?: string;
  completedAt?: string;
  compact?: boolean;
}

export const ActiveJobTimer: React.FC<Props> = ({
  status,
  startedAt,
  completedAt,
  compact = false,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (status !== 'IN_PROGRESS' || !startedAt) {
      return;
    }

    const startTimestamp = new Date(startedAt).getTime();
    if (isNaN(startTimestamp)) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startTimestamp) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status, startedAt]);

  if (status === 'IN_PROGRESS' && startedAt) {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (compact) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{toPersianDigits(timeString)}</span>
        </span>
      );
    }

    return (
      <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" />
              <span>زمان‌سنج کار در محل (فعال):</span>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              شروع کار: ساعت {formatTimeOnly(startedAt)}
            </div>
          </div>
        </div>

        <div className="font-mono font-black text-sm text-emerald-800 dark:text-emerald-200 bg-white dark:bg-[#161616] px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
          {toPersianDigits(timeString)}
        </div>
      </div>
    );
  }

  if (status === 'COMPLETED' && startedAt) {
    const durationText = formatDuration(startedAt, completedAt);
    const startTimeStr = formatTimeOnly(startedAt);
    const endTimeStr = formatTimeOnly(completedAt);

    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#202020] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 text-[10px] font-bold">
          <Clock className="w-3 h-3 text-[#C1A056]" />
          <span>{durationText}</span>
        </span>
      );
    }

    return (
      <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#E8E4DC] dark:border-[#2D2D2D] rounded-2xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#151515] border border-[#C1A056]/30 flex items-center justify-center text-[#C1A056]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-[#212121] dark:text-white block">
              مدت زمان اجرای کار در محل:
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">
              از ساعت {startTimeStr} تا {endTimeStr || 'اتمام کار'}
            </span>
          </div>
        </div>

        <span className="font-bold text-[#C1A056] bg-white dark:bg-[#151515] px-2.5 py-1 rounded-xl border border-[#C1A056]/30">
          {durationText}
        </span>
      </div>
    );
  }

  return null;
};
