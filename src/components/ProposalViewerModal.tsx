import React, { useState } from 'react';
import { ProposalImage } from '../types';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, FileText } from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';
import { CloudImage } from './common/CloudImage';

interface Props {
  images: ProposalImage[];
  projectTitle: string;
  onClose: () => void;
}

export const ProposalViewerModal: React.FC<Props> = ({ images, projectTitle, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scale, setScale] = useState(1);

  const validImages = (images || []).filter((img) => Boolean(img && img.url && img.url.trim() !== ''));

  if (!validImages || validImages.length === 0) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="empty-proposal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      >
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D]">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#252525] border border-slate-200 dark:border-[#333333] flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-500">
            <FileText className="w-8 h-8" aria-hidden="true" />
          </div>
          <h3 id="empty-proposal-title" className="text-lg font-black text-slate-800 dark:text-white">
            تصویر پروپوزال ثبت نشده است
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            هنوز برای این پروژه عکسی از برگه فروش، نقشه‌ها یا مشخصات فنی ضمیمه نشده است.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 min-h-[44px] px-6 py-2.5 bg-[#212121] dark:bg-[#C1A056] text-[#C1A056] dark:text-[#1A1A1A] font-black rounded-xl hover:bg-slate-800 dark:hover:bg-[#A88738] transition w-full text-sm active:scale-[0.98]"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    );
  }

  const current = validImages[selectedIndex] || validImages[0];

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.3, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.3, 0.6));
  const handleResetZoom = () => setScale(1);

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-viewer-title"
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md text-white"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border-b border-[#C1A056]/30 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 text-[#C1A056] border border-[#C1A056]/30 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="proposal-viewer-title" className="font-black text-sm sm:text-base text-white">
              {current.title || 'برگه پروپوزال و نقشه فنی'}
            </h2>
            <p className="text-xs text-[#C1A056] truncate max-w-[180px] sm:max-w-md mt-0.5">
              {projectTitle}
            </p>
          </div>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom percent indicator */}
          <div className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-slate-300 ml-1">
            {toPersianDigits(zoomPercent)}٪
          </div>

          <button
            type="button"
            onClick={handleZoomIn}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition active:scale-95"
            aria-label="بزرگ‌نمایی تصویر"
            title="بزرگ‌نمایی"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition active:scale-95"
            aria-label="کوچک‌نمایی تصویر"
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition active:scale-95"
            aria-label="اندازه عادی تصویر"
            title="اندازه عادی (100%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <a
            href={current.url}
            download={`proposal-${selectedIndex + 1}.png`}
            className="min-w-[44px] min-h-[44px] hidden sm:flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition active:scale-95"
            aria-label="دانلود تصویر پروپوزال"
            title="دانلود تصویر"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-red-600/80 hover:bg-red-600 text-white transition ml-1 active:scale-95"
            aria-label="بستن پیش‌نمایش"
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
          <CloudImage
            src={current.url}
            alt={current.title || 'تصویر پروپوزال گالری طلایی'}
            className="max-h-[80vh] max-w-[95vw] rounded-xl shadow-2xl object-contain bg-white"
          />
        </div>
      </div>

      {/* Bottom Thumbnail Bar (if multiple images) */}
      {validImages.length > 1 && (
        <div className="flex items-center justify-center gap-3 p-3 bg-[#151515] border-t border-white/10 overflow-x-auto">
          {validImages.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setSelectedIndex(idx);
                setScale(1);
              }}
              aria-label={`نمایش صفحه ${toPersianDigits(idx + 1)}`}
              className={`relative rounded-xl overflow-hidden border-2 transition min-w-[64px] min-h-[64px] ${
                selectedIndex === idx
                  ? 'border-[#C1A056] ring-2 ring-[#C1A056]/50 opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-90'
              }`}
            >
              <CloudImage src={img.url} alt="" className="w-16 h-16 object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[10px] text-center text-white py-0.5 font-bold">
                صفحه {toPersianDigits(idx + 1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
