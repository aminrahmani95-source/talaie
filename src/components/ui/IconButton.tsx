import React from 'react';
import { triggerToast } from '../Toast';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Enforce accessible label
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon: React.ReactNode;
  disabledReason?: string;
  nativeDisabled?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'default',
      size = 'md',
      icon,
      className = '',
      type = 'button',
      disabled,
      disabledReason,
      nativeDisabled = false,
      onClick,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'w-9 h-9 min-w-[36px] min-h-[36px] rounded-md text-xs',
      md: 'w-10 h-10 min-w-[40px] min-h-[40px] rounded-md text-sm',
      lg: 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-md text-base',
    }[size];

    const variantClasses = {
      default:
        'bg-[#151B23] text-[#9BA7B6] border border-[#2D3748] hover:text-[#F0F4F8] hover:border-[#3E4C63] hover:bg-[#1C232D] shadow-xs',
      primary:
        'bg-[#C5A059] text-[#0D1117] hover:bg-[#D4AF37] border border-[#C5A059] shadow-xs',
      ghost:
        'bg-transparent text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#1C232D]',
      danger:
        'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 shadow-xs',
    }[variant];

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('warning', disabledReason || 'این دکمه در حال حاضر نیازمند پیش‌نیاز است.');
        return;
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={nativeDisabled ? disabled : false}
        aria-disabled={disabled ? true : undefined}
        onClick={handleClick}
        className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0D1117] active:scale-95 ${
          disabled ? 'opacity-80 ring-1 ring-amber-500/30' : ''
        } ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
