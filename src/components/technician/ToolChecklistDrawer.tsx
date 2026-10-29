import React, { useState } from 'react';
import { Project } from '../../types';
import { Wrench, CheckCircle2, X } from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  project: Project;
  onClose: () => void;
}

export const ToolChecklistDrawer: React.FC<Props> = ({ project, onClose }) => {
  const tools = project.toolsRequired || [];
  // Local state for checking items off when loading the vehicle
  const [checkedTools, setCheckedTools] = useState<string[]>([]);

  const handleToggle = (tool: string) => {
    if (checkedTools.includes(tool)) {
      setCheckedTools(checkedTools.filter((t) => t !== tool));
    } else {
      setCheckedTools([...checkedTools, tool]);
    }
  };

  const handleSelectAll = () => {
    if (checkedTools.length === tools.length) {
      setCheckedTools([]);
    } else {
      setCheckedTools([...tools]);
    }
  };

  const progress =
    tools.length > 0
      ? Math.round((checkedTools.length / tools.length) * 100)
      : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tool-checklist-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-[#E8E4DC] dark:border-[#2D2D2D]">
        {/* Header */}
        <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between shrink-0 border-b border-[#C1A056]/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 text-[#C1A056] rounded-xl border border-white/10">
              <Wrench className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="tool-checklist-title" className="font-black text-sm sm:text-base text-white">
                  چک‌لیست بارگیری ابزار از انبار
                </h3>
                {project.isFullTools && (
                  <span className="text-[10px] bg-[#C1A056]/20 text-[#C1A056] border border-[#C1A056]/40 px-2.5 py-0.5 rounded-full font-bold">
                    فول ابزار
                  </span>
                )}
              </div>
              <p className="text-xs text-[#E8E4DC] truncate">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-[#FAF7F2] dark:bg-[#202020] px-6 py-3 border-b border-[#E8E4DC] dark:border-[#2D2D2D] shrink-0">
          <div className="flex items-center justify-between text-xs text-[#212121] dark:text-white font-bold mb-1.5">
            <span>وضعیت بارگیری در خودرو:</span>
            <span className="font-mono text-[#A88738] dark:text-[#C1A056]">
              {toPersianDigits(checkedTools.length)} از {toPersianDigits(tools.length)} قلم ({toPersianDigits(progress)}٪)
            </span>
          </div>
          <div className="w-full bg-[#E8E4DC] dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#C1A056] h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Tools List */}
        <div className="p-6 overflow-y-auto space-y-2 flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">اقلام مورد نیاز مأموریت:</span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-[#C1A056] hover:text-[#A88738] font-bold py-1 px-2 rounded-lg"
            >
              {checkedTools.length === tools.length
                ? 'لغو انتخاب همه'
                : 'تیک زدن همه اقلام'}
            </button>
          </div>

          {project.toolsRequired.map((tool) => {
            const isChecked = checkedTools.includes(tool);
            return (
              <label
                key={tool}
                onClick={() => handleToggle(tool)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-xs cursor-pointer transition select-none min-h-[48px] active:scale-[0.99] ${
                  isChecked
                    ? 'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-300 font-bold'
                    : 'border-slate-200 dark:border-[#2D2D2D] bg-slate-50 dark:bg-[#161616] text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-[#202020]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition shrink-0 ${
                    isChecked
                      ? 'bg-emerald-600 text-white'
                      : 'border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-[#1A1A1A]'
                  }`}
                >
                  {isChecked && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                </div>
                <span className="flex-1">{tool}</span>
              </label>
            );
          })}

          {project.customToolsNotes && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-300">
              <span className="font-bold block mb-1">ابزار و تجهیزات خاص مأموریت:</span>
              <p className="leading-relaxed">{project.customToolsNotes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF7F2] dark:bg-[#202020] border-t border-[#E8E4DC] dark:border-[#2D2D2D] shrink-0 safe-bottom-padding">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold rounded-xl text-sm transition border border-[#C1A056]/30 active:scale-[0.99] min-h-[48px]"
          >
            تایید و بستن چک‌لیست
          </button>
        </div>
      </div>
    </div>
  );
};
