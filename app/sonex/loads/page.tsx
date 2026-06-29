'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, Plus, Search, X, Check, ChevronRight, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getLoads, getCarriers, addLoad, computeLoadFinancials } from '@/lib/sonexStore';
import type { SonexLoad, SonexCarrier, LoadStatus, EquipmentType } from '@/lib/sonexTypes';
import {
  LOAD_STATUS_LABELS, LOAD_STATUS_ORDER, EQUIPMENT_TYPE_LABELS,
} from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<LoadStatus, string> = {
  booked: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
  dispatched: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/20',
  in_transit: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  pod_received: 'bg-teal-500/20 text-teal-300 border-teal-500/20',
  invoiced: 'bg-violet-500/20 text-violet-300 border-violet-500/20',
  paid: 'bg-green-500/20 text-green-300 border-green-500/20',
};

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── New Load Modal ───────────────────────────────────────────────────────────

interface NewLoadModalProps {
  carriers: SonexCarrier[];
  onClose: () => void;
  onSaved: () => void;
}

function NewLoadModal({ carriers, onClose, onSaved }: NewLoadModalProps) {
  const [form, setForm] = useState({
    carrierId: carriers[0]?.id ?? '',
    // Broker
    brokerName: '', brokerContact: '', brokerPhone: '', brokerEmail: '', brokerMC: '',
    // Pickup
    pickupFacility: '', pickupAddress: '', pickupCity: '', pickupState: '', pickupZip: '',
    pickupDate: '', pickupTime: '08:00', pickupApptNumber: '',
    // Delivery
    deliveryFacility: '', deliveryAddress: '', deliveryCity: '', deliveryState: '', deliveryZip: '',
    deliveryDate: '', deliveryTime: '17:00', deliveryApptNumber: '',
    // Cargo
    commodity: '', weight: 0, miles: 0,
    // Financials
    rate: 0,
    // Status + Notes
    status: 'booked' as LoadStatus,
    notes: '',
  });

  const selectedCarrier = carriers.find(c => c.id === form.carrierId);
  const feePercent = selectedCarrier?.dispatchFeePercent ?? 10;
  const financials = computeLoadFinancials(form.rate, form.miles, feePercent);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.carrierId || !form.pickupDate || !form.deliveryDate || !form.rate) {
      toast.error('Please fill in required fields: carrier, dates, and rate.');
      return;
    }
    await addLoad({
      ...form,
      dispatchFeePercent: feePercent,
      ratConUrl: undefined,
      bolUrl: undefined,
      podUrl: undefined,
    });
    toast.success('Load created!');
    onSaved();
    onClose();
  };

  const input = (label: string, key: string, type = 'text', placeholder = '', required = false) => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-amber-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="input-primary text-sm py-2"
      />
    </div>
  );

  const Section = ({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) => (
    <div>
      <div className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.06]">
        {title}
      </div>
      <div className={`grid grid-cols-${cols} gap-3`}>{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full flex flex-col animate-slide-in-right"
        style={{ background: '#080B14', borderLeft: '1px solid rgba(245,158,11,0.15)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus size={16} className="text-amber-400" /> New Load
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Carrier */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Carrier <span className="text-amber-500">*</span>
            </label>
            <select
              value={form.carrierId}
              onChange={e => set('carrierId', e.target.value)}
              className="input-primary text-sm py-2"
            >
              {carriers.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} — {EQUIPMENT_TYPE_LABELS[c.equipmentType]} ({c.dispatchFeePercent}% fee)
                </option>
              ))}
            </select>
          </div>

          <Section title="Broker Information" cols={2}>
            <div className="col-span-2">{input('Broker Name', 'brokerName', 'text', 'XPO Logistics')}</div>
            {input('Contact Name', 'brokerContact')}
            {input('Broker Phone', 'brokerPhone', 'tel')}
            {input('Broker Email', 'brokerEmail', 'email')}
            {input('Broker MC #', 'brokerMC')}
          </Section>

          <Section title="Pickup Details" cols={2}>
            <div className="col-span-2">{input('Facility Name', 'pickupFacility', 'text', 'Distribution Center', true)}</div>
            <div className="col-span-2">{input('Address', 'pickupAddress')}</div>
            {input('City', 'pickupCity')}
            {input('State', 'pickupState', 'text', 'TX')}
            {input('ZIP', 'pickupZip')}
            {input('Pickup Date', 'pickupDate', 'date', '', true)}
            {input('Pickup Time', 'pickupTime', 'time')}
            {input('Appt #', 'pickupApptNumber')}
          </Section>

          <Section title="Delivery Details" cols={2}>
            <div className="col-span-2">{input('Facility Name', 'deliveryFacility', 'text', 'Warehouse', true)}</div>
            <div className="col-span-2">{input('Address', 'deliveryAddress')}</div>
            {input('City', 'deliveryCity')}
            {input('State', 'deliveryState', 'text', 'CA')}
            {input('ZIP', 'deliveryZip')}
            {input('Delivery Date', 'deliveryDate', 'date', '', true)}
            {input('Delivery Time', 'deliveryTime', 'time')}
            {input('Appt #', 'deliveryApptNumber')}
          </Section>

          <Section title="Cargo" cols={2}>
            <div className="col-span-2">{input('Commodity', 'commodity', 'text', 'Steel Coils')}</div>
            {input('Weight (lbs)', 'weight', 'number')}
            {input('Miles', 'miles', 'number')}
          </Section>

          <Section title="Financials" cols={2}>
            {input('Rate ($)', 'rate', 'number', '0', true)}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Carrier</label>
              <p className="text-slate-400 text-sm py-2">{selectedCarrier?.firstName} {selectedCarrier?.lastName}</p>
            </div>
            {/* Live calculations */}
            <div className="col-span-2 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/15 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Dispatch Fee</p>
                <p className="text-amber-400 font-bold text-lg font-mono">{fmt$(financials.dispatchFeeAmount)}</p>
                <p className="text-slate-600 text-[10px]">{feePercent}%</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Carrier Net</p>
                <p className="text-emerald-400 font-bold text-lg font-mono">{fmt$(financials.carrierNet)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Rate/Mile</p>
                <p className="text-cyan-400 font-bold text-lg font-mono">
                  {form.miles > 0 ? `$${financials.ratePerMile.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>
          </Section>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="input-primary text-sm py-2 resize-none"
              placeholder="Any special instructions or notes about this load…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm font-medium hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary" style={{ background: '#F59E0B', color: '#000' }}>
            <Check size={15} /> Create Load
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Tabs ──────────────────────────────────────────────────────────────

const STATUS_TABS: Array<LoadStatus | 'all'> = [
  'all', ...LOAD_STATUS_ORDER,
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LoadsPage() {
  const router = useRouter();
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<LoadStatus | 'all'>('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    getLoads().then(setLoads);
    getCarriers().then(setCarriers);
  };

  useEffect(() => { load(); }, []);

  const carrierMap = new Map(carriers.map(c => [c.id, `${c.firstName} ${c.lastName}`]));

  const filtered = loads.filter(l => {
    const q = search.toLowerCase();
    const searchMatch = l.loadNumber.toLowerCase().includes(q)
      || l.brokerName.toLowerCase().includes(q)
      || (carrierMap.get(l.carrierId) ?? '').toLowerCase().includes(q)
      || l.pickupState.toLowerCase().includes(q)
      || l.deliveryState.toLowerCase().includes(q);
    const statusMatch = statusTab === 'all' || l.status === statusTab;
    const carrierMatch = carrierFilter === 'all' || l.carrierId === carrierFilter;
    return searchMatch && statusMatch && carrierMatch;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const countByStatus = (s: LoadStatus | 'all') =>
    s === 'all' ? loads.length : loads.filter(l => l.status === s).length;

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Loads</h1>
          <span className="bg-white/10 text-slate-400 text-xs font-semibold px-2.5 py-1 rounded-full">
            {loads.length}
          </span>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="btn-primary"
          style={{ background: '#F59E0B', color: '#000' }}
        >
          <Plus size={16} /> New Load
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto border-b border-white/[0.06] pb-0">
        {STATUS_TABS.map(s => {
          const count = countByStatus(s);
          return (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-all ${
                statusTab === s
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {s === 'all' ? 'All' : LOAD_STATUS_LABELS[s as LoadStatus]}
              {count > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  statusTab === s ? 'bg-amber-500/30 text-amber-300' : 'bg-white/[0.06] text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + Carrier Filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search loads, brokers, routes…"
            className="input-primary pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="relative">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <select
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
            className="input-primary pl-8 py-2.5 text-sm pr-8 appearance-none"
          >
            <option value="all">All Carriers</option>
            {carriers.map(c => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No loads found</p>
            <p className="text-slate-600 text-xs mt-1">Try adjusting your filters or create a new load.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  {['Load #', 'Carrier', 'Broker', 'Route', 'Date', 'Rate', 'Fee', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(load => (
                  <tr key={load.id}
                    onClick={() => router.push(`/sonex/loads/${load.id}`)}
                    className="table-row-hover cursor-pointer group">
                    <td className="px-4 py-3.5 font-mono text-xs text-amber-400 font-semibold">{load.loadNumber}</td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs">
                      {carrierMap.get(load.carrierId) ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs max-w-[120px] truncate">{load.brokerName}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-slate-300 text-xs font-medium">{load.pickupState}</span>
                      <span className="text-slate-600 text-xs mx-1">→</span>
                      <span className="text-slate-300 text-xs font-medium">{load.deliveryState}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">
                      {new Date(load.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5 text-white font-semibold text-xs">{fmt$(load.rate)}</td>
                    <td className="px-4 py-3.5 text-amber-400/80 text-xs">{fmt$(load.dispatchFeeAmount)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[load.status]}`}>
                        {LOAD_STATUS_LABELS[load.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showNew && (
        <NewLoadModal carriers={carriers} onClose={() => setShowNew(false)} onSaved={load} />
      )}
    </div>
  );
}
