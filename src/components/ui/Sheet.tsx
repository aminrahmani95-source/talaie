import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth,
  size,
  className = '',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const effectiveMaxWidth = size ?? maxWidth ?? 'md';

  // Close on Escape & Lock body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-3xl',
    '2xl': 'sm:max-w-4xl',
    full: 'sm:max-w-6xl',
  }[effectiveMaxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={contentRef}
        className={`w-full ${maxWidthClasses} bg-white dark:bg-[#1C1C1C] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E2DDD4] dark:border-[#333333] flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 sm:zoom-in-95 duration-200 ${className}`}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1 bg-[#E2DDD4] dark:bg-[#333333] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2DDD4] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#181818] shrink-0">
          <div className="min-w-0 pr-1">
            <h2 id="sheet-title" className="font-bold text-base text-[#181818] dark:text-[#F5F3EF] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#69655F] dark:text-[#9E988D] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="بستن پنجره"
            icon={<X className="w-5 h-5" />}
            onClick={onClose}
          />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#E2DDD4] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#181818] shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
