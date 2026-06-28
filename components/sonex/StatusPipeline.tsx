'use client';
import React from 'react';
import { Check } from 'lucide-react';
import type { LoadStatus } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS, LOAD_STATUS_ORDER } from '@/lib/sonexTypes';

const STATUS_COLORS: Record<LoadStatus, { bg: string; border: string; text: string; dot: string }> = {
  booked:      { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  text: '#60A5FA', dot: '#3B82F6' },
  dispatched:  { bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)',   text: '#67E8F9', dot: '#06B6D4' },
  in_transit:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  text: '#FCD34D', dot: '#F59E0B' },
  delivered:   { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  text: '#34D399', dot: '#10B981' },
  pod_received:{ bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.3)',  text: '#5EEAD4', dot: '#14B8A6' },
  invoiced:    { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  text: '#A78BFA', dot: '#8B5CF6' },
  paid:        { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   text: '#4ADE80', dot: '#22C55E' },
};

interface StatusBadgeProps {
  status: LoadStatus;
  size?: 'sm' | 'md';
}

export function LoadStatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {LOAD_STATUS_LABELS[status]}
    </span>
  );
}

interface StatusPipelineProps {
  currentStatus: LoadStatus;
  compact?: boolean;
}

export function StatusPipeline({ currentStatus, compact = false }: StatusPipelineProps) {
  const currentIndex = LOAD_STATUS_ORDER.indexOf(currentStatus);

  if (compact) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto">
        {LOAD_STATUS_ORDER.map((status, idx) => {
          const c = STATUS_COLORS[status];
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;
          return (
            <React.Fragment key={status}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isFuture ? 'opacity-30' : ''
                  }`}
                  style={{
                    background: isCompleted || isCurrent ? c.bg : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isCompleted || isCurrent ? c.border : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {isCompleted ? (
                    <Check size={10} style={{ color: c.text }} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCurrent ? c.dot : '#334155' }} />
                  )}
                </div>
              </div>
              {idx < LOAD_STATUS_ORDER.length - 1 && (
                <div
                  className="h-px flex-1 min-w-[8px] transition-all duration-300"
                  style={{ background: idx < currentIndex ? '#22C55E' : 'rgba(255,255,255,0.08)' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1">
      {LOAD_STATUS_ORDER.map((status, idx) => {
        const c = STATUS_COLORS[status];
        const isCompleted = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isFuture = idx > currentIndex;

        return (
          <React.Fragment key={status}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isFuture ? 'opacity-30' : ''
                }`}
                style={{
                  background: isCompleted || isCurrent ? c.bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isCompleted || isCurrent ? c.border : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isCurrent ? `0 0 12px ${c.dot}40` : 'none',
                }}
              >
                {isCompleted ? (
                  <Check size={14} style={{ color: c.text }} />
                ) : (
                  <span className="w-2 h-2 rounded-full" style={{ background: isCurrent ? c.dot : '#334155' }} />
                )}
              </div>
              <span
                className={`text-[9px] font-semibold mt-1 text-center leading-tight max-w-[52px] ${
                  isFuture ? 'text-slate-700' : isCurrent ? 'text-white' : 'text-slate-500'
                }`}
              >
                {LOAD_STATUS_LABELS[status]}
              </span>
            </div>
            {idx < LOAD_STATUS_ORDER.length - 1 && (
              <div
                className="h-px flex-1 mt-4 min-w-[12px] transition-all duration-300"
                style={{ background: idx < currentIndex ? c.dot : 'rgba(255,255,255,0.06)' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
