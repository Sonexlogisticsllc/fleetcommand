'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, FilePlus2, Landmark, Loader2, Plus, ReceiptText, RefreshCw, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SonexLoad } from '@/lib/sonexTypes';
import { calculateDriverLoadPay } from '@/lib/financialEngine';
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

export default function AccountingPage() {
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

  const receivables = (data?.invoices ?? [])
    .filter(invoice => invoice.status !== 'paid')
    .reduce((total, invoice) => total + invoice.amount, 0);
  const collected = (data?.invoices ?? [])
    .filter(invoice => invoice.status === 'paid')
    .reduce((total, invoice) => total + invoice.amount, 0);
  const payables = (data?.expenses ?? []).reduce((total, expense) => total + expense.amount, 0);
  const driverPay = (data?.settlements ?? []).reduce((total, settlement) => total + settlement.netTotal, 0);

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
    const start = mondayOf(new Date(invoiceWeek + 'T12:00:00'));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const weeklyLoads = (data?.loads ?? []).filter(load => eligibleStatuses.has(load.status) && new Date(load.deliveryDate + 'T12:00:00') >= start && new Date(load.deliveryDate + 'T12:00:00') <= end);
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
    const settlementLoads = (data?.loads ?? []).filter(load => load.carrierId === settlementCarrierId && eligibleStatuses.has(load.status) && load.pickupDate >= settlementFrom && load.pickupDate <= settlementTo);
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
      const feeTotal = settlementLoads.reduce((total, load) => total + load.dispatchFeeAmount, 0);
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
        head: [['Load', 'Pickup date', 'Route', 'Gross rate', 'Dispatch fee', 'Carrier net', 'Driver pay']],
        body: settlementLoads.map(load => [load.loadNumber, dateLabel(load.pickupDate), load.pickupState + ' to ' + load.deliveryState, money(load.rate), money(load.dispatchFeeAmount), money(load.carrierNet), money(driverPayForLoad(load))]),
        foot: [['', '', 'Totals', money(grossTotal), money(feeTotal), money(netTotal), money(driverPayTotal)]],
        headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 8.5 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      });
      await recordCarrierSettlement({ carrierId: carrier.id, periodStart: settlementFrom, periodEnd: settlementTo, loadIds: settlementLoads.map(load => load.id), grossTotal, feeTotal, netTotal });
      doc.save('sonex-settlement-' + carrier.lastName.toLowerCase() + '-' + settlementFrom + '.pdf');
      toast.success('Carrier settlement PDF downloaded.');
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

  const metrics = [
    { label: 'Open receivables', value: money(receivables), Icon: Landmark },
    { label: 'Cash collected', value: money(collected), Icon: WalletCards },
    { label: 'Open payables', value: money(payables), Icon: ReceiptText },
    { label: 'Carrier settlements', value: money(driverPay), Icon: ArrowRight },
  ];

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
        <section className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-3 bg-white px-4 py-3">
              <Icon size={17} className="text-slate-400" />
              <div><p className="font-mono text-base font-semibold text-slate-950">{value}</p><p className="text-[11px] font-medium text-slate-500">{label}</p></div>
            </div>
          ))}
        </section>

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
                        <select
                          aria-label={'Status for ' + invoice.invoiceNumber}
                          value={invoice.status}
                          disabled={busyId === 'status-' + invoice.id}
                          onChange={event => changeInvoiceStatus(invoice.id, event.target.value as 'draft' | 'sent' | 'paid')}
                          className="border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                          <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {!(data?.invoices ?? []).length && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No invoices created yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {!!readyToInvoice.length && (
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
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Record payable</h2><p className="mt-0.5 text-xs text-slate-500">Lumper, fuel advance, parking, repair, or other load cost.</p></div>
            <form onSubmit={submitExpense} className="space-y-3 p-4">
              <select value={expenseForm.loadId} onChange={event => setExpenseForm(current => ({ ...current, loadId: event.target.value }))} className="w-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"><option value="">Select load</option>{(data?.loads ?? []).map(load => <option key={load.id} value={load.id}>{load.loadNumber} / {load.brokerName}</option>)}</select>
              <div className="grid grid-cols-2 gap-3"><input value={expenseForm.category} onChange={event => setExpenseForm(current => ({ ...current, category: event.target.value }))} placeholder="Expense category" className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" /><input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={event => setExpenseForm(current => ({ ...current, amount: event.target.value }))} placeholder="Amount" className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3"><input type="date" value={expenseForm.incurredAt} onChange={event => setExpenseForm(current => ({ ...current, incurredAt: event.target.value }))} className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500" /><input value={expenseForm.vendorName} onChange={event => setExpenseForm(current => ({ ...current, vendorName: event.target.value }))} placeholder="Vendor" className="min-w-0 border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" /></div>
              <input value={expenseForm.notes} onChange={event => setExpenseForm(current => ({ ...current, notes: event.target.value }))} placeholder="Reference or internal note" className="w-full border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" />
              <button disabled={busyId === 'expense'} className="inline-flex w-full items-center justify-center gap-2 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busyId === 'expense' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Record payable</button>
            </form>
          </section>
        </div>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Carrier settlements & driver pay</h2><p className="mt-0.5 text-xs text-slate-500">Issued settlement totals remain accessible beside invoice and payable operations.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Period</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Dispatch fee</th><th className="px-4 py-3 text-right">Net settlement</th></tr></thead><tbody className="divide-y divide-slate-100">{(data?.settlements ?? []).map(settlement => <tr key={settlement.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{carrierNames.get(settlement.carrierId) ?? 'Unknown carrier'}</td><td className="px-4 py-3 text-slate-600">{dateLabel(settlement.periodStart)} to {dateLabel(settlement.periodEnd)}</td><td className="px-4 py-3 text-right font-mono text-slate-700">{money(settlement.grossTotal)}</td><td className="px-4 py-3 text-right font-mono text-slate-700">{money(settlement.feeTotal)}</td><td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{money(settlement.netTotal)}</td></tr>)}{!(data?.settlements ?? []).length && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">No carrier settlements generated yet.</td></tr>}</tbody></table></div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Weekly dispatch fee invoice</h2><p className="mt-0.5 text-xs text-slate-500">Generate a PDF across all completed deliveries in the selected dispatch week.</p></div><div className="flex flex-wrap items-end gap-3 p-4"><label className="min-w-[180px] flex-1 text-[11px] font-medium text-slate-600">Week starting<input type="date" value={invoiceWeek} onChange={event => setInvoiceWeek(event.target.value)} className="mt-1 block w-full border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-500" /></label><button onClick={generateWeeklyInvoicePdf} disabled={busyId === 'weekly-pdf'} className="inline-flex items-center gap-2 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busyId === 'weekly-pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download PDF</button></div></section>
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Carrier settlement PDF</h2><p className="mt-0.5 text-xs text-slate-500">Record the settlement and download its carrier-facing statement.</p></div><div className="grid gap-3 p-4 sm:grid-cols-2"><select value={settlementCarrierId} onChange={event => setSettlementCarrierId(event.target.value)} className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 sm:col-span-2"><option value="">Select carrier</option>{(data?.carriers ?? []).map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.firstName} {carrier.lastName}</option>)}</select><label className="text-[11px] font-medium text-slate-600">From<input type="date" value={settlementFrom} onChange={event => setSettlementFrom(event.target.value)} className="mt-1 block w-full border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-500" /></label><label className="text-[11px] font-medium text-slate-600">To<input type="date" value={settlementTo} onChange={event => setSettlementTo(event.target.value)} className="mt-1 block w-full border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-500" /></label><button onClick={generateSettlementPdf} disabled={busyId === 'settlement-pdf'} className="inline-flex items-center justify-center gap-2 bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 sm:col-span-2">{busyId === 'settlement-pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Record & download settlement</button></div></section>
        </div>
      </main>
    </div>
  );
}
