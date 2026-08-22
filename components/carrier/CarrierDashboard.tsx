'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList, DollarSign, FileCheck2, RefreshCw, Truck, Wallet } from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { getCarrierStats, getLoadsByCarrier } from '@/lib/sonexStore';
import type { CarrierStats } from '@/lib/sonexStore';
import type { LoadStatus, SonexLoad } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

const ACTIVE_STATUSES: LoadStatus[] = ['booked', 'dispatched', 'in_transit'];
const COMPLETE_STATUSES: LoadStatus[] = ['delivered', 'pod_received', 'invoiced', 'paid'];

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(value);

const displayDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
});

function statusClass(status: LoadStatus) {
  if (status === 'in_transit') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'dispatched' || status === 'booked') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'delivered' || status === 'pod_received') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function Metric({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Truck; tone: string }) {
  return (
    <div className="border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center border ${tone}`}><Icon size={20} /></div>
        <div><p className="font-mono text-2xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p></div>
      </div>
    </div>
  );
}

export function CarrierDashboard() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';
  const [stats, setStats] = useState<CarrierStats | null>(null);
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!carrierId) return;
    setLoading(true);
    try {
      const [nextStats, nextLoads] = await Promise.all([getCarrierStats(carrierId), getLoadsByCarrier(carrierId)]);
      setStats(nextStats);
      setLoads(nextLoads);
    } finally {
      setLoading(false);
    }
  }, [carrierId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeLoads = useMemo(() => loads.filter(load => ACTIVE_STATUSES.includes(load.status)).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate)), [loads]);
  const podFollowUps = useMemo(() => loads.filter(load => load.status === 'delivered' && !load.podUrl), [loads]);
  const invoiceQueue = useMemo(() => loads.filter(load => ['pod_received', 'invoiced'].includes(load.status)), [loads]);
  const thisMonthNet = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return loads.filter(load => load.pickupDate.startsWith(month)).reduce((sum, load) => sum + load.carrierNet, 0);
  }, [loads]);
  const weeklyRows = useMemo(() => {
    const anchor = loads.reduce((latest, load) => load.pickupDate > latest ? load.pickupDate : latest, new Date().toISOString().slice(0, 10));
    const end = new Date(`${anchor}T12:00:00`);
    return Array.from({ length: 8 }, (_, index) => {
      const weekEnd = new Date(end); weekEnd.setDate(end.getDate() - index * 7);
      const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
      const matching = loads.filter(load => {
        const date = new Date(`${load.pickupDate}T12:00:00`);
        return COMPLETE_STATUSES.includes(load.status) && date >= weekStart && date <= weekEnd;
      });
      const gross = matching.reduce((sum, load) => sum + load.rate, 0);
      const net = matching.reduce((sum, load) => sum + load.carrierNet, 0);
      return { label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), gross, net };
    }).reverse();
  }, [loads]);

  return (
    <div data-carrier-dashboard className="min-h-full bg-[#f2f5f9] text-slate-900">
      <div className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-3 h-1 w-14 bg-sky-500" /><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Carrier operations</p><h1 className="mt-1 text-3xl font-semibold text-slate-950">My Dispatch Center</h1><p className="mt-1 text-sm text-slate-500">Active work, paperwork, and settlement signals in one view.</p></div>
          <button onClick={() => void refresh()} title="Refresh dashboard" className="grid h-11 w-11 place-items-center border border-slate-300 bg-white text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-700"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Loads in progress" value={String(stats?.activeLoads ?? 0)} Icon={Truck} tone="border-sky-200 bg-sky-50 text-sky-600" />
          <Metric label="Completed loads" value={String(stats?.completedLoads ?? 0)} Icon={CheckCircle2} tone="border-emerald-200 bg-emerald-50 text-emerald-600" />
          <Metric label="Paperwork follow-up" value={String(podFollowUps.length)} Icon={FileCheck2} tone="border-amber-200 bg-amber-50 text-amber-600" />
          <Metric label="Net this month" value={money(thisMonthNet)} Icon={Wallet} tone="border-violet-200 bg-violet-50 text-violet-600" />
          <Metric label="Average RPM" value={`$${(stats?.avgRPM ?? 0).toFixed(2)}`} Icon={DollarSign} tone="border-teal-200 bg-teal-50 text-teal-600" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Current execution</h2><p className="mt-1 text-sm text-slate-500">Your active pickups and deliveries in dispatch order.</p></div><Link href="/carrier/loads" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Open loads <ArrowRight size={15} /></Link></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500"><tr><th className="px-5 py-3">Load</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Pickup</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{activeLoads.slice(0, 5).map(load => <tr key={load.id} className="hover:bg-sky-50"><td className="px-5 py-3 font-mono text-xs font-semibold text-blue-700">{load.loadNumber}</td><td className="px-4 py-3 text-slate-700">{load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}</td><td className="px-4 py-3 text-slate-600">{displayDate(load.pickupDate)}</td><td className="px-4 py-3"><span className={`border px-2 py-1 text-[10px] font-semibold ${statusClass(load.status)}`}>{LOAD_STATUS_LABELS[load.status]}</span></td><td className="px-5 py-3 text-right"><Link href={`/carrier/loads?load=${encodeURIComponent(load.id)}`} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Open</Link></td></tr>)}{!loading && activeLoads.length === 0 && <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-400">No active assignments right now.</td></tr>}</tbody></table></div>
          </div>
          <aside className="border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Operations queue</h2><p className="mt-1 text-sm text-slate-500">Work that needs your attention.</p></div><div className="divide-y divide-slate-100"><Link href="/carrier/loads" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-sky-50"><FileCheck2 size={18} className="text-amber-500" /><div className="min-w-0 flex-1"><p className="font-medium text-slate-800">POD follow-up</p><p className="mt-0.5 text-xs text-slate-500">Delivered loads awaiting proof of delivery</p></div><span className="font-mono text-sm font-semibold text-slate-700">{podFollowUps.length}</span><ArrowRight size={15} className="text-slate-400" /></Link><Link href="/carrier/earnings" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-sky-50"><DollarSign size={18} className="text-violet-500" /><div className="min-w-0 flex-1"><p className="font-medium text-slate-800">Settlement status</p><p className="mt-0.5 text-xs text-slate-500">Loads moving through billing and payment</p></div><span className="font-mono text-sm font-semibold text-slate-700">{invoiceQueue.length}</span><ArrowRight size={15} className="text-slate-400" /></Link><Link href="/carrier/history" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-sky-50"><ClipboardList size={18} className="text-sky-500" /><div className="min-w-0 flex-1"><p className="font-medium text-slate-800">Load history</p><p className="mt-0.5 text-xs text-slate-500">Every load and document record</p></div><span className="font-mono text-sm font-semibold text-slate-700">{stats?.totalLoads ?? 0}</span><ArrowRight size={15} className="text-slate-400" /></Link></div></aside>
        </section>

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Eight-week revenue view</h2><p className="mt-1 text-sm text-slate-500">Completed-load revenue and net pay.</p></div><Link href="/carrier/earnings" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Open earnings <ArrowRight size={15} /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500"><tr><th className="px-5 py-3">Week</th><th className="px-5 py-3 text-right">Gross revenue</th><th className="px-5 py-3 text-right">Net pay</th><th className="px-5 py-3">Net share</th></tr></thead><tbody className="divide-y divide-slate-100">{weeklyRows.map(row => { const share = row.gross ? Math.round((row.net / row.gross) * 100) : 0; return <tr key={row.label}><td className="px-5 py-2.5 text-slate-700">{row.label}</td><td className="px-5 py-2.5 text-right font-mono text-slate-700">{money(row.gross)}</td><td className="px-5 py-2.5 text-right font-mono font-semibold text-emerald-700">{money(row.net)}</td><td className="px-5 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 w-28 bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${share}%` }} /></div><span className="font-mono text-xs text-slate-500">{share}%</span></div></td></tr>; })}</tbody></table></div></section>
      </div>
    </div>
  );
}
