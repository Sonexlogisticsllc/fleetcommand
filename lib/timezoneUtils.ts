import { USTimezone } from './types';

export const STATE_TIMEZONE_MAP: Record<string, USTimezone> = {
  CT: 'EST', DE: 'EST', FL: 'EST', GA: 'EST', IN: 'EST', KY: 'EST',
  ME: 'EST', MD: 'EST', MA: 'EST', MI: 'EST', NH: 'EST', NJ: 'EST',
  NY: 'EST', NC: 'EST', OH: 'EST', PA: 'EST', RI: 'EST', SC: 'EST',
  VT: 'EST', VA: 'EST', WV: 'EST',
  AL: 'CST', AR: 'CST', IL: 'CST', IA: 'CST', KS: 'CST', LA: 'CST',
  MN: 'CST', MS: 'CST', MO: 'CST', NE: 'CST', ND: 'CST', OK: 'CST',
  SD: 'CST', TN: 'CST', TX: 'CST', WI: 'CST',
  AZ: 'MST', CO: 'MST', ID: 'MST', MT: 'MST', NM: 'MST', UT: 'MST', WY: 'MST',
  AK: 'PST', CA: 'PST', HI: 'PST', NV: 'PST', OR: 'PST', WA: 'PST',
};

export const TIMEZONE_IANA: Record<USTimezone, string> = {
  EST: 'America/New_York',
  CST: 'America/Chicago',
  MST: 'America/Denver',
  PST: 'America/Los_Angeles',
};

export const TIMEZONE_COLORS: Record<USTimezone, string> = {
  EST: '#3B82F6',
  CST: '#10B981',
  MST: '#8B5CF6',
  PST: '#F59E0B',
};

export function getTimezoneForState(stateAbbr: string): USTimezone {
  return STATE_TIMEZONE_MAP[stateAbbr.toUpperCase()] ?? 'CST';
}

export function formatInTimezone(isoString: string, timezone: USTimezone): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_IANA[timezone],
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
}

export function formatInLocalTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(isoString));
}

export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function crossesMidnight(isoString: string, timezone: USTimezone): boolean {
  const date = new Date(isoString);
  const facilityDay = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_IANA[timezone], weekday: 'long',
  }).format(date);
  const localDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  return facilityDay !== localDay;
}

export function getTimezoneOffsetLabel(timezone: USTimezone): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_IANA[timezone], timeZoneName: 'short',
  }).formatToParts(new Date());
  return parts.find(p => p.type === 'timeZoneName')?.value ?? timezone;
}
