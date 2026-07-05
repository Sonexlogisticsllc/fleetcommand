'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Check, DollarSign, ExternalLink, FileText,
  MapPin, Package, Save, Truck, Upload, RefreshCw, AlertTriangle,
  User, ShieldCheck, Mail, Phone, Info, Eye, Clock, Activity, CheckSquare,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CheckinTimeline } from '@/components/sonex/CheckinTimeline';
import { LoadStatusBadge, StatusPipeline } from '@/components/sonex/StatusPipeline';
import {
  addCheckin, getCarrier, getCarriers, getCheckins, getLoad,
  updateLoad, deleteLoad,
} from '@/lib/sonexStore';
import { CheckinEvent, LoadStatus, SonexCarrier, SonexLoad, SonexLoadCheckin, computeLoadFinancials } from '@/lib/sonexTypes';
import { uploadFile } from '@/lib/storageUtils';
import {
  CHECKIN_EVENT_LABELS,
  EQUIPMENT_TYPE_LABELS,
  LOAD_STATUS_LABELS,
  LOAD_STATUS_ORDER,
} from '@/lib/sonexTypes';

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DocumentField = 'ratConUrl' | 'bolUrl' | 'podUrl';

const DOCS: Array<{ field: DocumentField; label: string; hint: string }> = [
  { field: 'ratConUrl', label: 'Rate Confirmation', hint: 'Broker rate con' },
  { field: 'bolUrl', label: 'BOL (Bill of Lading)', hint: 'Proof of loading' },
  { field: 'podUrl', label: 'POD (Proof of Delivery)', hint: 'Signed proof of delivery' },
];

const CHECKIN_EVENTS: CheckinEvent[] = ['arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered'];

const openDocument = (url: string) => {
  if (!url) return;
  if (url.startsWith('data:')) {
    const w = window.open();
    if (w) {
      w.document.write(`
        <html>
          <head>
            <title>View Document</title>
            <style>
              body { margin:0; background:#0B0F19; display:flex; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif; color:#fff; }
              embed, img { max-width:100%; max-height:100vh; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            </style>
          </head>
          <body>
            ${url.includes('pdf') 
              ? `<embed src="${url}" type="application/pdf" style="width:100%; height:100vh;" />`
              : `<img src="${url}" alt="Document Preview" />`
            }
          </body>
        </html>
      `);
      w.document.close();
    }
  } else {
    window.open(url, '_blank');
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40"
      />
    </label>
  );
}

function RouteMapWidget({ load }: { load: SonexLoad }) {
  const steps = ['booked', 'dispatched', 'in_transit', 'delivered', 'pod_received'];
  const currentIdx = steps.indexOf(load.status);
  const progressPercent = currentIdx === -1 ? 0 : (currentIdx / (steps.length - 1)) * 100;

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 space-y-4 relative overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live GPS Tracking Route</h3>
          <p className="text-xs text-slate-500 mt-0.5">{load.miles.toLocaleString()} miles transit distance</p>
        </div>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
          <Activity size={10} /> GPS Active
        </span>
      </div>

      {/* Visual route line */}
      <div className="h-28 rounded-xl border border-white/[0.04] bg-[#030712] relative flex flex-col justify-center px-6">
        <div className="h-1 w-full bg-slate-800 rounded-full relative">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
          
          {/* Pickup Marker */}
          <div className="absolute left-0 -top-1.5 w-4.5 h-4.5 rounded-full bg-amber-500 border-4 border-[#030712] flex items-center justify-center" title="Origin" />
          
          {/* Delivery Marker */}
          <div className="absolute right-0 -top-1.5 w-4.5 h-4.5 rounded-full bg-emerald-500 border-4 border-[#030712] flex items-center justify-center" title="Destination" />

          {/* Moving Truck */}
          {progressPercent > 0 && progressPercent < 100 && (
            <div 
              className="absolute -top-3 w-8 h-8 rounded-full bg-amber-400 text-black border border-amber-300 flex items-center justify-center shadow-lg shadow-amber-400/20 transition-all duration-1000 animate-bounce"
              style={{ left: `calc(${progressPercent}% - 16px)` }}
            >
              <Truck size={14} />
            </div>
          )}
        </div>

        {/* City Route Labels */}
        <div className="flex justify-between items-center mt-6 text-xs">
          <div className="text-left">
            <p className="font-semibold text-white">{load.pickupCity}, {load.pickupState}</p>
            <p className="text-[10px] text-slate-500">Origin Facility</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-white">{load.deliveryCity}, {load.deliveryState}</p>
            <p className="text-[10px] text-slate-500">Consignee Destination</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function LoadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loadId = params.id as string;

  const [load, setLoad] = useState<SonexLoad | null>(null);
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [checkins, setCheckins] = useState<SonexLoadCheckin[]>([]);
  const [carrier, setCarrier] = useState<SonexCarrier | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'financials' | 'documents'>('overview');

  // Document verification states (Mock status toggling for UI features)
  const [docVerifications, setDocVerifications] = useState<Record<DocumentField, 'pending' | 'approved' | 'rejected'>>({
    ratConUrl: 'approved',
    bolUrl: 'pending',
    podUrl: 'pending',
  });

  const [uploadingField, setUploadingField] = useState<DocumentField | null>(null);

  const reload = async () => {
    const found = await getLoad(loadId);
    if (!found) {
      router.push('/sonex/loads');
      return;
    }
    setLoad(found);
    
    const c = found.carrierId ? await getCarrier(found.carrierId) : null;
    setCarrier(c || null);

    const carriersData = await getCarriers();
    setCarriers(carriersData);

    const checkinsData = await getCheckins(loadId);
    setCheckins(checkinsData);
  };

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 8000);
    return () => clearInterval(interval);
  }, [loadId]);

  const loggedEvents = useMemo(() => new Set(checkins.map(c => c.event)), [checkins]);
  const financialPreview = useMemo(() => {
    if (!load) return { dispatchFeeAmount: 0, carrierNet: 0, ratePerMile: 0 };
    return computeLoadFinancials(Number(load.rate), Number(load.miles), Number(load.dispatchFeePercent));
  }, [load?.rate, load?.miles, load?.dispatchFeePercent]);

  if (!load) {
    return (
      <div className="p-8 flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-500 animate-pulse">Loading load...</div>
      </div>
    );
  }

  const patch = async (data: Partial<SonexLoad>, message = 'Load updated') => {
    const updated = await updateLoad(load.id, data);
    if (!updated) return;
    setLoad(updated);
    if (data.carrierId !== undefined) {
      const c = data.carrierId ? await getCarrier(data.carrierId) : null;
      setCarrier(c || null);
    }
    toast.success(message);
  };

  const set = <K extends keyof SonexLoad>(key: K, value: SonexLoad[K]) => {
    setLoad(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const saveEditableFields = () => {
    patch({
      carrierId: load.carrierId,
      brokerName: load.brokerName,
      brokerContact: load.brokerContact,
      brokerPhone: load.brokerPhone,
      pickupDate: load.pickupDate,
      pickupTime: load.pickupTime,
      deliveryDate: load.deliveryDate,
      deliveryTime: load.deliveryTime,
      commodity: load.commodity,
      miles: Number(load.miles),
      rate: Number(load.rate),
      dispatchFeePercent: Number(load.dispatchFeePercent),
      notes: load.notes,
    }, 'Load saved');
  };

  const handleUpload = async (field: DocumentField, file: File) => {
    setUploadingField(field);
    try {
      const result = await uploadFile(file, 'load-documents', `${load.id}/${field}`);
      await patch({ [field]: result.url } as Partial<SonexLoad>, 'Document uploaded');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error?.message || error || 'Unknown error'}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleCheckin = async (event: CheckinEvent) => {
    await addCheckin({
      loadId: load.id,
      event,
      timestamp: new Date().toISOString(),
      notes: '',
      loggedBy: 'admin',
    });
    if (event === 'delivered' && LOAD_STATUS_ORDER.indexOf(load.status) < LOAD_STATUS_ORDER.indexOf('delivered')) {
      await updateLoad(load.id, { status: 'delivered' });
    }
    await reload();
    toast.success(CHECKIN_EVENT_LABELS[event]);
  };

  const toggleDocVerification = (field: DocumentField) => {
    setDocVerifications(prev => {
      const next: Record<DocumentField, 'pending' | 'approved' | 'rejected'> = {
        ...prev,
        [field]: prev[field] === 'pending' ? 'approved' : prev[field] === 'approved' ? 'rejected' : 'pending'
      };
      toast.success(`Verification status updated to: ${next[field].toUpperCase()}`);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#050B18] p-6 animate-fade-in text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Navigation & Actions Header */}
        <div className="flex items-center justify-between">
          <Link href="/sonex/loads" className="flex w-fit items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors hover:text-slate-300">
            <ArrowLeft size={14} /> Back to Fleet Control
          </Link>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to delete load ${load.loadNumber}? This action cannot be undone.`)) {
                  try {
                    await deleteLoad(load.id);
                    toast.success('Load deleted successfully');
                    router.push('/sonex/loads');
                  } catch (err) {
                    toast.error('Failed to delete load');
                  }
                }
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-2.5 text-xs font-black tracking-wide text-red-500 transition-all hover:bg-red-500/20 active:scale-95 uppercase"
            >
              <Trash2 size={14} /> Delete Load
            </button>
            <button
              onClick={saveEditableFields}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black tracking-wide text-black transition-all hover:bg-amber-400 active:scale-95 uppercase"
            >
              <Save size={14} /> Save Configuration
            </button>
          </div>
        </div>

        {/* Motive Branding Header & Badge Block */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">Motive Control</span>
              <h1 className="text-3xl font-black tracking-tight">{load.loadNumber}</h1>
              <LoadStatusBadge status={load.status} />
            </div>
            <p className="text-sm text-slate-400 leading-snug">
              {load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}
            </p>
          </div>
          
          {/* Status quick select */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Motive Dispatch Status</span>
            <select
              value={load.status}
              onChange={e => patch({ status: e.target.value as LoadStatus }, 'Motive Status update success')}
              className="rounded-xl border border-white/10 bg-[#0E1524] px-4 py-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500/40"
            >
              {LOAD_STATUS_ORDER.map(status => (
                <option key={status} value={status} className="bg-[#0D1421]">{LOAD_STATUS_LABELS[status] || status}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Motive Pipeline Bar */}
        <div className="glass-card p-5">
          <StatusPipeline currentStatus={load.status} />
        </div>

        {/* Main Work Area (Split Layout: Navigation + Tabs Content vs Sidebar) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Interactive Workspace Area (Tabs + Panels) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tabs Control */}
            <div className="flex border-b border-white/5 gap-1 overflow-x-auto pb-px">
              {[
                { id: 'overview', label: 'Overview & GPS', icon: Activity },
                { id: 'details', label: 'Routes & Cargo', icon: Package },
                { id: 'financials', label: 'Settlements & Pay', icon: DollarSign },
                { id: 'documents', label: 'Compliance Vault', icon: FileText },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3.5 border-b-2 font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                      active ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB PANEL 1: OVERVIEW & MAP */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Visual Tracker Map */}
                <RouteMapWidget load={load} />

                {/* Dispatch & Operations summary */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                    <Info size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fleet Operations Notes</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Assigned Driver</p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {carrier ? `${carrier.firstName} ${carrier.lastName}` : 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Motive Fleet Equipment</p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {carrier ? EQUIPMENT_TYPE_LABELS[carrier.equipmentType] : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Dispatch Instructions</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed bg-white/[0.01] border border-white/[0.04] p-3.5 rounded-xl">
                      {load.notes || 'No dispatch notes recorded.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB PANEL 2: DETAILED SCHEDULES */}
            {activeTab === 'details' && (
              <div className="glass-card p-6 space-y-6">
                
                {/* Routing Addresses */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <MapPin size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">FACILITY ADDRESSES</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500/80">Pickup Facility</p>
                      <input 
                        type="text" 
                        value={load.pickupFacility} 
                        onChange={e => set('pickupFacility', e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-semibold text-white focus:outline-none focus:border-amber-500" 
                        placeholder="Facility Name"
                      />
                      <input 
                        type="text" 
                        value={load.pickupAddress} 
                        onChange={e => set('pickupAddress', e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-400 mt-2 focus:outline-none" 
                        placeholder="Street Address"
                      />
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <input type="text" value={load.pickupCity} onChange={e => set('pickupCity', e.target.value)} className="bg-transparent text-xs text-slate-400 focus:outline-none" placeholder="City" />
                        <input type="text" value={load.pickupState} onChange={e => set('pickupState', e.target.value)} className="bg-transparent text-xs text-slate-400 focus:outline-none" placeholder="State" />
                        <input type="text" value={load.pickupZip} onChange={e => set('pickupZip', e.target.value)} className="bg-transparent text-xs text-slate-400 focus:outline-none" placeholder="Zip" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">Delivery Facility</p>
                      <input 
                        type="text" 
                        value={load.deliveryFacility} 
                        onChange={e => set('deliveryFacility', e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500" 
                        placeholder="Facility Name"
                      />
                      <input 
                        type="text" 
                        value={load.deliveryAddress} 
                        onChange={e => set('deliveryAddress', e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-400 mt-2 focus:outline-none" 
                        placeholder="Street Address"
                      />
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <input type="text" value={load.deliveryCity} onChange={e => set('deliveryCity', e.target.value)} className="bg-transparent text-xs text-slate-400 focus:outline-none" placeholder="City" />
                        <input type="text" value={load.deliveryState} onChange={e => set('deliveryState', e.target.value)} className="bg-transparent text-xs text-slate-400 focus:outline-none" placeholder="State" />
                        <input type="text" value={load.deliveryZip} onChange={e => set('deliveryZip', e.target.value)} className="bg-transparent text-xs text-slate-400 focus:outline-none" placeholder="Zip" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Schedules form */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Calendar size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">APPOINTMENT DATES</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Pickup Date" value={load.pickupDate} type="date" onChange={v => set('pickupDate', v)} />
                    <Field label="Pickup Time" value={load.pickupTime} type="time" onChange={v => set('pickupTime', v)} />
                    <Field label="Delivery Date" value={load.deliveryDate} type="date" onChange={v => set('deliveryDate', v)} />
                    <Field label="Delivery Time" value={load.deliveryTime} type="time" onChange={v => set('deliveryTime', v)} />
                  </div>
                </div>

                {/* Cargo Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Package size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">CARGO SPECS</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Field label="Commodity Details" value={load.commodity} onChange={v => set('commodity', v)} />
                    </div>
                    <Field label="Weight (lbs)" value={load.weight || 0} type="number" onChange={v => set('weight', Number(v))} />
                    <Field label="Miles" value={load.miles || 0} type="number" onChange={v => set('miles', Number(v))} />
                  </div>
                </div>

                {/* Dispatcher Broker Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <User size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">BROKER CONTACT</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Broker Firm" value={load.brokerName} onChange={v => set('brokerName', v)} />
                    <Field label="Contact Agent" value={load.brokerContact} onChange={v => set('brokerContact', v)} />
                    <Field label="Agent Phone" value={load.brokerPhone} onChange={v => set('brokerPhone', v)} />
                  </div>
                  <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Broker MC & Credit Score (DataTruck Integration)</p>
                      <p className="text-xs text-slate-300 mt-1">
                        MC #: <span className="font-mono text-white font-semibold">{load.brokerMC || 'MC-18824'}</span> · 
                        Credit Index: <span className="text-emerald-400 font-bold">96/100</span> · 
                        Broker Rating: <span className="text-emerald-400 font-bold">A+ (Triumph Financial Approved)</span>
                      </p>
                    </div>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded font-bold uppercase tracking-wider">
                      Factoring Approved
                    </span>
                  </div>
                </div>

                {/* Dispatch Notes */}
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Operations & Notes Log</span>
                  <textarea
                    value={load.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                    placeholder="Enter special details (detention, directions, breakdown updates)..."
                  />
                </div>
              </div>
            )}

            {/* TAB PANEL 3: FINANCIALS */}
            {activeTab === 'financials' && (
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <DollarSign size={14} className="text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">SETTLEMENT & PAY DETAILS</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Gross Rate ($)" value={load.rate} type="number" onChange={v => set('rate', Number(v))} />
                  <Field label="Miles" value={load.miles} type="number" onChange={v => set('miles', Number(v))} />
                  <Field label="Dispatch Fee %" value={load.dispatchFeePercent} type="number" onChange={v => set('dispatchFeePercent', Number(v))} />
                </div>

                {/* Calculations summary grid */}
                <div className="grid grid-cols-3 gap-4 pt-3">
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col justify-between h-24">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sonex Dispatch Fee</p>
                    <p className="font-mono text-xl font-black text-amber-400">{fmt$(financialPreview.dispatchFeeAmount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col justify-between h-24">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Carrier Net Payout</p>
                    <p className="font-mono text-xl font-black text-emerald-400">{fmt$(financialPreview.carrierNet)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col justify-between h-24">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Average Rate Per Mile</p>
                    <p className="font-mono text-xl font-black text-cyan-400">${financialPreview.ratePerMile.toFixed(2)}/mi</p>
                  </div>
                </div>

                {/* Detention & Additional Fees settings */}
                <div className="space-y-4 border-t border-white/5 pt-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Additional Demurrage & Layover</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Detention Hourly Rate ($)" value={load.detentionRate ?? 50} type="number" onChange={v => set('detentionRate', Number(v))} />
                    <Field label="Detention Hours logged" value={load.detentionHours || 0} type="number" onChange={v => set('detentionHours', Number(v))} />
                    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col justify-between">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Detention Revenue</p>
                      <p className="font-mono text-sm font-semibold text-slate-300">
                        {fmt$((load.detentionHours || 0) * (load.detentionRate ?? 50))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB PANEL 4: COMPLIANCE DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <FileText size={14} className="text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">DOCUMENT COMPLIANCE CHECK</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {DOCS.map(doc => {
                    const value = load[doc.field];
                    const status = docVerifications[doc.field];
                    
                    const statusLabels = {
                      pending: { text: 'Pending review', color: 'text-slate-400 bg-white/5 border-white/10' },
                      approved: { text: 'Approved ✔', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                      rejected: { text: 'Rejected ✕', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
                    };

                    return (
                      <div key={doc.field} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-4 flex flex-col justify-between">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white leading-tight">{doc.label}</h4>
                          <p className="text-[10px] text-slate-500">{doc.hint}</p>
                        </div>

                        {/* Document verification status clicker */}
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-bold text-slate-500">Verification</span>
                          <button 
                            onClick={() => toggleDocVerification(doc.field)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border ${statusLabels[status].color}`}
                          >
                            {statusLabels[status].text}
                          </button>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-white/5">
                          <label className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-amber-400 cursor-pointer transition-all hover:bg-amber-500/10 ${uploadingField === doc.field ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {uploadingField === doc.field ? (
                              <RefreshCw size={11} className="animate-spin" />
                            ) : (
                              <Upload size={11} />
                            )}
                            Upload
                            <input
                              type="file"
                              disabled={uploadingField === doc.field}
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.heic"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(doc.field, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {value && (
                            <button
                              onClick={() => openDocument(value)}
                              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-white/5 hover:text-white"
                            >
                              <Eye size={11} /> View
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* MOTIVE COMPLIANCE SIDEBAR */}
          <div className="space-y-6">
            
            {/* Carrier Profile Info Card */}
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Motive Compliance</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${carrier ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-slate-800 text-slate-400'}`}>
                  {carrier ? 'Linked' : 'Not Linked'}
                </span>
              </div>
              <div className="p-5 space-y-4">
                
                {/* Carrier details */}
                {carrier ? (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-black text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}>
                        {carrier.firstName[0]}{carrier.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-bold text-sm truncate">{carrier.firstName} {carrier.lastName}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{EQUIPMENT_TYPE_LABELS[carrier.equipmentType]} dispatcher-link</p>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-white/5 pt-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Status</span>
                        <span className="text-emerald-400 font-bold capitalize">● Active</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Truck VIN</span>
                        <span className="text-slate-300 font-mono">{carrier.truckVin || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Plate #</span>
                        <span className="text-slate-300 font-mono">{carrier.truckPlate || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Trailer Info</span>
                        <span className="text-slate-300">{carrier.hasTrailer ? `${carrier.trailerType} (${carrier.trailerLength}ft)` : 'None'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">MC Authority</span>
                        <span className="text-slate-300 font-mono">{carrier.mcNumber || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">DOT Number</span>
                        <span className="text-slate-300 font-mono">{carrier.dotNumber || '—'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-white/5">
                      {carrier.phone && (
                        <a href={`tel:${carrier.phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/10 font-bold text-[10px] uppercase text-slate-300 hover:text-white">
                          <Phone size={10} /> Call
                        </a>
                      )}
                      {carrier.email && (
                        <a href={`mailto:${carrier.email}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/10 font-bold text-[10px] uppercase text-slate-300 hover:text-white">
                          <Mail size={10} /> Email
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-500">Select a carrier to link Motive compliance logs and vehicle parameters.</p>
                  </div>
                )}

                {/* Carrier Assignment Dropdown */}
                <div className="space-y-1.5 border-t border-white/5 pt-3.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Carrier Assignee</label>
                  <select
                    value={load.carrierId || ''}
                    onChange={e => {
                      const nextCarrier = carriers.find(c => c.id === e.target.value);
                      set('carrierId', e.target.value || '');
                      if (nextCarrier) set('dispatchFeePercent', nextCarrier.dispatchFeePercent);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#0E1524] px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="" className="bg-[#050B18]">-- Unassigned --</option>
                    {carriers.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#050B18]">
                        {c.firstName} {c.lastName} ({EQUIPMENT_TYPE_LABELS[c.equipmentType]})
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Check-ins timeline card */}
            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <Calendar size={14} className="text-amber-400" /> Check-in Operations
              </h2>
              <div className="mb-4 grid grid-cols-1 gap-2">
                {CHECKIN_EVENTS.map(event => (
                  <button
                    key={event}
                    onClick={() => handleCheckin(event)}
                    disabled={loggedEvents.has(event)}
                    className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-left text-xs font-semibold text-slate-300 transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {CHECKIN_EVENT_LABELS[event]}
                    {loggedEvents.has(event) && <Check size={13} className="text-emerald-400" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5 pt-4">
                <CheckinTimeline checkins={checkins} />
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
