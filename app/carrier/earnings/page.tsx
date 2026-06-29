'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, TrendingUp, FileDown, ChevronDown, Calendar,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSonexAuth } from '@/lib/sonexAuth';
import { getLoadsByCarrier, getSettlements } from '@/lib/sonexStore';
import type { SonexLoad, SonexSettlement, LoadStatus } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPLETED: LoadStatus[] = ['delivered', 'pod_received', 'invoiced', 'paid'];

type FilterRange = 'this_week' | 'this_month' | 'last_month' | 'all_time';

const FILTER_LABELS: Record<FilterRange, string> = {
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  all_time: 'All Time',
};

function getDateBounds(range: FilterRange): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (range === 'this_week') {
    const start = new Date(now);
    const dow = now.getDay();
    start.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (range === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end };
  }
  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    lastEnd.setHours(23, 59, 59, 999);
    return { start, end: lastEnd };
  }
  return { start: new Date(0), end };
}

function filterLoads(loads: SonexLoad[], range: FilterRange): SonexLoad[] {
  if (range === 'all_time') return loads;
  const { start, end } = getDateBounds(range);
  return loads.filter(l => {
    const d = new Date(l.pickupDate + 'T00:00:00');
    return d >= start && d <= end;
  });
}

function fmt$(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, color = 'text-white', icon,
}: { label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl px-3 py-4 flex flex-col gap-1"
      style={{ background: 'rgba(13,31,60,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {icon && <div className="mb-1">{icon}</div>}
      <div className="text-slate-500 text-[10px] uppercase tracking-widest leading-tight">{label}</div>
      <div className={`font-black font-mono text-lg leading-tight ${color}`}>{value}</div>
      {sub && <div className="text-slate-600 text-[10px]">{sub}</div>}
    </div>
  );
}

// ─── Load Table Row ───────────────────────────────────────────────────────────

function LoadRow({ load }: { load: SonexLoad }) {
  const STATUS_COLORS: Partial<Record<LoadStatus, string>> = {
    delivered: 'text-emerald-400',
    paid: 'text-green-400',
    invoiced: 'text-violet-400',
    pod_received: 'text-teal-400',
  };
  const color = STATUS_COLORS[load.status] ?? 'text-slate-400';

  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0.5 px-3 py-3 rounded-xl"
      style={{ background: 'rgba(13,31,60,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Col 1: Load # + date */}
      <div className="flex flex-col">
        <span className="font-mono text-amber-400 text-xs font-bold">{load.loadNumber}</span>
        <span className="text-slate-600 text-[10px]">{fmtDate(load.pickupDate)}</span>
      </div>
      {/* Col 2: Route + commodity */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1 text-slate-300 text-xs truncate">
          <span className="truncate">{load.pickupCity}, {load.pickupState}</span>
          <ArrowRight size={10} className="flex-shrink-0 text-slate-600" />
          <span className="truncate">{load.deliveryCity}, {load.deliveryState}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold ${color}`}>{LOAD_STATUS_LABELS[load.status]}</span>
          <span className="text-slate-600 text-[10px]">{load.miles.toLocaleString()} mi</span>
        </div>
      </div>
      {/* Col 3: financials */}
      <div className="flex flex-col items-end">
        <span className="text-amber-400 text-sm font-black font-mono">{fmt$(load.carrierNet)}</span>
        <span className="text-slate-600 text-[10px]">of {fmt$(load.rate)}</span>
        <span className="text-slate-700 text-[10px]">-{load.dispatchFeePercent}% fee</span>
      </div>
    </div>
  );
}

// ─── Settlement Row ───────────────────────────────────────────────────────────

function SettlementRow({ s }: { s: SonexSettlement }) {
  function handleDownload() {
    // Simple CSV export as fallback (jsPDF would need install)
    const lines = [
      'Settlement Report — Sonex Dispatch Hub',
      `Period: ${s.periodStart} to ${s.periodEnd}`,
      `Generated: ${new Date(s.generatedAt).toLocaleDateString()}`,
      '',
      `Gross Total: $${s.grossTotal.toFixed(2)}`,
      `Dispatch Fees: $${s.feeTotal.toFixed(2)}`,
      `Net Paid: $${s.netTotal.toFixed(2)}`,
      `Loads: ${s.loadIds.length}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlement-${s.periodStart}-${s.periodEnd}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Settlement downloaded!');
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: 'rgba(13,31,60,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Calendar size={12} className="text-amber-500/60" />
          <span className="text-white text-xs font-semibold">
            {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
          </span>
        </div>
        <div className="text-slate-500 text-[10px]">
          {s.loadIds.length} load{s.loadIds.length !== 1 ? 's' : ''} ·{' '}
          Generated {new Date(s.generatedAt).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-slate-400 text-xs">Gross: <span className="font-mono text-slate-300">{fmt$(s.grossTotal)}</span></span>
          <span className="text-amber-400 text-xs font-bold font-mono">{fmt$(s.netTotal)} net</span>
        </div>
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 transition-all active:scale-95"
        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.20)' }}>
        <FileDown size={13} />
        Download
      </button>
    </div>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────

function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-amber-500 text-black'
          : 'text-slate-400 hover:text-white'
      }`}
      style={active ? {} : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CarrierEarningsPage() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';
  const [allCompleted, setAllCompleted] = useState<SonexLoad[]>([]);
  const [settlements, setSettlements] = useState<SonexSettlement[]>([]);
  const [filter, setFilter] = useState<FilterRange>('this_month');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!carrierId) return;
    getLoadsByCarrier(carrierId).then(allLoads => {
      const loads = allLoads.filter(l => COMPLETED.includes(l.status));
      loads.sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
      setAllCompleted(loads);
    });
    getSettlements(carrierId).then(allSettlements => {
      setSettlements(allSettlements.sort(
        (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      ));
    });
  }, [carrierId]);

  // Lifetime totals
  const lifetimeGross = useMemo(() => allCompleted.reduce((s, l) => s + l.rate, 0), [allCompleted]);
  const lifetimeFees = useMemo(() => allCompleted.reduce((s, l) => s + l.dispatchFeeAmount, 0), [allCompleted]);
  const lifetimeNet = useMemo(() => lifetimeGross - lifetimeFees, [lifetimeGross, lifetimeFees]);

  // Filtered loads
  const filteredLoads = useMemo(() => filterLoads(allCompleted, filter), [allCompleted, filter]);
  const filteredGross = filteredLoads.reduce((s, l) => s + l.rate, 0);
  const filteredFees = filteredLoads.reduce((s, l) => s + l.dispatchFeeAmount, 0);
  const filteredNet = filteredGross - filteredFees;

  const displayedLoads = showAll ? filteredLoads : filteredLoads.slice(0, 8);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-white tracking-tight">My Earnings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Transparent breakdown of your pay</p>
      </div>

      {/* Lifetime summary cards */}
      <div>
        <div className="text-xs text-slate-600 uppercase tracking-widest mb-2">Lifetime Totals</div>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="Gross"
            value={`$${(lifetimeGross / 1000).toFixed(1)}k`}
            sub="From broker"
            color="text-white"
            icon={<TrendingUp size={14} className="text-slate-500" />}
          />
          <SummaryCard
            label="Dispatch Fee"
            value={`$${(lifetimeFees / 1000).toFixed(1)}k`}
            sub="Transparent"
            color="text-slate-400"
            icon={<ChevronDown size={14} className="text-slate-600" />}
          />
          <SummaryCard
            label="Net Paid"
            value={`$${(lifetimeNet / 1000).toFixed(1)}k`}
            sub="Your take"
            color="text-amber-400"
            icon={<DollarSign size={14} className="text-amber-500" />}
          />
        </div>
      </div>

      {/* Filter row */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(Object.keys(FILTER_LABELS) as FilterRange[]).map(r => (
            <FilterPill
              key={r}
              active={filter === r}
              label={FILTER_LABELS[r]}
              onClick={() => { setFilter(r); setShowAll(false); }}
            />
          ))}
        </div>
      </div>

      {/* Filtered period summary */}
      {filteredLoads.length > 0 && (
        <div className="rounded-2xl px-4 py-4"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="text-amber-400/60 text-[10px] uppercase tracking-widest mb-3">
            {FILTER_LABELS[filter]} — {filteredLoads.length} Load{filteredLoads.length !== 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Gross</div>
              <div className="text-white text-sm font-bold font-mono">{fmt$(filteredGross)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Fees</div>
              <div className="text-slate-400 text-sm font-bold font-mono">-{fmt$(filteredFees)}</div>
            </div>
            <div>
              <div className="text-amber-400/80 text-xs mb-0.5">Your Net</div>
              <div className="text-amber-400 text-lg font-black font-mono">{fmt$(filteredNet)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Per-load breakdown */}
      {filteredLoads.length > 0 ? (
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Load Breakdown</div>
          <div className="space-y-2">
            {displayedLoads.map(load => <LoadRow key={load.id} load={load} />)}
          </div>

          {/* Footer totals */}
          {filteredLoads.length > 0 && (
            <div className="mt-2 px-3 py-2.5 rounded-xl flex justify-between items-center"
              style={{ background: 'rgba(13,31,60,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-slate-500 text-xs font-semibold">
                {filteredLoads.length} Load{filteredLoads.length !== 1 ? 's' : ''} Total
              </span>
              <span className="text-amber-400 font-black font-mono text-sm">{fmt$(filteredNet)}</span>
            </div>
          )}

          {filteredLoads.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-2 w-full py-2.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {showAll ? `Show less` : `Show all ${filteredLoads.length} loads`}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-600 text-sm">
          No completed loads for {FILTER_LABELS[filter].toLowerCase()}.
        </div>
      )}

      {/* Settlements */}
      {settlements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileDown size={15} className="text-amber-500/60" />
            <h2 className="text-base font-bold text-white">Settlement History</h2>
          </div>
          <div className="space-y-2">
            {settlements.map(s => <SettlementRow key={s.id} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}
