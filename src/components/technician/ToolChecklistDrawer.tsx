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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="bg-[#151B23] rounded-t-lg sm:rounded-lg max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-[#212835]">
        {/* Header */}
        <div className="bg-[#0D1117] px-6 py-4 text-[#F0F4F8] flex items-center justify-between shrink-0 border-b border-[#212835]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="tool-checklist-title" className="font-bold text-sm sm:text-base text-[#F0F4F8]">
                  چک‌لیست بارگیری ابزار از انبار
                </h3>
                {project.isFullTools && (
                  <span className="text-xs bg-[#1C232D] text-[#E5CA8F] border border-[#C5A059]/40 px-2 py-0.5 rounded font-semibold">
                    فول ابزار
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9BA7B6] truncate">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] flex items-center justify-center transition cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-[#111620] px-6 py-3 border-b border-[#212835] shrink-0">
          <div className="flex items-center justify-between text-xs text-[#F0F4F8] font-semibold mb-1.5">
            <span>وضعیت بارگیری در خودرو:</span>
            <span className="text-[#C5A059] font-mono tabular-nums">
              {toPersianDigits(checkedTools.length)} از {toPersianDigits(tools.length)} قلم ({toPersianDigits(progress)}٪)
            </span>
          </div>
          <div className="w-full bg-[#1C232D] h-2 rounded overflow-hidden">
            <div
              className="bg-[#C5A059] h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Tools List */}
        <div className="p-5 overflow-y-auto space-y-2 flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#9BA7B6]">اقلام مورد نیاز مأموریت:</span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-[#C5A059] hover:underline font-semibold py-1 px-2 cursor-pointer"
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
                className={`flex items-center gap-3 p-3 rounded-md border text-xs cursor-pointer transition select-none min-h-[44px] ${
                  isChecked
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold'
                    : 'border-[#212835] bg-[#111620] text-[#9BA7B6] hover:border-[#2D3748] hover:text-[#F0F4F8]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center transition shrink-0 ${
                    isChecked
                      ? 'bg-emerald-500 text-[#0D1117]'
                      : 'border border-[#2D3748] bg-[#0D1117]'
                  }`}
                >
                  {isChecked && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
                </div>
                <span className="flex-1">{tool}</span>
              </label>
            );
          })}

          {project.customToolsNotes && (
            <div className="mt-4 p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              <span className="font-semibold block mb-1">ابزار و تجهیزات خاص مأموریت:</span>
              <p className="leading-relaxed">{project.customToolsNotes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0D1117] border-t border-[#212835] shrink-0 safe-bottom-padding">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] font-bold rounded-md text-xs transition cursor-pointer min-h-[44px]"
          >
            تایید و بستن چک‌لیست
          </button>
        </div>
      </div>
    </div>
  );
};
