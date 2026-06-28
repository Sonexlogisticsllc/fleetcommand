'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-amber text-navy-DEFAULT font-semibold hover:bg-amber-light shadow-amber-glow hover:shadow-amber-glow-lg active:scale-95',
  secondary: 'bg-navy-panel border border-navy-border text-white hover:border-amber/40 hover:bg-navy-hover',
  ghost: 'text-slate-400 hover:text-white hover:bg-navy-hover',
  danger: 'bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20',
  success: 'bg-success/10 border border-success/30 text-success hover:bg-success/20',
};

const sizeStyles: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1.5',
  sm: 'px-3 py-1.5 text-sm gap-2',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
};

export function Button({
  variant = 'primary', size = 'md', loading = false,
  icon, iconPosition = 'left', children, className = '', disabled, ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={14} />
      ) : (
        iconPosition === 'left' && icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children}
      {!loading && iconPosition === 'right' && icon && <span className="flex-shrink-0">{icon}</span>}
    </button>
  );
}
