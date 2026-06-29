'use client';
import React from 'react';
import { formatInTimezone, formatInLocalTime, getTimezoneOffsetLabel, TIMEZONE_COLORS, getTimezoneForState, TIMEZONE_IANA } from '@/lib/timezoneUtils';
import { USTimezone } from '@/lib/types';
import { Clock, AlertTriangle } from 'lucide-react';

interface TimezoneDisplayProps {
  isoTime: string;
  state: string;
  label?: string;
}

export function TimezoneDisplay({ isoTime, state, label = 'Appointment' }: TimezoneDisplayProps) {
  const tz: USTimezone = getTimezoneForState(state);
  const facilityTime = formatInTimezone(isoTime, tz);
  const localTime = formatInLocalTime(isoTime);
  const tzLabel = getTimezoneOffsetLabel(tz);
  const color = TIMEZONE_COLORS[tz];

  // Check if the displayed days differ (midnight boundary warning)
  const date = new Date(isoTime);
  const facilityDay = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_IANA[tz],
    weekday: 'short',
  }).format(date);
  const localDay = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  const crossesMidnight = facilityDay !== localDay;

  return (
    <div className="space-y-1.5">
      {label && <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</div>}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-navy-DEFAULT rounded-lg p-2.5 border border-navy-border">
          <div className="flex items-center gap-1 mb-1">
            <Clock size={9} style={{ color }} />
            <span className="text-[10px] font-bold" style={{ color }}>FACILITY ({tzLabel})</span>
          </div>
          <div className="text-xs text-white font-medium leading-snug">{facilityTime}</div>
        </div>
        <div className={`bg-navy-DEFAULT rounded-lg p-2.5 border ${crossesMidnight ? 'border-warning/40' : 'border-navy-border'}`}>
          <div className="flex items-center gap-1 mb-1">
            <Clock size={9} className="text-amber" />
            <span className="text-[10px] font-bold text-amber">YOUR LOCAL</span>
          </div>
          <div className="text-xs text-white font-medium leading-snug">{localTime}</div>
        </div>
      </div>
      {crossesMidnight && (
        <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/5 border border-warning/20 rounded-lg px-2.5 py-1.5">
          <AlertTriangle size={11} />
          Day boundary: facility is {facilityDay}, your local time is {localDay}
        </div>
      )}
    </div>
  );
}
