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
      'relative inline-flex items-center justify-center font-bold select-none transition-all duration-150 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0D1117] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer tracking-tight';

    // Touch-friendly sizes with min-h-[44px] accessibility standard
    const sizeClasses = {
      sm: 'text-xs px-3 py-1.5 min-h-[38px] gap-1.5',
      md: 'text-sm px-4 py-2 min-h-[44px] gap-2',
      lg: 'text-base px-5 py-2.5 min-h-[48px] gap-2.5',
    }[size];

    // Enterprise industrial color tokens
    const variantClasses = {
      primary:
        'bg-[#C5A059] text-[#0D1117] hover:bg-[#D4AF37] border border-[#C5A059] shadow-xs',
      secondary:
        'bg-[#151B23] text-[#F0F4F8] border border-[#2D3748] hover:border-[#3E4C63] hover:bg-[#1C232D] shadow-xs',
      ghost:
        'bg-transparent text-[#9BA7B6] hover:bg-[#1C232D] hover:text-[#F0F4F8]',
      danger:
        'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 shadow-xs',
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
