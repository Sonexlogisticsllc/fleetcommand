'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Search, ChevronRight, X, Check,
  Truck, DollarSign, Shield, KeyRound, Eye, EyeOff, Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCarriers, addCarrier, getSettings } from '@/lib/sonexStore';
import type {
  SonexCarrier, CarrierStatus, EquipmentType, InsuranceType,
} from '@/lib/sonexTypes';
import {
  EQUIPMENT_TYPE_LABELS, INSURANCE_TYPE_LABELS,
} from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<CarrierStatus, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/25',
  inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  onboarding: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/25',
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
    dispatchFeePercent: 10, status: 'active' as CarrierStatus, notes: '',
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
            {input('Dispatch Fee %', 'dispatchFeePercent', 'number')}
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
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CarrierStatus | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    getCarriers().then(setCarriers);
  };

  useEffect(() => { load(); }, []);

  const filtered = carriers.filter(c => {
    const q = search.toLowerCase();
    const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || c.phone.includes(q);
    const statusMatch = statusFilter === 'all' || c.status === statusFilter;
    return nameMatch && statusMatch;
  });

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Carriers</h1>
          <span className="bg-white/10 text-slate-400 text-xs font-semibold px-2.5 py-1 rounded-full">
            {carriers.length}
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary"
        >
          <Plus size={16} /> Add Carrier
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search carriers…"
            className="input-primary pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'onboarding', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                statusFilter === s
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No carriers found</p>
            <p className="text-slate-600 text-xs mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  {['Carrier', 'Equipment', 'Authority', 'Phone', 'Fee', 'Login', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(carrier => {
                  const initials = `${carrier.firstName[0]}${carrier.lastName[0]}`.toUpperCase();
                  return (
                    <tr
                      key={carrier.id}
                      onClick={() => router.push(`/sonex/carriers/${carrier.id}`)}
                      className="table-row-hover cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                            <span className="text-amber-400 text-xs font-bold">{initials}</span>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{carrier.firstName} {carrier.lastName}</p>
                            <p className="text-slate-600 text-[10px]">{carrier.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs bg-white/5 text-slate-300 px-2 py-1 rounded-lg border border-white/[0.06]">
                          {EQUIPMENT_TYPE_LABELS[carrier.equipmentType]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {carrier.hasOwnAuthority
                          ? <span className="text-emerald-400 font-mono">MC-{carrier.mcNumber}</span>
                          : carrier.isLeasedMC
                            ? <span className="text-slate-500">Leased — {carrier.mcHolderName}</span>
                            : <span className="text-slate-600">—</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">{carrier.phone}</td>
                      <td className="px-4 py-3.5 text-xs text-amber-400 font-semibold">{carrier.dispatchFeePercent}%</td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">{carrier.portalEmail}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${statusBadge[carrier.status]}`}>
                          {carrier.status.charAt(0).toUpperCase() + carrier.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                          View <ChevronRight size={13} />
                        </button>
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
