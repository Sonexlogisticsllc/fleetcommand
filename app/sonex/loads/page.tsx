'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, Plus, Search, X, Check, ChevronRight, Filter,
  Sparkles, UploadCloud, Loader2, User, Clock, ArrowRight,
  Activity, FileText, AlertTriangle, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getLoads, getCarriers, addLoad, updateLoad, deleteLoad } from '@/lib/sonexStore';
import { SonexLoad, SonexCarrier, LoadStatus, EquipmentType, computeLoadFinancials } from '@/lib/sonexTypes';
import {
  LOAD_STATUS_LABELS, LOAD_STATUS_ORDER, EQUIPMENT_TYPE_LABELS,
} from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<LoadStatus, string> = {
  booked: 'bg-slate-800 text-slate-300 border-slate-700',
  dispatched: 'bg-blue-950 text-blue-300 border-blue-800',
  in_transit: 'bg-amber-950 text-amber-300 border-amber-800',
  delivered: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  pod_received: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  invoiced: 'bg-purple-950 text-purple-300 border-purple-800',
  paid: 'bg-purple-950 text-purple-300 border-purple-800',
};

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ParsedPreview = {
  documentType: 'rate_confirmation' | 'bol';
  loadNumber: string;
  confidenceScore: number;
  fieldConfidence: Record<string, number>;
  brokerName: string; brokerContact: string; brokerPhone: string; brokerEmail: string; brokerMC: string;
  pickupFacility: string; pickupAddress: string; pickupCity: string; pickupState: string; pickupZip: string; pickupDate: string; pickupTime: string; pickupApptNumber: string;
  deliveryFacility: string; deliveryAddress: string; deliveryCity: string; deliveryState: string; deliveryZip: string; deliveryDate: string; deliveryTime: string; deliveryApptNumber: string;
  commodity: string; weight: number; miles: number; rate: number; notes: string;
};

// ─── Section Helper ───────────────────────────────────────────────────────────

const Section = ({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) => (
  <div>
    <div className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.06]">
      {title}
    </div>
    <div className={`grid grid-cols-${cols} gap-3`}>{children}</div>
  </div>
);

// ─── New Load Modal ───────────────────────────────────────────────────────────

interface NewLoadModalProps {
  carriers: SonexCarrier[];
  onClose: () => void;
  onSaved: () => void;
}

function NewLoadModal({ carriers, onClose, onSaved }: NewLoadModalProps) {
  const [form, setForm] = useState({
    carrierId: '', // Default to unassigned
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
    if (!form.pickupDate || !form.deliveryDate || !form.rate) {
      toast.error('Please fill in required fields: dates and rate.');
      return;
    }
    await addLoad({
      ...form,
      dispatchFeePercent: feePercent,
      ratConUrl: undefined,
      bolUrl: undefined,
      podUrl: undefined,
    });
    toast.success('Load created successfully!');
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-[650px] h-full flex flex-col transition-none"
        style={{ background: '#080B14', borderLeft: '1px solid rgba(245,158,11,0.15)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus size={16} className="text-amber-400" /> Create New Order
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Carrier Assignment Select */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Carrier Assignment
            </label>
            <select
              value={form.carrierId}
              onChange={e => set('carrierId', e.target.value)}
              className="input-primary text-sm py-2"
            >
              <option value="">-- Unassigned (Add to Queue) --</option>
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
              <p className="text-slate-400 text-sm py-2">{selectedCarrier ? `${selectedCarrier.firstName} ${selectedCarrier.lastName}` : 'Unassigned'}</p>
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

// ─── Main Loads Page Component ────────────────────────────────────────────────

export default function LoadsPage() {
  const router = useRouter();
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  
  // Tabs State
  const [activeBoardTab, setActiveBoardTab] = useState<'dispatch' | 'unassigned' | 'log'>('dispatch');

  // Master Log State
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<LoadStatus | 'all'>('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  
  // Modals & Scan state
  const [showNew, setShowNew] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [parseDocumentType, setParseDocumentType] = useState<'rate_confirmation' | 'bol'>('rate_confirmation');
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview | null>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  // Dynamic quick-assign load selections for carriers
  const [quickAssignLoads, setQuickAssignLoads] = useState<Record<string, string>>({});

  const reloadData = () => {
    getLoads().then(setLoads);
    getCarriers().then(setCarriers);
  };

  useEffect(() => {
    reloadData();
  }, []);

  const carrierMap = useMemo(() => new Map(carriers.map(c => [c.id, `${c.firstName} ${c.lastName}`])), [carriers]);

  // Grouped loads
  const unassignedLoads = useMemo(() => {
    return loads.filter(l => !l.carrierId);
  }, [loads]);

  const activeCarriers = useMemo(() => {
    return carriers.filter(c => c.status === 'active');
  }, [carriers]);

  // Master Log Filter
  const filteredLoads = useMemo(() => {
    return loads.filter(l => {
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
  }, [loads, search, statusTab, carrierFilter, carrierMap]);

  // Quick assign load logic
  const handleQuickAssign = async (carrierId: string) => {
    const loadId = quickAssignLoads[carrierId];
    if (!loadId) return;

    try {
      const selectedCarrier = carriers.find(c => c.id === carrierId);
      const fee = selectedCarrier?.dispatchFeePercent ?? 10;
      await updateLoad(loadId, { carrierId, dispatchFeePercent: fee });
      toast.success(`✓ Load successfully assigned to carrier!`);
      setQuickAssignLoads(prev => {
        const next = { ...prev };
        delete next[carrierId];
        return next;
      });
      reloadData();
    } catch (e) {
      toast.error('Failed to assign load');
    }
  };

  // AI Parse Rate Confirmation from Dispatch Board
  const handleAiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanStep('Scanning Rate Confirmation PDF...');
    await new Promise(r => setTimeout(r, 700));
    setScanStep('Extracting freight route and rate...');
    await new Promise(r => setTimeout(r, 700));

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('documentType', parseDocumentType);
      const res = await fetch('/api/parse-rc', {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      if (json.success) {
        setParsedPreview(json.data as ParsedPreview);
        toast.success('Document parsed. Review the structured fields before saving.');
      } else {
        toast.error(json.error || 'Failed to parse rate confirmation');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error connecting to document parser');
    } finally {
      setScanning(false);
      if (aiFileRef.current) aiFileRef.current.value = '';
    }
  };

  const confirmParsedLoad = async () => {
    if (!parsedPreview) return;
    try {
      const { confidenceScore, documentType, loadNumber, ...loadData } = parsedPreview;
      await addLoad({
        ...loadData,
        carrierId: '',
        status: 'booked',
        dispatchFeePercent: 10,
        ratConUrl: undefined,
        bolUrl: undefined,
        podUrl: undefined,
        notes: (loadData.notes || '') + ' Parsed from ' + documentType + (loadNumber ? ' ' + loadNumber : '') + ' with confidence ' + confidenceScore,
      } as Parameters<typeof addLoad>[0]);
      setParsedPreview(null);
      toast.success('Reviewed document saved to the unassigned queue.');
      reloadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save parsed load.');
    }
  };

  const updateParsedField = <K extends keyof ParsedPreview>(key: K, value: ParsedPreview[K]) => {
    setParsedPreview(current => current ? { ...current, [key]: value } : current);
  };

  return (
    <div className="p-6 animate-fade-in text-white space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">DataTruck TMS</span>
            <h1 className="text-2xl font-black tracking-tight">Dispatch Control Center</h1>
          </div>
          <p className="text-slate-400 text-xs">Automate load booking, fleet dispatching, and settlements</p>
        </div>
         <div className="flex items-center gap-2">
           <select value={parseDocumentType} onChange={event => setParseDocumentType(event.target.value as 'rate_confirmation' | 'bol')} className="border border-white/10 bg-[#0E1524] px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 outline-none focus:border-blue-500">
             <option value="rate_confirmation">Rate confirmation</option>
             <option value="bol">BOL</option>
           </select>
           <button
            onClick={() => aiFileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 font-bold text-xs hover:bg-amber-500/20 transition-all uppercase shrink-0"
          >
            {scanning ? (
              <>
                <Loader2 className="animate-spin" size={13} />
                Scanning RC...
              </>
            ) : (
              <>
                <Sparkles size={13} />
                AI Parse Rate Con
              </>
            )}
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-black text-xs hover:bg-amber-400 transition-all uppercase shrink-0"
          >
            <Plus size={14} /> New Manual Order
          </button>
        </div>
      </div>
      <input ref={aiFileRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={handleAiUpload} />
      {parsedPreview && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button aria-label="Close extraction preview" onClick={() => setParsedPreview(null)} className="absolute inset-0 bg-slate-950/70" />
          <aside className="relative h-full w-full max-w-[650px] overflow-y-auto border-l border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-400">Bounded extraction preview</p><h2 className="mt-1 text-lg font-semibold">Review before saving</h2><p className="mt-1 text-xs text-slate-400">No load has been written yet. Edit any field, then confirm.</p></div><button onClick={() => setParsedPreview(null)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title="Close preview"><X size={17} /></button></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><div className="border border-slate-800 bg-slate-950 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Overall confidence</p><p className="mt-1 font-mono text-xl font-bold text-emerald-400">{Math.round(parsedPreview.confidenceScore * 100)}%</p></div><div className="border border-slate-800 bg-slate-950 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Document type</p><p className="mt-2 text-xs font-semibold uppercase text-slate-200">{parsedPreview.documentType.replace('_', ' ')}</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Load number<input value={parsedPreview.loadNumber} onChange={event => updateParsedField('loadNumber', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Broker<input value={parsedPreview.brokerName} onChange={event => updateParsedField('brokerName', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Rate<input type="number" value={parsedPreview.rate} onChange={event => updateParsedField('rate', Number(event.target.value))} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Commodity<input value={parsedPreview.commodity} onChange={event => updateParsedField('commodity', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label></div>
            <div className="mt-5 border border-slate-800 bg-slate-950"><div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pickup stop</div><div className="grid gap-3 p-3 sm:grid-cols-2"><label className="text-[10px] text-slate-400">Facility<input value={parsedPreview.pickupFacility} onChange={event => updateParsedField('pickupFacility', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">City / state<input value={parsedPreview.pickupCity + ', ' + parsedPreview.pickupState} onChange={event => { const [city, state] = event.target.value.split(','); updateParsedField('pickupCity', city.trim()); updateParsedField('pickupState', (state || '').trim()); }} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Date<input type="date" value={parsedPreview.pickupDate} onChange={event => updateParsedField('pickupDate', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Time<input type="time" value={parsedPreview.pickupTime} onChange={event => updateParsedField('pickupTime', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label></div></div>
            <div className="mt-3 border border-slate-800 bg-slate-950"><div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivery stop</div><div className="grid gap-3 p-3 sm:grid-cols-2"><label className="text-[10px] text-slate-400">Facility<input value={parsedPreview.deliveryFacility} onChange={event => updateParsedField('deliveryFacility', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">City / state<input value={parsedPreview.deliveryCity + ', ' + parsedPreview.deliveryState} onChange={event => { const [city, state] = event.target.value.split(','); updateParsedField('deliveryCity', city.trim()); updateParsedField('deliveryState', (state || '').trim()); }} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Date<input type="date" value={parsedPreview.deliveryDate} onChange={event => updateParsedField('deliveryDate', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Time<input type="time" value={parsedPreview.deliveryTime} onChange={event => updateParsedField('deliveryTime', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label></div></div>
            <details className="mt-3 border border-slate-800 bg-slate-950"><summary className="cursor-pointer px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Structured JSON</summary><pre className="max-h-48 overflow-auto border-t border-slate-800 p-3 text-[10px] leading-relaxed text-slate-300">{JSON.stringify(parsedPreview, null, 2)}</pre></details>
            <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-slate-800 bg-slate-900 pt-4"><button onClick={() => setParsedPreview(null)} className="flex-1 border border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Discard</button><button onClick={confirmParsedLoad} className="inline-flex flex-1 items-center justify-center gap-2 bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"><Check size={14} />Confirm and save</button></div>
          </aside>
        </div>
      )}

      {/* Main Boards Tabs Navigation */}
      <div className="flex gap-2 border-b border-white/5 pb-px">
        {[
          { id: 'dispatch', label: 'Active Dispatch Board', count: activeCarriers.length, sub: 'Fleet control' },
          { id: 'unassigned', label: 'Unassigned Order Queue', count: unassignedLoads.length, sub: 'Unbooked loads' },
          { id: 'log', label: 'Master Load Log', count: loads.length, sub: 'All logs' },
        ].map(tab => {
          const active = activeBoardTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveBoardTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                active ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                active ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20' : 'bg-white/5 text-slate-500'
              }`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* BOARD VIEW 1: ACTIVE DISPATCH BOARD */}
      {activeBoardTab === 'dispatch' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCarriers.map(carrier => {
            // Find active load (not completed) for this carrier
            const carrierLoads = loads.filter(l => l.carrierId === carrier.id);
            const activeLoad = carrierLoads.find(l => !['delivered', 'pod_received', 'invoiced', 'paid'].includes(l.status));
            const completedCount = carrierLoads.length - (activeLoad ? 1 : 0);

            return (
              <div key={carrier.id} className="rounded-2xl border border-white/[0.05] bg-[#0E1524]/60 p-5 space-y-4 flex flex-col justify-between">
                
                {/* Carrier info */}
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Motive Telematics</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                      activeLoad ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                    }`}>
                      {activeLoad ? 'In Transit' : 'Available (Empty)'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1.5">{carrier.firstName} {carrier.lastName}</h3>
                  <p className="text-[10px] text-slate-500">
                    {EQUIPMENT_TYPE_LABELS[carrier.equipmentType]} · {carrier.truckMake} Plate: {carrier.truckPlate}
                  </p>
                </div>

                {/* Assigned Load Details */}
                {activeLoad ? (
                  <div 
                    onClick={() => router.push(`/sonex/loads/${activeLoad.id}`)}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/30 transition-all cursor-pointer space-y-2.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-amber-400">{activeLoad.loadNumber}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{activeLoad.status}</span>
                    </div>
                    <p className="text-xs text-white truncate">
                      {activeLoad.pickupCity}, {activeLoad.pickupState} → {activeLoad.deliveryCity}, {activeLoad.deliveryState}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>Rate: <span className="text-slate-300 font-mono font-semibold">{fmt$(activeLoad.rate)}</span></span>
                      <span>Deliv: {new Date(activeLoad.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-dashed border-white/5 bg-white/[0.01] space-y-3">
                    <p className="text-xs text-slate-600 text-center">No active load assigned.</p>
                    {unassignedLoads.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={quickAssignLoads[carrier.id] || ''}
                          onChange={e => setQuickAssignLoads({ ...quickAssignLoads, [carrier.id]: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-[#0E1524] px-3 py-2 text-[10px] font-bold text-slate-300 focus:outline-none"
                        >
                          <option value="">-- Select Unassigned Load --</option>
                          {unassignedLoads.map(ul => (
                            <option key={ul.id} value={ul.id} className="bg-[#050B18]">
                              {ul.loadNumber} ({ul.pickupCity} → {ul.deliveryCity}) - {fmt$(ul.rate)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleQuickAssign(carrier.id)}
                          disabled={!quickAssignLoads[carrier.id]}
                          className="w-full py-1.5 bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 transition-all"
                        >
                          Assign Selected Load
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-700 text-center">Unassigned order queue is empty.</p>
                    )}
                  </div>
                )}

                {/* Footer specs */}
                <div className="flex justify-between items-center text-[9px] text-slate-500 pt-2 border-t border-white/5 font-semibold">
                  <span>HOS: 14h active clock</span>
                  <span>{completedCount} Completed loads</span>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* BOARD VIEW 2: UNASSIGNED ORDER QUEUE */}
      {activeBoardTab === 'unassigned' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Queue List */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Unassigned Loads Pipeline</h3>
            {unassignedLoads.length === 0 ? (
              <div className="glass-card p-10 text-center space-y-2">
                <Package size={32} className="mx-auto text-slate-700" />
                <p className="text-sm text-slate-500">Unassigned load queue is empty.</p>
                <p className="text-xs text-slate-600">All booked loads have been successfully assigned to active carriers.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedLoads.map(load => (
                  <div key={load.id} className="rounded-2xl border border-white/[0.05] bg-[#0E1524]/60 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{load.loadNumber}</span>
                        <span className="text-[10px] text-slate-500">· {load.commodity}</span>
                      </div>
                      <p className="text-xs text-white leading-snug truncate">
                        {load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Pickup: {fmtDate(load.pickupDate)} · {load.miles.toLocaleString()} mi
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="font-mono text-xs font-bold text-white">{fmt$(load.rate)}</p>
                        <p className="text-[9px] text-slate-500">Broker: {load.brokerName}</p>
                      </div>

                      {/* Dropdown to assign carrier */}
                      <div className="flex gap-2">
                        <select
                          onChange={e => {
                            if (e.target.value) {
                              const fee = carriers.find(c => c.id === e.target.value)?.dispatchFeePercent ?? 10;
                              updateLoad(load.id, { carrierId: e.target.value, dispatchFeePercent: fee }).then(() => {
                                toast.success('✓ Load assigned!');
                                reloadData();
                              });
                            }
                          }}
                          className="rounded-lg border border-white/10 bg-[#080B14] px-2.5 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none"
                        >
                          <option value="">-- Assign Carrier --</option>
                          {activeCarriers.map(ac => (
                            <option key={ac.id} value={ac.id}>
                              {ac.firstName} {ac.lastName}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete load ${load.loadNumber}?`)) {
                              try {
                                await deleteLoad(load.id);
                                toast.success('Load deleted successfully');
                                reloadData();
                              } catch (err) {
                                toast.error('Failed to delete load');
                              }
                            }
                          }}
                          className="p-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-colors"
                          title="Delete Load"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          onClick={() => router.push(`/sonex/loads/${load.id}`)}
                          className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                          title="Edit"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Drag-and-drop OCR Parser Sidebar */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">OCR Load Creator (TruckGPT)</h3>
            <div 
              onClick={() => aiFileRef.current?.click()}
              className="border border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.02] hover:border-amber-500/30 transition-all space-y-4"
            >
              {scanning ? (
                <div className="space-y-2 py-4">
                  <Loader2 className="animate-spin text-amber-500 mx-auto" size={24} />
                  <p className="text-xs font-bold text-white">{scanStep}</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center">
                    <UploadCloud size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold">Import Rate Confirmation</p>
                    <p className="text-slate-500 text-[10px] mt-1">Upload broker order PDF or image for instant automated load creation</p>
                  </div>
                  <span className="text-[9px] text-amber-500/80 bg-amber-500/10 px-3 py-1 rounded-full font-bold tracking-wider uppercase border border-amber-500/10">
                    Parse Document
                  </span>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-[#0E1524]/60 p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <FileText size={13} className="text-amber-500" />
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">DT Automations Guide</span>
              </div>
              <p className="text-slate-500 text-[10px] leading-relaxed">
                When you drag and drop a Rate Confirmation document:
                <br />1. DataTruck OCR parses route stops, pickup dates, broker contacts, commodity descriptions, and rate payouts.
                <br />2. The load is created in under 15 seconds and appended to the <strong>Unassigned Queue</strong>.
                <br />3. Assign it to any available carrier immediately using the dropdown selector.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* BOARD VIEW 3: MASTER LOAD LOG (TABULAR) */}
      {activeBoardTab === 'log' && (
        <div className="space-y-4">
          
          {/* Filters Row */}
          <div className="flex gap-3 flex-wrap">
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

          {/* Status filter tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] pb-0">
            {['all', ...LOAD_STATUS_ORDER].map(s => {
              const count = s === 'all' ? loads.length : loads.filter(l => l.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusTab(s as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-bold whitespace-nowrap border-b-2 -mb-px transition-all ${
                    statusTab === s
                      ? 'text-amber-400 border-amber-400'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  {s === 'all' ? 'All' : LOAD_STATUS_LABELS[s as LoadStatus] || s}
                  {count > 0 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      statusTab === s ? 'bg-amber-500/30 text-amber-300' : 'bg-white/[0.06] text-slate-500'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tabular Output */}
          <div className="glass-card overflow-hidden">
            {filteredLoads.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={40} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No loads found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-white/[0.06]">
                    <tr>
                      {['Load #', 'Carrier', 'Broker', 'Route', 'Date', 'Rate', 'Fee', 'Status', ''].map(h => (
                        <th key={h} className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredLoads.map(load => (
                      <tr key={load.id}
                        onClick={() => router.push(`/sonex/loads/${load.id}`)}
                        className="table-row-hover cursor-pointer group">
                        <td className="px-4 py-3.5 font-mono text-xs text-amber-400 font-semibold">{load.loadNumber}</td>
                        <td className="px-4 py-3.5 text-slate-300 text-xs">
                          {carrierMap.get(load.carrierId) ?? '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs max-w-[120px] truncate">{load.brokerName}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          {load.pickupState} → {load.deliveryState}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">
                          {fmtDate(load.pickupDate)}
                        </td>
                        <td className="px-4 py-3.5 text-white font-semibold text-xs font-mono">{fmt$(load.rate)}</td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs font-mono">{fmt$(load.dispatchFeeAmount)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[load.status] || 'text-slate-400'}`}>
                            {LOAD_STATUS_LABELS[load.status] || load.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete load ${load.loadNumber}?`)) {
                                  try {
                                    await deleteLoad(load.id);
                                    toast.success('Load deleted successfully');
                                    reloadData();
                                  } catch (err) {
                                    toast.error('Failed to delete load');
                                  }
                                }
                              }}
                              className="p-1 rounded text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete Load"
                            >
                              <Trash2 size={13} />
                            </button>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-amber-400 transition-colors cursor-pointer" onClick={() => router.push(`/sonex/loads/${load.id}`)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showNew && (
        <NewLoadModal carriers={carriers} onClose={() => setShowNew(false)} onSaved={reloadData} />
      )}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
