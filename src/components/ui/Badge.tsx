import type { ReactNode } from 'react';
import type { AlertSeverity, AuditStatus, MovementType } from '@/types';

export type BadgeVariant = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  accent: 'bg-accent/10 text-accent ring-accent/25',
};

export function Badge({ variant = 'neutral', children, icon, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors duration-300 ${VARIANTS[variant]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

const SEVERITY_VARIANT: Record<AlertSeverity, BadgeVariant> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return <Badge variant={SEVERITY_VARIANT[severity]}>{severity}</Badge>;
}

const MOVEMENT_LABEL: Record<MovementType, { label: string; variant: BadgeVariant }> = {
  in: { label: 'Stock in', variant: 'success' },
  out: { label: 'Stock out', variant: 'neutral' },
  adjustment: { label: 'Adjustment', variant: 'warning' },
};

export function MovementBadge({ type }: { type: MovementType }) {
  const { label, variant } = MOVEMENT_LABEL[type];
  return <Badge variant={variant}>{label}</Badge>;
}

const AUDIT_VARIANT: Record<AuditStatus, BadgeVariant> = {
  success: 'success',
  denied: 'danger',
  failure: 'warning',
};

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  return <Badge variant={AUDIT_VARIANT[status]}>{status}</Badge>;
}
