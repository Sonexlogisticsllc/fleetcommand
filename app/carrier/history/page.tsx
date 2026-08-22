'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileCheck2, Search, SlidersHorizontal } from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { getLoadsByCarrier } from '@/lib/sonexStore';
import type { LoadStatus, SonexLoad } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

const statuses: Array<LoadStatus | 'all'> = ['all', 'booked', 'dispatched', 'in_transit', 'delivered', 'pod_received', 'invoiced', 'paid'];
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function statusClass(status: LoadStatus) {
  if (status === 'in_transit') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'booked' || status === 'dispatched') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'delivered' || status === 'pod_received') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'invoiced') return 'border-violet-200 bg-violet-50 text-violet-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

export default function CarrierHistoryPage() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<LoadStatus | 'all'>('all');

  useEffect(() => {
    if (!carrierId) return;
    void getLoadsByCarrier(carrierId).then(nextLoads => setLoads(nextLoads.sort((a, b) => b.pickupDate.localeCompare(a.pickupDate))));
  }, [carrierId]);

  const visibleLoads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return loads.filter(load => {
      const matchesStatus = status === 'all' || load.status === status;
      const text = `${load.loadNumber} ${load.brokerName} ${load.pickupCity} ${load.pickupState} ${load.deliveryCity} ${load.deliveryState}`.toLowerCase();
      return matchesStatus && (!normalized || text.includes(normalized));
    });
  }, [loads, query, status]);

  return (
    <div data-carrier-dashboard className="min-h-full bg-[#f2f5f9] px-5 py-6 text-slate-900 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-3 h-1 w-14 bg-sky-500" /><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Carrier operations</p><h1 className="mt-1 text-3xl font-semibold text-slate-950">Load History</h1><p className="mt-1 text-sm text-slate-500">Every assigned load, payment status, and paperwork record.</p></div><Link href="/carrier/loads" className="inline-flex h-10 items-center gap-2 border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><FileCheck2 size={16} /> Open active work</Link></div>

      <section className="mb-5 border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search load, broker, or route" className="h-10 w-full border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div><div className="flex flex-wrap gap-2">{statuses.map(item => <button key={item} onClick={() => setStatus(item)} className={`h-10 border px-3 text-xs font-semibold transition-colors ${status === item ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}>{item === 'all' ? 'All loads' : LOAD_STATUS_LABELS[item]}</button>)}</div></div></section>

      <section className="overflow-hidden border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-slate-500" /><span className="text-sm font-semibold text-slate-700">{visibleLoads.length} loads</span></div><span className="text-xs text-slate-500">Carrier-scoped records</span></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500"><tr><th className="px-5 py-3">Load</th><th className="px-4 py-3">Pickup</th><th className="px-4 py-3">Delivery</th><th className="px-4 py-3">Broker</th><th className="px-4 py-3">Paperwork</th><th className="px-4 py-3 text-right">Net pay</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Open</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleLoads.map(load => <tr key={load.id} className="transition-colors hover:bg-sky-50"><td className="px-5 py-3 font-mono text-xs font-semibold text-blue-700">{load.loadNumber}<p className="mt-0.5 font-sans text-[10px] font-normal text-slate-400">{load.pickupDate}</p></td><td className="px-4 py-3 text-slate-700">{load.pickupCity}, {load.pickupState}</td><td className="px-4 py-3 text-slate-700">{load.deliveryCity}, {load.deliveryState}</td><td className="px-4 py-3 text-slate-600">{load.brokerName}</td><td className="px-4 py-3"><span className={load.bolUrl && load.podUrl ? 'text-emerald-700' : 'text-amber-700'}>{load.bolUrl && load.podUrl ? 'Complete' : load.bolUrl ? 'BOL saved' : 'Pending'}</span></td><td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">{money(load.carrierNet)}</td><td className="px-4 py-3"><span className={`border px-2 py-1 text-[10px] font-semibold ${statusClass(load.status)}`}>{LOAD_STATUS_LABELS[load.status]}</span></td><td className="px-5 py-3 text-right"><Link href={`/carrier/loads?load=${encodeURIComponent(load.id)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">Open <ArrowRight size={14} /></Link></td></tr>)}{visibleLoads.length === 0 && <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">No load records match this view.</td></tr>}</tbody></table></div></section>
    </div>
  );
}
