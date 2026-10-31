import React from 'react';
import { Button, ButtonProps } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
    icon?: React.ReactNode;
  };
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-[#E2DDD4] dark:border-[#2D2D2D] bg-[#FAF7F2]/50 dark:bg-[#181818]/50 ${
        compact ? 'p-4 sm:p-5' : 'p-6 sm:p-8'
      } ${className}`}
    >
      {icon && (
        <div
          className={`rounded-2xl bg-white dark:bg-[#202020] border border-[#E2DDD4] dark:border-[#2E2E2E] flex items-center justify-center text-[#8E6F27] dark:text-[#C1A056] shadow-2xs mb-2.5 ${
            compact ? 'w-10 h-10' : 'w-12 h-12'
          }`}
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm sm:text-base font-bold text-[#181818] dark:text-[#F5F3EF]">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-[#69655F] dark:text-[#9E988D] max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-3.5">
          <Button
            size="sm"
            variant={action.variant || 'secondary'}
            icon={action.icon}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};
