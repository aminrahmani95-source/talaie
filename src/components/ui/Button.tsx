import React from 'react';
import { Loader2 } from 'lucide-react';
import { triggerToast } from '../Toast';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  /** توضیح پیش‌نیازهایی که در صورت برآورده‌نشدن، هنگام کلیک کاربر به صورت پیام واضح نمایش داده می‌شوند */
  disabledReason?: string;
  /** در صورتی که نیاز قطعی به غیرفعال‌سازی native مرورگر باشد (پیش‌فرض false است تا دکمه هرگز خاموش و بی‌واکنش نماند) */
  nativeDisabled?: boolean;
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
      disabledReason,
      nativeDisabled = false,
      type = 'button',
      onClick,
      ...props
    },
    ref
  ) => {
    const isCurrentlyLoading = loading ?? isLoading;
    // Base styles: minimum 44px touch target, flex layout, focus ring
    const baseClasses =
      'relative inline-flex items-center justify-center font-bold select-none transition-all duration-150 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-canvas active:scale-[0.99] cursor-pointer tracking-tight';

    // Touch-friendly sizes with min-h-[44px] accessibility standard
    const sizeClasses = {
      sm: 'text-xs px-3 py-1.5 min-h-[38px] gap-1.5',
      md: 'text-sm px-4 py-2 min-h-[44px] gap-2',
      lg: 'text-base px-5 py-2.5 min-h-[48px] gap-2.5',
    }[size];

    // Enterprise industrial color tokens
    const variantClasses = {
      primary:
        'bg-brand text-on-brand hover:bg-brand-hover border border-brand shadow-xs',
      secondary:
        'bg-surface text-ink border border-line-strong hover:border-line-strong hover:bg-raised shadow-xs',
      ghost:
        'bg-transparent text-ink-2 hover:bg-raised hover:text-ink',
      danger:
        'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 shadow-xs',
    }[variant];

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isCurrentlyLoading) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('info', 'در حال پردازش عملیات، لطفاً شکیبا باشید...');
        return;
      }

      if (disabled) {
        e.preventDefault();
        e.stopPropagation();
        const reason =
          disabledReason ||
          'این اقدام نیازمند تکمیل پیش‌نیازهاست. لطفاً بخش‌ها یا فیلدهای مشخص‌شده را کامل فرمایید.';
        triggerToast('warning', reason);
        return;
      }

      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={nativeDisabled ? Boolean(disabled || isCurrentlyLoading) : isCurrentlyLoading}
        aria-disabled={disabled ? true : undefined}
        onClick={handleClick}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${
          disabled ? 'opacity-90 ring-1 ring-amber-500/30 hover:border-amber-500/50' : ''
        } ${className}`}
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
