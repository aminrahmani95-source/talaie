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
        'bg-surface text-ink-2 border border-line-strong hover:text-ink hover:border-line-strong hover:bg-raised shadow-xs',
      primary:
        'bg-brand text-on-brand hover:bg-brand-hover border border-brand shadow-xs',
      ghost:
        'bg-transparent text-ink-2 hover:text-ink hover:bg-raised',
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
        className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-canvas active:scale-95 ${
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
