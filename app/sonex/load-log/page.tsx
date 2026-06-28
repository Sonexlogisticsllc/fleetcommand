'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Download, X, ChevronUp, ChevronDown, Filter,
  ArrowRight, LayoutGrid, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SonexCarrier, SonexLoad, LoadStatus } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS, LOAD_STATUS_ORDER } from '@/lib/sonexTypes';
import { getCarriers, getLoads, exportLoadsCSV } from '@/lib/sonexStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_COLORS: Record<LoadStatus, string> = {
  booked: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  dispatched: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  in_transit: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  pod_received: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  invoiced: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  paid: 'bg-green-500/15 text-green-400 border-green-500/20',
};

type SortDir = 'asc' | 'desc';
type SortCol = 'loadNumber' | 'pickupDate' | 'carrier' | 'brokerName' | 'route' | 'commodity' | 'miles' | 'rate' | 'ratePerMile' | 'dispatchFeeAmount' | 'status';

function getRPMColor(rpm: number): string {
  if (rpm >= 2.5) return 'text-emerald-400';
  if (rpm >= 1.5) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Status Chip Toggle ───────────────────────────────────────────────────────

function StatusChip({ status, selected, onClick }: { status: LoadStatus; selected: boolean; onClick: () => void }) {
  const colors = STATUS_COLORS[status];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${
        selected ? colors : 'border-white/10 text-slate-600 hover:border-white/20 hover:text-slate-400'
      }`}
    >
      {LOAD_STATUS_LABELS[status]}
    </button>
  );
}

// ─── Sort Header ─────────────────────────────────────────────────────────────

function SortTH({ label, col, sortCol, sortDir, onSort, className = '', right }: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir;
  onSort: (col: SortCol) => void; className?: string; right?: boolean;
}) {
  const active = sortCol === col;
  return (
    <th
      className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider cursor-pointer whitespace-nowrap select-none transition-colors ${
        active ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
      } ${right ? 'text-right' : ''} ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          : <Minus size={9} className="opacity-30" />}
      </span>
    </th>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LoadLogPage() {
  const router = useRouter();
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [loads, setLoads] = useState<SonexLoad[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [pickupState, setPickupState] = useState('all');
  const [deliveryState, setDeliveryState] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<LoadStatus>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('pickupDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setCarriers(getCarriers());
    setLoads(getLoads());
  }, []);

  const carrierMap = useMemo(() => new Map(carriers.map(c => [c.id, c])), [carriers]);

  // Unique states from data
  const pickupStates = useMemo(() => ['all', ...Array.from(new Set(loads.map(l => l.pickupState))).sort()], [loads]);
  const deliveryStates = useMemo(() => ['all', ...Array.from(new Set(loads.map(l => l.deliveryState))).sort()], [loads]);

  const toggleStatus = (s: LoadStatus) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const clearFilters = useCallback(() => {
    setSearch('');
    setCarrierFilter('all');
    setPickupState('all');
    setDeliveryState('all');
    setSelectedStatuses(new Set());
    setDateFrom('');
    setDateTo('');
  }, []);

  const handleSort = (col: SortCol) => {
    setSortDir(prev => (sortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'));
    setSortCol(col);
  };

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return loads.filter(l => {
      // text search
      if (q) {
        const carrier = carrierMap.get(l.carrierId);
        const carrierName = carrier ? `${carrier.firstName} ${carrier.lastName}`.toLowerCase() : '';
        const searchStr = `${l.loadNumber} ${l.brokerName} ${l.pickupState} ${l.deliveryState} ${l.commodity} ${carrierName}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }
      if (carrierFilter !== 'all' && l.carrierId !== carrierFilter) return false;
      if (pickupState !== 'all' && l.pickupState !== pickupState) return false;
      if (deliveryState !== 'all' && l.deliveryState !== deliveryState) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(l.status)) return false;
      if (dateFrom && new Date(l.pickupDate) < new Date(dateFrom)) return false;
      if (dateTo && new Date(l.pickupDate) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [loads, search, carrierFilter, pickupState, deliveryState, selectedStatuses, dateFrom, dateTo, carrierMap]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortCol === 'carrier') {
        const ca = carrierMap.get(a.carrierId);
        const cb = carrierMap.get(b.carrierId);
        av = ca ? `${ca.firstName} ${ca.lastName}` : '';
        bv = cb ? `${cb.firstName} ${cb.lastName}` : '';
      } else if (sortCol === 'route') {
        av = `${a.pickupState}${a.deliveryState}`;
        bv = `${b.pickupState}${b.deliveryState}`;
      } else {
        av = a[sortCol as keyof SonexLoad] as string | number;
        bv = b[sortCol as keyof SonexLoad] as string | number;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [filtered, sortCol, sortDir, carrierMap]);

  // Footer totals
  const totalRate = sorted.reduce((s, l) => s + l.rate, 0);
  const totalFees = sorted.reduce((s, l) => s + l.dispatchFeeAmount, 0);

  const handleExportCSV = () => {
    const csv = exportLoadsCSV(sorted, carriers);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonex-load-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${sorted.length} loads exported`);
  };

  const hasFilters = search || carrierFilter !== 'all' || pickupState !== 'all' || deliveryState !== 'all' || selectedStatuses.size > 0 || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-[#050B18] p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Load Log</h1>
          <p className="text-slate-400 text-sm mt-0.5">All loads — spreadsheet view</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-all active:scale-95"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search load #, carrier, broker, route, commodity…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Carrier */}
          <select value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40 cursor-pointer">
            <option value="all">All Carriers</option>
            {carriers.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>

          {/* Pickup State */}
          <select value={pickupState} onChange={e => setPickupState(e.target.value)}
            className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40 cursor-pointer">
            <option value="all">Pickup State</option>
            {pickupStates.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Delivery State */}
          <select value={deliveryState} onChange={e => setDeliveryState(e.target.value)}
            className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40 cursor-pointer">
            <option value="all">Delivery State</option>
            {deliveryStates.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Date Range */}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40"
            placeholder="From" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40"
            placeholder="To" />

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-red-400 transition-colors">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mr-1">Status:</span>
          <button
            onClick={() => setSelectedStatuses(new Set())}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              selectedStatuses.size === 0
                ? 'bg-white/10 border-white/20 text-white'
                : 'border-white/10 text-slate-600 hover:text-slate-400'
            }`}
          >
            All
          </button>
          {LOAD_STATUS_ORDER.map(s => (
            <StatusChip
              key={s}
              status={s}
              selected={selectedStatuses.has(s)}
              onClick={() => toggleStatus(s)}
            />
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-white">{sorted.length}</span> of{' '}
          <span className="font-semibold text-slate-400">{loads.length}</span> loads
        </p>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <SortTH label="Load #" col="loadNumber" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Date" col="pickupDate" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Carrier" col="carrier" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Broker" col="brokerName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Route" col="route" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Commodity" col="commodity" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Miles" col="miles" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                <SortTH label="Rate" col="rate" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                <SortTH label="RPM" col="ratePerMile" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                <SortTH label="Fee $" col="dispatchFeeAmount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                <SortTH label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-600">
                      <LayoutGrid size={28} className="opacity-30" />
                      <div>
                        <p className="text-sm font-semibold">No loads match your filters</p>
                        {hasFilters && (
                          <button onClick={clearFilters} className="text-xs text-amber-500 hover:text-amber-400 mt-1 transition-colors">
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : sorted.map(l => {
                const carrier = carrierMap.get(l.carrierId);
                return (
                  <tr
                    key={l.id}
                    onClick={() => router.push(`/sonex/loads/${l.id}`)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    {/* Load # */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-mono font-semibold text-amber-400 group-hover:text-amber-300 transition-colors">
                        {l.loadNumber}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">
                      {new Date(l.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>

                    {/* Carrier */}
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-slate-200">
                      {carrier ? `${carrier.firstName} ${carrier.lastName}` : '—'}
                    </td>

                    {/* Broker */}
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{l.brokerName}</td>

                    {/* Route */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                        <span className="font-semibold">{l.pickupState}</span>
                        <ArrowRight size={10} className="text-slate-600" />
                        <span className="font-semibold">{l.deliveryState}</span>
                      </span>
                    </td>

                    {/* Commodity */}
                    <td className="px-3 py-2 max-w-[120px] truncate text-xs text-slate-400 title-hint" title={l.commodity}>
                      {l.commodity}
                    </td>

                    {/* Miles */}
                    <td className="px-3 py-2 text-right whitespace-nowrap text-xs font-mono text-slate-400">
                      {l.miles.toLocaleString()}
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-2 text-right whitespace-nowrap text-xs font-mono text-slate-200 font-semibold">
                      {fmt$(l.rate)}
                    </td>

                    {/* RPM */}
                    <td className={`px-3 py-2 text-right whitespace-nowrap text-xs font-mono font-bold ${getRPMColor(l.ratePerMile)}`}>
                      ${l.ratePerMile.toFixed(2)}
                    </td>

                    {/* Dispatch Fee */}
                    <td className="px-3 py-2 text-right whitespace-nowrap text-xs font-mono font-bold text-amber-400">
                      {fmt$(l.dispatchFeeAmount)}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[l.status]}`}>
                        {LOAD_STATUS_LABELS[l.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer totals */}
            {sorted.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-amber-500/30 bg-amber-500/[0.05]">
                  <td className="px-3 py-2.5 text-xs font-bold text-amber-400 uppercase tracking-wider" colSpan={7}>
                    Totals — {sorted.length} loads
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold font-mono text-amber-300">
                    {fmt$(totalRate)}
                  </td>
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold font-mono text-amber-400">
                    {fmt$(totalFees)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
