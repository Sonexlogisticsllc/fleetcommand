'use client';
import React from 'react';

type BadgeVariant = 'amber' | 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'hot' | 'warm' | 'soft';

const styles: Record<BadgeVariant, string> = {
  amber: 'bg-amber/15 text-amber border-amber/30',
  success: 'bg-success/15 text-success border-success/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  info: 'bg-info/15 text-info border-info/30',
  neutral: 'bg-navy-border/40 text-slate-400 border-navy-border',
  hot: 'bg-red-500/15 text-red-400 border-red-500/30',
  warm: 'bg-amber/15 text-amber border-amber/30',
  soft: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ variant = 'neutral', children, dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border
      ${styles[variant]} ${className}
    `}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          variant === 'success' ? 'bg-success animate-pulse' :
          variant === 'danger' ? 'bg-danger animate-pulse' :
          variant === 'amber' ? 'bg-amber animate-pulse' : 'bg-current'
        }`} />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    available: { variant: 'success', label: 'Available' },
    assigned: { variant: 'amber', label: 'Assigned' },
    in_transit: { variant: 'info', label: 'In Transit' },
    delivered: { variant: 'neutral', label: 'Delivered' },
    invoiced: { variant: 'warning', label: 'Invoiced' },
    paid: { variant: 'success', label: 'Paid' },
    driving: { variant: 'success', label: 'Driving' },
    on_duty: { variant: 'amber', label: 'On Duty' },
    off_duty: { variant: 'neutral', label: 'Off Duty' },
    sleeper: { variant: 'info', label: 'Sleeper' },
  };
  const config = map[status] ?? { variant: 'neutral', label: status };
  return <Badge variant={config.variant} dot>{config.label}</Badge>;
}
