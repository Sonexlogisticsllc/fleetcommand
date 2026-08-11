'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, FileWarning, Inbox, Clock, X } from 'lucide-react';
import { getLoads, getLoadsByCarrier, getCheckins } from '@/lib/sonexStore';

interface AlertItem {
  id: string;
  type: 'info' | 'warning' | 'error';
  title: string;
  desc: string;
  link?: string;
}

interface NotificationBellProps {
  role: 'admin' | 'carrier';
  carrierId?: string | null;
}

export function NotificationBell({ role, carrierId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = async () => {
    try {
      const activeAlerts: AlertItem[] = [];
      const now = new Date();

      if (role === 'admin') {
        // ─── ADMIN NOTIFICATIONS ───────────────────────────────────────────────
        // Active loads crossing detention threshold
        const loads = await getLoads();
        const activeLoads = loads.filter(l => ['dispatched', 'in_transit'].includes(l.status));
        
        for (const l of activeLoads) {
          const checkins = await getCheckins(l.id);
          const done = new Set(checkins.map(c => c.event));
          const freeTime = l.freeTimeMinutes || 120;

          // Pickup dwell check
          if (done.has('arrived_pickup') && !done.has('loaded_departing')) {
            const arrived = checkins.find(c => c.event === 'arrived_pickup');
            if (arrived) {
              const dwellMin = (now.getTime() - new Date(arrived.timestamp).getTime()) / 60000;
              if (dwellMin > freeTime) {
                activeAlerts.push({
                  id: `det-pu-${l.id}`,
                  type: 'error',
                  title: 'Detention Threshold Crossed',
                  desc: `Load ${l.loadNumber} waiting at pickup for ${Math.floor(dwellMin)}m (Threshold: ${freeTime}m).`,
                  link: `/sonex/loads/${l.id}`,
                });
              }
            }
          }

          // Delivery dwell check
          if (done.has('arrived_delivery') && !done.has('delivered')) {
            const arrived = checkins.find(c => c.event === 'arrived_delivery');
            if (arrived) {
              const dwellMin = (now.getTime() - new Date(arrived.timestamp).getTime()) / 60000;
              if (dwellMin > freeTime) {
                activeAlerts.push({
                  id: `det-del-${l.id}`,
                  type: 'error',
                  title: 'Detention Threshold Crossed',
                  desc: `Load ${l.loadNumber} waiting at delivery for ${Math.floor(dwellMin)}m (Threshold: ${freeTime}m).`,
                  link: `/sonex/loads/${l.id}`,
                });
              }
            }
          }
        }
      } else if (role === 'carrier' && carrierId) {
        // ─── CARRIER NOTIFICATIONS ─────────────────────────────────────────────
        const loads = await getLoadsByCarrier(carrierId);
        
        // 1. New load assigned (booked status)
        const bookedLoads = loads.filter(l => l.status === 'booked');
        bookedLoads.forEach(l => {
          activeAlerts.push({
            id: `load-assigned-${l.id}`,
            type: 'info',
            title: 'New Load Assigned',
            desc: `You have been assigned Load ${l.loadNumber} (${l.pickupCity} -> ${l.deliveryCity}).`,
            link: '/carrier',
          });
        });

        // Detention threshold warning on active load
        const activeLoad = loads.find(l => ['dispatched', 'in_transit'].includes(l.status));
        if (activeLoad) {
          const checkins = await getCheckins(activeLoad.id);
          const done = new Set(checkins.map(c => c.event));
          const freeTime = activeLoad.freeTimeMinutes || 120;

          if (done.has('arrived_pickup') && !done.has('loaded_departing')) {
            const arrived = checkins.find(c => c.event === 'arrived_pickup');
            if (arrived) {
              const dwellMin = (now.getTime() - new Date(arrived.timestamp).getTime()) / 60000;
              if (dwellMin > freeTime) {
                activeAlerts.push({
                  id: `det-carrier-pu-${activeLoad.id}`,
                  type: 'error',
                  title: 'Detention Clock Running',
                  desc: `You are in billable detention at pickup (${Math.floor(dwellMin)}m elapsed).`,
                  link: '/carrier',
                });
              }
            }
          }

          if (done.has('arrived_delivery') && !done.has('delivered')) {
            const arrived = checkins.find(c => c.event === 'arrived_delivery');
            if (arrived) {
              const dwellMin = (now.getTime() - new Date(arrived.timestamp).getTime()) / 60000;
              if (dwellMin > freeTime) {
                activeAlerts.push({
                  id: `det-carrier-del-${activeLoad.id}`,
                  type: 'error',
                  title: 'Detention Clock Running',
                  desc: `You are in billable detention at delivery (${Math.floor(dwellMin)}m elapsed).`,
                  link: '/carrier',
                });
              }
            }
          }
        }
      }

      setAlerts(activeAlerts);
    } catch (err) {
      console.warn('Failed to compile notifications:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // refresh alerts list every 10s
    return () => clearInterval(interval);
  }, [role, carrierId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const badgeColor = alerts.some(a => a.type === 'error')
    ? 'bg-red-500 text-white'
    : 'bg-amber-500 text-black';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-slate-400 hover:text-white"
        title="Notifications"
      >
        <Bell size={16} />
        {alerts.length > 0 && (
          <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black leading-none ${badgeColor}`}>
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-white text-xs font-black uppercase tracking-wider">Alerts & Notifications</span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
            {alerts.length > 0 ? (
              alerts.map(item => {
                const Icon = item.type === 'error' ? AlertTriangle : item.type === 'warning' ? FileWarning : Inbox;
                const iconColor = item.type === 'error' ? 'text-red-400' : item.type === 'warning' ? 'text-amber-400' : 'text-cyan-400';
                const bgType = item.type === 'error' ? 'bg-red-500/10' : item.type === 'warning' ? 'bg-amber-500/10' : 'bg-cyan-500/10';

                return (
                  <a
                    key={item.id}
                    href={item.link || '#'}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgType}`}>
                      <Icon size={14} className={iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-200 text-xs font-bold leading-tight">{item.title}</p>
                      <p className="text-slate-500 text-[10px] leading-snug mt-0.5">{item.desc}</p>
                    </div>
                  </a>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Clock size={24} className="text-slate-700 mb-2" />
                <p className="text-slate-400 text-xs font-semibold">All Caught Up</p>
                <p className="text-slate-600 text-[10px] mt-0.5">No active alerts or warnings at this time.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
