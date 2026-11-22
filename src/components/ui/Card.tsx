import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'muted' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const paddingClasses = {
      none: 'p-0',
      sm: 'p-3 sm:p-4',
      md: 'p-4 sm:p-5',
      lg: 'p-5 sm:p-6',
    }[padding];

    const variantClasses = {
      default:
        'bg-surface border border-line shadow-xs text-ink',
      elevated:
        'bg-raised border border-line-strong shadow-sm text-ink',
      muted:
        'bg-sunken border border-line text-ink-2',
      interactive:
        'bg-surface border border-line hover:border-brand/60 hover:bg-[#1A222C] cursor-pointer transition-all duration-150 active:scale-[0.995] text-ink',
    }[variant];

    return (
      <div
        ref={ref}
        className={`rounded-lg transition-colors duration-150 ${paddingClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
