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
        'bg-[#151B23] border border-[#212835] shadow-xs text-[#F0F4F8]',
      elevated:
        'bg-[#1C232D] border border-[#2D3748] shadow-sm text-[#F0F4F8]',
      muted:
        'bg-[#111620] border border-[#212835] text-[#9BA7B6]',
      interactive:
        'bg-[#151B23] border border-[#212835] hover:border-[#C5A059]/60 hover:bg-[#1A222C] cursor-pointer transition-all duration-150 active:scale-[0.995] text-[#F0F4F8]',
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
