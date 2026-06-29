'use client';
import React from 'react';
import { CheckCircle, Clock, Truck, PackageCheck, MapPin, Flag } from 'lucide-react';
import type { SonexLoadCheckin, CheckinEvent } from '@/lib/sonexTypes';
import { CHECKIN_EVENT_LABELS } from '@/lib/sonexTypes';

const EVENT_CONFIG: Record<CheckinEvent, { icon: React.ElementType; color: string; bg: string }> = {
  arrived_pickup:   { icon: Truck,        color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  loaded_departing: { icon: PackageCheck, color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
  arrived_delivery: { icon: MapPin,       color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  delivered:        { icon: Flag,         color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  // Extended events — shown in timeline but not in ALL_EVENTS pipeline
  detention_start:  { icon: Clock,        color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  detention_end:    { icon: Clock,        color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  layover_start:    { icon: Clock,        color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
  layover_end:      { icon: Clock,        color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
  tonu:             { icon: Clock,        color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
  breakdown:        { icon: Clock,        color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
  accident:         { icon: Clock,        color: '#DC2626', bg: 'rgba(220,38,38,0.15)'  },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

interface CheckinTimelineProps {
  checkins: SonexLoadCheckin[];
  compact?: boolean;
}

const ALL_EVENTS: CheckinEvent[] = ['arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered'];

export function CheckinTimeline({ checkins, compact = false }: CheckinTimelineProps) {
  const checkinMap = new Map(checkins.map(c => [c.event, c]));

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {ALL_EVENTS.map((event, idx) => {
          const cfg = EVENT_CONFIG[event];
          const Icon = cfg.icon;
          const done = checkinMap.has(event);
          return (
            <React.Fragment key={event}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  background: done ? cfg.bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${done ? cfg.color + '40' : 'rgba(255,255,255,0.08)'}`,
                }}
                title={CHECKIN_EVENT_LABELS[event]}
              >
                <Icon size={12} style={{ color: done ? cfg.color : '#334155' }} />
              </div>
              {idx < ALL_EVENTS.length - 1 && (
                <div className="h-px flex-1" style={{ background: done ? cfg.color + '40' : 'rgba(255,255,255,0.06)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {ALL_EVENTS.map((event, idx) => {
        const cfg = EVENT_CONFIG[event];
        const Icon = cfg.icon;
        const checkin = checkinMap.get(event);
        const done = !!checkin;
        const isLast = idx === ALL_EVENTS.length - 1;

        return (
          <div key={event} className="flex gap-4">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={{
                  background: done ? cfg.bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${done ? cfg.color + '50' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: done ? `0 0 12px ${cfg.color}30` : 'none',
                }}
              >
                {done
                  ? <CheckCircle size={16} style={{ color: cfg.color }} />
                  : <Icon size={16} style={{ color: '#475569' }} />
                }
              </div>
              {!isLast && (
                <div
                  className="w-px flex-1 my-1 min-h-[24px]"
                  style={{ background: done ? cfg.color + '30' : 'rgba(255,255,255,0.06)' }}
                />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-sm font-semibold ${done ? 'text-white' : 'text-slate-500'}`}>
                  {CHECKIN_EVENT_LABELS[event]}
                </span>
                {done && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                    Logged
                  </span>
                )}
              </div>
              {done && checkin ? (
                <>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={10} />
                    <span>{formatTimestamp(checkin.timestamp)}</span>
                    <span className="text-slate-700">·</span>
                    <span className="capitalize">{checkin.loggedBy === 'admin' ? 'Dispatcher' : 'Driver'}</span>
                  </div>
                  {checkin.notes && (
                    <div className="mt-1.5 text-xs text-slate-400 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2">
                      {checkin.notes}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-slate-600">Pending</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
