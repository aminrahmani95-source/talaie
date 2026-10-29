import React, { useState } from 'react';
import { Project, User, PersonnelEvaluation } from '../../types';
import {
  Award,
  Star,
  CheckCircle2,
  X,
  UserCheck,
  ShieldCheck,
  Sparkles,
  FileText,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString } from '../../utils/jalali';

interface Props {
  project: Project;
  users: User[];
  isOpen: boolean;
  onClose: () => void;
  onSaveEvaluation: (evaluation: PersonnelEvaluation) => void;
}

export const PersonnelEvaluationModal: React.FC<Props> = ({
  project,
  users,
  isOpen,
  onClose,
  onSaveEvaluation,
}) => {
  // Find project crew
  const leadUser = users.find((u) => u.id === project.leadTechnicianId);
  const assignedIds = project.assignedTechnicianIds || [];
  const crewUsers = users.filter(
    (u) =>
      assignedIds.includes(u.id) ||
      u.id === project.leadTechnicianId
  );

  const [selectedUserId, setSelectedUserId] = useState<string>(
    project.leadTechnicianId || (crewUsers[0]?.id ?? '')
  );
  const [technicalScore, setTechnicalScore] = useState<number>(5);
  const [behavioralScore, setBehavioralScore] = useState<number>(5);
  const [cleanlinessScore, setCleanlinessScore] = useState<number>(5);
  const [criticalIncidentNote, setCriticalIncidentNote] = useState<string>('');

  if (!isOpen) return null;

  const targetUser = users.find((u) => u.id === selectedUserId) || leadUser || crewUsers[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    const evaluation: PersonnelEvaluation = {
      id: `eval-${Date.now()}`,
      userId: targetUser.id,
      userName: targetUser.name,
      role: targetUser.role,
      technicalScore,
      behavioralScore,
      cleanlinessScore,
      criticalIncidentNote: criticalIncidentNote.trim(),
      evaluatedBy: 'امین رحمانی (مسئول QC)',
      evaluatedAt: getTodayPersianString(),
    };

    onSaveEvaluation(evaluation);
    onClose();
    alert(`ارزیابی عملکرد ${targetUser.name} با موفقیت در سوابق و شاخص‌های KPI ثبت شد.`);
  };

  const renderStarPicker = (
    label: string,
    subLabel: string,
    value: number,
    onChange: (v: number) => void
  ) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[#212121] dark:text-white">{label}</span>
        <span className="font-bold text-[#C1A056] font-mono">{toPersianDigits(value)} از 5</span>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-zinc-400">{subLabel}</p>
      <div className="flex items-center gap-1.5 pt-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="p-1 transition hover:scale-115 active:scale-95"
          >
            <Star
              className={`w-5 h-5 ${
                s <= value
                  ? 'text-[#C1A056] fill-[#C1A056]'
                  : 'text-slate-300 dark:text-zinc-700'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-lg w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden my-6 transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#C1A056] border border-[#C1A056]/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">
                برگه ارزیابی عملکرد و شاخص ۳۶۰ درجه پرسنل
              </h3>
              <p className="text-xs text-[#C1A056] font-bold line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Pick User to evaluate */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              انتخاب سرپرست یا تکنسین پروژه:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {crewUsers.map((u) => {
                const isSelected = u.id === selectedUserId;
                const isLead = u.role === 'LEAD_TECHNICIAN';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`p-3 rounded-2xl border text-right transition flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-[#C1A056] bg-[#FAF7F2] dark:bg-[#222222] ring-2 ring-[#C1A056]/30 shadow-xs'
                        : 'border-[#E8E4DC] dark:border-[#2D2D2D] bg-white dark:bg-[#181818]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#212121] text-[#C1A056] flex items-center justify-center font-bold text-xs shrink-0">
                      {isLead ? 'سرپرست' : 'تکنسین'}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-bold text-xs text-[#212121] dark:text-white truncate">
                        {u.name.split(' (')[0]}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                        {u.phone}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 Evaluation Criteria */}
          <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#333333] space-y-4">
            {renderStarPicker(
              '۱. مهارت فنی، تراز و کیفیت نهایی اجرا',
              'دقت در شاقول بودن قاب، عدم چروک در لت‌های شید و عملکرد نرم موتور سامفی',
              technicalScore,
              setTechnicalScore
            )}

            <div className="border-t border-[#E8E4DC] dark:border-[#2E2E2E]" />

            {renderStarPicker(
              '۲. آراستگی، اخلاق حرفه‌ای و تعامل با مشتری',
              'برخورد رسمی با کارفرما، خوش‌قولی و ارائه آموزش نحوه کارکرد ریموت کنترل',
              behavioralScore,
              setBehavioralScore
            )}

            <div className="border-t border-[#E8E4DC] dark:border-[#2E2E2E]" />

            {renderStarPicker(
              '۳. استانداردهای لوکس طلایی و نظافت محیط',
              'پهن کردن آستری زیر جعبه ابزار، اتوکشی پرده و جمع‌آوری کامل براده‌ها',
              cleanlinessScore,
              setCleanlinessScore
            )}
          </div>

          {/* Critical Incident Technique (CIT) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#C1A056]" />
              <span>فرم ثبت وقایع حساس (CIT) جهت محاسبه در KPI و پاداش:</span>
            </label>
            <textarea
              rows={2}
              placeholder="مثال: دقت بسیار بالا در مهاربندی کناف دوبلکس نیاوران و تحویل بی‌نقص قبل از زمان مقرر که مورد تحسین کارفرما قرار گرفت..."
              value={criticalIncidentNote}
              onChange={(e) => setCriticalIncidentNote(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] bg-[#FAF7F2] dark:bg-[#151515] dark:text-white"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#252525]"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-black rounded-xl text-xs transition border border-[#C1A056]/30 shadow-md active:scale-98 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[#C1A056]" />
              ثبت ارزیابی پرسنل
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
