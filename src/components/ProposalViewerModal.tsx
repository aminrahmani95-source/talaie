import React, { useState } from 'react';
import { Portal } from './ui/Portal';
import { ProposalImage } from '../types';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, FileText } from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';
import { CloudImage } from './common/CloudImage';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Props {
  images: ProposalImage[];
  projectTitle: string;
  onClose: () => void;
}

export const ProposalViewerModal: React.FC<Props> = ({ images, projectTitle, onClose }) => {
  useEscapeKey(onClose);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scale, setScale] = useState(1);

  const validImages = (images || []).filter((img) => Boolean(img && img.url && img.url.trim() !== ''));

  if (!validImages || validImages.length === 0) {
    return (
      <Portal><div
        role="dialog"
        aria-modal="true"
        aria-labelledby="empty-proposal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <div className="bg-surface rounded-lg p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border border-line">
          <div className="w-14 h-14 rounded-md bg-raised border border-line flex items-center justify-center mx-auto mb-4 text-brand-ink">
            <FileText className="w-7 h-7" aria-hidden="true" />
          </div>
          <h3 id="empty-proposal-title" className="text-base sm:text-lg font-bold text-ink">
            تصویر پروپوزال ثبت نشده است
          </h3>
          <p className="text-xs text-ink-2 mt-2 leading-relaxed">
            هنوز برای این پروژه عکسی از برگه فروش، نقشه‌ها یا مشخصات فنی ضمیمه نشده است.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 min-h-[44px] px-6 py-2.5 bg-brand hover:bg-brand-hover text-on-brand font-bold rounded-md transition w-full text-xs active:scale-[0.98] cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div></Portal>
    );
  }

  const current = validImages[selectedIndex] || validImages[0];

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.3, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.3, 0.6));
  const handleResetZoom = () => setScale(1);

  const zoomPercent = Math.round(scale * 100);

  return (
    <Portal><div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-viewer-title"
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md text-white"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-canvas border-b border-line select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-raised text-brand-ink border border-brand/30 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="proposal-viewer-title" className="font-bold text-sm sm:text-base text-ink">
              {current.title || 'برگه پروپوزال و نقشه فنی'}
            </h2>
            <p className="text-xs text-brand-ink truncate max-w-[180px] sm:max-w-md mt-0.5">
              {projectTitle}
            </p>
          </div>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom percent indicator */}
          <div className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md bg-sunken border border-line text-xs font-mono text-ink-2 ml-1 tabular-nums">
            {toPersianDigits(zoomPercent)}٪
          </div>

          <button
            type="button"
            onClick={handleZoomIn}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md bg-raised hover:bg-hover text-ink-2 hover:text-ink transition cursor-pointer"
            aria-label="بزرگ‌نمایی تصویر"
            title="بزرگ‌نمایی"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md bg-raised hover:bg-hover text-ink-2 hover:text-ink transition cursor-pointer"
            aria-label="کوچک‌نمایی تصویر"
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md bg-raised hover:bg-hover text-ink-2 hover:text-ink transition cursor-pointer"
            aria-label="اندازه عادی تصویر"
            title="اندازه عادی (100%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <a
            href={current.url}
            download={`proposal-${selectedIndex + 1}.png`}
            className="min-w-[40px] min-h-[40px] hidden sm:flex items-center justify-center rounded-md bg-raised hover:bg-hover text-ink-2 hover:text-ink transition"
            aria-label="دانلود تصویر پروپوزال"
            title="دانلود تصویر"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md bg-rose-600/80 hover:bg-rose-600 text-white transition ml-1 cursor-pointer"
            aria-label="بستن پیش‌نمایش"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 overflow-auto flex p-4 bg-canvas">
        <div
          className="transition-all duration-200 ease-out flex items-center justify-center m-auto"
          style={{ width: `${scale * 100}%`, maxWidth: scale === 1 ? '95vw' : 'none' }}
        >
          <CloudImage
            src={current.url}
            alt={current.title || 'تصویر پروپوزال گالری طلایی'}
            className="w-full h-auto max-h-[85vh] rounded-md shadow-2xl object-contain bg-white"
          />
        </div>
      </div>

      {/* Bottom Thumbnail Bar (if multiple images) */}
      {validImages.length > 1 && (
        <div className="flex items-center justify-center gap-3 p-3 bg-canvas border-t border-line overflow-x-auto">
          {validImages.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setSelectedIndex(idx);
                setScale(1);
              }}
              aria-label={`نمایش صفحه ${toPersianDigits(idx + 1)}`}
              className={`relative rounded-md overflow-hidden border-2 transition min-w-[64px] min-h-[64px] cursor-pointer ${
                selectedIndex === idx
                  ? 'border-brand ring-1 ring-brand/50 opacity-100'
                  : 'border-line opacity-60 hover:opacity-90'
              }`}
            >
              <CloudImage src={img.url} alt="" className="w-16 h-16 object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[11px] text-center text-white py-0.5 font-bold">
                صفحه {toPersianDigits(idx + 1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div></Portal>
  );
};
