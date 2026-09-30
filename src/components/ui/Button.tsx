import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-md shadow-accent/25 hover:-translate-y-px hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/30 focus-visible:ring-accent/40',
  secondary:
    'border border-slate-300 bg-white/90 text-slate-700 shadow-sm hover:-translate-y-px hover:border-slate-400 hover:bg-white hover:shadow-md focus-visible:ring-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300',
  danger:
    'bg-red-600 text-white shadow-md shadow-red-600/25 hover:-translate-y-px hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/30 focus-visible:ring-red-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
};

function buttonClasses(variant: Variant, size: Size, className: string) {
  return `inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 disabled:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
});

interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function LinkButton({ variant = 'primary', size = 'md', icon, className = '', children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
