import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 sm:pb-3 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-[#C1A056]/15 text-[#8E6F27] dark:text-[#E5CA8F] flex items-center justify-center shrink-0 border border-[#C1A056]/30">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-[#181818] dark:text-[#F5F3EF] truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[#69655F] dark:text-[#9E988D] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};
