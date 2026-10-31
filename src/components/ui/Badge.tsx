import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'gold' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  icon,
  className = '',
  children,
  ...props
}) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2.5 py-0.5 gap-1' : 'text-sm px-3 py-1 gap-1.5';

  const variantClasses = {
    default:
      'bg-[#EFEBE4] dark:bg-[#2A2A2A] text-[#4A4742] dark:text-[#D1CCC2] border border-[#E2DDD4] dark:border-[#383838]',
    gold:
      'bg-[#C1A056]/15 text-[#8E6F27] dark:text-[#E5CA8F] border border-[#C1A056]/30',
    success:
      'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
    warning:
      'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
    danger:
      'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50',
    info:
      'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50',
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
