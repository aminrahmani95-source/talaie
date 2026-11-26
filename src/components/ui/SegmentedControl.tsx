import React from 'react';

export interface SegmentedControlOption<T extends string = string> {
  value?: T;
  id?: T;
  label: string;
  count?: number | string;
  badge?: number | string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
  ariaLabel = 'انتخاب دسته‌بندی',
}: SegmentedControlProps<T>) {
  const sizeClasses = size === 'sm' ? 'text-xs p-0.5' : 'text-xs sm:text-sm p-1';
  const itemPadding = size === 'sm' ? 'px-2.5 py-1.5 min-h-[36px]' : 'px-3 py-2 min-h-[40px]';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap items-center gap-0.5 bg-sunken rounded-md border border-line select-none max-w-full ${sizeClasses} ${className}`}
    >
      {options.map((opt) => {
        const optVal = (opt.value ?? opt.id) as T;
        const countVal = opt.count ?? opt.badge;
        const isSelected = optVal === value;
        return (
          <button
            key={optVal}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onChange(optVal)}
            className={`relative flex items-center justify-center gap-1.5 rounded font-bold transition-all duration-150 shrink-0 cursor-pointer ${itemPadding} ${
              isSelected
                ? 'bg-raised text-brand-ink border border-brand/40 shadow-xs'
                : 'text-ink-2 hover:text-ink hover:bg-surface border border-transparent'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {countVal !== undefined && (
              <span
                className={`text-[12px] px-1.5 py-0.5 rounded font-bold leading-none ${
                  isSelected
                    ? 'bg-brand text-on-brand'
                    : 'bg-raised text-ink-2 border border-line-strong'
                }`}
              >
                {countVal}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
