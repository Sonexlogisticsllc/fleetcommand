'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, TrendingUp, BarChart2, Truck, Download, FileDown,
  ChevronDown, Calendar, ArrowRight, RefreshCw, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useSonexAuth } from '@/lib/sonexAuth';
import { getLoadsByCarrier, getSettlements } from '@/lib/sonexStore';
import type { SonexLoad, SonexSettlement, LoadStatus } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPLETED: LoadStatus[] = ['delivered', 'pod_received', 'invoiced', 'paid'];

type FilterRange = 'this_week' | 'this_month' | 'last_month' | 'all_time' | 'custom';

const FILTER_LABELS: Record<Exclude<FilterRange, 'custom'>, string> = {
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  all_time: 'All Time',
};

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString('en-US');

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function filterLoadsByRange(loads: SonexLoad[], range: FilterRange, customFrom: string, customTo: string): SonexLoad[] {
  const now = new Date();
  let from: Date, to: Date;

  if (range === 'this_week') {
    from = getWeekStart(now);
    to = getWeekEnd(now);
  } else if (range === 'this_month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (range === 'last_month') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (range === 'custom' && customFrom && customTo) {
    from = new Date(customFrom);
    to = new Date(customTo + 'T23:59:59');
  } else {
    return loads;
  }

  return loads.filter(l => {
    const d = new Date(l.pickupDate + 'T00:00:00');
    return d >= from && d <= to;
  });
}

function buildWeeklyData(loads: SonexLoad[]): { week: string; gross: number; net: number }[] {
  const weeks: Map<string, { gross: number; net: number }> = new Map();
  const now = new Date();

  for (let i = 7; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(now.getDate() - i * 7);
    const ws = getWeekStart(weekDate);
    const key = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weeks.set(key, { gross: 0, net: 0 });
  }

  loads.forEach(l => {
    const ws = getWeekStart(new Date(l.pickupDate + 'T00:00:00'));
    const key = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (weeks.has(key)) {
      const w = weeks.get(key)!;
      w.gross += l.rate;
      w.net += l.carrierNet;
    }
  });

  return Array.from(weeks.entries()).map(([week, data]) => ({ week, ...data }));
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`glass-card p-5 flex flex-col gap-3 ${accent ? 'border-violet-200 ring-1 ring-violet-100' : ''}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${accent ? 'bg-violet-50' : 'bg-slate-100'}`}>
          <Icon size={16} className={accent ? 'text-violet-700' : 'text-slate-500'} />
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${accent ? 'text-violet-700' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const EarningsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0D1F3C] border border-amber-500/20 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className={p.dataKey === 'net' ? 'text-emerald-400' : 'text-amber-300'}>
          {p.name}: {fmt$(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Settlement Row ───────────────────────────────────────────────────────────

function SettlementRow({ s, loads, carrierName }: { s: SonexSettlement; loads: SonexLoad[]; carrierName: string }) {
  function handleDownload() {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(5, 11, 24);
      doc.text('SONEX LOGISTICS LLC', 14, 20);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('525 Randall Ave Ste 100', 14, 25);
      doc.text('Cheyenne, WY 82001', 14, 30);
      doc.text('dispatch@sonexlogistics.com | (346) 421-2681', 14, 35);
      
      // Title
      doc.setFontSize(14);
      doc.setTextColor(245, 158, 11);
      doc.text('CARRIER SETTLEMENT STATEMENT', 14, 48);
      
      // Settlement Info
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(`Carrier Name: ${carrierName}`, 14, 58);
      doc.text(`Statement Period: ${s.periodStart} to ${s.periodEnd}`, 14, 63);
      doc.text(`Statement Date: ${new Date(s.generatedAt).toLocaleDateString()}`, 14, 68);
      doc.text(`Statement ID: ST-${s.id.slice(0, 8).toUpperCase()}`, 14, 73);
      
      // Table data
      const tableBody = loads.map(l => [
        l.loadNumber,
        l.pickupDate,
        `${l.pickupCity}, ${l.pickupState} → ${l.deliveryCity}, ${l.deliveryState}`,
        `$${l.rate.toFixed(2)}`,
        `${l.totalFeePercent}%`,
        `$${l.totalFeeAmount.toFixed(2)}`,
        `$${l.carrierNet.toFixed(2)}`
      ]);
      
      // Add totals row
      tableBody.push([
        'TOTALS',
        '',
        '',
        `$${s.grossTotal.toFixed(2)}`,
        '',
        `$${s.feeTotal.toFixed(2)}`,
        `$${s.netTotal.toFixed(2)}`
      ]);
      
      (doc as any).autoTable({
        startY: 80,
        head: [['Load #', 'Date', 'Route', 'Gross Rate', 'Fee %', 'Fee Amount', 'Net Pay']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [5, 11, 24], textColor: [255, 255, 255] },
        footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
        styles: { fontSize: 8 },
        columnStyles: {
          3: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' }
        }
      });
      
      doc.save(`settlement-${s.periodStart}-${s.periodEnd}.pdf`);
      toast.success('✓ Settlement PDF downloaded!');
    } catch (err) {
      console.error('PDF generation failed, falling back to text:', err);
      const lines = [
        'Settlement Report — Sonex Dispatch Hub',
        `Period: ${s.periodStart} to ${s.periodEnd}`,
        `Generated: ${new Date(s.generatedAt).toLocaleDateString()}`,
        '',
        `Gross Total: $${s.grossTotal.toFixed(2)}`,
        `Total Fees: $${s.feeTotal.toFixed(2)}`,
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
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl"
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CarrierEarningsPage() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';

  const [allCompleted, setAllCompleted] = useState<SonexLoad[]>([]);
  const [settlements, setSettlements] = useState<SonexSettlement[]>([]);
  const [dateRange, setDateRange] = useState<FilterRange>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Sort state for table
  const [loadSort, setLoadSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'pickupDate', dir: 'desc' });

  const refresh = useCallback(async () => {
    if (!carrierId) return;
    try {
      const allLoads = await getLoadsByCarrier(carrierId);
      const loads = allLoads.filter(l => COMPLETED.includes(l.status));
      loads.sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
      setAllCompleted(loads);

      const allSettlements = await getSettlements(carrierId);
      setSettlements(allSettlements.sort(
        (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      ));
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.includes('session has expired')) {
        window.location.assign('/sonex/login');
      }
    }
  }, [carrierId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Filter loads based on date selection
  const filteredLoads = useMemo(() => {
    return filterLoadsByRange(allCompleted, dateRange, customFrom, customTo);
  }, [allCompleted, dateRange, customFrom, customTo]);

  // Financial summaries
  const totalGross = useMemo(() => filteredLoads.reduce((s, l) => s + l.rate, 0), [filteredLoads]);
  const totalFees = useMemo(() => filteredLoads.reduce((s, l) => s + l.totalFeeAmount, 0), [filteredLoads]);
  const totalNet = useMemo(() => totalGross - totalFees, [totalGross, totalFees]);
  const totalMiles = useMemo(() => filteredLoads.reduce((s, l) => s + l.miles, 0), [filteredLoads]);
  const avgRPM = useMemo(() => {
    const loadsWithMiles = filteredLoads.filter(l => l.miles > 0);
    return loadsWithMiles.length > 0 ? filteredLoads.reduce((s, l) => s + l.ratePerMile, 0) / loadsWithMiles.length : 0;
  }, [filteredLoads]);

  // Chart 1: Weekly earnings data (last 8 weeks)
  const weeklyChartData = useMemo(() => buildWeeklyData(allCompleted), [allCompleted]);

  // Chart 2: Earnings grouped by load lifecycle status
  const statusChartData = useMemo(() => {
    const statusGroup = new Map<string, { gross: number; net: number }>();
    COMPLETED.forEach(st => {
      statusGroup.set(st, { gross: 0, net: 0 });
    });
    filteredLoads.forEach(l => {
      const key = l.status;
      if (statusGroup.has(key)) {
        const val = statusGroup.get(key)!;
        val.gross += l.rate;
        val.net += l.carrierNet;
      }
    });
    return Array.from(statusGroup.entries()).map(([status, val]) => ({
      name: LOAD_STATUS_LABELS[status as LoadStatus] || status,
      Gross: Math.round(val.gross * 100) / 100,
      Net: Math.round(val.net * 100) / 100,
    }));
  }, [filteredLoads]);

  // Sort loads logic
  const sortedLoads = useMemo(() => {
    return [...filteredLoads].sort((a, b) => {
      const av: string | number = a[loadSort.col as keyof SonexLoad] as string | number;
      const bv: string | number = b[loadSort.col as keyof SonexLoad] as string | number;
      if (typeof av === 'string' && typeof bv === 'string') {
        return loadSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return loadSort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [filteredLoads, loadSort]);

  const toggleSort = (col: string) => {
    setLoadSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (loadSort.col !== col) return <span className="ml-1 text-slate-700">↕</span>;
    return <span className="ml-1 text-amber-400">{loadSort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  // CSV Export for driver/carrier
  const handleExportCSV = () => {
    if (filteredLoads.length === 0) {
      toast.error('No loads available to export');
      return;
    }
    const headers = ['Load #', 'Pickup Date', 'Pickup City', 'Pickup State', 'Delivery City', 'Delivery State', 'Status', 'Miles', 'Gross Rate', 'Fee Amount', 'Net Pay', 'RPM'];
    const rows = filteredLoads.map(l => [
      l.loadNumber,
      l.pickupDate,
      l.pickupCity,
      l.pickupState,
      l.deliveryCity,
      l.deliveryState,
      l.status,
      l.miles,
      l.rate,
      l.totalFeeAmount,
      l.carrierNet,
      l.ratePerMile
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-earnings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('✓ CSV exported successfully!');
  };

  return (
    <div data-carrier-workspace className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Financial Reporting</h1>
          <p className="text-slate-500 text-sm mt-0.5">Revenue, dispatch fees, and settlements analysis</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-xs hover:bg-violet-700 transition-all active:scale-95 shrink-0"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Date Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value as FilterRange)}
          className="px-3 py-2 text-xs bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40 cursor-pointer"
        >
          <option value="all_time">All Time</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="custom">Custom Range</option>
        </select>
        {dateRange === 'custom' && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none"
            />
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none"
            />
          </>
        )}
        <span className="text-xs text-slate-500 ml-auto font-mono">{filteredLoads.length} loads</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label="Total Gross Revenue" value={fmt$(totalGross)} sub={`${filteredLoads.length} loads`} />
        <SummaryCard icon={TrendingUp} label="Total Dispatch Fees" value={fmt$(totalFees)} sub={`${totalGross > 0 ? (totalFees / totalGross * 100).toFixed(1) : 0}% fee`} accent />
        <SummaryCard icon={DollarSign} label="Total Net Pay" value={fmt$(totalNet)} sub="Your take-home" />
        <SummaryCard icon={BarChart2} label="Average RPM" value={`$${avgRPM.toFixed(2)}/mi`} sub={`${totalMiles.toLocaleString()} total miles`} />
      </div>

      {/* Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Weekly Earning Trend */}
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Weekly Earnings (Last 8 Weeks)</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<EarningsTooltip />} />
                <Bar dataKey="gross" name="Gross Pay" fill="#F59E0B" radius={[4, 4, 0, 0]} opacity={0.65} />
                <Bar dataKey="net" name="Net Pay" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Earnings by load lifecycle state */}
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Earnings by Load Status</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip content={<EarningsTooltip />} />
                <Bar dataKey="Gross" fill="rgba(245,158,11,0.25)" stroke="#F59E0B" strokeWidth={0.8} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Net" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabular Load Breakdown */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Load Breakdown</h2>
          <span className="text-xs text-slate-500 font-mono">{filteredLoads.length} loads</span>
        </div>
        {filteredLoads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {[
                    { label: 'Load #', col: 'loadNumber' },
                    { label: 'Date', col: 'pickupDate' },
                    { label: 'Route', col: '' },
                    { label: 'Status', col: 'status' },
                    { label: 'Gross', col: 'rate' },
                    { label: 'Fees', col: 'totalFeeAmount' },
                    { label: 'Net Pay', col: 'carrierNet' },
                    { label: 'RPM', col: 'ratePerMile' },
                  ].map(({ label, col }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${col ? 'cursor-pointer hover:text-slate-300' : ''}`}
                      onClick={col ? () => toggleSort(col) : undefined}
                    >
                      {label}{col && <SortIcon col={col} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLoads.map(load => {
                  const statusColors: Record<string, string> = {
                    delivered: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    paid: 'text-green-400 bg-green-500/10 border-green-500/20',
                    invoiced: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                    pod_received: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
                  };
                  return (
                    <tr key={load.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5 text-xs font-bold text-amber-400 font-mono">{load.loadNumber}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">{fmtDate(load.pickupDate)}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-200">
                        {load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}
                        <div className="text-[10px] text-slate-500 mt-0.5">{load.miles.toLocaleString()} mi</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColors[load.status] || 'text-slate-400 bg-white/5 border-white/10'}`}>
                          {LOAD_STATUS_LABELS[load.status] || load.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-300">{fmt$(load.rate)}</td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-500">
                        -{fmt$(load.totalFeeAmount)}
                        <span className="text-[10px] text-slate-600 block mt-0.5">{load.totalFeePercent}%</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-bold font-mono text-amber-400">{fmt$(load.carrierNet)}</td>
                      <td className="px-4 py-3.5 text-xs font-mono">
                        <span className={load.ratePerMile >= 2.5 ? 'text-emerald-400' : load.ratePerMile >= 1.5 ? 'text-amber-400' : 'text-red-400'}>
                          ${load.ratePerMile.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-600 text-xs">
            No completed loads found for this filter range.
          </div>
        )}
      </div>

      {/* Settlements History */}
      {settlements.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileDown size={15} className="text-amber-500/60" />
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Settlement Statements</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {settlements.map(s => (
              <SettlementRow
                key={s.id}
                s={s}
                loads={allCompleted.filter(l => s.loadIds.includes(l.id))}
                carrierName={user?.displayName || 'Carrier'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
