'use client';
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, icon: Icon, trend, accent = false, className = '' }: StatCardProps) {
  return (
    <div className={`
      bg-navy-panel border rounded-xl p-4 flex flex-col gap-3
      ${accent ? 'border-amber/30 shadow-amber-glow' : 'border-navy-border'}
      ${className}
    `}>
      <div className="flex items-start justify-between">
        <span className="metric-label">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${accent ? 'bg-amber/15' : 'bg-navy-border/40'}`}>
            <Icon size={16} className={accent ? 'text-amber' : 'text-slate-400'} />
          </div>
        )}
      </div>
      <div>
        <div className={`text-2xl font-bold ${accent ? 'text-amber' : 'text-white'}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
      {trend && (
        <div className={`text-xs font-medium flex items-center gap-1 ${
          trend.value > 0 ? 'text-success' : trend.value < 0 ? 'text-danger' : 'text-slate-400'
        }`}>
          {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'}
          {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  );
}
