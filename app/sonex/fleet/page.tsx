'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CircleDot, ClipboardPlus, Loader2, Plus, RefreshCw, Truck, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { completeMaintenanceTask, createMaintenanceTask, getFleetManagementData, updateEquipmentStatus } from '@/lib/tmsStore';

type Equipment = { id: string; carrierId: string; type: string; equipmentType: string; year: number; make: string; model: string; vin: string; plate: string; state: string; status: string };
type Carrier = { id: string; firstName: string; lastName: string };
type Maintenance = { id: string; equipmentId: string; title: string; status: string; dueAt: string | null; estimatedCost: number | null; vendorName: string | null };
type FleetData = { equipment: Equipment[]; carriers: Carrier[]; maintenance: Maintenance[] };

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unscheduled';
}

export default function FleetPage() {
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ equipmentId: '', title: '', dueAt: '', vendorName: '', estimatedCost: '' });

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setData(await getFleetManagementData());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load fleet data.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const carrierNames = useMemo(() => new Map((data?.carriers ?? []).map(carrier => [carrier.id, carrier.firstName + ' ' + carrier.lastName])), [data]);
  const equipment = data?.equipment ?? [];
  const trucks = equipment.filter(item => item.type === 'truck');
  const trailers = equipment.filter(item => item.type === 'trailer');
  const openMaintenance = (data?.maintenance ?? []).filter(item => item.status !== 'completed');
  const metrics = [
    { label: 'In-service trucks', value: trucks.filter(item => item.status === 'active').length, Icon: Truck },
    { label: 'In-service trailers', value: trailers.filter(item => item.status === 'active').length, Icon: CircleDot },
    { label: 'Open maintenance', value: openMaintenance.length, Icon: Wrench },
    { label: 'Out of service', value: equipment.filter(item => item.status !== 'active').length, Icon: ClipboardPlus },
  ];

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.equipmentId || !form.title.trim()) {
      toast.error('Select equipment and enter the maintenance work.');
      return;
    }
    setSaving(true);
    try {
      await createMaintenanceTask({ equipmentId: form.equipmentId, title: form.title, dueAt: form.dueAt || undefined, vendorName: form.vendorName || undefined, estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined });
      setForm({ equipmentId: '', title: '', dueAt: '', vendorName: '', estimatedCost: '' });
      toast.success('Maintenance work scheduled.');
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not schedule maintenance.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: 'active' | 'inactive') => {
    try {
      await updateEquipmentStatus(id, status);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update equipment status.');
    }
  };

  if (loading && !data) return <div className="grid min-h-[60vh] place-items-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  return (
    <div data-tms-surface className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <div><p className="text-xs font-medium text-slate-500">Fleet operations</p><h1 className="mt-1 text-xl font-semibold">Fleet management</h1></div>
          <button onClick={reload} className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-500 hover:text-slate-900" title="Refresh fleet"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
        <section className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {metrics.map(({ label, value, Icon }) => <div key={label} className="flex items-center gap-3 bg-white px-4 py-3"><Icon size={17} className="text-slate-400" /><div><p className="text-lg font-semibold">{value}</p><p className="text-[11px] font-medium text-slate-500">{label}</p></div></div>)}
        </section>
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold">Equipment register</h2><p className="mt-0.5 text-xs text-slate-500">Service status and carrier assignment for every truck and trailer.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">VIN / plate</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Lifecycle</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{equipment.map(item => <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><p className="font-medium text-slate-900">{item.year} {item.make} {item.model}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.equipmentType.replace('_', ' ')}</p></td>
              <td className="px-4 py-3 capitalize text-slate-600">{item.type}</td><td className="px-4 py-3 text-slate-600">{carrierNames.get(item.carrierId) ?? 'Unassigned'}</td>
              <td className="px-4 py-3"><p className="font-mono text-[11px] text-slate-700">{item.vin}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.state} {item.plate}</p></td>
              <td className="px-4 py-3"><span className={'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ' + (item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{item.status === 'active' ? 'In service' : 'Out of service'}</span></td>
              <td className="px-4 py-3 text-right"><button onClick={() => setStatus(item.id, item.status === 'active' ? 'inactive' : 'active')} className="border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900">{item.status === 'active' ? 'Take out of service' : 'Return to service'}</button></td>
            </tr>)}</tbody>
          </table></div>
        </section>
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold">Maintenance board</h2></div>
            <div className="divide-y divide-slate-100">{openMaintenance.map(item => <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={async () => { await completeMaintenanceTask(item.id); await reload(); }} className="grid h-6 w-6 place-items-center border border-slate-300 text-slate-400 hover:border-emerald-500 hover:text-emerald-600" title="Complete maintenance"><Check size={13} /></button>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-800">{item.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatDate(item.dueAt)}{item.vendorName ? ' · ' + item.vendorName : ''}</p></div>
              {item.estimatedCost !== null && <span className="font-mono text-[11px] text-slate-600">USD {item.estimatedCost.toFixed(2)}</span>}
            </div>)}{!openMaintenance.length && <p className="px-4 py-10 text-center text-xs text-slate-400">No open maintenance work.</p>}</div>
          </section>
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold">Schedule maintenance</h2></div>
            <form onSubmit={createTask} className="space-y-3 p-4">
              <select value={form.equipmentId} onChange={event => setForm(current => ({ ...current, equipmentId: event.target.value }))} className="w-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"><option value="">Select equipment</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.year} {item.make} {item.model} · {item.plate}</option>)}</select>
              <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Oil change, inspection, repair..." className="w-full border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-3"><input type="date" value={form.dueAt} onChange={event => setForm(current => ({ ...current, dueAt: event.target.value }))} className="border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500" /><input type="number" min="0" step="0.01" value={form.estimatedCost} onChange={event => setForm(current => ({ ...current, estimatedCost: event.target.value }))} placeholder="Estimated cost" className="border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" /></div>
              <input value={form.vendorName} onChange={event => setForm(current => ({ ...current, vendorName: event.target.value }))} placeholder="Vendor (optional)" className="w-full border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500" />
              <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Schedule work</button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
