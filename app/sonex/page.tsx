'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowRight, CheckCircle2, Clock, DollarSign, FileWarning, MessageSquare,
  Package, Percent, ReceiptText, Sun, Truck,
} from 'lucide-react';
import {
  getAllMessages, getCarriers, getDashboardStats, getLoads, getTodayActivity,
} from '@/lib/sonexStore';
import type { SonexCarrier, SonexLoad } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

const RevenueChart = dynamic(() => import('@/components/sonex/RevenueChart'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-white/[0.03]" />,
});

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function buildWeeklyData(loads: SonexLoad[]) {
  const weeks: { label: string; gross: number; fees: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1 - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekLoads = loads.filter(load => {
      const pickup = new Date(load.pickupDate);
      return pickup >= weekStart && pickup <= weekEnd;
    });

    weeks.push({
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gross: Math.round(weekLoads.reduce((sum, load) => sum + load.rate, 0)),
      fees: Math.round(weekLoads.reduce((sum, load) => sum + load.dispatchFeeAmount, 0)),
    });
  }

  return weeks;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    booked: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
    dispatched: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/20',
    in_transit: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
    delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
    pod_received: 'bg-teal-500/20 text-teal-300 border-teal-500/20',
    invoiced: 'bg-violet-500/20 text-violet-300 border-violet-500/20',
    paid: 'bg-green-500/20 text-green-300 border-green-500/20',
  };
  return map[status] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/20';
}

function KPICard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="mb-3 flex items-start justify-between">
        <p className="metric-label">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="font-mono text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function SonexDashboardPage() {
  const [stats, setStats] = useState({
    activeCarriers: 0,
    loadsInProgress: 0,
    loadsCompletedThisWeek: 0,
    grossThisMonth: 0,
    feesThisMonth: 0,
  });
  const [activity, setActivity] = useState<{ pickups: SonexLoad[]; deliveries: SonexLoad[] }>({ pickups: [], deliveries: [] });
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ label: string; gross: number; fees: number }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [podNeeded, setPodNeeded] = useState(0);
  const [invoiceReady, setInvoiceReady] = useState(0);

  useEffect(() => {
    const loads = getLoads();
    setStats(getDashboardStats());
    setActivity(getTodayActivity());
    setCarriers(getCarriers());
    setWeeklyData(buildWeeklyData(loads));
    setPodNeeded(loads.filter(load => load.status === 'delivered' && !load.podUrl).length);
    setInvoiceReady(loads.filter(load => ['pod_received', 'invoiced', 'paid'].includes(load.status)).length);
    setUnreadCount(getAllMessages().filter(message => !message.read && message.senderRole === 'carrier').length);
  }, []);

  const carrierMap = useMemo(
    () => new Map(carriers.map(carrier => [carrier.id, `${carrier.firstName} ${carrier.lastName}`])),
    [carriers],
  );

  const todayAll = [
    ...activity.pickups.map(load => ({ ...load, type: 'Pickup' })),
    ...activity.deliveries.map(load => ({ ...load, type: 'Delivery' })),
  ].sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));

  return (
    <div className="space-y-6 bg-[#080808] p-6 animate-fade-in">
      <div
        className="relative overflow-hidden rounded-2xl border border-amber-500/20 p-6"
        style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.12) 0%, rgba(255,140,90,0.05) 48%, rgba(8,8,8,0.9) 100%)' }}
      >
        <div className="relative flex items-center gap-3">
          <Sun size={18} className="text-amber-400" />
          <div>
            <h1 className="font-display text-xl font-extrabold text-white">Sonex Dispatch</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Active Carriers" value={stats.activeCarriers} icon={Truck} color="bg-amber-500/15 text-amber-400" />
        <KPICard label="Loads In Progress" value={stats.loadsInProgress} icon={Package} color="bg-cyan-500/15 text-cyan-400" />
        <KPICard label="Completed This Week" value={stats.loadsCompletedThisWeek} icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" />
        <KPICard label="Gross This Month" value={fmt$(stats.grossThisMonth)} icon={DollarSign} color="bg-amber-500/15 text-amber-400" />
        <KPICard label="Fees This Month" value={fmt$(stats.feesThisMonth)} icon={Percent} color="bg-green-500/15 text-green-400" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Clock size={16} className="text-amber-400" />
                Today's Loads
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-normal text-slate-500">
                  {todayAll.length}
                </span>
              </h2>
              <Link href="/sonex/loads" className="flex items-center gap-1 text-xs text-amber-500 transition-colors hover:text-amber-400">
                View All <ArrowRight size={12} />
              </Link>
            </div>

            {todayAll.length === 0 ? (
              <div className="py-10 text-center">
                <Package size={32} className="mx-auto mb-3 text-slate-700" />
                <p className="text-sm text-slate-500">No pickups or deliveries scheduled today.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Load #', 'Type', 'Carrier', 'Route', 'Status', 'Time'].map(header => (
                        <th key={header} className="pb-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {todayAll.map(load => (
                      <tr key={load.id} className="table-row-hover group">
                        <td className="py-3 pr-4 font-mono text-xs text-amber-400">{load.loadNumber}</td>
                        <td className="py-3 pr-4 text-xs text-slate-400">{load.type}</td>
                        <td className="py-3 pr-4 text-xs text-slate-300">{carrierMap.get(load.carrierId) ?? '-'}</td>
                        <td className="py-3 pr-4 text-xs text-slate-400">{load.pickupState} {'->'} {load.deliveryState}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor(load.status)}`}>
                            {LOAD_STATUS_LABELS[load.status]}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">{load.pickupTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <DollarSign size={16} className="text-amber-400" />
                Weekly Revenue
              </h2>
              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-500" />Gross</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded border border-amber-500/40 bg-amber-500/25" />Fees</span>
              </div>
            </div>
            <RevenueChart data={weeklyData} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Core Work Queue</h2>
            <div className="space-y-3">
              {[
                { href: '/sonex/loads', icon: FileWarning, label: 'Loads Needing POD', value: podNeeded },
                { href: '/sonex/financials', icon: ReceiptText, label: 'Invoice / Settlement Loads', value: invoiceReady },
                { href: '/sonex/messages', icon: MessageSquare, label: 'Unread Messages', value: unreadCount },
              ].map(({ href, icon: Icon, label, value }) => (
                <Link key={label} href={href} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
                      <Icon size={13} className="text-amber-400" />
                    </div>
                    <span className="text-xs text-slate-400 transition-colors group-hover:text-slate-300">{label}</span>
                  </div>
                  <span className={`font-mono text-xs font-bold ${value > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{value}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Dispatch Hub Focus</h2>
            <div className="space-y-2">
              {[
                { href: '/sonex/load-log', icon: Package, label: 'Load Management', text: 'Master log, status, BOL/POD, cargo photos' },
                { href: '/sonex/financials', icon: ReceiptText, label: 'Invoicing', text: 'Weekly fee invoices and carrier settlements' },
                { href: '/sonex/messages', icon: MessageSquare, label: 'Messaging', text: 'Real-time admin and carrier conversations' },
              ].map(({ href, icon: Icon, label, text }) => (
                <Link key={label} href={href} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:border-amber-500/25 hover:bg-amber-500/[0.06]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="truncate text-[11px] text-slate-500">{text}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
