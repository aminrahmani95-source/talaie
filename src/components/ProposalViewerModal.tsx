import React, { useState } from 'react';
import { ProposalImage } from '../types';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, FileText } from 'lucide-react';

interface Props {
  images: ProposalImage[];
  projectTitle: string;
  onClose: () => void;
}

export const ProposalViewerModal: React.FC<Props> = ({ images, projectTitle, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scale, setScale] = useState(1);

  if (!images || images.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">تصویر پروپوزال ثبت نشده است</h3>
          <p className="text-sm text-slate-500 mt-2">
            هنوز برای این پروژه عکسی از برگه فروش یا پروپوزال فنی ضمیمه نشده است.
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium w-full"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    );
  }

  const current = images[selectedIndex];

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.3, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.3, 0.6));
  const handleResetZoom = () => setScale(1);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#212121] border-b border-[#C1A056]/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 text-[#C1A056] rounded-xl border border-white/10">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base text-white">{current.title || 'برگه پروپوزال فروش'}</h2>
            <p className="text-xs text-[#C1A056] truncate max-w-[200px] sm:max-w-md">{projectTitle}</p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="بزرگ‌نمایی"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="اندازه عادی"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <a
            href={current.url}
            download={`proposal-${selectedIndex + 1}.png`}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition hidden sm:inline-flex"
            title="دانلود تصویر"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition ml-2"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 touch-pan-x touch-pan-y">
        <div
          className="transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${scale})` }}
        >
          <img
            src={current.url}
            alt={current.title}
            className="max-h-[80vh] max-w-[95vw] rounded-lg shadow-2xl object-contain bg-white"
          />
        </div>
      </div>

      {/* Bottom Thumbnail Bar (if multiple images) */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-3 p-3 bg-slate-900 border-t border-slate-800 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => {
                setSelectedIndex(idx);
                setScale(1);
              }}
              className={`relative rounded-lg overflow-hidden border-2 transition ${
                selectedIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img.url} alt="" className="w-16 h-16 object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-center text-white py-0.5">
                صفحه {idx + 1}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
