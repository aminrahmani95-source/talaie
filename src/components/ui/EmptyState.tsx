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
      className={`flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-[#2D3748] bg-[#111620]/60 ${
        compact ? 'p-4 sm:p-5' : 'p-6 sm:p-8'
      } ${className}`}
    >
      {icon && (
        <div
          className={`rounded-md bg-[#1C232D] border border-[#2D3748] flex items-center justify-center text-[#C5A059] shadow-xs mb-2.5 ${
            compact ? 'w-10 h-10' : 'w-12 h-12'
          }`}
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm sm:text-base font-bold text-[#F0F4F8]">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-[#9BA7B6] max-w-sm mt-1 leading-relaxed">
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
