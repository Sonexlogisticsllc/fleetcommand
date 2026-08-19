'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { uploadFile } from '@/lib/storageUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<LoadStatus, string> = {
  booked: 'bg-slate-100 text-slate-700 border-slate-200',
  dispatched: 'bg-blue-50 text-blue-800 border-blue-200',
  in_transit: 'bg-amber-50 text-amber-800 border-amber-200',
  delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  pod_received: 'bg-teal-50 text-teal-800 border-teal-200',
  invoiced: 'bg-violet-50 text-violet-800 border-violet-200',
  paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ParsedPreview = {
  documentType: 'rate_confirmation' | 'bol';
  engine: 'google_document_ai' | 'local_text_review';
  loadNumber: string;
  confidenceScore: number;
  fieldConfidence: Record<string, number>;
  brokerName: string; brokerContact: string; brokerPhone: string; brokerEmail: string; brokerMC: string;
  pickupFacility: string; pickupAddress: string; pickupCity: string; pickupState: string; pickupZip: string; pickupDate: string; pickupTime: string; pickupApptNumber: string;
  deliveryFacility: string; deliveryAddress: string; deliveryCity: string; deliveryState: string; deliveryZip: string; deliveryDate: string; deliveryTime: string; deliveryApptNumber: string;
  commodity: string; weight: number; miles: number; rate: number; notes: string;
  reviewRequired: boolean;
  validationIssues: string[];
};

const LOAD_VIEW_TABS = [
  { id: 'all', label: 'All Loads', count: (loads: SonexLoad[]) => loads.length },
  { id: 'upcoming', label: 'Upcoming Loads', count: (loads: SonexLoad[]) => loads.filter(load => load.status === 'booked').length },
  { id: 'dispatched', label: 'Dispatched', count: (loads: SonexLoad[]) => loads.filter(load => load.status === 'dispatched').length },
  { id: 'in_transit', label: 'In-Transit', count: (loads: SonexLoad[]) => loads.filter(load => load.status === 'in_transit').length },
  { id: 'delivered', label: 'Delivered', count: (loads: SonexLoad[]) => loads.filter(load => ['delivered', 'pod_received'].includes(load.status)).length },
  { id: 'unpaid', label: 'Unpaid', count: (loads: SonexLoad[]) => loads.filter(load => load.status === 'invoiced').length },
  { id: 'trips', label: 'Trips', count: (loads: SonexLoad[]) => loads.filter(load => Boolean(load.carrierId)).length },
  { id: 'ltl', label: 'LTL', count: (loads: SonexLoad[]) => loads.filter(load => /ltl/i.test(load.notes || '')).length },
] as const;

type LoadViewTab = typeof LOAD_VIEW_TABS[number]['id'];

// ─── Section Helper ───────────────────────────────────────────────────────────

const Section = ({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) => (
  <div>
    <div className="mb-3 border-b border-slate-200 pb-2 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
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
  onAiParse: (file: File, documentType: 'rate_confirmation' | 'bol') => Promise<boolean>;
}

function NewLoadModal({ carriers, onClose, onSaved, onAiParse }: NewLoadModalProps) {
  const rateConRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [aiDocumentType, setAiDocumentType] = useState<'rate_confirmation' | 'bol'>('rate_confirmation');
  const [aiParsing, setAiParsing] = useState(false);
  const [rateConFile, setRateConFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    carrierId: '',
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
      toast.error('Select a carrier and fill in the required dates and rate.');
      return;
    }
    const created = await addLoad({
      ...form,
      dispatchFeePercent: feePercent,
      ratConUrl: undefined,
      bolUrl: undefined,
      podUrl: undefined,
    });
    if (rateConFile) {
      const uploaded = await uploadFile(rateConFile, 'load-documents', `${created.id}/ratConUrl`);
      await updateLoad(created.id, { ratConUrl: uploaded.url });
    }
    toast.success('Load created successfully!');
    onSaved();
    onClose();
  };

  const input = (label: string, key: string, type = 'text', placeholder = '', required = false) => (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );

  const handleAiFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAiParsing(true);
    const succeeded = await onAiParse(file, aiDocumentType);
    setAiParsing(false);
    if (succeeded) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[700px] flex-col border-l border-slate-200 bg-[#f7f9fc] shadow-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <div className="flex items-center gap-2"><span className="inline-flex size-7 items-center justify-center bg-blue-600 text-white"><Plus size={16} /></span><h3 className="text-lg font-bold text-slate-950">New Load</h3></div>
            <p className="mt-1 text-xs text-slate-500">Create from a broker document or enter the load manually.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" title="Close new load">
            <X size={18} />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 bg-white px-6 pb-4">
          {([
            ['ai', 'AI parse document'],
            ['manual', 'Manual entry'],
          ] as const).map(([id, label]) => <button key={id} onClick={() => setCreationMode(id)} className={`h-10 border text-xs font-semibold transition-colors ${creationMode === id ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}>{label}</button>)}
          <input ref={aiFileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleAiFile} />
          <input ref={rateConRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={event => { const file = event.target.files?.[0] ?? null; setRateConFile(file); if (file) toast.success(`${file.name} attached for this manual load`); event.target.value = ''; }} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {creationMode === 'ai' ? (
            <div className="mx-auto max-w-xl space-y-5 py-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4"><p className="text-sm font-semibold text-slate-900">Create a load from paperwork</p><p className="mt-1 text-xs leading-5 text-slate-600">Upload a rate confirmation or BOL. Sonex extracts the load fields into an editable review screen before anything is saved.</p></div>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAiDocumentType('rate_confirmation')} className={`border p-3 text-left ${aiDocumentType === 'rate_confirmation' ? 'border-violet-600 bg-violet-50 ring-1 ring-violet-600' : 'border-slate-200 bg-white hover:border-violet-300'}`}><p className="text-xs font-semibold text-slate-900">Rate confirmation</p><p className="mt-1 text-[11px] text-slate-500">Broker tender or rate con</p></button><button type="button" onClick={() => setAiDocumentType('bol')} className={`border p-3 text-left ${aiDocumentType === 'bol' ? 'border-violet-600 bg-violet-50 ring-1 ring-violet-600' : 'border-slate-200 bg-white hover:border-violet-300'}`}><p className="text-xs font-semibold text-slate-900">Bill of lading</p><p className="mt-1 text-[11px] text-slate-500">Shipment or BOL paperwork</p></button></div>
              <button type="button" disabled={aiParsing} onClick={() => aiFileRef.current?.click()} className="flex min-h-56 w-full flex-col items-center justify-center border-2 border-dashed border-blue-200 bg-white px-6 text-center transition-colors hover:border-blue-500 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"><span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">{aiParsing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}</span><span className="text-sm font-semibold text-slate-900">{aiParsing ? 'Reading document...' : 'Choose a document to parse'}</span><span className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, or WEBP up to 15 MB</span><span className="mt-4 border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Select file</span></button>
              <p className="text-center text-[11px] text-slate-500">You will review and edit every extracted field before the load is created.</p>
            </div>
          ) : (<div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Carrier Assignment
            </label>
            <select
              value={form.carrierId}
              onChange={e => set('carrierId', e.target.value)}
              className="h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select carrier</option>
              {carriers.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} — {EQUIPMENT_TYPE_LABELS[c.equipmentType]} ({c.dispatchFeePercent}% fee)
                </option>
              ))}
            </select>
          </div>

          <div className="border border-dashed border-slate-300 bg-white p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-800">Source document <span className="font-normal text-slate-500">(optional)</span></p><p className="mt-1 text-[10px] text-slate-500">Attach paperwork without parsing it.</p></div><button type="button" onClick={() => rateConRef.current?.click()} className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700"><UploadCloud size={13} /> Choose file</button></div>{rateConFile && <p className="mt-2 truncate text-[10px] text-emerald-600">{rateConFile.name}</p>}
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
              <p className="text-slate-400 text-sm py-2">{selectedCarrier ? `${selectedCarrier.firstName} ${selectedCarrier.lastName}` : 'Select a carrier'}</p>
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
              className="w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
              placeholder="Any special instructions or notes about this load…"
            />
          </div>
          </div>)}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
            Cancel
          </button>
          {creationMode === 'manual' && <button onClick={handleSave} className="inline-flex items-center gap-2 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
            <Check size={15} /> Create Load
          </button>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Loads Page Component ────────────────────────────────────────────────

export default function LoadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  
  // Tabs State
  const [activeBoardTab, setActiveBoardTab] = useState<'dispatch' | 'unassigned' | 'log'>('dispatch');

  // Master Log State
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<LoadStatus | 'all'>('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [loadViewTab, setLoadViewTab] = useState<LoadViewTab>('all');
  
  // Modals and parser review state
  const [showNew, setShowNew] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview | null>(null);
  const [parsedCarrierId, setParsedCarrierId] = useState('');

  // Dynamic quick-assign load selections for carriers
  const [quickAssignLoads, setQuickAssignLoads] = useState<Record<string, string>>({});
  const [denseMode, setDenseMode] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({ broker: true, route: true, dates: true, rate: true, fee: true, status: true });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());

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
  const pageCount = Math.max(1, Math.ceil(filteredLoads.length / pageSize));
  const pagedLoads = filteredLoads.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [search, statusTab, carrierFilter, loadViewTab]);

  const toggleLoadSelection = (loadId: string) => {
    setSelectedLoadIds(current => {
      const next = new Set(current);
      if (next.has(loadId)) next.delete(loadId); else next.add(loadId);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedLoadIds(current => {
      const next = new Set(current);
      const allSelected = pagedLoads.length > 0 && pagedLoads.every(load => next.has(load.id));
      pagedLoads.forEach(load => allSelected ? next.delete(load.id) : next.add(load.id));
      return next;
    });
  };

  const deleteSelectedLoads = async () => {
    if (!selectedLoadIds.size || !confirm(`Delete ${selectedLoadIds.size} selected load${selectedLoadIds.size === 1 ? '' : 's'}?`)) return;
    await Promise.all(Array.from(selectedLoadIds).map(id => deleteLoad(id)));
    setSelectedLoadIds(new Set());
    toast.success('Selected loads deleted');
    reloadData();
  };

  const selectLoadView = (view: LoadViewTab) => {
    setLoadViewTab(view);
    setActiveBoardTab('log');
    if (view === 'all' || view === 'trips' || view === 'ltl') setStatusTab('all');
    else if (view === 'upcoming') setStatusTab('booked');
    else if (view === 'unpaid') setStatusTab('invoiced');
    else if (view === 'delivered') setStatusTab('delivered');
    else setStatusTab(view);
  };

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

  const parseAiFile = async (file: File, documentType: 'rate_confirmation' | 'bol'): Promise<boolean> => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Parser files must be 15 MB or smaller.');
      return false;
    }
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('documentType', documentType);
      const res = await fetch('/api/parse-rc', {
        method: 'POST',
        body: fd
      });
      const payload = await res.text();
      let json: { success?: boolean; error?: string; data?: ParsedPreview } | null = null;
      try {
        json = JSON.parse(payload) as { success?: boolean; error?: string; data?: ParsedPreview };
      } catch {
        throw new Error(`Document parser returned an invalid response (${res.status}).`);
      }
      if (!res.ok || !json.success || !json.data) throw new Error(json.error || `Document parser failed (${res.status}).`);
      setParsedPreview(json.data);
      toast.success('Document parsed. Review the structured fields before saving.');
      return true;
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Document parser could not be reached.');
      return false;
    }
  };

  const confirmParsedLoad = async () => {
    if (!parsedPreview) return;
    if (!parsedCarrierId) {
      toast.error('Choose the carrier that will receive this load.');
      return;
    }
    try {
      const { confidenceScore, documentType, loadNumber, ...loadData } = parsedPreview;
      await addLoad({
        ...loadData,
        carrierId: parsedCarrierId,
        status: 'booked',
        dispatchFeePercent: 10,
        ratConUrl: undefined,
        bolUrl: undefined,
        podUrl: undefined,
        notes: (loadData.notes || '') + ' Parsed from ' + documentType + (loadNumber ? ' ' + loadNumber : '') + ' with confidence ' + confidenceScore,
      } as Parameters<typeof addLoad>[0]);
      setParsedPreview(null);
      setParsedCarrierId('');
      toast.success('Reviewed document saved and assigned to the selected carrier.');
      reloadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save parsed load.');
    }
  };

  const updateParsedField = <K extends keyof ParsedPreview>(key: K, value: ParsedPreview[K]) => {
    setParsedPreview(current => current ? { ...current, [key]: value } : current);
  };

  const exportLoads = () => {
    const rows = filteredLoads.map(load => [load.loadNumber, carrierMap.get(load.carrierId) ?? '', load.brokerName, `${load.pickupCity}, ${load.pickupState} to ${load.deliveryCity}, ${load.deliveryState}`, load.status, load.rate].join(','));
    const csv = ['Load,Carrier,Customer,Route,Status,Rate', ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sonex-loads.csv'; anchor.click(); URL.revokeObjectURL(url);
    toast.success('Load list exported');
  };

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowNew(true);
  }, [searchParams]);

  const closeNewLoad = () => {
    setShowNew(false);
    if (searchParams.get('new') === '1') router.replace('/sonex/loads');
  };

  return (
    <div className="mx-auto max-w-none space-y-3 bg-[#f2f5f9] p-4 text-slate-900 sm:p-5">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded border border-blue-200">SONEX DISPATCH</span>
            <h1 className="text-2xl font-black tracking-tight">Dispatch Control Center</h1>
          </div>
          <p className="text-slate-500 text-xs">Plan, assign, track, and settle every load from one workspace.</p>
        </div>
         <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-blue-600 px-4 py-2.5 text-xs font-bold uppercase text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus size={14} /> New Load
          </button>
        </div>
      </div>
      {parsedPreview && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button aria-label="Close extraction preview" onClick={() => setParsedPreview(null)} className="absolute inset-0 bg-slate-950/70" />
          <aside className="relative h-full w-full max-w-[650px] overflow-y-auto border-l border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-400">Bounded extraction preview</p><h2 className="mt-1 text-lg font-semibold">Review before saving</h2><p className="mt-1 text-xs text-slate-400">No load has been written yet. Edit any field, then confirm.</p></div><button onClick={() => setParsedPreview(null)} className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title="Close preview"><X size={17} /></button></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><div className="border border-slate-800 bg-slate-950 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Critical field confidence</p><p className="mt-1 font-mono text-xl font-bold text-emerald-400">{Math.round(parsedPreview.confidenceScore * 100)}%</p></div><div className="border border-slate-800 bg-slate-950 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Extraction engine</p><p className="mt-2 text-xs font-semibold uppercase text-slate-200">{parsedPreview.engine === 'google_document_ai' ? 'Google Document AI' : 'Local text review'}</p></div></div>
            {parsedPreview.validationIssues.length > 0 && <div className="mt-3 border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100"><p className="font-semibold">Review required before saving</p><ul className="mt-1 list-disc space-y-1 pl-4 text-amber-200">{parsedPreview.validationIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
            <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned carrier<select value={parsedCarrierId} onChange={event => setParsedCarrierId(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500"><option value="">Choose a carrier</option>{activeCarriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.firstName} {carrier.lastName}</option>)}</select></label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Load number<input value={parsedPreview.loadNumber} onChange={event => updateParsedField('loadNumber', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Broker<input value={parsedPreview.brokerName} onChange={event => updateParsedField('brokerName', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Rate<input type="number" value={parsedPreview.rate} onChange={event => updateParsedField('rate', Number(event.target.value))} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Commodity<input value={parsedPreview.commodity} onChange={event => updateParsedField('commodity', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label></div>
            <div className="mt-5 border border-slate-800 bg-slate-950"><div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pickup stop</div><div className="grid gap-3 p-3 sm:grid-cols-2"><label className="text-[10px] text-slate-400">Facility<input value={parsedPreview.pickupFacility} onChange={event => updateParsedField('pickupFacility', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">City / state<input value={parsedPreview.pickupCity + ', ' + parsedPreview.pickupState} onChange={event => { const [city, state] = event.target.value.split(','); updateParsedField('pickupCity', city.trim()); updateParsedField('pickupState', (state || '').trim()); }} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Date<input type="date" value={parsedPreview.pickupDate} onChange={event => updateParsedField('pickupDate', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Time<input type="time" value={parsedPreview.pickupTime} onChange={event => updateParsedField('pickupTime', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label></div></div>
            <div className="mt-3 border border-slate-800 bg-slate-950"><div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivery stop</div><div className="grid gap-3 p-3 sm:grid-cols-2"><label className="text-[10px] text-slate-400">Facility<input value={parsedPreview.deliveryFacility} onChange={event => updateParsedField('deliveryFacility', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">City / state<input value={parsedPreview.deliveryCity + ', ' + parsedPreview.deliveryState} onChange={event => { const [city, state] = event.target.value.split(','); updateParsedField('deliveryCity', city.trim()); updateParsedField('deliveryState', (state || '').trim()); }} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Date<input type="date" value={parsedPreview.deliveryDate} onChange={event => updateParsedField('deliveryDate', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label><label className="text-[10px] text-slate-400">Time<input type="time" value={parsedPreview.deliveryTime} onChange={event => updateParsedField('deliveryTime', event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-blue-500" /></label></div></div>
            <details className="mt-3 border border-slate-800 bg-slate-950"><summary className="cursor-pointer px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Structured JSON</summary><pre className="max-h-48 overflow-auto border-t border-slate-800 p-3 text-[10px] leading-relaxed text-slate-300">{JSON.stringify(parsedPreview, null, 2)}</pre></details>
            <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-slate-800 bg-slate-900 pt-4"><button onClick={() => setParsedPreview(null)} className="flex-1 border border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Discard</button><button onClick={confirmParsedLoad} className="inline-flex flex-1 items-center justify-center gap-2 bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"><Check size={14} />Confirm and save</button></div>
          </aside>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border border-slate-200 bg-white p-3">
        {LOAD_VIEW_TABS.map(view => (
          <button
            key={view.id}
            onClick={() => selectLoadView(view.id)}
            className={`inline-flex h-9 items-center gap-1.5 border px-3 text-xs font-medium transition-colors ${loadViewTab === view.id ? 'border-violet-700 bg-violet-700 text-white' : 'border-violet-700 text-slate-800 hover:bg-violet-50'}`}
          >
            {view.id !== 'all' && <span className="font-mono">({view.count(loads)})</span>}
            {view.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search loads, customers, routes" className="h-9 w-full border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500" /></div>
        <select value={carrierFilter} onChange={event => setCarrierFilter(event.target.value)} className="h-9 border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"><option value="all">All carriers</option>{carriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.firstName} {carrier.lastName}</option>)}</select>
        <button onClick={() => setActiveBoardTab('log')} className="inline-flex h-9 items-center gap-2 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-blue-500"><Filter size={14} /> Filter</button>
        <button onClick={exportLoads} className="h-9 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-blue-500">Export</button>
        <button onClick={() => { localStorage.setItem('sonex-load-view', JSON.stringify({ carrierFilter, statusTab })); toast.success('View saved'); }} className="h-9 border border-blue-100 bg-blue-50 px-3 text-xs font-medium text-blue-700">Save view</button>
        <button onClick={() => setDenseMode(value => !value)} className="h-9 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">Density: {denseMode ? 'compact' : 'comfortable'}</button>
        <button onClick={() => setShowColumns(value => !value)} className="h-9 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">Columns</button>
        {selectedLoadIds.size > 0 && <button onClick={deleteSelectedLoads} className="h-9 border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100">Bulk actions ({selectedLoadIds.size})</button>}
      </div>
      {showColumns && <div className="flex flex-wrap items-center gap-4 border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><span className="font-semibold">Visible columns</span>{(Object.keys(visibleColumns) as Array<keyof typeof visibleColumns>).map(column => <label key={column} className="inline-flex items-center gap-1.5 capitalize"><input type="checkbox" checked={visibleColumns[column]} onChange={event => setVisibleColumns(current => ({ ...current, [column]: event.target.checked }))} />{column}</label>)}</div>}

      {/* Main Boards Tabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {[
          { id: 'dispatch', label: 'Active Dispatch Board', count: activeCarriers.length, sub: 'Fleet control' },
          { id: 'log', label: 'Master Load Log', count: loads.length, sub: 'All logs' },
        ].map(tab => {
          const active = activeBoardTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveBoardTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                active ? 'border border-blue-200 bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* BOARD VIEW 1: ACTIVE DISPATCH BOARD */}
      {activeBoardTab === 'dispatch' && (
        <>
        <div className="overflow-x-auto border border-slate-800 bg-slate-900">
          <table className="w-full min-w-[980px] text-left">
            <thead className="border-b border-slate-800 bg-slate-950"><tr className="h-7 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"><th className="px-2 py-1">Driver / Unit</th><th className="px-2 py-1">Load</th><th className="px-2 py-1">Route</th><th className="px-2 py-1">Pickup</th><th className="px-2 py-1">Delivery</th><th className="px-2 py-1 text-right">Rate</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {activeCarriers.map(carrier => {
                const activeLoad = loads.filter(load => load.carrierId === carrier.id).find(load => !['delivered', 'pod_received', 'invoiced', 'paid'].includes(load.status));
                return <tr key={carrier.id} className="h-7 cursor-pointer text-[11px] hover:bg-slate-800/70" onClick={() => activeLoad && router.push(`/sonex/loads/${activeLoad.id}`)}>
                  <td className="px-2 py-1"><div className="font-medium text-slate-200">{carrier.firstName} {carrier.lastName}</div><div className="font-mono text-[10px] text-slate-500">{carrier.truckMake} · {carrier.truckPlate}</div></td>
                  <td className="px-2 py-1 font-mono font-semibold text-sky-400">{activeLoad?.loadNumber ?? '—'}</td>
                  <td className="max-w-[300px] truncate px-2 py-1 text-slate-300">{activeLoad ? `${activeLoad.pickupCity}, ${activeLoad.pickupState} → ${activeLoad.deliveryCity}, ${activeLoad.deliveryState}` : 'No active assignment'}</td>
                  <td className="px-2 py-1 font-mono text-slate-400">{activeLoad ? fmtDate(activeLoad.pickupDate) : '—'}</td>
                  <td className="px-2 py-1 font-mono text-slate-400">{activeLoad ? fmtDate(activeLoad.deliveryDate) : '—'}</td>
                  <td className="px-2 py-1 text-right font-mono text-emerald-400">{activeLoad ? fmt$(activeLoad.rate) : '—'}</td>
                  <td className="px-2 py-1"><span className={`inline-flex border px-1.5 py-0.5 text-[10px] font-bold ${activeLoad ? STATUS_BADGE[activeLoad.status] : 'border-slate-200 bg-slate-100 text-slate-700'}`}>{activeLoad ? LOAD_STATUS_LABELS[activeLoad.status] : 'UNASSIGNED'}</span></td>
                  <td className="px-2 py-1"><ChevronRight size={14} className="text-slate-500" /></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Sonex Operations</span>
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
        </>
      )}

      {/* BOARD VIEW 2: UNASSIGNED ORDER QUEUE */}
      {activeBoardTab === 'unassigned' && (
        <div className="space-y-3">
          
          {/* Queue List */}
          <div className="space-y-3">
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
                    <tr className={denseMode ? 'h-7' : 'h-14'}>
                      <th className="w-9 px-2 py-2"><input type="checkbox" aria-label="Select visible loads" checked={pagedLoads.length > 0 && pagedLoads.every(load => selectedLoadIds.has(load.id))} onChange={togglePageSelection} /></th>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Load #</th>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Carrier</th>
                      {visibleColumns.broker && <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Broker</th>}
                      {visibleColumns.route && <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Route</th>}
                      {visibleColumns.dates && <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Date</th>}
                      {visibleColumns.rate && <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Rate</th>}
                      {visibleColumns.fee && <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Fee</th>}
                      {visibleColumns.status && <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">Status</th>}
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {pagedLoads.map(load => (
                      <tr key={load.id}
                        onClick={() => router.push(`/sonex/loads/${load.id}`)}
                        className={`table-row-hover cursor-pointer group ${denseMode ? 'h-7' : 'h-14'}`}>
                        <td className="px-2 py-2" onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${load.loadNumber}`} checked={selectedLoadIds.has(load.id)} onChange={() => toggleLoadSelection(load.id)} /></td>
                        <td className="px-4 py-2 font-mono text-xs font-semibold text-blue-700">{load.loadNumber}</td>
                        <td className="px-4 py-2 text-xs text-slate-700">
                          {carrierMap.get(load.carrierId) ?? '—'}
                        </td>
                        {visibleColumns.broker && <td className="max-w-[120px] truncate px-4 py-2 text-xs text-slate-700">{load.brokerName}</td>}
                        {visibleColumns.route && <td className="px-4 py-2 text-xs text-slate-700">
                          {load.pickupState} → {load.deliveryState}
                        </td>}
                        {visibleColumns.dates && <td className="px-4 py-2 text-xs text-slate-600">
                          {fmtDate(load.pickupDate)}
                        </td>}
                        {visibleColumns.rate && <td className="px-4 py-2 font-mono text-xs font-semibold text-emerald-600">{fmt$(load.rate)}</td>}
                        {visibleColumns.fee && <td className="px-4 py-2 font-mono text-xs text-slate-600">{fmt$(load.dispatchFeeAmount)}</td>}
                        {visibleColumns.status && <td className="px-4 py-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[load.status] || 'text-slate-400'}`}>
                            {LOAD_STATUS_LABELS[load.status] || load.status}
                          </span>
                        </td>}
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
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
                <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500"><span>{filteredLoads.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredLoads.length)} of ${filteredLoads.length}` : '0 of 0'} loads</span><div className="flex items-center gap-2"><label className="flex items-center gap-1">Rows<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="border border-slate-200 bg-white px-1.5 py-1 text-[11px]"><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><button disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="border border-slate-200 px-2 py-1 disabled:opacity-40">‹</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))} className="border border-slate-200 px-2 py-1 disabled:opacity-40">›</button></div></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showNew && (
        <NewLoadModal carriers={carriers} onClose={closeNewLoad} onSaved={reloadData} onAiParse={parseAiFile} />
      )}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
