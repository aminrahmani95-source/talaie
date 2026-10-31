import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Enforce accessible label
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon: React.ReactNode;
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
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-sm',
      md: 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-base',
      lg: 'w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl text-lg',
    }[size];

    const variantClasses = {
      default:
        'bg-white dark:bg-[#1F1F1F] text-[#4A4742] dark:text-[#BDB8AF] border border-[#E2DDD4] dark:border-[#333333] hover:text-[#181818] dark:hover:text-[#F5F3EF] hover:bg-[#F9F7F3] dark:hover:bg-[#282828] shadow-2xs',
      primary:
        'bg-[#212121] text-[#C1A056] hover:bg-[#2D2D2D] dark:bg-[#C1A056] dark:text-[#181818] dark:hover:bg-[#D4B56C] border border-[#C1A056]/30 shadow-xs',
      ghost:
        'bg-transparent text-[#4A4742] dark:text-[#BDB8AF] hover:text-[#181818] dark:hover:text-[#F5F3EF] hover:bg-[#EFEBE4]/60 dark:hover:bg-[#252525]',
      danger:
        'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1A056] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121212] active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
