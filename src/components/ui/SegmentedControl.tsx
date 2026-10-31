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
  const sizeClasses = size === 'sm' ? 'text-xs p-1' : 'text-xs sm:text-sm p-1';
  const itemPadding = size === 'sm' ? 'px-3 py-1.5 min-h-[36px]' : 'px-3.5 py-2 min-h-[40px]';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center bg-[#EFEBE4] dark:bg-[#1C1C1C] rounded-2xl border border-[#E2DDD4] dark:border-[#2D2D2D] select-none max-w-full overflow-x-auto scrollbar-none ${sizeClasses} ${className}`}
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
            className={`relative flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all duration-150 shrink-0 cursor-pointer ${itemPadding} ${
              isSelected
                ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#181818] shadow-xs ring-1 ring-black/5 dark:ring-white/10'
                : 'text-[#4A4742] dark:text-[#BDB8AF] hover:text-[#181818] dark:hover:text-[#F5F3EF] hover:bg-white/40 dark:hover:bg-white/5'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {countVal !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-none ${
                  isSelected
                    ? 'bg-[#C1A056] text-[#212121] dark:bg-[#181818] dark:text-[#C1A056]'
                    : 'bg-[#E2DDD4] text-[#4A4742] dark:bg-[#2C2C2C] dark:text-[#BDB8AF]'
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
