'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, TrendingUp, BarChart2, Truck, Download, FileText,
  ChevronDown, Calendar, Filter, ArrowUpRight, Printer, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SonexCarrier, SonexLoad, LoadStatus } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS, EQUIPMENT_TYPE_LABELS } from '@/lib/sonexTypes';
import { getCarriers, getLoads, getSettings, exportLoadsCSV, addSettlement } from '@/lib/sonexStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString('en-US');
const COMPLETED_STATUSES: LoadStatus[] = ['delivered', 'pod_received', 'invoiced', 'paid'];

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

function filterLoadsByRange(loads: SonexLoad[], range: string, customFrom: string, customTo: string): SonexLoad[] {
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
    const d = new Date(l.pickupDate);
    return d >= from && d <= to;
  });
}

function buildWeeklyData(loads: SonexLoad[]): { week: string; gross: number; fees: number }[] {
  const weeks: Map<string, { gross: number; fees: number }> = new Map();
  const now = new Date();

  for (let i = 7; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(now.getDate() - i * 7);
    const ws = getWeekStart(weekDate);
    const key = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weeks.set(key, { gross: 0, fees: 0 });
  }

  loads.forEach(l => {
    const ws = getWeekStart(new Date(l.pickupDate));
    const key = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (weeks.has(key)) {
      const w = weeks.get(key)!;
      w.gross += l.rate;
      w.fees += l.dispatchFeeAmount;
    }
  });

  return Array.from(weeks.entries()).map(([week, data]) => ({ week, ...data }));
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<LoadStatus, string> = {
  booked: 'bg-blue-500/15 text-blue-400',
  dispatched: 'bg-cyan-500/15 text-cyan-400',
  in_transit: 'bg-amber-500/15 text-amber-400',
  delivered: 'bg-emerald-500/15 text-emerald-400',
  pod_received: 'bg-teal-500/15 text-teal-400',
  invoiced: 'bg-violet-500/15 text-violet-400',
  paid: 'bg-green-500/15 text-green-400',
};

function StatusBadge({ status }: { status: LoadStatus }) {
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {LOAD_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, sub, amber }: {
  icon: React.ElementType; label: string; value: string; sub?: string; amber?: boolean;
}) {
  return (
    <div className={`glass-card p-5 flex flex-col gap-3 ${amber ? 'border-amber-500/20 ring-1 ring-amber-500/10' : ''}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl ${amber ? 'bg-amber-500/15' : 'bg-white/[0.06]'}`}>
          <Icon size={16} className={amber ? 'text-amber-400' : 'text-slate-400'} />
        </div>
        {amber && <ArrowUpRight size={14} className="text-amber-500/60" />}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${amber ? 'text-amber-400' : 'text-white'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const AmberTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0D1F3C] border border-amber-500/20 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-amber-300">{p.name}: {fmt$(p.value)}</p>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [dateRange, setDateRange] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Settlement PDF state
  const [settlementCarrier, setSettlementCarrier] = useState('');
  const [settlementFrom, setSettlementFrom] = useState('');
  const [settlementTo, setSettlementTo] = useState('');

  // Weekly Invoice state
  const [invoiceWeek, setInvoiceWeek] = useState(() => {
    const ws = getWeekStart(new Date());
    return ws.toISOString().split('T')[0];
  });

  // Sort state for tables
  const [loadSort, setLoadSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'pickupDate', dir: 'desc' });
  const [carrierSort, setCarrierSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'gross', dir: 'desc' });

  useEffect(() => {
    setCarriers(getCarriers());
    setLoads(getLoads());
  }, []);

  const carrierMap = useMemo(() => new Map(carriers.map(c => [c.id, c])), [carriers]);

  // Filter loads
  const filteredLoads = useMemo(() => {
    let ls = loads;
    if (carrierFilter !== 'all') ls = ls.filter(l => l.carrierId === carrierFilter);
    ls = filterLoadsByRange(ls, dateRange, customFrom, customTo);
    return ls;
  }, [loads, carrierFilter, dateRange, customFrom, customTo]);

  // Summary stats
  const totalGross = filteredLoads.reduce((s, l) => s + l.rate, 0);
  const totalFees = filteredLoads.reduce((s, l) => s + l.dispatchFeeAmount, 0);
  const totalMiles = filteredLoads.reduce((s, l) => s + l.miles, 0);
  const avgRPM = filteredLoads.length > 0 ? filteredLoads.reduce((s, l) => s + l.ratePerMile, 0) / filteredLoads.length : 0;

  // Weekly chart data
  const weeklyData = useMemo(() => buildWeeklyData(loads), [loads]);

  // Per-carrier breakdown
  const carrierBreakdown = useMemo(() => {
    const map = new Map<string, { loads: number; gross: number; fees: number; miles: number; rpmSum: number }>();
    filteredLoads.forEach(l => {
      if (!map.has(l.carrierId)) map.set(l.carrierId, { loads: 0, gross: 0, fees: 0, miles: 0, rpmSum: 0 });
      const d = map.get(l.carrierId)!;
      d.loads++;
      d.gross += l.rate;
      d.fees += l.dispatchFeeAmount;
      d.miles += l.miles;
      d.rpmSum += l.ratePerMile;
    });
    return Array.from(map.entries())
      .map(([carrierId, data]) => ({
        carrierId,
        carrier: carrierMap.get(carrierId),
        ...data,
        avgRPM: data.loads > 0 ? data.rpmSum / data.loads : 0,
        feePercent: data.gross > 0 ? (data.fees / data.gross * 100) : 0,
      }))
      .sort((a, b) => {
        const av = a[carrierSort.col as keyof typeof a] as number;
        const bv = b[carrierSort.col as keyof typeof b] as number;
        return carrierSort.dir === 'asc' ? av - bv : bv - av;
      });
  }, [filteredLoads, carrierMap, carrierSort]);

  const carrierChartData = useMemo(() => carrierBreakdown.slice(0, 8).map(c => ({
    name: c.carrier ? `${c.carrier.firstName.slice(0, 1)}. ${c.carrier.lastName}` : c.carrierId,
    fees: Math.round(c.fees * 100) / 100,
    gross: Math.round(c.gross * 100) / 100,
  })), [carrierBreakdown]);

  // Sorted loads for table
  const sortedLoads = useMemo(() => {
    return [...filteredLoads].sort((a, b) => {
      let av: string | number = a[loadSort.col as keyof SonexLoad] as string | number;
      let bv: string | number = b[loadSort.col as keyof SonexLoad] as string | number;
      if (typeof av === 'string' && typeof bv === 'string') {
        return loadSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return loadSort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [filteredLoads, loadSort]);

  const toggleLoadSort = (col: string) => {
    setLoadSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };

  const toggleCarrierSort = (col: string) => {
    setCarrierSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };

  // CSV Export
  const handleExportCSV = () => {
    const csv = exportLoadsCSV(filteredLoads, carriers);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonex-loads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Settlement PDF
  const handleGenerateSettlement = () => {
    const carrier = carriers.find(c => c.id === settlementCarrier);
    if (!carrier || !settlementFrom || !settlementTo) {
      toast.error('Select carrier and date range');
      return;
    }
    const settlementLoads = loads.filter(l =>
      l.carrierId === settlementCarrier &&
      new Date(l.pickupDate) >= new Date(settlementFrom) &&
      new Date(l.pickupDate) <= new Date(settlementTo + 'T23:59:59')
    );
    if (settlementLoads.length === 0) { toast.error('No loads in this period'); return; }

    const settings = getSettings();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pg = doc.internal.pageSize;

    // Header
    doc.setFillColor(5, 11, 24);
    doc.rect(0, 0, pg.getWidth(), 90, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.companyName || 'Sonex Logistics LLC', 40, 38);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`${settings.companyAddress} · ${settings.companyCity}, ${settings.companyState} ${settings.companyZip}`, 40, 54);
    doc.text(`${settings.companyEmail} · ${settings.companyPhone}`, 40, 67);
    doc.setTextColor(252, 211, 77);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CARRIER SETTLEMENT STATEMENT', 40, 82);

    // Carrier Info
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`Carrier: ${carrier.firstName} ${carrier.lastName}`, 40, 115);
    doc.text(`Equipment: ${EQUIPMENT_TYPE_LABELS[carrier.equipmentType]} · ${carrier.truckYear} ${carrier.truckMake} ${carrier.truckModel}`, 40, 130);
    doc.text(`Period: ${new Date(settlementFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} – ${new Date(settlementTo).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 40, 145);
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`, 40, 160);

    // Loads table
    const totalGrossS = settlementLoads.reduce((s, l) => s + l.rate, 0);
    const totalFeesS = settlementLoads.reduce((s, l) => s + l.dispatchFeeAmount, 0);
    const totalNetS = settlementLoads.reduce((s, l) => s + l.carrierNet, 0);

    autoTable(doc, {
      startY: 180,
      head: [['Load #', 'Date', 'Route', 'Gross Rate', 'Fee %', 'Fee $', 'Carrier Net']],
      body: [
        ...settlementLoads.map(l => [
          l.loadNumber,
          new Date(l.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          `${l.pickupState} → ${l.deliveryState}`,
          `$${l.rate.toFixed(2)}`,
          `${l.dispatchFeePercent}%`,
          `$${l.dispatchFeeAmount.toFixed(2)}`,
          `$${l.carrierNet.toFixed(2)}`,
        ]),
        ['', '', 'TOTALS', `$${totalGrossS.toFixed(2)}`, '', `$${totalFeesS.toFixed(2)}`, `$${totalNetS.toFixed(2)}`],
      ],
      headStyles: { fillColor: [12, 10, 0], textColor: [245, 158, 11], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' }
      },
      didDrawRow: (data) => {
        if (data.row.index === settlementLoads.length) {
          data.row.cells[0].styles = { fontStyle: 'bold', fillColor: [245, 158, 11], textColor: [0, 0, 0] };
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 40;

    // Signature lines
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Authorized by (Sonex Logistics LLC):', 40, finalY);
    doc.line(40, finalY + 25, 200, finalY + 25);
    doc.text('Carrier Acknowledgment:', 320, finalY);
    doc.line(320, finalY + 25, 520, finalY + 25);

    // Save settlement record
    addSettlement({
      carrierId: settlementCarrier,
      periodStart: settlementFrom,
      periodEnd: settlementTo,
      loadIds: settlementLoads.map(l => l.id),
      grossTotal: totalGrossS,
      feeTotal: totalFeesS,
      netTotal: totalNetS,
      generatedAt: new Date().toISOString(),
    });

    doc.save(`settlement-${carrier.lastName}-${settlementFrom}.pdf`);
    toast.success('Settlement PDF generated');
  };

  const getInvoiceLoadsForWeek = useCallback((weekStartISO: string) => {
    const weekStart = new Date(weekStartISO);
    const weekEnd = getWeekEnd(weekStart);
    return loads.filter(l => {
      const d = new Date(l.deliveryDate);
      return COMPLETED_STATUSES.includes(l.status) && d >= weekStart && d <= weekEnd;
    });
  }, [loads]);

  // Weekly Invoice PDF
  const handleGenerateInvoice = () => {
    const weekStart = new Date(invoiceWeek);
    const weekEnd = getWeekEnd(weekStart);
    const weekLoads = getInvoiceLoadsForWeek(invoiceWeek);
    if (weekLoads.length === 0) { toast.error('No completed loads this week'); return; }

    const settings = getSettings();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pg = doc.internal.pageSize;

    // Header
    doc.setFillColor(5, 11, 24);
    doc.rect(0, 0, pg.getWidth(), 85, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Sonex Logistics LLC — Dispatch Fee Invoice', 40, 36);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`${settings.companyAddress} · ${settings.companyCity}, ${settings.companyState} ${settings.companyZip} · ${settings.companyEmail} · ${settings.companyPhone}`, 40, 52);
    doc.setTextColor(252, 211, 77);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const periodLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    doc.text(`Period: ${periodLabel}`, 40, 70);

    // Build table rows + per-carrier subtotals
    const carrierGroups: Map<string, SonexLoad[]> = new Map();
    weekLoads.forEach(l => {
      if (!carrierGroups.has(l.carrierId)) carrierGroups.set(l.carrierId, []);
      carrierGroups.get(l.carrierId)!.push(l);
    });

    const rows: (string | number)[][] = [];
    let grandFees = 0;

    carrierGroups.forEach((cls, cid) => {
      const c = carrierMap.get(cid);
      const name = c ? `${c.firstName} ${c.lastName}` : cid;
      cls.forEach(l => {
        rows.push([l.loadNumber, name, l.brokerName, `$${l.rate.toFixed(2)}`, `${l.dispatchFeePercent}%`, `$${l.dispatchFeeAmount.toFixed(2)}`]);
      });
      const subFees = cls.reduce((s, l) => s + l.dispatchFeeAmount, 0);
      grandFees += subFees;
      rows.push([`${name} Subtotal`, '', '', '', '', `$${subFees.toFixed(2)}`]);
    });

    autoTable(doc, {
      startY: 100,
      head: [['Load #', 'Carrier', 'Broker', 'Gross Rate', 'Fee %', 'Dispatch Fee $']],
      body: rows,
      headStyles: { fillColor: [12, 10, 0], textColor: [245, 158, 11], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        const txt = String(data.cell.raw || '');
        if (txt.includes('Subtotal')) {
          data.cell.styles.fillColor = [255, 248, 220];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [120, 80, 0];
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 24;

    // Grand Total — large prominent block
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(40, finalY, pg.getWidth() - 80, 60, 8, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Dispatch Fees Earned This Week', 60, finalY + 22);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${grandFees.toFixed(2)}`, 60, finalY + 48);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated ${new Date().toLocaleString()} · Sonex Logistics LLC`, 40, finalY + 82);

    doc.save(`invoice-week-${invoiceWeek}.pdf`);
    toast.success('Weekly invoice PDF generated');
  };

  const SortIcon = ({ col, table }: { col: string; table: 'loads' | 'carriers' }) => {
    const s = table === 'loads' ? loadSort : carrierSort;
    if (s.col !== col) return <span className="ml-1 text-slate-700">↕</span>;
    return <span className="ml-1 text-amber-400">{s.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen bg-[#050B18] p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Reporting</h1>
          <p className="text-slate-400 text-sm mt-0.5">Revenue, dispatch fees, and settlements</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-all active:scale-95">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={carrierFilter}
          onChange={e => setCarrierFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40 cursor-pointer"
        >
          <option value="all">All Carriers</option>
          {carriers.map(c => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40 cursor-pointer"
        >
          <option value="all">All Time</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="custom">Custom Range</option>
        </select>
        {dateRange === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none" />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none" />
          </>
        )}
        <span className="text-xs text-slate-500 ml-auto">{filteredLoads.length} loads</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label="Total Gross Revenue" value={fmt$(totalGross)} sub={`${filteredLoads.length} loads`} />
        <SummaryCard icon={TrendingUp} label="Total Dispatch Fees" value={fmt$(totalFees)} sub={`${totalGross > 0 ? (totalFees / totalGross * 100).toFixed(1) : 0}% avg`} amber />
        <SummaryCard icon={BarChart2} label="Average RPM" value={`$${avgRPM.toFixed(2)}/mi`} sub="per mile" />
        <SummaryCard icon={Truck} label="Total Loads" value={fmtN(filteredLoads.length)} sub={`${totalMiles.toLocaleString()} total miles`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Revenue Chart */}
        <div className="glass-card p-5">
          <p className="text-sm font-semibold text-white mb-4">Weekly Gross Revenue (Last 8 Weeks)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<AmberTooltip />} />
              <Bar dataKey="gross" name="Gross" fill="#F59E0B" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="fees" name="Fees" fill="#FCD34D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-carrier fees chart */}
        <div className="glass-card p-5">
          <p className="text-sm font-semibold text-white mb-4">Dispatch Fees by Carrier</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={carrierChartData} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<AmberTooltip />} />
              <Bar dataKey="fees" name="Dispatch Fees" radius={[0, 4, 4, 0]}>
                {carrierChartData.map((_, i) => (
                  <Cell key={i} fill={`hsl(${40 + i * 10}, 90%, ${50 + i * 3}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-Carrier Breakdown Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-bold text-white">Per-Carrier Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {[
                  { label: 'Carrier', col: 'carrierId' },
                  { label: 'Equipment', col: '' },
                  { label: 'Loads', col: 'loads' },
                  { label: 'Gross Revenue', col: 'gross' },
                  { label: 'Fee %', col: 'feePercent' },
                  { label: 'Total Fees', col: 'fees' },
                  { label: 'Avg RPM', col: 'avgRPM' },
                ].map(({ label, col }) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${col ? 'cursor-pointer hover:text-slate-300' : ''}`}
                    onClick={col ? () => toggleCarrierSort(col) : undefined}
                  >
                    {label}{col && <SortIcon col={col} table="carriers" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carrierBreakdown.map(row => (
                <tr key={row.carrierId} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-white">
                    {row.carrier ? `${row.carrier.firstName} ${row.carrier.lastName}` : row.carrierId}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {row.carrier ? EQUIPMENT_TYPE_LABELS[row.carrier.equipmentType] : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{row.loads}</td>
                  <td className="px-4 py-3 text-sm text-slate-200 font-mono">{fmt$(row.gross)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{row.feePercent.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-sm font-bold text-amber-400 font-mono">{fmt$(row.fees)}</td>
                  <td className="px-4 py-3 text-sm font-mono">
                    <span className={row.avgRPM >= 2.5 ? 'text-emerald-400' : row.avgRPM >= 1.5 ? 'text-amber-400' : 'text-red-400'}>
                      ${row.avgRPM.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {carrierBreakdown.length > 0 && (
              <tfoot>
                <tr className="border-t border-amber-500/20 bg-amber-500/[0.04]">
                  <td className="px-4 py-3 text-xs font-bold text-amber-400 uppercase tracking-wider" colSpan={2}>Totals</td>
                  <td className="px-4 py-3 text-sm font-bold text-amber-300">{carrierBreakdown.reduce((s, r) => s + r.loads, 0)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-amber-300 font-mono">{fmt$(carrierBreakdown.reduce((s, r) => s + r.gross, 0))}</td>
                  <td className="px-4 py-3 text-sm text-amber-400">—</td>
                  <td className="px-4 py-3 text-sm font-bold text-amber-400 font-mono">{fmt$(carrierBreakdown.reduce((s, r) => s + r.fees, 0))}</td>
                  <td className="px-4 py-3 text-sm text-amber-400">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* All Loads Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">All Loads — Filtered View</h2>
          <span className="text-xs text-slate-500">{filteredLoads.length} loads</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {[
                  { label: 'Load #', col: 'loadNumber' },
                  { label: 'Carrier', col: 'carrierId' },
                  { label: 'Broker', col: 'brokerName' },
                  { label: 'Route', col: '' },
                  { label: 'Date', col: 'pickupDate' },
                  { label: 'Rate', col: 'rate' },
                  { label: 'Fee', col: 'dispatchFeeAmount' },
                  { label: 'Net', col: 'carrierNet' },
                  { label: 'Status', col: 'status' },
                ].map(({ label, col }) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${col ? 'cursor-pointer hover:text-slate-300' : ''}`}
                    onClick={col ? () => toggleLoadSort(col) : undefined}
                  >
                    {label}{col && <SortIcon col={col} table="loads" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedLoads.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-600">No loads in this period.</td></tr>
              ) : sortedLoads.map(l => {
                const carrier = carrierMap.get(l.carrierId);
                return (
                  <tr key={l.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-amber-400">{l.loadNumber}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-200">{carrier ? `${carrier.firstName} ${carrier.lastName}` : '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-300">{l.brokerName}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{l.pickupState} → {l.deliveryState}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{new Date(l.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-slate-200 text-right">{fmt$(l.rate)}</td>
                    <td className="px-4 py-2.5 text-sm font-mono font-bold text-amber-400 text-right">{fmt$(l.dispatchFeeAmount)}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-emerald-400 text-right">{fmt$(l.carrierNet)}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                  </tr>
                );
              })}
            </tbody>
            {sortedLoads.length > 0 && (
              <tfoot>
                <tr className="border-t border-amber-500/20 bg-amber-500/[0.04]">
                  <td className="px-4 py-2.5 text-xs font-bold text-amber-400" colSpan={5}>TOTALS</td>
                  <td className="px-4 py-2.5 text-sm font-bold font-mono text-amber-300 text-right">{fmt$(sortedLoads.reduce((s, l) => s + l.rate, 0))}</td>
                  <td className="px-4 py-2.5 text-sm font-bold font-mono text-amber-400 text-right">{fmt$(sortedLoads.reduce((s, l) => s + l.dispatchFeeAmount, 0))}</td>
                  <td className="px-4 py-2.5 text-sm font-bold font-mono text-emerald-400 text-right">{fmt$(sortedLoads.reduce((s, l) => s + l.carrierNet, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Export / PDF Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Settlement PDF */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={15} className="text-amber-400" />
            <h2 className="text-sm font-bold text-white">Generate Settlement PDF</h2>
          </div>
          <div className="space-y-3">
            <select
              value={settlementCarrier}
              onChange={e => setSettlementCarrier(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-amber-500/40"
            >
              <option value="">Select Carrier…</option>
              {carriers.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">From</label>
                <input type="date" value={settlementFrom} onChange={e => setSettlementFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">To</label>
                <input type="date" value={settlementTo} onChange={e => setSettlementTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none" />
              </div>
            </div>
            {settlementCarrier && settlementFrom && settlementTo && (
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <p className="text-xs text-slate-400">
                  Preview: <span className="font-semibold text-white">
                    {loads.filter(l => l.carrierId === settlementCarrier && new Date(l.pickupDate) >= new Date(settlementFrom) && new Date(l.pickupDate) <= new Date(settlementTo + 'T23:59:59')).length}
                  </span> loads · <span className="font-semibold text-amber-400">
                    {fmt$(loads.filter(l => l.carrierId === settlementCarrier && new Date(l.pickupDate) >= new Date(settlementFrom) && new Date(l.pickupDate) <= new Date(settlementTo + 'T23:59:59')).reduce((s, l) => s + l.dispatchFeeAmount, 0))}
                  </span> fees
                </p>
              </div>
            )}
            <button
              onClick={handleGenerateSettlement}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-all active:scale-95"
            >
              <Printer size={14} /> Generate Settlement PDF
            </button>
          </div>
        </div>

        {/* Weekly Invoice PDF */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={15} className="text-amber-400" />
            <h2 className="text-sm font-bold text-white">Generate Weekly Invoice PDF</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Week Starting (Monday)</label>
              <input
                type="date"
                value={invoiceWeek}
                onChange={e => setInvoiceWeek(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-slate-300 focus:outline-none"
              />
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <p className="text-xs text-slate-400 mb-1">Preview: completed loads across all carriers</p>
              {(() => {
                const wl = getInvoiceLoadsForWeek(invoiceWeek);
                return (
                  <p className="text-xs">
                    <span className="font-semibold text-white">{wl.length}</span> completed loads across{' '}
                    <span className="font-semibold text-white">{new Set(wl.map(l => l.carrierId)).size}</span> carriers ·{' '}
                    <span className="font-semibold text-amber-400">{fmt$(wl.reduce((s, l) => s + l.dispatchFeeAmount, 0))}</span> total fees
                  </p>
                );
              })()}
            </div>
            <button
              onClick={handleGenerateInvoice}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-all active:scale-95"
            >
              <Printer size={14} /> Generate Weekly Invoice PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
