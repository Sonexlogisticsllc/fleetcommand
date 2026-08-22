'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Search, X, Check,
  Truck, DollarSign, Shield, KeyRound, Eye, EyeOff, Copy, LogIn, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCarriers, addCarrier, deleteCarrier, getCarrierPortalAccounts, getMcOwners, getSettings } from '@/lib/sonexStore';
import { startPortalPreviewAction } from '@/lib/authActions';
import type {
  SonexCarrier, SonexMcOwner, CarrierStatus, EquipmentType, InsuranceType,
} from '@/lib/sonexTypes';
import { useSonexAuth } from '@/lib/sonexAuth';
import { CarrierManagementTabs } from '@/components/sonex/CarrierManagementTabs';
import {
  EQUIPMENT_TYPE_LABELS, INSURANCE_TYPE_LABELS,
} from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<CarrierStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  inactive: 'border-slate-200 bg-slate-100 text-slate-600',
  onboarding: 'border-amber-200 bg-amber-50 text-amber-700',
};

// ─── Section Helper ───────────────────────────────────────────────────────────

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div>
    <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
      <Icon size={14} className="text-blue-600" />
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-800">{title}</h4>
    </div>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
);

// ─── Add Carrier Modal ────────────────────────────────────────────────────────

interface AddCarrierModalProps { onClose: () => void; onSaved: () => void; }

const EQUIPMENT_OPTS = Object.entries(EQUIPMENT_TYPE_LABELS) as [EquipmentType, string][];
const INSURANCE_OPTS = Object.entries(INSURANCE_TYPE_LABELS) as [InsuranceType, string][];
const STATUS_OPTS: CarrierStatus[] = ['active', 'onboarding', 'inactive'];

function AddCarrierModal({ onClose, onSaved }: AddCarrierModalProps) {
  const { isAdmin } = useSonexAuth();
  const [mcOwners, setMcOwners] = useState<SonexMcOwner[]>([]);
  const [form, setForm] = useState({
    // Contact
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '',
    // Equipment
    equipmentType: 'flatbed' as EquipmentType,
    truckYear: new Date().getFullYear(), truckMake: '', truckModel: '',
    truckVin: '', truckPlate: '', truckState: '', weightCapacity: 48000,
    // Trailer
    hasTrailer: false,
    trailerType: '', trailerVin: '', trailerPlate: '', trailerState: '', trailerLength: 48,
    // Authority
    hasOwnAuthority: false, mcNumber: '', dotNumber: '',
    isLeasedMC: false, mcHolderName: '', mcHolderMC: '',
    // Insurance
    insuranceType: 'certificate_holder' as InsuranceType,
    insuranceCompany: '', insurancePolicyNumber: '',
    // Business
    mcOwnerId: '', totalFeePercent: 10, dispatchFeePercent: 10, status: 'active' as CarrierStatus, notes: '',
    // Portal login
    portalEmail: '', portalPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    getSettings().then(s => {
      setForm(f => ({ ...f, dispatchFeePercent: s.defaultDispatchFeePercent }));
    });
    getMcOwners().then(setMcOwners).catch(() => setMcOwners([]));
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.portalEmail) {
      toast.error('First name, last name, and portal email are required.');
      return;
    }
    if (!form.portalPassword || form.portalPassword.length < 8) {
      toast.error('Portal password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await addCarrier({ ...form, portalPassword: form.portalPassword } as any);
      setSavedCredentials({ email: form.portalEmail, password: form.portalPassword });
      toast.success(`✓ ${form.firstName} ${form.lastName} added with portal access!`, { duration: 4000 });
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save carrier');
    } finally {
      setSaving(false);
    }
  };

  const input = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );

  const select = (label: string, key: string, options: [string, string][]) => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        className="h-10 w-full appearance-none border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  const toggle = (label: string, key: string) => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-600">{label}</span>
      <div
        onClick={() => set(key, !(form as any)[key])}
        className={`relative h-5 w-10 rounded-full border transition-colors ${(form as any)[key] ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-slate-100'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(form as any)[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );


  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div data-sonex-load-modal className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-[#f4f7fb] shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="relative flex shrink-0 items-start justify-between overflow-hidden border-b border-slate-800 bg-[#101a2f] px-6 py-5">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500" />
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-blue-500 text-white shadow-lg shadow-blue-950/30"><Plus size={18} /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">Carrier operations</p><h3 className="mt-0.5 text-xl font-bold text-white">Add New Carrier</h3><p className="mt-1 text-xs text-slate-300">Create the carrier profile, equipment record, and portal login together.</p></div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" title="Close add carrier">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <Section title="Contact Info" icon={Users}>
            {input('First Name', 'firstName', 'text', 'John')}
            {input('Last Name', 'lastName', 'text', 'Smith')}
            <div className="col-span-2">{input('Email', 'email', 'email', 'john@email.com')}</div>
            {input('Phone', 'phone', 'tel', '+1 (555) 000-0000')}
            {input('State', 'state', 'text', 'TX')}
          </Section>

          <Section title="Equipment" icon={Truck}>
            <div className="col-span-2">
              {select('Equipment Type', 'equipmentType', EQUIPMENT_OPTS)}
            </div>
            {input('Year', 'truckYear', 'number')}
            {input('Make', 'truckMake', 'text', 'Peterbilt')}
            {input('Model', 'truckModel', 'text', '389')}
            {input('VIN', 'truckVin', 'text', '1XPBD49X...')}
            {input('Plate #', 'truckPlate', 'text', 'TX-1234')}
            {input('Plate State', 'truckState', 'text', 'TX')}
            <div className="col-span-2">{input('Weight Capacity (lbs)', 'weightCapacity', 'number')}</div>
          </Section>

          <Section title="Trailer" icon={Truck}>
            <div className="col-span-2 pt-1">{toggle('Has Trailer?', 'hasTrailer')}</div>
            {form.hasTrailer && (
              <>
                {input('Trailer Type', 'trailerType', 'text', 'Flatbed')}
                {input('Length (ft)', 'trailerLength', 'number')}
                {input('Trailer VIN', 'trailerVin')}
                {input('Trailer Plate', 'trailerPlate')}
              </>
            )}
          </Section>

          <Section title="Authority" icon={Shield}>
            <div className="col-span-2 pt-1">{toggle('Has Own Authority (MC/DOT)', 'hasOwnAuthority')}</div>
            {form.hasOwnAuthority ? (
              <>
                {input('MC Number', 'mcNumber', 'text', 'MC-123456')}
                {input('DOT Number', 'dotNumber', 'text', 'DOT-789012')}
              </>
            ) : (
              <>
                <div className="col-span-2">{toggle('Leased Under MC', 'isLeasedMC')}</div>
                {form.isLeasedMC && (
                  <>
                    {input('MC Holder Name', 'mcHolderName', 'text', 'Company LLC')}
                    {input('MC Holder MC#', 'mcHolderMC', 'text', 'MC-000000')}
                  </>
                )}
              </>
            )}
          </Section>

          <Section title="Insurance" icon={Shield}>
            <div className="col-span-2">{select('Insurance Type', 'insuranceType', INSURANCE_OPTS)}</div>
            {input('Insurance Company', 'insuranceCompany')}
            {input('Policy Number', 'insurancePolicyNumber')}
          </Section>

          <Section title="Business" icon={DollarSign}>
            {isAdmin && <div className="col-span-2"><label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">MC owner / authority</label><select value={form.mcOwnerId} onChange={event => { const owner = mcOwners.find(item => item.id === event.target.value); setForm(current => ({ ...current, mcOwnerId: event.target.value, isLeasedMC: Boolean(owner) || current.isLeasedMC, mcHolderName: owner?.companyName ?? current.mcHolderName, mcHolderMC: owner?.mcNumber ?? current.mcHolderMC, totalFeePercent: owner?.defaultTotalFeePercent ?? current.totalFeePercent, dispatchFeePercent: owner?.defaultDispatchFeePercent ?? current.dispatchFeePercent })); }} className="h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500"><option value="">Direct carrier - Sonex manages authority</option>{mcOwners.map(owner => <option key={owner.id} value={owner.id}>{owner.ownerName} · MC {owner.mcNumber}</option>)}</select></div>}
            {isAdmin && input('Total Carrier Fee %', 'totalFeePercent', 'number')}
            {isAdmin && input('Sonex Dispatch Fee %', 'dispatchFeePercent', 'number')}
            {select('Status', 'status', STATUS_OPTS.map(s => [s, s.charAt(0).toUpperCase() + s.slice(1)]))}
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                className="w-full resize-none border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Internal notes about this carrier…"
              />
            </div>
          </Section>

          <Section title="Create Carrier Login" icon={KeyRound}>
            <div className="col-span-2">{input('Login Email', 'portalEmail', 'email', 'carrier@example.com')}</div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Portal Password <span className="text-blue-600">(min 8 chars)</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.portalPassword}
                  onChange={e => set('portalPassword', e.target.value)}
                  placeholder="Create a strong password…"
                  className="h-10 w-full border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="col-span-2 border border-blue-100 bg-blue-50 px-3 py-2.5">
              <p className="text-[10px] leading-relaxed text-blue-800">The carrier will use these credentials to sign in to the Carrier Portal. Save the password now because it cannot be recovered after this panel is closed.</p>
            </div>
          </Section>
        </div>

        {/* Footer */}
        {savedCredentials ? (
          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-5">
            <div className="mb-4 border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-2 flex items-center gap-2"><Check size={14} className="text-emerald-600" /><span className="text-sm font-bold text-emerald-800">Carrier Created Successfully</span></div>
              <p className="mb-3 text-xs text-slate-600">Save these credentials and share them with the carrier:</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between border border-emerald-100 bg-white px-3 py-2">
                  <span className="text-xs text-slate-500">Email:</span>
                  <span className="font-mono text-xs text-slate-800">{savedCredentials.email}</span>
                  <button onClick={() => { navigator.clipboard.writeText(savedCredentials.email); toast.success('Copied!'); }} className="p-1"><Copy size={11} className="text-slate-500" /></button>
                </div>
                <div className="flex items-center justify-between border border-emerald-100 bg-white px-3 py-2">
                  <span className="text-xs text-slate-500">Password:</span>
                  <span className="font-mono text-xs text-slate-800">{savedCredentials.password}</span>
                  <button onClick={() => { navigator.clipboard.writeText(savedCredentials.password); toast.success('Copied!'); }} className="p-1"><Copy size={11} className="text-slate-500" /></button>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-full bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700">Close</button>
          </div>
        ) : (
          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">Cancel</button>
            <button onClick={handleSave} disabled={saving} className={`inline-flex items-center gap-2 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 ${saving ? 'cursor-not-allowed opacity-60' : ''}`}>
              {saving ? <><span className="animate-spin">⏳</span> Creating…</> : <><Check size={15} /> Save Carrier</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CarriersPage() {
  const router = useRouter();
  const { isAdmin } = useSonexAuth();
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [portalAccountIds, setPortalAccountIds] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CarrierStatus | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'direct' | 'leased'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = () => {
    void getCarriers().then(setCarriers);
    if (isAdmin) {
      void getCarrierPortalAccounts().then(accounts => {
        setPortalAccountIds(Object.fromEntries(accounts.map(account => [account.carrierId, account.userId])));
      });
    }
  };

  useEffect(() => { load(); }, [isAdmin]);

  const openPortal = async (event: React.MouseEvent, userId: string) => {
    event.stopPropagation();
    const result = await startPortalPreviewAction(userId);
    if (!result.success || !result.destination) {
      toast.error(result.error ?? 'Could not open the portal preview.');
      return;
    }
    window.location.assign(result.destination);
  };

  const isLeasedCarrier = (carrier: SonexCarrier) => carrier.isLeasedMC || Boolean(carrier.mcOwnerId);
  const scopedCarriers = carriers.filter(carrier => scopeFilter === 'all' || (scopeFilter === 'leased' ? isLeasedCarrier(carrier) : !isLeasedCarrier(carrier)));
  const filtered = scopedCarriers.filter(c => {
    const q = search.toLowerCase();
    const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || c.phone.includes(q);
    const statusMatch = statusFilter === 'all' || c.status === statusFilter;
    return nameMatch && statusMatch;
  });

  const removeCarrier = async (event: React.MouseEvent, carrier: SonexCarrier) => {
    event.stopPropagation();
    const confirmation = `Remove ${carrier.firstName} ${carrier.lastName}'s portal access? Profiles with existing loads are archived so their load and financial history stay intact.`;
    if (!window.confirm(confirmation)) return;

    setRemovingId(carrier.id);
    try {
      const result = await deleteCarrier(carrier.id);
      toast.success(result.disposition === 'archived' ? 'Carrier portal access removed. Historical profile archived.' : 'Carrier profile removed.');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove this carrier.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">Carrier management</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Carrier Profiles</h1>
          <p className="mt-1 text-sm text-slate-500">Every carrier profile, whether direct or leased under a managed MC authority.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} /> Add Carrier
        </button>
      </div>

      <CarrierManagementTabs active="carriers" carrierCount={carriers.length} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search carriers…"
            className="h-10 w-full border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['all', `All carriers ${carriers.length}`],
            ['direct', `Direct ${carriers.filter(carrier => !isLeasedCarrier(carrier)).length}`],
            ['leased', `Leased ${carriers.filter(isLeasedCarrier).length}`],
          ] as const).map(([scope, label]) => (
            <button key={scope} onClick={() => setScopeFilter(scope)} className={`h-10 border px-3 text-xs font-semibold transition-colors ${scopeFilter === scope ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700'}`}>
              {label}
            </button>
          ))}
          {(['all', 'active', 'onboarding', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`h-10 border px-3 text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-600">No carrier profiles found</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="sonex-management-table w-full min-w-[920px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Carrier', 'Equipment', 'Authority', 'Phone', 'Fee', 'Login', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(carrier => {
                  const initials = `${carrier.firstName[0]}${carrier.lastName[0]}`.toUpperCase();
                  return (
                    <tr
                      key={carrier.id}
                      onClick={() => router.push(`/sonex/carriers/${carrier.id}`)}
                      className="cursor-pointer transition-colors hover:bg-sky-50"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-blue-200 bg-blue-50">
                            <span className="text-xs font-bold text-blue-700">{initials}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{carrier.firstName} {carrier.lastName}</p>
                            <p className="text-[10px] text-slate-500">{carrier.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          {EQUIPMENT_TYPE_LABELS[carrier.equipmentType]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {carrier.hasOwnAuthority
                          ? <span className="font-mono text-emerald-700">MC-{carrier.mcNumber}</span>
                          : isLeasedCarrier(carrier)
                            ? <span>Leased - {carrier.mcHolderName}</span>
                            : <span className="text-slate-500">Sonex direct</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{carrier.phone}</td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-blue-700">{carrier.dispatchFeePercent}%</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{carrier.portalEmail}</td>
                      <td className="px-4 py-3.5">
                        <span className={`border px-2 py-1 text-[10px] font-semibold ${statusBadge[carrier.status]}`}>
                          {carrier.status.charAt(0).toUpperCase() + carrier.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isAdmin && portalAccountIds[carrier.id] && <button onClick={event => void openPortal(event, portalAccountIds[carrier.id])} title="Open this carrier portal" className="flex items-center gap-1 border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"><LogIn size={13} /> Portal</button>}
                          <button onClick={event => { event.stopPropagation(); router.push(`/sonex/carriers/${carrier.id}`); }} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:text-blue-700">
                            <Pencil size={13} /> Edit
                          </button>
                          {isAdmin && <button onClick={event => void removeCarrier(event, carrier)} disabled={removingId === carrier.id} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                            <Trash2 size={13} /> {removingId === carrier.id ? 'Removing' : 'Remove'}
                          </button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showAdd && <AddCarrierModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </div>
  );
}
