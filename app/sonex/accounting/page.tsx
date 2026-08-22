'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FilePlus2, Loader2, Plus, ReceiptText, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import type { SonexLoad } from '@/lib/sonexTypes';
import { calculateDriverLoadPay } from '@/lib/financialEngine';
import { useSonexAuth } from '@/lib/sonexAuth';
import {
  addLoadExpense,
  createInvoiceForLoad,
  getAccountingWorkspaceData,
  recordCarrierSettlement,
  setInvoiceStatus,
} from '@/lib/tmsStore';

type Invoice = {
  id: string;
  invoiceNumber: string;
  loadId: string;
  customerName: string;
  amount: number;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
};

type Expense = {
  id: string;
  loadId: string;
  carrierId: string;
  category: string;
  vendorName: string | null;
  amount: number;
  incurredAt: string;
};

type Settlement = {
  id: string;
  carrierId: string;
  periodStart: string;
  periodEnd: string;
  grossTotal: number;
  feeTotal: number;
  netTotal: number;
};

type Carrier = { id: string; firstName: string; lastName: string };
type Driver = { id: string; firstName: string; lastName: string; status: string };
type PayProfile = { driverId: string; payType: string; payRate: number };
type AccountingData = {
  loads: SonexLoad[];
  carriers: Carrier[];
  settlements: Settlement[];
  invoices: Invoice[];
  expenses: Expense[];
  drivers: Driver[];
  payProfiles: PayProfile[];
};

const eligibleStatuses = new Set(['delivered', 'pod_received', 'invoiced', 'paid']);

function money(value: number) {
  return 'USD ' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not issued';
}

function invoiceTone(status: string) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (status === 'sent') return 'bg-blue-50 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function mondayOf(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(value: Date) {
  return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
}

function completedDeliveryDate(load: SonexLoad) {
  return load.deliveryDate;
}

function weekRangeFor(dateValue: string) {
  const start = mondayOf(new Date(dateValue + 'T12:00:00'));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

function isCompletedInPeriod(load: SonexLoad, from: string, to: string) {
  const completionDate = completedDeliveryDate(load);
  return eligibleStatuses.has(load.status) && completionDate >= from && completionDate <= to;
}

function FinancialReportingOverview({ loads, isMcOwner }: { loads: SonexLoad[]; isMcOwner: boolean }) {
  const completedLoads = useMemo(() => loads.filter(load => eligibleStatuses.has(load.status)), [loads]);
  const totalGross = useMemo(() => completedLoads.reduce((total, load) => total + load.rate, 0), [completedLoads]);
  const totalFee = useMemo(() => completedLoads.reduce((total, load) => total + load.totalFeeAmount, 0), [completedLoads]);
  const dispatchGross = useMemo(() => completedLoads.reduce((total, load) => total + load.dispatchFeeAmount, 0), [completedLoads]);
  const ownerGross = useMemo(() => completedLoads.reduce((total, load) => total + load.mcOwnerFeeAmount, 0), [completedLoads]);
  const carrierNet = useMemo(() => completedLoads.reduce((total, load) => total + load.carrierNet, 0), [completedLoads]);
  const totalMiles = useMemo(() => completedLoads.reduce((total, load) => total + load.miles, 0), [completedLoads]);
  const avgRpm = totalMiles ? totalGross / totalMiles : 0;
  const weeklyRows = useMemo(() => {
    const anchor = completedLoads.reduce((latest, load) => completedDeliveryDate(load) > latest ? completedDeliveryDate(load) : latest, new Date().toISOString().slice(0, 10));
    const end = new Date(`${anchor}T12:00:00`);
    return Array.from({ length: 8 }, (_, index) => {
      const day = new Date(end); day.setDate(day.getDate() - (7 - index) * 7);
      const from = new Date(day); from.setDate(day.getDate() - 6);
      const group = completedLoads.filter(load => {
        const date = new Date(`${completedDeliveryDate(load)}T12:00:00`);
        return date >= from && date <= day;
      });
      return { week: from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), gross: group.reduce((sum, load) => sum + load.rate, 0), net: group.reduce((sum, load) => sum + (isMcOwner ? load.mcOwnerFeeAmount : load.carrierNet), 0) };
    });
  }, [completedLoads, isMcOwner]);
  const statusRows = useMemo(() => ['delivered', 'pod_received', 'invoiced', 'paid'].map(status => {
    const group = completedLoads.filter(load => load.status === status);
    return { name: status === 'pod_received' ? 'POD' : status[0].toUpperCase() + status.slice(1), gross: group.reduce((sum, load) => sum + load.rate, 0), net: group.reduce((sum, load) => sum + (isMcOwner ? load.mcOwnerFeeAmount : load.carrierNet), 0) };
  }), [completedLoads, isMcOwner]);
  const cards = isMcOwner
    ? [
      ['Total gross revenue', totalGross, 'Leased carrier loads'],
      ['Total authority fees', totalFee, totalGross ? `${(totalFee / totalGross * 100).toFixed(1)}% total fee` : '0% total fee'],
      ['Sonex dispatch fees', dispatchGross, 'Dispatch share'],
      ['MC owner gross', ownerGross, 'Your authority share'],
    ]
    : [
      ['Total gross revenue', totalGross, `${completedLoads.length} completed loads`],
      ['Sonex dispatch gross', dispatchGross, 'Dispatch revenue'],
      ['MC owner gross', ownerGross, 'Authority share'],
      ['Carrier net pay', carrierNet, `${avgRpm.toFixed(2)} average RPM`],
    ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="mb-3 h-1 w-14 bg-sky-500" /><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Financial reporting</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">{isMcOwner ? 'Authority Financials' : 'Financial Reporting'}</h1><p className="mt-1 text-sm text-slate-500">Revenue, fees, and settlement performance across your accessible loads.</p></div><span className="font-mono text-xs text-slate-500">{completedLoads.length} completed loads</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, detail], index) => <div key={String(label)} className="border border-slate-200 bg-white p-5 shadow-sm" style={{ borderLeftWidth: 4, borderLeftColor: ['#38bdf8', '#7c3aed', '#10b981', '#14b8a6'][index] }}><p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">{label}</p><p className="mt-2 font-mono text-2xl font-bold text-slate-900">{money(Number(value))}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}</div>
      <div className="grid gap-5 xl:grid-cols-2"><section className="border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Weekly earnings (last 8 weeks)</p><div className="mt-4 h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyRows} barCategoryGap="25%"><CartesianGrid vertical={false} stroke="#e5e7eb" /><XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={48} /><Tooltip /><Bar dataKey="gross" name="Gross" fill="#fbbf24" radius={[4, 4, 0, 0]} /><Bar dataKey="net" name={isMcOwner ? 'MC owner gross' : 'Carrier net'} fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Earnings by load status</p><div className="mt-4 h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusRows} barCategoryGap="25%"><CartesianGrid vertical={false} stroke="#e5e7eb" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={48} /><Tooltip /><Bar dataKey="gross" name="Gross" fill="#fde68a" stroke="#f59e0b" radius={[4, 4, 0, 0]} /><Bar dataKey="net" name={isMcOwner ? 'MC owner gross' : 'Carrier net'} fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section></div>
    </section>
  );
}

export default function AccountingPage() {
  const { isMcOwner } = useSonexAuth();
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settlementCarrierId, setSettlementCarrierId] = useState('');
  const [settlementFrom, setSettlementFrom] = useState(() => isoDate(mondayOf(new Date())));
  const [settlementTo, setSettlementTo] = useState(() => {
    const end = mondayOf(new Date());
    end.setDate(end.getDate() + 6);
    return isoDate(end);
  });
  const [invoiceWeek, setInvoiceWeek] = useState(() => isoDate(mondayOf(new Date())));
  const hasInitializedAccountingPeriod = useRef(false);
  const [expenseForm, setExpenseForm] = useState({
    loadId: '',
    category: 'Lumper fee',
    amount: '',
    incurredAt: new Date().toISOString().slice(0, 10),
    vendorName: '',
    notes: '',
  });

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setData(await getAccountingWorkspaceData());
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not load accounting data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!data || hasInitializedAccountingPeriod.current) return;
    const latestCompletedLoad = (data.loads ?? [])
      .filter(load => eligibleStatuses.has(load.status))
      .sort((left, right) => completedDeliveryDate(right).localeCompare(completedDeliveryDate(left)))[0];

    if (latestCompletedLoad) {
      const period = weekRangeFor(completedDeliveryDate(latestCompletedLoad));
      setInvoiceWeek(period.start);
      setSettlementFrom(period.start);
      setSettlementTo(period.end);
      setSettlementCarrierId(latestCompletedLoad.carrierId);
    }
    hasInitializedAccountingPeriod.current = true;
  }, [data]);

  const loadsById = useMemo(() => new Map((data?.loads ?? []).map(load => [load.id, load])), [data]);
  const carrierNames = useMemo(
    () => new Map((data?.carriers ?? []).map(carrier => [carrier.id, carrier.firstName + ' ' + carrier.lastName])),
    [data],
  );
  const payProfiles = useMemo(() => new Map((data?.payProfiles ?? []).map(profile => [profile.driverId, profile])), [data]);
  const drivers = useMemo(() => new Map((data?.drivers ?? []).map(driver => [driver.id, driver])), [data]);
  const driverPayForLoad = (load: SonexLoad) => {
    const driver = load.driverId ? drivers.get(load.driverId) : undefined;
    const profile = load.driverId ? payProfiles.get(load.driverId) : undefined;
    if (!driver || !profile || !['per_mile', 'percentage', 'flat'].includes(profile.payType)) return 0;
    return calculateDriverLoadPay(profile.payType as 'per_mile' | 'percentage' | 'flat', profile.payRate, load.miles, 0, load.rate, 0);
  };
  const invoiceLoadIds = useMemo(() => new Set((data?.invoices ?? []).map(invoice => invoice.loadId)), [data]);
  const readyToInvoice = useMemo(
    () => (data?.loads ?? []).filter(load => eligibleStatuses.has(load.status) && !invoiceLoadIds.has(load.id)),
    [data, invoiceLoadIds],
  );
  const settlementLoads = useMemo(
    () => (data?.loads ?? []).filter(load => load.carrierId === settlementCarrierId && isCompletedInPeriod(load, settlementFrom, settlementTo)),
    [data, settlementCarrierId, settlementFrom, settlementTo],
  );
  const weeklyCompletedLoads = useMemo(() => {
    const period = weekRangeFor(invoiceWeek);
    return (data?.loads ?? []).filter(load => isCompletedInPeriod(load, period.start, period.end));
  }, [data, invoiceWeek]);

  const selectSettlementCarrier = (carrierId: string) => {
    setSettlementCarrierId(carrierId);
    const latestCarrierLoad = (data?.loads ?? [])
      .filter(load => load.carrierId === carrierId && eligibleStatuses.has(load.status))
      .sort((left, right) => completedDeliveryDate(right).localeCompare(completedDeliveryDate(left)))[0];
    if (latestCarrierLoad) {
      const period = weekRangeFor(completedDeliveryDate(latestCarrierLoad));
      setSettlementFrom(period.start);
      setSettlementTo(period.end);
    }
  };

  const createInvoice = async (loadId: string) => {
    setBusyId('invoice-' + loadId);
    try {
      await createInvoiceForLoad(loadId);
      toast.success('Invoice draft created.');
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create invoice.');
    } finally {
      setBusyId(null);
    }
  };

  const changeInvoiceStatus = async (invoiceId: string, status: 'draft' | 'sent' | 'paid') => {
    setBusyId('status-' + invoiceId);
    try {
      await setInvoiceStatus(invoiceId, status);
      toast.success(status === 'paid' ? 'Invoice marked paid.' : 'Invoice status updated.');
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update invoice.');
    } finally {
      setBusyId(null);
    }
  };

  const submitExpense = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.loadId || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Select a load and enter a valid amount.');
      return;
    }

    setBusyId('expense');
    try {
      await addLoadExpense({
        loadId: expenseForm.loadId,
        category: expenseForm.category,
        amount,
        incurredAt: expenseForm.incurredAt,
        vendorName: expenseForm.vendorName || undefined,
        notes: expenseForm.notes || undefined,
      });
      setExpenseForm(current => ({ ...current, loadId: '', amount: '', vendorName: '', notes: '' }));
      toast.success('Payable expense recorded.');
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record expense.');
    } finally {
      setBusyId(null);
    }
  };

  const generateWeeklyInvoicePdf = async () => {
    const { start: weekStart } = weekRangeFor(invoiceWeek);
    const start = new Date(weekStart + 'T12:00:00');
    const weeklyLoads = weeklyCompletedLoads;
    if (!weeklyLoads.length) {
      toast.error('No completed loads in this dispatch week.');
      return;
    }

    setBusyId('weekly-pdf');
    try {
      const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new JsPdf({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('SONEX LOGISTICS', 40, 34);
      doc.setTextColor(191, 219, 254);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Weekly Dispatch Fee Invoice', 40, 53);
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.text('Week of ' + start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 40, 106);
      const totalFees = weeklyLoads.reduce((total, load) => total + load.dispatchFeeAmount, 0);
      autoTable(doc, {
        startY: 124,
        head: [['Load', 'Carrier', 'Broker', 'Gross rate', 'Fee %', 'Dispatch fee']],
        body: weeklyLoads.map(load => [load.loadNumber, carrierNames.get(load.carrierId) ?? 'Unknown', load.brokerName, money(load.rate), String(load.dispatchFeePercent) + '%', money(load.dispatchFeeAmount)]),
        foot: [['', '', '', '', 'Total fees', money(totalFees)]],
        headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 8.5 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' } },
      });
      doc.save('sonex-weekly-dispatch-fees-' + invoiceWeek + '.pdf');
      toast.success('Weekly invoice PDF downloaded.');
    } catch (error) {
      console.error(error);
      toast.error('Could not generate the weekly invoice PDF.');
    } finally {
      setBusyId(null);
    }
  };

  const generateSettlementPdf = async () => {
    const carrier = (data?.carriers ?? []).find(item => item.id === settlementCarrierId);
    if (!carrier || !settlementFrom || !settlementTo) {
      toast.error('Choose a carrier and settlement period.');
      return;
    }
    if (!settlementLoads.length) {
      toast.error('No completed loads exist for that settlement period.');
      return;
    }

    setBusyId('settlement-pdf');
    try {
      const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const grossTotal = settlementLoads.reduce((total, load) => total + load.rate, 0);
      const feeTotal = settlementLoads.reduce((total, load) => total + load.totalFeeAmount, 0);
      const netTotal = settlementLoads.reduce((total, load) => total + load.carrierNet, 0);
      const driverPayTotal = settlementLoads.reduce((total, load) => total + driverPayForLoad(load), 0);
      const doc = new JsPdf({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('SONEX LOGISTICS', 40, 34);
      doc.setTextColor(191, 219, 254);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Carrier Settlement Statement', 40, 53);
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.text('Carrier: ' + carrier.firstName + ' ' + carrier.lastName, 40, 106);
      doc.text('Period: ' + dateLabel(settlementFrom) + ' to ' + dateLabel(settlementTo), 40, 122);
      autoTable(doc, {
        startY: 142,
        head: [['Load', 'Delivery date', 'Route', 'Gross rate', 'Total fee', 'Carrier net', 'Driver pay']],
        body: settlementLoads.map(load => [load.loadNumber, dateLabel(completedDeliveryDate(load)), load.pickupState + ' to ' + load.deliveryState, money(load.rate), money(load.totalFeeAmount), money(load.carrierNet), money(driverPayForLoad(load))]),
        foot: [['', '', 'Totals', money(grossTotal), money(feeTotal), money(netTotal), money(driverPayTotal)]],
        headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 8.5 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      });
      if (!isMcOwner) {
        await recordCarrierSettlement({ carrierId: carrier.id, periodStart: settlementFrom, periodEnd: settlementTo, loadIds: settlementLoads.map(load => load.id), grossTotal, feeTotal, netTotal });
      }
      doc.save('sonex-settlement-' + carrier.lastName.toLowerCase() + '-' + settlementFrom + '.pdf');
      toast.success(isMcOwner ? 'Carrier settlement PDF downloaded.' : 'Carrier settlement recorded and PDF downloaded.');
      await reload();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not generate settlement PDF.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return <div className="grid min-h-[60vh] place-items-center bg-slate-50"><Loader2 size={24} className="animate-spin text-blue-600" /></div>;
  }

  return (
    <div data-tms-surface className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Financial operations</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Accounting workspace</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reload} className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-500 hover:text-slate-900" title="Refresh accounting">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
        <FinancialReportingOverview loads={data?.loads ?? []} isMcOwner={isMcOwner} />

        <section className="border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Accounts receivable</h2>
              <p className="mt-0.5 text-xs text-slate-500">Invoice delivered loads, then track collection in one queue.</p>
            </div>
            <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">{readyToInvoice.length} ready to invoice</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                <tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Load / customer</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Workflow</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.invoices ?? []).map(invoice => {
                  const load = loadsById.get(invoice.loadId);
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-3"><p className="font-medium text-slate-800">{load?.loadNumber ?? 'Archived load'}</p><p className="mt-0.5 text-[11px] text-slate-500">{invoice.customerName}</p></td>
                      <td className="px-4 py-3 text-slate-600">{dateLabel(invoice.issuedAt)}</td>
                      <td className="px-4 py-3 font-mono text-slate-800">{money(invoice.amount)}</td>
                      <td className="px-4 py-3"><span className={'inline-flex px-1.5 py-0.5 text-[10px] font-semibold capitalize ' + invoiceTone(invoice.status)}>{invoice.status}</span></td>
                      <td className="px-4 py-3 text-right">
                        {isMcOwner ? <span className="text-xs font-medium capitalize text-slate-600">{invoice.status}</span> : <select
                          aria-label={'Status for ' + invoice.invoiceNumber}
                          value={invoice.status}
                          disabled={busyId === 'status-' + invoice.id}
                          onChange={event => changeInvoiceStatus(invoice.id, event.target.value as 'draft' | 'sent' | 'paid')}
                          className="border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                          <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option>
                        </select>}
                      </td>
                    </tr>
                  );
                })}
                {!(data?.invoices ?? []).length && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No invoices created yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {!isMcOwner && !!readyToInvoice.length && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Ready for billing</p>
              <div className="flex flex-wrap gap-2">
                {readyToInvoice.map(load => (
                  <button key={load.id} disabled={busyId === 'invoice-' + load.id} onClick={() => createInvoice(load.id)} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700 disabled:opacity-50">
                    {busyId === 'invoice-' + load.id ? <Loader2 size={12} className="animate-spin" /> : <FilePlus2 size={12} />}
                    {load.loadNumber} <span className="font-mono text-slate-500">{money(load.rate)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Accounts payable</h2><p className="mt-0.5 text-xs text-slate-500">Operational costs linked to the load and carrier that incurred them.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-4 py-3">Load</th><th className="px-4 py-3">Category / vendor</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.expenses ?? []).map(expense => <tr key={expense.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-mono text-slate-700">{loadsById.get(expense.loadId)?.loadNumber ?? 'Unknown'}</td><td className="px-4 py-3"><p className="font-medium text-slate-800">{expense.category}</p><p className="mt-0.5 text-[11px] text-slate-500">{expense.vendorName ?? 'No vendor'}</p></td><td className="px-4 py-3 text-slate-600">{carrierNames.get(expense.carrierId) ?? 'Unassigned'}</td><td className="px-4 py-3 text-slate-600">{dateLabel(expense.incurredAt)}</td><td className="px-4 py-3 text-right font-mono text-slate-800">{money(expense.amount)}</td></tr>)}
                  {!(data?.expenses ?? []).length && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">No payable expenses recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">{isMcOwner ? 'Payable access' : 'Record payable'}</h2><p className="mt-0.5 text-xs text-slate-500">{isMcOwner ? 'Payable records are visible here; only Sonex Dispatch can add or edit costs.' : 'Lumper, fuel advance, parking, repair, or other load cost.'}</p></div>
            {isMcOwner ? <div className="p-4 text-xs leading-5 text-slate-600">This financial workspace is read-only for MC owners. Contact Sonex Dispatch to record a payable against one of your loads.</div> : <form onSubmit={submitExpense} className="space-y-3 p-4">
              <select value={expenseForm.loadId} onChange={event => setExpenseForm(current => ({ ...current, loadId: event.target.value }))} className="w-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"><option value="">Select load</option>{(data?.loads ?? []).map(load => <option key={load.id} value={load.id}>{load.loadNumber} / {load.brokerName}</option>)}</select>
              <div className="grid grid-cols-2 gap-3"><input value={expenseForm.category} onChange={event => setExpenseForm(current => ({ ...current, category: event.target.value }))} placeholder="Expense category" className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" /><input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={event => setExpenseForm(current => ({ ...current, amount: event.target.value }))} placeholder="Amount" className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3"><input type="date" value={expenseForm.incurredAt} onChange={event => setExpenseForm(current => ({ ...current, incurredAt: event.target.value }))} className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500" /><input value={expenseForm.vendorName} onChange={event => setExpenseForm(current => ({ ...current, vendorName: event.target.value }))} placeholder="Vendor" className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" /></div>
              <input value={expenseForm.notes} onChange={event => setExpenseForm(current => ({ ...current, notes: event.target.value }))} placeholder="Reference or internal note" className="w-full border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" />
              <button disabled={busyId === 'expense'} className="inline-flex w-full items-center justify-center gap-2 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busyId === 'expense' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Record payable</button>
            </form>}
          </section>
        </div>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Carrier settlements & driver pay</h2><p className="mt-0.5 text-xs text-slate-500">Issued settlement totals remain accessible beside invoice and payable operations.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Period</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Total fee</th><th className="px-4 py-3 text-right">Net settlement</th></tr></thead><tbody className="divide-y divide-slate-100">{(data?.settlements ?? []).map(settlement => <tr key={settlement.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{carrierNames.get(settlement.carrierId) ?? 'Unknown carrier'}</td><td className="px-4 py-3 text-slate-600">{dateLabel(settlement.periodStart)} to {dateLabel(settlement.periodEnd)}</td><td className="px-4 py-3 text-right font-mono text-slate-700">{money(settlement.grossTotal)}</td><td className="px-4 py-3 text-right font-mono text-slate-700">{money(settlement.feeTotal)}</td><td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{money(settlement.netTotal)}</td></tr>)}{!(data?.settlements ?? []).length && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">No carrier settlements generated yet.</td></tr>}</tbody></table></div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Weekly dispatch fee invoice</h2><p className="mt-0.5 text-xs text-slate-500">Generate a PDF across completed deliveries in the selected delivery week.</p></div><div className="flex flex-wrap items-end gap-3 p-4"><label className="min-w-[180px] flex-1 text-[11px] font-medium text-slate-600">Week starting<input type="date" value={invoiceWeek} onChange={event => setInvoiceWeek(event.target.value)} className="mt-1 block w-full border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-500" /></label><div className="text-[11px] text-slate-500"><span className="font-semibold text-slate-700">{weeklyCompletedLoads.length}</span> completed {weeklyCompletedLoads.length === 1 ? 'delivery' : 'deliveries'} in this week</div><button onClick={generateWeeklyInvoicePdf} disabled={busyId === 'weekly-pdf'} className="inline-flex items-center gap-2 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busyId === 'weekly-pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download PDF</button></div></section>
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Carrier settlement PDF</h2><p className="mt-0.5 text-xs text-slate-500">Record the settlement from completed deliveries in the selected delivery period.</p></div><div className="grid gap-3 p-4 sm:grid-cols-2"><select value={settlementCarrierId} onChange={event => selectSettlementCarrier(event.target.value)} className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 sm:col-span-2"><option value="">Select carrier</option>{(data?.carriers ?? []).map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.firstName} {carrier.lastName}</option>)}</select><label className="text-[11px] font-medium text-slate-600">From<input type="date" value={settlementFrom} onChange={event => setSettlementFrom(event.target.value)} className="mt-1 block w-full border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-500" /></label><label className="text-[11px] font-medium text-slate-600">To<input type="date" value={settlementTo} onChange={event => setSettlementTo(event.target.value)} className="mt-1 block w-full border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-500" /></label><p className="text-[11px] text-slate-500 sm:col-span-2"><span className="font-semibold text-slate-700">{settlementLoads.length}</span> completed {settlementLoads.length === 1 ? 'delivery' : 'deliveries'} for this carrier and period.</p><button onClick={generateSettlementPdf} disabled={busyId === 'settlement-pdf' || !settlementLoads.length} className="inline-flex items-center justify-center gap-2 bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">{busyId === 'settlement-pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Record & download settlement</button></div></section>
        </div>
      </main>
    </div>
  );
}
