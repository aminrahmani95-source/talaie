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

  const upcomingDays = getUpcomingDays(60);

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
      <div className="bg-[#151B23] rounded-lg max-w-lg w-full shadow-2xl border border-[#212835] overflow-hidden my-6 transition-all max-h-[92vh] flex flex-col">
        {/* Header - Auto-populated metadata */}
        <div className="bg-[#0D1117] px-5 py-4 text-[#F0F4F8] flex items-center justify-between border-b border-[#212835] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#F0F4F8]">
                ثبت پیشرفت روزانه و پایان شیفت کاری
              </h3>
              <p className="text-xs text-[#C5A059] mt-0.5">
                <span className="font-mono">{project.code}</span> • {project.title} • {project.assignedTeamName || 'اکیپ نصب'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Planned Activities vs Today's Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#F0F4F8] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#C5A059]" />
                اقلام کار و پیشرفت امروز:
              </span>
              <button
                type="button"
                onClick={handleQuickFillRemaining}
                className="text-[11px] font-semibold text-[#C5A059] hover:text-[#E5CA8F] flex items-center gap-1 cursor-pointer transition py-1 px-2 rounded-md bg-[#1C232D] border border-[#C5A059]/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                تکمیل تمام لت‌های باقیمانده
              </button>
            </div>

            {liveCalculations.items.map((act) => (
              <div
                key={act.activityId}
                className="p-3.5 rounded-md bg-[#111620] border border-[#212835] space-y-2.5 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-xs text-[#F0F4F8] block">
                      {act.title}
                    </span>
                    {act.technicalDetails && (
                      <span className="text-[11px] text-[#9BA7B6] block mt-0.5">
                        {act.technicalDetails}
                      </span>
                    )}
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-xs font-medium text-[#9BA7B6] tabular-nums">
                      طرح: {toPersianDigits(act.effectivePlannedQuantity)} {act.unit}
                    </span>
                    {act.amendmentDelta !== 0 && (
                      <span className="text-[10px] text-amber-400 block tabular-nums">
                        ({act.amendmentDelta > 0 ? `+${toPersianDigits(act.amendmentDelta)}` : toPersianDigits(act.amendmentDelta)} اصلاحیه)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center pt-1 border-t border-dashed border-[#212835]">
                  {/* Previously Completed */}
                  <div className="text-[11px] text-[#9BA7B6]">
                    <span className="block text-[10px] text-[#637184]">انجام‌شده قبلی:</span>
                    <span className="font-semibold text-[#F0F4F8] font-mono tabular-nums">
                      {toPersianDigits(act.previouslyCompletedQuantity)} {act.unit}
                    </span>
                  </div>

                  {/* Today's Input */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#C5A059] mb-1">
                      نصب امروز:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={todayInputs[act.activityId] || ''}
                      onChange={(e) => handleInputChange(act.activityId, e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-xs font-bold font-mono tabular-nums p-2 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                    />
                  </div>

                  {/* Dynamic Remaining */}
                  <div className="text-left">
                    <span className="block text-[10px] text-[#637184]">باقیمانده:</span>
                    {act.isOver ? (
                      <span className="text-[11px] font-bold text-rose-400 font-mono tabular-nums bg-rose-500/10 px-1.5 py-0.5 rounded">
                        +{toPersianDigits(act.overQty)} مازاد!
                      </span>
                    ) : (
                      <span className={`text-xs font-semibold font-mono tabular-nums ${act.remaining === 0 ? 'text-emerald-400' : 'text-[#F0F4F8]'}`}>
                        {toPersianDigits(act.remaining)} {act.unit}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {liveCalculations.anyOverCompleted && (
              <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>توجه: تعداد نصب‌شده از سقف طرح اولیه بیشتر است و پس از ثبت، جهت بررسی به مدیر QC گزارش خواهد شد.</span>
              </div>
            )}
          </div>

          {/* Work Hours Tracking */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-[#9BA7B6] mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#637184]" />
                ساعت شروع کار:
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA7B6] mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#637184]" />
                ساعت پایان کار:
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059]"
              />
            </div>
          </div>

          {/* Supervisor Confirmation Toggle */}
          {isSupervisor ? (
            <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                تایید سرپرست اکیپ ({currentUser?.name || 'سرپرست'})
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supervisorConfirmed}
                  onChange={(e) => setSupervisorConfirmed(e.target.checked)}
                  className="rounded text-[#C5A059] focus:ring-[#C5A059]"
                />
                <span className="text-[11px] font-medium text-[#9BA7B6]">تایید شده</span>
              </label>
            </div>
          ) : (
            <div className="p-2.5 rounded-md bg-[#111620] border border-[#212835] flex items-center justify-between text-xs text-[#9BA7B6]">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#637184] shrink-0" />
                <span>گزارش توسط نصاب ثبت شده و تایید آن برعهده سرپرست اکیپ است.</span>
              </span>
              <span className="text-[10px] bg-[#1C232D] text-[#9BA7B6] px-2 py-0.5 rounded font-medium shrink-0">
                در انتظار تایید سرپرست
              </span>
            </div>
          )}

          {/* Optional Details Collapsible (Notes, Photos, Obstacles) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowOptionalDetails((prev) => !prev)}
              className="w-full py-2 px-3 text-xs font-semibold text-[#9BA7B6] hover:text-[#F0F4F8] bg-[#111620] hover:bg-[#1C232D] rounded-md border border-[#212835] flex items-center justify-between cursor-pointer transition"
            >
              <span>توضیحات و مستندات تکمیلی (اختیاری)</span>
              {showOptionalDetails ? <ChevronUp className="w-4 h-4 text-[#C5A059]" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showOptionalDetails && (
              <div className="mt-3 space-y-3.5 p-3 rounded-md border border-[#212835] bg-[#111620] animate-in fade-in duration-150">
                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-[#9BA7B6] mb-1">
                    یادداشت یا توضیحات روزانه:
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="در صورت وجود نکته خاص یا هماهنگی با کارفرما بنویسید..."
                    className="w-full text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] leading-relaxed focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                  />
                </div>

                {/* Obstacles */}
                <div>
                  <label className="block text-xs font-medium text-[#9BA7B6] mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    موانع کارگاهی یا تاخیرات فیزیکی:
                  </label>
                  <input
                    type="text"
                    value={obstacles}
                    onChange={(e) => setObstacles(e.target.value)}
                    placeholder="مثال: قطعی برق یا حضور عوامل نقاشی"
                    className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059]"
                  />
                </div>

                {/* Equipment Issues */}
                <div>
                  <label className="block text-xs font-medium text-[#9BA7B6] mb-1 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    مشکلات ابزار یا متریال:
                  </label>
                  <input
                    type="text"
                    value={equipmentIssues}
                    onChange={(e) => setEquipmentIssues(e.target.value)}
                    placeholder="مثال: نیاز به رول‌پلاک بلندتر"
                    className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059]"
                  />
                </div>

                {/* Continuation Date */}
                <div>
                  <label className="block text-xs font-medium text-[#9BA7B6] mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
                    تاریخ پیشنهادی ادامه کار:
                  </label>
                  <select
                    value={plannedContinuationDate}
                    onChange={(e) => setPlannedContinuationDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-md border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059]"
                  >
                    <option value="">پیش‌فرض (روز کاری بعدی تقویم)</option>
                    {upcomingDays.map((d) => (
                      <option key={d.dateKey} value={d.dateKey}>
                        {d.persianDayName} {d.persianDayNum} {d.persianMonthName} ({toPersianDigits(d.persianDateStr)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Photos */}
                <div>
                  <label className="block text-xs font-medium text-[#9BA7B6] mb-1">
                    عکس‌های پیشرفت امروز (اختیاری):
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {photos.map((ph, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-md overflow-hidden border border-[#212835]">
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

                    <label className="flex flex-col items-center justify-center w-14 h-14 rounded-md border border-dashed border-[#2D3748] hover:border-[#C5A059] hover:bg-[#1C232D] cursor-pointer text-[#9BA7B6] transition">
                      <Camera className="w-4 h-4 mb-0.5 text-[#C5A059]" />
                      <span className="text-[9px] font-medium">عکس</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    <label className="flex flex-col items-center justify-center w-14 h-14 rounded-md border border-dashed border-[#2D3748] hover:border-[#C5A059] hover:bg-[#1C232D] cursor-pointer text-[#9BA7B6] transition">
                      <Upload className="w-4 h-4 mb-0.5 text-[#C5A059]" />
                      <span className="text-[9px] font-medium">گالری</span>
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
        <div className="p-4 border-t border-[#212835] bg-[#0D1117] flex items-center gap-2 shrink-0">
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
