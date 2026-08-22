'use client';

import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, LogIn, Pencil, Plus, ShieldCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { addMcOwner, getCarriers, getMcOwners, resetMcOwnerPortalPassword, updateMcOwner } from '@/lib/sonexStore';
import { startMcOwnerPortalPreviewAction } from '@/lib/authActions';
import type { SonexCarrier, SonexMcOwner } from '@/lib/sonexTypes';
import { useSonexAuth } from '@/lib/sonexAuth';
import { CarrierManagementTabs } from '@/components/sonex/CarrierManagementTabs';

type OwnerForm = {
  ownerName: string;
  companyName: string;
  email: string;
  phone: string;
  mcNumber: string;
  dotNumber: string;
  canManageLeasedCarriers: boolean;
  primaryCarrierId: string;
  defaultTotalFeePercent: number;
  defaultDispatchFeePercent: number;
  status: 'active' | 'inactive';
  portalPassword: string;
};

const createInitialForm = (): OwnerForm => ({
  ownerName: '', companyName: '', email: '', phone: '', mcNumber: '', dotNumber: '',
  canManageLeasedCarriers: true, primaryCarrierId: '', defaultTotalFeePercent: 18,
  defaultDispatchFeePercent: 8, status: 'active', portalPassword: '',
});

export default function McOwnersPage() {
  const { isAdmin } = useSonexAuth();
  const [owners, setOwners] = useState<SonexMcOwner[]>([]);
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingOwner, setEditingOwner] = useState<SonexMcOwner | null>(null);
  const [form, setForm] = useState<OwnerForm>(createInitialForm);
  const [saving, setSaving] = useState(false);

  const reload = () => Promise.all([getMcOwners(), getCarriers()]).then(([nextOwners, nextCarriers]) => {
    setOwners(nextOwners); setCarriers(nextCarriers);
  }).catch(() => toast.error('Unable to load MC owners.'));
  useEffect(() => { void reload(); }, []);

  const openCreate = () => {
    setEditingOwner(null);
    setForm(createInitialForm());
    setShowForm(true);
  };

  const openEdit = (owner: SonexMcOwner) => {
    setEditingOwner(owner);
    setForm({
      ownerName: owner.ownerName, companyName: owner.companyName, email: owner.email, phone: owner.phone,
      mcNumber: owner.mcNumber, dotNumber: owner.dotNumber ?? '', canManageLeasedCarriers: owner.canManageLeasedCarriers,
      primaryCarrierId: owner.primaryCarrierId ?? '', defaultTotalFeePercent: owner.defaultTotalFeePercent,
      defaultDispatchFeePercent: owner.defaultDispatchFeePercent, status: owner.status, portalPassword: '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingOwner(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const input = { ...form, primaryCarrierId: form.primaryCarrierId || undefined };
    try {
      if (editingOwner) {
        await updateMcOwner(editingOwner.id, input);
        toast.success('MC owner authority updated.');
      } else {
        await addMcOwner(input);
        toast.success('MC owner portal created. Save the login details now.');
      }
      closeForm();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the MC owner.');
    } finally { setSaving(false); }
  };

  const resetPassword = async (owner: SonexMcOwner) => {
    const password = window.prompt(`Set a new password for ${owner.ownerName} (10+ characters):`);
    if (!password) return;
    try { await resetMcOwnerPortalPassword(owner.id, password); toast.success('MC owner password reset.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Password reset failed.'); }
  };

  const openPortal = async (owner: SonexMcOwner) => {
    const result = await startMcOwnerPortalPreviewAction(owner.id);
    if (!result.success || !result.destination) {
      toast.error(result.error ?? 'Could not open the portal preview.');
      return;
    }
    window.location.assign(result.destination);
  };

  if (!isAdmin) return null;

  return <div className="p-4 sm:p-6 animate-fade-in">
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">Carrier management</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">MC Owners</h1><p className="mt-1 text-sm text-slate-500">Authorities with their own portal, fee split, and leased-carrier access.</p></div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} /> Add MC Owner</button>
      </div>
      <CarrierManagementTabs active="owners" ownerCount={owners.length} />
      <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="sonex-management-table w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500"><tr><th className="px-4 py-3">MC owner</th><th className="px-4 py-3">Authority</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3 text-right">Total fee</th><th className="px-4 py-3 text-right">Sonex fee</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Access</th></tr></thead><tbody className="divide-y divide-slate-100">{owners.map(owner => <tr key={owner.id} className="transition-colors hover:bg-sky-50"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{owner.ownerName}</p><p className="mt-0.5 text-slate-500">{owner.companyName} · {owner.email}</p></td><td className="px-4 py-3 font-mono text-slate-700">MC {owner.mcNumber}</td><td className="px-4 py-3 text-slate-600">{owner.canManageLeasedCarriers ? 'Leased carrier management' : 'Owner-operator only'}</td><td className="px-4 py-3 text-right font-mono text-slate-800">{owner.defaultTotalFeePercent}%</td><td className="px-4 py-3 text-right font-mono text-blue-700">{owner.defaultDispatchFeePercent}%</td><td className="px-4 py-3"><span className={owner.status === 'active' ? 'border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700' : 'border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600'}>{owner.status}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => void openPortal(owner)} className="inline-flex items-center gap-1.5 border border-sky-200 bg-sky-50 px-2.5 py-1.5 font-semibold text-sky-700 hover:bg-sky-100"><LogIn size={13} /> Portal</button><button onClick={() => openEdit(owner)} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700"><Pencil size={13} /> Edit</button><button onClick={() => resetPassword(owner)} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700"><KeyRound size={13} /> Reset password</button></div></td></tr>)}{!owners.length && <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-400"><Users className="mx-auto mb-2" size={26} />No MC owner portals yet.</td></tr>}</tbody></table></div>
      </section>
    </div>
    {showForm && <div className="fixed inset-0 z-[70] bg-slate-950/45" onMouseDown={closeForm}><form onSubmit={submit} onMouseDown={event => event.stopPropagation()} className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-blue-600 text-white"><ShieldCheck size={19} /></div><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">Authority setup</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{editingOwner ? 'Edit MC Owner' : 'Add MC Owner'}</h2></div></div><button type="button" onClick={closeForm} className="p-2 text-slate-500 hover:text-slate-900"><X size={18} /></button></div><div className="flex-1 overflow-y-auto p-6"><div className="grid gap-4 sm:grid-cols-2">
      <Field label="Owner name" value={form.ownerName} onChange={value => setForm(current => ({ ...current, ownerName: value }))} required /><Field label="Company name" value={form.companyName} onChange={value => setForm(current => ({ ...current, companyName: value }))} required />
      <div><Field label="MC owner portal email" type="email" value={form.email} onChange={value => setForm(current => ({ ...current, email: value }))} required /><p className="mt-1 text-[11px] text-slate-500">Use a unique sign-in email; it cannot also be a carrier portal login.</p></div><Field label="Phone" value={form.phone} onChange={value => setForm(current => ({ ...current, phone: value }))} required />
      <Field label="MC number" value={form.mcNumber} onChange={value => setForm(current => ({ ...current, mcNumber: value }))} required /><Field label="DOT number" value={form.dotNumber} onChange={value => setForm(current => ({ ...current, dotNumber: value }))} />
      <Field label="Total carrier fee %" type="number" value={String(form.defaultTotalFeePercent)} onChange={value => setForm(current => ({ ...current, defaultTotalFeePercent: Number(value) }))} required /><Field label="Sonex dispatch fee %" type="number" value={String(form.defaultDispatchFeePercent)} onChange={value => setForm(current => ({ ...current, defaultDispatchFeePercent: Number(value) }))} required />
      {!editingOwner && <div className="sm:col-span-2"><Field label="Initial portal password (10+ characters)" type="password" value={form.portalPassword} onChange={value => setForm(current => ({ ...current, portalPassword: value }))} required minLength={10} /></div>}
      <label className="sm:col-span-2 flex items-center gap-3 border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.canManageLeasedCarriers} onChange={event => setForm(current => ({ ...current, canManageLeasedCarriers: event.target.checked }))} className="h-4 w-4 accent-blue-600" />This MC owner can manage leased carriers under this authority.</label>
      {!form.canManageLeasedCarriers && <label className="sm:col-span-2 block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Owner-operator primary carrier</span><select required value={form.primaryCarrierId} onChange={event => setForm(current => ({ ...current, primaryCarrierId: event.target.value }))} className="h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500"><option value="">Select carrier profile</option>{carriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.firstName} {carrier.lastName} · {carrier.portalEmail}</option>)}</select></label>}
      </div><p className="mt-5 border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">Only Sonex Dispatch can change these fee percentages. MC owner dashboards are scoped to this MC number; owner-operator accounts are further limited to their chosen primary carrier.</p></div><div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={closeForm} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button><button disabled={saving} className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editingOwner ? 'Save MC Owner' : 'Create MC Owner Portal'}</button></div></form></div>}
  </div>;
}

function Field({ label, value, onChange, type = 'text', required = false, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">{label}</span><input required={required} minLength={minLength} type={type} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 100 : undefined} value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500" /></label>;
}
