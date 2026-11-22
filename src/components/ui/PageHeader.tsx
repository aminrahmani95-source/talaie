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
          <div className="w-9 h-9 rounded-md bg-raised text-brand-ink flex items-center justify-center shrink-0 border border-brand/30 shadow-xs">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-black text-ink truncate tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-ink-2 truncate mt-0.5">
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
