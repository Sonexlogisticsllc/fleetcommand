'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Search, ChevronRight, X, Check,
  Truck, DollarSign, Shield, KeyRound,
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

// ─── Add Carrier Modal ────────────────────────────────────────────────────────

interface AddCarrierModalProps { onClose: () => void; onSaved: () => void; }

const EQUIPMENT_OPTS = Object.entries(EQUIPMENT_TYPE_LABELS) as [EquipmentType, string][];
const INSURANCE_OPTS = Object.entries(INSURANCE_TYPE_LABELS) as [InsuranceType, string][];
const STATUS_OPTS: CarrierStatus[] = ['active', 'onboarding', 'inactive'];

function AddCarrierModal({ onClose, onSaved }: AddCarrierModalProps) {
  const defaultDispatchFeePercent = getSettings().defaultDispatchFeePercent;
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
    dispatchFeePercent: defaultDispatchFeePercent, status: 'active' as CarrierStatus, notes: '',
    // Portal
    portalEmail: '', portalPassword: '',
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.firstName || !form.lastName || !form.portalEmail) {
      toast.error('First name, last name, and portal email are required.');
      return;
    }
    addCarrier({ ...form });
    toast.success(`Carrier ${form.firstName} ${form.lastName} added!`);
    onSaved();
    onClose();
  };

  const input = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="input-primary text-sm py-2.5"
      />
    </div>
  );

  const select = (label: string, key: string, options: [string, string][]) => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        className="input-primary text-sm py-2.5 appearance-none"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  const toggle = (label: string, key: string) => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-300">{label}</span>
      <div
        onClick={() => set(key, !(form as any)[key])}
        className={`w-10 h-5 rounded-full border transition-colors relative ${(form as any)[key] ? 'bg-amber-500 border-amber-400' : 'bg-white/10 border-white/10'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(form as any)[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );

  const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
        <Icon size={14} className="text-amber-400" />
        <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full flex flex-col animate-slide-in-right"
        style={{ background: '#080B14', borderLeft: '1px solid rgba(245,158,11,0.15)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus size={16} className="text-amber-400" /> Add New Carrier
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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
                className="input-primary text-sm py-2.5 resize-none"
                placeholder="Internal notes about this carrier…"
              />
            </div>
          </Section>

          <Section title="Create Carrier Login" icon={KeyRound}>
            <div className="col-span-2">{input('Login Email', 'portalEmail', 'email', 'carrier@example.com')}</div>
            <div className="col-span-2">{input('Temporary Password', 'portalPassword', 'text', 'temp-password-123')}</div>
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm font-medium hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            <Check size={15} /> Save Carrier
          </button>
        </div>
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
    setCarriers(getCarriers());
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
