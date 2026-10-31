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
        'bg-white dark:bg-[#1B1B1B] border border-[#E2DDD4] dark:border-[#2D2D2D] shadow-2xs',
      elevated:
        'bg-white dark:bg-[#202020] border border-[#E2DDD4] dark:border-[#333333] shadow-md',
      muted:
        'bg-[#F7F4EE] dark:bg-[#161616] border border-[#E8E4DC] dark:border-[#262626]',
      interactive:
        'bg-white dark:bg-[#1B1B1B] border border-[#E2DDD4] dark:border-[#2D2D2D] shadow-2xs hover:border-[#C1A056] dark:hover:border-[#C1A056] hover:shadow-xs cursor-pointer transition-all duration-150 active:scale-[0.99]',
    }[variant];

    return (
      <div
        ref={ref}
        className={`rounded-2xl transition-colors duration-150 ${paddingClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
