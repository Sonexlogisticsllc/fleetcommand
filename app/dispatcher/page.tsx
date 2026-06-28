'use client';
import React, { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Truck, Clock, DollarSign, MapPin, Activity, AlertTriangle, ArrowRight } from 'lucide-react';
import { Load, Driver } from '@/lib/types';
import { PageSpinner } from '@/components/ui/Spinner';
import { FuelPriceWidget } from '@/components/widgets/FuelPriceWidget';

export default function DispatcherDashboard() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/loads').then(r => r.json()),
      fetch('/api/drivers').then(r => r.json()),
    ]).then(([l, d]) => {
      setLoads(l);
      setDrivers(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <PageSpinner text="Loading dashboard..." />;

  const activeLoads = loads.filter(l => l.status === 'in_transit' || l.status === 'assigned');
  const availableLoads = loads.filter(l => l.status === 'available');
  const deliveredToday = loads.filter(l => l.status === 'delivered');
  const totalRevenue = loads.reduce((s, l) => l.status !== 'available' ? s + l.rate : s, 0);
  const drivingNow = drivers.filter(d => d.status === 'driving');

  const DRIVER_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
    driving:  { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
    on_duty:  { bg: 'rgba(16,185,129,0.12)', color: '#34D399' },
    off_duty: { bg: 'rgba(148,163,184,0.08)', color: '#94A3B8' },
    sleeper:  { bg: 'rgba(139,92,246,0.1)', color: '#A78BFA' },
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Welcome banner */}
      <div className="rounded-2xl p-5 relative overflow-hidden border border-blue-500/15"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(6,182,212,0.06) 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 -translate-y-1/4 translate-x-1/4"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Operations Center · Live
            </div>
            <h2 className="text-xl font-bold text-white">Dispatcher Dashboard</h2>
            <p className="text-sm text-slate-400 mt-0.5">{drivingNow.length} driver{drivingNow.length !== 1 ? 's' : ''} active · {activeLoads.length} loads in motion</p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-3xl font-bold text-blue-400">${totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-slate-500">Gross revenue this week</div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 border border-blue-500/20" style={{ background: 'rgba(7,16,30,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Truck size={16} className="text-blue-400" />
            </div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Loads</span>
          </div>
          <div className="text-3xl font-bold text-white mb-0.5">{activeLoads.length}</div>
          <div className="text-xs text-slate-600">{availableLoads.length} available to assign</div>
          <div className="mt-2 h-1 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${(activeLoads.length / loads.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-2xl p-4 border border-cyan-500/15" style={{ background: 'rgba(7,16,30,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.15)' }}>
              <Activity size={16} className="text-cyan-400" />
            </div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Drivers On Duty</span>
          </div>
          <div className="text-3xl font-bold text-white mb-0.5">{drivingNow.length}</div>
          <div className="text-xs text-slate-600">{drivers.length} total fleet</div>
          <div className="mt-2 flex gap-1">
            {drivers.map(d => {
              const sc = DRIVER_STATUS_COLOR[d.status];
              return <div key={d.id} className="w-2 h-2 rounded-full" style={{ background: sc.color }} />;
            })}
          </div>
        </div>

        <div className="rounded-2xl p-4 border border-blue-500/20" style={{ background: 'rgba(7,16,30,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <DollarSign size={16} className="text-blue-400" />
            </div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Revenue</span>
          </div>
          <div className="text-3xl font-bold text-white mb-0.5">${totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-emerald-400 font-semibold">↑ 8% vs last week</div>
        </div>

        <div className="rounded-2xl p-4 border border-white/[0.06]" style={{ background: 'rgba(7,16,30,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Clock size={16} className="text-emerald-400" />
            </div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Delivered Today</span>
          </div>
          <div className="text-3xl font-bold text-white mb-0.5">{deliveredToday.length}</div>
          <div className="text-xs text-slate-600">Awaiting POD upload</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Active Loads */}
        <div className="lg:col-span-2 rounded-2xl p-5 border border-white/[0.06]" style={{ background: 'rgba(7,16,30,0.6)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Active Loads</h3>
            <a href="/dispatcher/load-board" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight size={12} />
            </a>
          </div>
          <div className="space-y-2.5">
            {activeLoads.map(load => (
              <div key={load.id}
                className="flex items-center gap-4 p-3.5 rounded-xl border border-white/[0.05] hover:border-blue-500/20 bg-white/[0.02] transition-all duration-200 cursor-pointer hover:bg-blue-500/[0.04]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white font-mono">{load.referenceNumber}</span>
                    <StatusBadge status={load.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin size={10} />
                    <span className="text-blue-400/80">{load.pickup.facility.city}, {load.pickup.facility.state}</span>
                    <span className="text-slate-700">→</span>
                    <span>{load.delivery.facility.city}, {load.delivery.facility.state}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-blue-400">${load.rate.toLocaleString()}</div>
                  <div className="text-xs text-slate-600">${load.ratePerMile}/mi</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Status */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: 'rgba(7,16,30,0.6)' }}>
            <h3 className="text-sm font-bold text-white mb-4">Driver Status</h3>
            <div className="space-y-2.5">
              {drivers.map(driver => {
                const sc = DRIVER_STATUS_COLOR[driver.status];
                return (
                  <div key={driver.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.15))', border: '1px solid rgba(59,130,246,0.15)' }}>
                      {driver.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{driver.name}</div>
                      <div className="text-[10px] text-slate-600">{driver.truckNumber} · {driver.currentLocation.city}, {driver.currentLocation.state}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: sc.bg, color: sc.color }}>
                      {driver.status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fuel Widget */}
          <FuelPriceWidget />
        </div>
      </div>

      {/* HOS Alerts */}
      <div className="rounded-2xl p-5 border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.04)' }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={15} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white">HOS Alerts</h3>
          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">1 WARNING</span>
        </div>
        <div className="p-4 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl flex items-start gap-3">
          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Priya Patel (FC-104) — Hours Critical</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Only 1.25 hours remaining. 11-hour drive limit exceeded — mandatory 10-hour rest required before next dispatch.
              Next availability: Apr 19, 10:00 PM local.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
