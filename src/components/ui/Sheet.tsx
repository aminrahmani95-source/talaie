import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useEscapeKey } from '../../hooks/useEscapeKey';

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

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-3xl',
    '2xl': 'sm:max-w-4xl',
    full: 'sm:max-w-6xl',
  }[effectiveMaxWidth];

  // Rendered at the end of <body>: inside a blurred/transformed parent (like the sticky header)
  // a fixed overlay is trapped in that parent's box and covered only the header.
  const sheet = (
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
        className={`w-full ${maxWidthClasses} bg-surface rounded-t-lg sm:rounded-lg shadow-2xl border border-line-strong flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 sm:zoom-in-95 duration-200 ${className}`}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-10 h-1 bg-line-strong rounded mx-auto mt-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-line bg-sunken shrink-0">
          <div className="min-w-0 pr-1">
            <h2 id="sheet-title" className="font-bold text-sm sm:text-base text-ink truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-ink-2 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="بستن پنجره"
            icon={<X className="w-4 h-4" />}
            onClick={onClose}
          />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="px-4 sm:px-5 py-3 border-t border-line bg-sunken shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet;
};
