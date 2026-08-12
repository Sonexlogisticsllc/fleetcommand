'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, DollarSign, FileWarning, Package, Percent, ReceiptText, RefreshCw, Truck, Users } from 'lucide-react';
import { getDashboardCombinedData } from '@/lib/sonexStore';
import type { SonexLoad } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

type DashboardStats = {
  activeCarriers: number;
  loadsInProgress: number;
  loadsCompletedThisWeek: number;
  grossThisMonth: number;
  feesThisMonth: number;
};

type ActivityLoad = SonexLoad & { carrierName?: string; type: 'Pickup' | 'Delivery' };

const emptyStats: DashboardStats = {
  activeCarriers: 0,
  loadsInProgress: 0,
  loadsCompletedThisWeek: 0,
  grossThisMonth: 0,
  feesThisMonth: 0,
};

function money(value: number) {
  return 'USD ' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function statusTone(status: string) {
  if (status === 'in_transit') return 'border border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'dispatched') return 'border border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'delivered' || status === 'pod_received') return 'border border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'invoiced' || status === 'paid') return 'border border-violet-200 bg-violet-50 text-violet-800';
  return 'border border-slate-200 bg-slate-100 text-slate-700';
}

export default function SonexDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [activity, setActivity] = useState<{ pickups: (SonexLoad & { carrierName?: string })[]; deliveries: (SonexLoad & { carrierName?: string })[] }>({ pickups: [], deliveries: [] });
  const [weeklyData, setWeeklyData] = useState<{ label: string; gross: number; fees: number }[]>([]);
  const [podNeeded, setPodNeeded] = useState(0);
  const [invoiceReady, setInvoiceReady] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDashboardCombinedData();
      setStats(data.stats);
      setActivity(data.activity);
      setWeeklyData(data.weeklyData);
      setPodNeeded(data.podNeeded);
      setInvoiceReady(data.invoiceReady);
    } catch (error) {
      console.warn('Dashboard data fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const interval = window.setInterval(reload, 60000);
    return () => window.clearInterval(interval);
  }, [reload]);

  const todaysSchedule = useMemo<ActivityLoad[]>(() => [
    ...activity.pickups.map(load => ({ ...load, type: 'Pickup' as const })),
    ...activity.deliveries.map(load => ({ ...load, type: 'Delivery' as const })),
  ].sort((left, right) => left.pickupTime.localeCompare(right.pickupTime)), [activity]);

  const metrics = [
    { label: 'Active carriers', value: stats.activeCarriers, Icon: Truck, tone: 'border-sky-200 bg-sky-50 text-sky-700', accent: 'border-t-sky-500' },
    { label: 'Loads in progress', value: stats.loadsInProgress, Icon: Package, tone: 'border-indigo-200 bg-indigo-50 text-indigo-700', accent: 'border-t-indigo-500' },
    { label: 'Completed this week', value: stats.loadsCompletedThisWeek, Icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', accent: 'border-t-emerald-500' },
    { label: 'Gross this month', value: money(stats.grossThisMonth), Icon: DollarSign, tone: 'border-teal-200 bg-teal-50 text-teal-700', accent: 'border-t-teal-500' },
    { label: 'Dispatch fees', value: money(stats.feesThisMonth), Icon: Percent, tone: 'border-violet-200 bg-violet-50 text-violet-700', accent: 'border-t-violet-500' },
  ];

  const queue = [
    { href: '/sonex/loads', label: 'POD follow-up', detail: 'Delivered loads awaiting proof of delivery', value: podNeeded, Icon: FileWarning },
    { href: '/sonex/accounting', label: 'Invoice queue', detail: 'Loads ready for billing or settlement', value: invoiceReady, Icon: ReceiptText },
    { href: '/sonex/carriers', label: 'Carrier coverage', detail: 'Manage active carrier profiles and driver contacts', value: stats.activeCarriers, Icon: Users },
  ];

  return (
    <div data-tms-surface className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-[linear-gradient(100deg,#ffffff_0%,#f2f8ff_48%,#f8f5ff_100%)] px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div><div className="mb-2 h-1 w-12 bg-sky-500" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">Operations overview</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Dispatch control center</h1><p className="mt-1 text-xs text-slate-500">Live workload, paperwork, and revenue signals in one view.</p></div>
          <div className="flex items-center gap-3"><p className="hidden text-xs text-slate-500 sm:block">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p><button onClick={reload} className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-500 hover:text-slate-900" title="Refresh dashboard"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(({ label, value, Icon, tone, accent }) => <div key={label} className={`flex min-h-20 items-center gap-3 border border-slate-200 border-t-2 bg-white px-4 py-3 shadow-sm ${accent}`}><div className={`grid h-9 w-9 shrink-0 place-items-center border ${tone}`}><Icon size={17} /></div><div className="min-w-0"><p className="truncate font-mono text-lg font-semibold text-slate-950">{value}</p><p className="text-[11px] font-semibold text-slate-500">{label}</p></div></div>)}</section>
        <div className="grid gap-5 xl:grid-cols-[1.5fr_0.7fr]">
          <section className="border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">Today&apos;s execution</h2><p className="mt-0.5 text-xs text-slate-500">Pickup and delivery commitments in dispatch order.</p></div><Link href="/sonex/loads" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">Load management <ArrowRight size={13} /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-4 py-3">Load</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Time</th></tr></thead><tbody className="divide-y divide-slate-100">{todaysSchedule.slice(0, 20).map(load => <tr key={load.id + load.type} className="hover:bg-slate-50"><td className="px-4 py-3 font-mono font-semibold text-slate-800">{load.loadNumber}</td><td className="px-4 py-3 text-slate-600">{load.type}</td><td className="px-4 py-3 text-slate-600">{load.carrierName ?? 'Unassigned'}</td><td className="px-4 py-3 text-slate-600">{load.pickupState} to {load.deliveryState}</td><td className="px-4 py-3"><span className={'inline-flex px-1.5 py-0.5 text-[10px] font-semibold ' + statusTone(load.status)}>{LOAD_STATUS_LABELS[load.status]}</span></td><td className="px-4 py-3 text-right font-mono text-slate-600">{load.type === 'Pickup' ? load.pickupTime : load.deliveryTime}</td></tr>)}{!todaysSchedule.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-400">No pickup or delivery commitments today.</td></tr>}</tbody></table></div></section>
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Operations queue</h2><p className="mt-0.5 text-xs text-slate-500">The next work requiring dispatcher attention.</p></div><div className="divide-y divide-slate-100">{queue.map(({ href, label, detail, value, Icon }) => <Link key={label} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"><Icon size={16} className="text-slate-400" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{label}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p></div><span className="font-mono text-sm font-semibold text-slate-800">{value}</span><ArrowRight size={13} className="text-slate-400" /></Link>)}</div></section>
        </div>
        <section className="border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">Eight-week revenue view</h2><p className="mt-0.5 text-xs text-slate-500">Gross revenue and dispatch fee trend, kept deliberately light for fast initial render.</p></div><Link href="/sonex/accounting" className="text-xs font-semibold text-blue-700 hover:text-blue-900">Open accounting</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-4 py-3">Week</th><th className="px-4 py-3 text-right">Gross revenue</th><th className="px-4 py-3 text-right">Dispatch fees</th><th className="px-4 py-3">Fee share</th></tr></thead><tbody className="divide-y divide-slate-100">{weeklyData.map(week => { const percentage = week.gross ? Math.min(100, Math.round((week.fees / week.gross) * 100)) : 0; return <tr key={week.label} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-700">{week.label}</td><td className="px-4 py-3 text-right font-mono text-slate-800">{money(week.gross)}</td><td className="px-4 py-3 text-right font-mono text-slate-800">{money(week.fees)}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-28 overflow-hidden bg-slate-100"><div className="h-full bg-blue-600" style={{ width: percentage + '%' }} /></div><span className="font-mono text-[11px] text-slate-500">{percentage}%</span></div></td></tr>; })}{!weeklyData.length && <tr><td colSpan={4} className="px-4 py-12 text-center text-xs text-slate-400">No weekly revenue data is available yet.</td></tr>}</tbody></table></div></section>
      </main>
    </div>
  );
}
