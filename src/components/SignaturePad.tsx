import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface Props {
  value?: string;
  onChange: (dataUrl: string | null) => void;
  className?: string;
}

export const SignaturePad: React.FC<Props> = ({ value, onChange, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const isDark = document.documentElement.classList.contains('dark');

  // Setup Canvas resolution and context
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isDark ? '#E8E4DC' : '#1E1E1E';
    }

    // If pre-existing value, draw image onto canvas
    if (value) {
      const img = new Image();
      img.onload = () => {
        const currentCtx = canvas.getContext('2d');
        if (currentCtx) {
          currentCtx.clearRect(0, 0, rect.width, rect.height);
          currentCtx.drawImage(img, 0, 0, rect.width, rect.height);
        }
      };
      img.src = value;
    }
  }, [value, isDark]);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      // Prevent screen scroll while drawing on mobile screen
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export signature as PNG data URL
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    onChange(null);
  };

  return (
    <div className={`space-y-2 select-none ${className}`}>
      <div className="relative border-2 border-dashed border-[#C1A056]/50 rounded-2xl overflow-hidden bg-[#FAF7F2] dark:bg-[#161616] transition-colors shadow-inner">
        {/* Placeholder hint when canvas is pristine */}
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 dark:text-zinc-500">
            <PenTool className="w-6 h-6 mb-1 text-[#C1A056]/60" aria-hidden="true" />
            <span className="text-xs font-bold">با انگشت یا قلم در این کادر امضا کنید</span>
            <span className="text-[10px] mt-0.5 opacity-75">تاییدیه رسمی تحویل اقلام و پرده‌های گالری طلایی</span>
          </div>
        )}

        {/* Guideline line at bottom */}
        <div className="absolute bottom-6 inset-x-6 border-b border-dashed border-slate-300/70 dark:border-zinc-700/60 pointer-events-none flex justify-between text-[9px] text-slate-400 dark:text-zinc-600 px-1">
          <span>خط امضای کارفرما</span>
          <span>TALAEI QC</span>
        </div>

        <canvas
          ref={canvasRef}
          className="w-full h-36 cursor-crosshair touch-none block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          aria-label="پد امضای دیجیتال کارفرما"
        />
      </div>

      {/* Signature Toolbar */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
          {hasSignature ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>امضای دیجیتال دریافت شد</span>
            </>
          ) : (
            <span className="text-slate-400 dark:text-zinc-500 font-normal">در انتظار امضا</span>
          )}
        </div>

        {hasSignature && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 font-bold py-1 px-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition text-[11px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>پاک کردن و امضای مجدد</span>
          </button>
        )}
      </div>
    </div>
  );
};
