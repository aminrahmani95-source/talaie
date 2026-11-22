import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className="block text-xs font-bold text-ink"
        >
          {label} {required && <span className="text-rose-400 font-bold">*</span>}
        </label>
        {hint && !error && (
          <span className="text-[12px] text-ink-3">
            {hint}
          </span>
        )}
      </div>

      <div>{children}</div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
