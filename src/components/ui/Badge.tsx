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
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  const variantClasses = {
    default:
      'bg-[#1C232D] text-[#9BA7B6] border border-[#2D3748]',
    gold:
      'bg-[#C5A059]/15 text-[#E5CA8F] border border-[#C5A059]/30',
    success:
      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    warning:
      'bg-amber-500/10 text-amber-300 border border-amber-500/30',
    danger:
      'bg-rose-500/15 text-rose-300 border border-rose-500/40',
    info:
      'bg-sky-500/10 text-sky-400 border border-sky-500/30',
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-bold rounded select-none tracking-tight ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
