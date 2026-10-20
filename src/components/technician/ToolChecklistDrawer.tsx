import React, { useState } from 'react';
import { Project } from '../../types';
import { Wrench, CheckCircle2, X, Sparkles } from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  project: Project;
  onClose: () => void;
}

export const ToolChecklistDrawer: React.FC<Props> = ({ project, onClose }) => {
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
    if (checkedTools.length === project.toolsRequired.length) {
      setCheckedTools([]);
    } else {
      setCheckedTools([...project.toolsRequired]);
    }
  };

  const progress =
    project.toolsRequired.length > 0
      ? Math.round((checkedTools.length / project.toolsRequired.length) * 100)
      : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base">چک‌لیست بارگیری ابزار از انبار</h3>
                {project.isFullTools && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    فول ابزار
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{project.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-700 font-bold mb-1.5">
            <span>وضعیت بارگیری در خودرو:</span>
            <span className="font-mono text-blue-700">
              {toPersianDigits(checkedTools.length)} از {toPersianDigits(project.toolsRequired.length)} قلم ({toPersianDigits(progress)}٪)
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Tools List */}
        <div className="p-6 overflow-y-auto space-y-2 flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">اقلام مورد نیاز مأموریت:</span>
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold"
            >
              {checkedTools.length === project.toolsRequired.length
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
                className={`flex items-center gap-3 p-3 rounded-2xl border text-xs cursor-pointer transition select-none ${
                  isChecked
                    ? 'border-emerald-400 bg-emerald-50/70 text-emerald-950 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition ${
                    isChecked
                      ? 'bg-emerald-600 text-white'
                      : 'border-2 border-slate-300 bg-white'
                  }`}
                >
                  {isChecked && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <span className="flex-1">{tool}</span>
              </label>
            );
          })}

          {project.customToolsNotes && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="font-bold block mb-1">⚠️ ابزار و تجهیزات خاص مأموریت:</span>
              <p className="leading-relaxed">{project.customToolsNotes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition"
          >
            تایید و بستن چک‌لیست
          </button>
        </div>
      </div>
    </div>
  );
};
