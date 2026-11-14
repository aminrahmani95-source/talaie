import React, { useState, useEffect } from 'react';
import { Clock, Play, CheckCircle2 } from 'lucide-react';
import { toPersianDigits, formatDuration, formatTimeOnly } from '../utils/jalali';
import { ProjectStatus, WorkSession } from '../types';
import { calculateWorkSessionsSummary } from '../utils/multiDay';

interface Props {
  status: ProjectStatus;
  startedAt?: string;
  completedAt?: string;
  reworkStartedAt?: string;
  workSessions?: WorkSession[];
  compact?: boolean;
}

export const ActiveJobTimer: React.FC<Props> = ({
  status,
  startedAt,
  completedAt,
  reworkStartedAt,
  workSessions,
  compact = false,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const openSession = workSessions?.find((s) => !s.endedAt);
  const effectiveStartedAt = openSession?.startedAt || reworkStartedAt || startedAt;
  const isRework = Boolean(reworkStartedAt);

  useEffect(() => {
    if (status !== 'IN_PROGRESS' || !effectiveStartedAt) {
      return;
    }

    const startTimestamp = new Date(effectiveStartedAt).getTime();
    if (isNaN(startTimestamp)) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startTimestamp) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status, effectiveStartedAt]);

  const multiDaySummary = workSessions && workSessions.length > 0
    ? calculateWorkSessionsSummary(workSessions, effectiveStartedAt, completedAt)
    : null;

  if (status === 'IN_PROGRESS' && effectiveStartedAt) {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (compact) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{toPersianDigits(timeString)}</span>
        </span>
      );
    }

    return (
      <div className="bg-[#111620] border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Play className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              <span>{isRework ? 'زمان‌سنج کار در محل (بازکاری / رفع نقص QC):' : 'زمان‌سنج کار در محل (فعال):'}</span>
            </div>
            <div className="text-xs text-[#9BA7B6] mt-0.5">
              {isRework ? 'شروع بازکاری:' : 'شروع کار:'} ساعت {formatTimeOnly(effectiveStartedAt)}
            </div>
          </div>
        </div>

        <div className="text-left">
          <div className="font-mono font-bold text-sm text-emerald-400 bg-[#0D1117] px-3 py-1 rounded-md border border-emerald-500/30">
            {toPersianDigits(timeString)}
          </div>
          {multiDaySummary && (
            <div className="text-xs text-[#9BA7B6] mt-1 font-bold text-right">
              مجموع: {toPersianDigits(Math.floor(multiDaySummary.totalSeconds / 3600))} ساعت در {toPersianDigits(multiDaySummary.uniqueDaysCount)} روز
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'COMPLETED' && effectiveStartedAt) {
    return (
      <div className="bg-[#111620] border border-[#212835] rounded-lg p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="font-bold text-[#F0F4F8]">مدت زمان کل اجرای پروژه:</span>
            {multiDaySummary && (
              <span className="text-[#9BA7B6] mr-1">
                ({toPersianDigits(multiDaySummary.uniqueDaysCount)} روز کاری)
              </span>
            )}
          </div>
        </div>
        <div className="font-mono font-bold text-[#F0F4F8] bg-[#0D1117] px-2.5 py-1 rounded-md border border-[#212835]">
          {multiDaySummary ? multiDaySummary.text : formatDuration(effectiveStartedAt, completedAt)}
        </div>
      </div>
    );
  }

  return null;
};
