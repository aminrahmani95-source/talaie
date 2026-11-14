import React, { useState, useMemo } from 'react';
import { Project, DailyActivityProgress, User } from '../../types';
import {
  X,
  Camera,
  Upload,
  AlertTriangle,
  Moon,
  Clock,
  Layers,
  Calendar,
  AlertCircle,
  Wrench,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import { CloudImage } from '../common/CloudImage';
import { Button } from '../ui/Button';
import { getUpcomingDays, toPersianDigits, localDateKey } from '../../utils/jalali';
import { calculateActivityProgress, ActivityProgressSummary } from '../../utils/planProgress';

export interface DailyLogSubmitData {
  note?: string;
  photos: string[];
  startTime?: string;
  endTime?: string;
  completedQuantity?: number;
  remainingQuantity?: number;
  quantityUnit?: string;
  activityProgress?: DailyActivityProgress[];
  obstacles?: string;
  equipmentIssues?: string;
  plannedContinuationDate?: string;
  supervisorConfirmed?: boolean;
}

interface Props {
  isOpen: boolean;
  project: Project;
  currentUser?: User;
  onClose: () => void;
  onSubmit: (data: DailyLogSubmitData) => Promise<void>;
}

export const DailyLogModal: React.FC<Props> = ({
  isOpen,
  project,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const todayKey = useMemo(() => localDateKey(), []);

  // Compute structured activities and previous progress
  const activityProgressList = useMemo(() => {
    return calculateActivityProgress(project, todayKey);
  }, [project, todayKey]);

  // Today completed quantities by activity ID
  const [todayInputs, setTodayInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const act of activityProgressList) {
      initial[act.activityId] = '';
    }
    return initial;
  });

  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [note, setNote] = useState('');
  const [obstacles, setObstacles] = useState('');
  const [equipmentIssues, setEquipmentIssues] = useState('');
  const [plannedContinuationDate, setPlannedContinuationDate] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSupervisor =
    currentUser?.role === 'LEAD_TECHNICIAN' ||
    currentUser?.role === 'QC_MANAGER' ||
    project.leadTechnicianId === currentUser?.id;

  const [supervisorConfirmed, setSupervisorConfirmed] = useState(isSupervisor);

  const upcomingDays = getUpcomingDays(14);

  // Compute live progress calculations based on today's inputs
  const liveCalculations = useMemo(() => {
    let totalCompletedToday = 0;
    let totalRemaining = 0;
    let anyOverCompleted = false;

    const items = activityProgressList.map((act) => {
      const inputVal = todayInputs[act.activityId];
      const todayNum = inputVal && !isNaN(Number(inputVal)) ? Number(inputVal) : 0;
      totalCompletedToday += todayNum;

      const newTotal = Number((act.previouslyCompletedQuantity + todayNum).toFixed(2));
      const remaining = Number((act.effectivePlannedQuantity - newTotal).toFixed(2));
      const isOver = newTotal > act.effectivePlannedQuantity;
      if (isOver) anyOverCompleted = true;
      totalRemaining += Math.max(0, remaining);

      return {
        ...act,
        todayNum,
        newTotal,
        remaining,
        isOver,
        overQty: isOver ? Number((newTotal - act.effectivePlannedQuantity).toFixed(2)) : 0,
      };
    });

    return {
      items,
      totalCompletedToday: Number(totalCompletedToday.toFixed(2)),
      totalRemaining: Number(totalRemaining.toFixed(2)),
      anyOverCompleted,
    };
  }, [activityProgressList, todayInputs]);

  if (!isOpen) return null;

  const handleInputChange = (activityId: string, val: string) => {
    setTodayInputs((prev) => ({
      ...prev,
      [activityId]: val,
    }));
  };

  // Quick fill remaining items for 1-click completion
  const handleQuickFillRemaining = () => {
    const updated: Record<string, string> = {};
    for (const act of activityProgressList) {
      const needed = Math.max(0, act.remainingQuantity);
      updated[act.activityId] = needed > 0 ? String(needed) : '0';
    }
    setTodayInputs(updated);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.75);
        setPhotos((prev) => [...prev, compressed]);
      } catch (err) {
        console.warn('Image compression failed:', err);
      }
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Ensure at least one activity has progress or note is given
    const itemizedProgress: DailyActivityProgress[] = liveCalculations.items.map((it) => ({
      activityId: it.activityId,
      activityTitle: it.title,
      completedQuantity: it.todayNum,
      unit: it.unit,
    }));

    setIsSubmitting(true);
    try {
      await onSubmit({
        note: note.trim() || undefined,
        photos,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        completedQuantity: liveCalculations.totalCompletedToday,
        remainingQuantity: liveCalculations.totalRemaining,
        quantityUnit: activityProgressList[0]?.unit || 'لت',
        activityProgress: itemizedProgress,
        obstacles: obstacles.trim() || undefined,
        equipmentIssues: equipmentIssues.trim() || undefined,
        plannedContinuationDate: plannedContinuationDate || undefined,
        supervisorConfirmed: isSupervisor ? supervisorConfirmed : false,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ثبت گزارش کار.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full shadow-2xl border border-[#E2DDD4] dark:border-[#2C2C2C] overflow-hidden my-6 transition-all max-h-[92vh] flex flex-col">
        {/* Header - Auto-populated metadata */}
        <div className="bg-[#212121] px-5 py-4 text-white flex items-center justify-between border-b border-[#C1A056]/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C1A056]/20 text-[#C1A056] border border-[#C1A056]/40 flex items-center justify-center">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white">
                ثبت پیشرفت روزانه و پایان شیفت کاری
              </h3>
              <p className="text-xs text-[#E5CA8F] mt-0.5">
                <span className="font-mono">{project.code}</span> • {project.title} • {project.assignedTeamName || 'اکیپ نصب'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Planned Activities vs Today's Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#C1A056]" />
                اقلام کار و پیشرفت امروز:
              </span>
              <button
                type="button"
                onClick={handleQuickFillRemaining}
                className="text-[11px] font-bold text-[#C1A056] hover:text-[#9A7D37] flex items-center gap-1 cursor-pointer transition py-1 px-2 rounded-lg bg-[#FAF7F2] dark:bg-[#202020] border border-[#C1A056]/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                تکمیل تمام لت‌های باقیمانده
              </button>
            </div>

            {liveCalculations.items.map((act) => (
              <div
                key={act.activityId}
                className="p-3.5 rounded-2xl bg-[#FAF8F5] dark:bg-[#151515] border border-[#E8E4DC] dark:border-[#2C2C2C] space-y-2.5 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-[#212121] dark:text-white block">
                      {act.title}
                    </span>
                    {act.technicalDetails && (
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
                        {act.technicalDetails}
                      </span>
                    )}
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                      طرح: {toPersianDigits(act.effectivePlannedQuantity)} {act.unit}
                    </span>
                    {act.amendmentDelta !== 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block">
                        ({act.amendmentDelta > 0 ? `+${toPersianDigits(act.amendmentDelta)}` : toPersianDigits(act.amendmentDelta)} اصلاحیه)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center pt-1 border-t border-dashed border-[#E2DDD4] dark:border-[#2A2A2A]">
                  {/* Previously Completed */}
                  <div className="text-[11px] text-neutral-500">
                    <span className="block text-[10px] text-neutral-400">انجام‌شده قبلی:</span>
                    <span className="font-bold text-neutral-700 dark:text-neutral-300 font-mono">
                      {toPersianDigits(act.previouslyCompletedQuantity)} {act.unit}
                    </span>
                  </div>

                  {/* Today's Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#C1A056] mb-1">
                      نصب امروز:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={todayInputs[act.activityId] || ''}
                      onChange={(e) => handleInputChange(act.activityId, e.target.value)}
                      placeholder="۰"
                      className="w-full text-center text-xs font-bold font-mono p-2 rounded-xl border border-[#C1A056]/50 bg-white dark:bg-[#202020] dark:text-white focus:ring-2 focus:ring-[#C1A056]"
                    />
                  </div>

                  {/* Dynamic Remaining */}
                  <div className="text-left">
                    <span className="block text-[10px] text-neutral-400">باقیمانده:</span>
                    {act.isOver ? (
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded">
                        +{toPersianDigits(act.overQty)} مازاد!
                      </span>
                    ) : (
                      <span className={`text-xs font-bold font-mono ${act.remaining === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {toPersianDigits(act.remaining)} {act.unit}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {liveCalculations.anyOverCompleted && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>توجه: تعداد نصب‌شده از سقف طرح اولیه بیشتر است و پس از ثبت، جهت بررسی به مدیر QC گزارش خواهد شد.</span>
              </div>
            )}
          </div>

          {/* Work Hours Tracking */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                ساعت شروع کار:
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                ساعت پایان کار:
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
              />
            </div>
          </div>

          {/* Supervisor Confirmation Toggle */}
          {isSupervisor ? (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                تایید سرپرست اکیپ ({currentUser?.name || 'سرپرست'})
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supervisorConfirmed}
                  onChange={(e) => setSupervisorConfirmed(e.target.checked)}
                  className="rounded text-[#C1A056] focus:ring-[#C1A056]"
                />
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">تایید شده</span>
              </label>
            </div>
          ) : (
            <div className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/40 border border-[#E2DDD4] dark:border-[#2C2C2C] flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>گزارش توسط نصاب ثبت شده و تایید آن برعهده سرپرست اکیپ است.</span>
              </span>
              <span className="text-[10px] bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                در انتظار تایید سرپرست
              </span>
            </div>
          )}

          {/* Optional Details Collapsible (Notes, Photos, Obstacles) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowOptionalDetails((prev) => !prev)}
              className="w-full py-2 px-3 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-[#C1A056] bg-neutral-100/60 dark:bg-neutral-800/40 rounded-xl flex items-center justify-between cursor-pointer transition"
            >
              <span>توضیحات و مستندات تکمیلی (اختیاری)</span>
              {showOptionalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showOptionalDetails && (
              <div className="mt-3 space-y-3.5 p-3 rounded-2xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-neutral-50/50 dark:bg-neutral-900/30 animate-in fade-in duration-150">
                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    یادداشت یا توضیحات روزانه:
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="در صورت وجود نکته خاص یا هماهنگی با کارفرما بنویسید..."
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white leading-relaxed focus:ring-2 focus:ring-[#C1A056]"
                  />
                </div>

                {/* Obstacles */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    موانع کارگاهی یا تاخیرات فیزیکی:
                  </label>
                  <input
                    type="text"
                    value={obstacles}
                    onChange={(e) => setObstacles(e.target.value)}
                    placeholder="مثال: قطعی برق یا حضور عوامل نقاشی"
                    className="w-full text-xs p-2 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                  />
                </div>

                {/* Equipment Issues */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />
                    مشکلات ابزار یا متریال:
                  </label>
                  <input
                    type="text"
                    value={equipmentIssues}
                    onChange={(e) => setEquipmentIssues(e.target.value)}
                    placeholder="مثال: نیاز به رول‌پلاک بلندتر"
                    className="w-full text-xs p-2 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                  />
                </div>

                {/* Continuation Date */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C1A056]" />
                    تاریخ پیشنهادی ادامه کار:
                  </label>
                  <select
                    value={plannedContinuationDate}
                    onChange={(e) => setPlannedContinuationDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
                  >
                    <option value="">پیش‌فرض (روز کاری بعدی تقویم)</option>
                    {upcomingDays.map((d) => (
                      <option key={d.dateKey} value={d.dateKey}>
                        {d.persianDayName} {d.persianDayNum} ({d.dateKey})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Photos */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    عکس‌های پیشرفت امروز (اختیاری):
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {photos.map((ph, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#E2DDD4] dark:border-[#2C2C2C]">
                        <CloudImage src={ph} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <label className="flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-dashed border-[#E2DDD4] dark:border-[#2C2C2C] hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-neutral-400 transition">
                      <Camera className="w-4 h-4 mb-0.5" />
                      <span className="text-[9px] font-bold">عکس</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    <label className="flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-dashed border-[#E2DDD4] dark:border-[#2C2C2C] hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-neutral-400 transition">
                      <Upload className="w-4 h-4 mb-0.5" />
                      <span className="text-[9px] font-bold">گالری</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2DDD4] dark:border-[#2C2C2C] bg-[#FAF7F2] dark:bg-[#181818] flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1"
          >
            انصراف
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="flex-1"
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            ثبت پایان کار امروز
          </Button>
        </div>
      </div>
    </div>
  );
};
