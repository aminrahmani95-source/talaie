import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loading,
      icon,
      iconPosition = 'start',
      children,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isCurrentlyLoading = loading ?? isLoading;
    // Base styles: minimum 44px touch target, flex layout, focus ring
    const baseClasses =
      'relative inline-flex items-center justify-center font-bold select-none transition-all duration-150 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1A056] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121212] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    // Touch-friendly sizes with min-h-[44px]
    const sizeClasses = {
      sm: 'text-xs px-3.5 py-2 min-h-[44px] gap-1.5',
      md: 'text-sm px-4 py-2.5 min-h-[44px] gap-2',
      lg: 'text-base px-6 py-3.5 min-h-[48px] gap-2.5',
    }[size];

    // Refined brand colors (Charcoal #212121 and Gold #C1A056)
    const variantClasses = {
      primary:
        'bg-[#212121] text-[#C1A056] hover:bg-[#2D2D2D] dark:bg-[#C1A056] dark:text-[#181818] dark:hover:bg-[#D4B56C] shadow-sm border border-[#C1A056]/30',
      secondary:
        'bg-white dark:bg-[#1F1F1F] text-[#181818] dark:text-[#F5F3EF] border border-[#E2DDD4] dark:border-[#333333] hover:bg-[#F9F7F3] dark:hover:bg-[#262626] shadow-2xs',
      ghost:
        'bg-transparent text-[#4A4742] dark:text-[#BDB8AF] hover:bg-[#EFEBE4]/60 dark:hover:bg-[#262626] hover:text-[#181818] dark:hover:text-[#F5F3EF]',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 shadow-sm border border-rose-700/30',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isCurrentlyLoading}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {isCurrentlyLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />}
        {!isCurrentlyLoading && icon && iconPosition === 'start' && (
          <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!isCurrentlyLoading && icon && iconPosition === 'end' && (
          <span className="shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
