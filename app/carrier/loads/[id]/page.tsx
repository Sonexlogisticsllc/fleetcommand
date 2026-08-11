'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Check, DollarSign, ExternalLink, FileText,
  MapPin, Package, Save, Truck, Upload, RefreshCw, AlertTriangle,
  User, ShieldCheck, Mail, Phone, Info, Eye, Clock, Activity, CheckSquare,
  AlertOctagon, Camera, UploadCloud
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CheckinTimeline } from '@/components/sonex/CheckinTimeline';
import { LoadStatusBadge, StatusPipeline } from '@/components/sonex/StatusPipeline';
import { useSonexAuth } from '@/lib/sonexAuth';
import {
  addCheckin, getCarrier, getCheckins, getLoad,
  updateLoad, addCargoPhoto, getCargoPhotos
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
  { field: 'bolUrl', label: 'BOL (Bill of Lading)', hint: 'Signed proof of loading' },
  { field: 'podUrl', label: 'POD (Proof of Delivery)', hint: 'Signed proof of delivery' },
];

const CHECKIN_EVENTS: CheckinEvent[] = ['arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered'];

// Bypasses browser restrictions on opening direct base64 data URLs
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

function RouteMapWidget({ load }: { load: SonexLoad }) {
  const steps = ['booked', 'dispatched', 'in_transit', 'delivered', 'pod_received'];
  const currentIdx = steps.indexOf(load.status);
  const progressPercent = currentIdx === -1 ? 0 : (currentIdx / (steps.length - 1)) * 100;

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 space-y-4 relative overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Transit Route</h3>
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

export default function CarrierLoadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loadId = params.id as string;
  const { user } = useSonexAuth();

  const [load, setLoad] = useState<SonexLoad | null>(null);
  const [checkins, setCheckins] = useState<SonexLoadCheckin[]>([]);
  const [carrier, setCarrier] = useState<SonexCarrier | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'financials' | 'documents'>('overview');
  const [uploadingField, setUploadingField] = useState<DocumentField | null>(null);

  const reload = async () => {
    const found = await getLoad(loadId);
    if (!found) {
      router.push('/carrier');
      return;
    }
    setLoad(found);
    
    const c = found.carrierId ? await getCarrier(found.carrierId) : null;
    setCarrier(c || null);

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
        <div className="text-sm text-slate-500 animate-pulse">Loading assignment...</div>
      </div>
    );
  }

  // Security Check: Ensure carrier only views their assigned load
  if (user?.role === 'carrier' && load.carrierId !== user.carrierId) {
    return (
      <div className="p-8 flex min-h-[60vh] flex-col items-center justify-center space-y-3">
        <AlertOctagon size={32} className="text-red-500 animate-pulse" />
        <h3 className="text-white text-base font-bold">Unauthorized Access</h3>
        <p className="text-slate-400 text-xs text-center max-w-xs">You are not authorized to view this load assignment.</p>
        <Link href="/carrier" className="text-amber-400 text-xs hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const patch = async (data: Partial<SonexLoad>, message = 'Load updated') => {
    const updated = await updateLoad(load.id, data);
    if (!updated) return;
    setLoad(updated);
    toast.success(message);
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
      loggedBy: 'carrier',
    });
    
    // Automatically advance load statuses on carrier logs
    let newStatus: LoadStatus = load.status;
    if (event === 'arrived_pickup') newStatus = 'dispatched';
    else if (event === 'loaded_departing') newStatus = 'in_transit';
    else if (event === 'delivered') newStatus = 'delivered';

    if (newStatus !== load.status) {
      await updateLoad(load.id, { status: newStatus });
    }
    
    await reload();
    toast.success(`Check-in logged: ${CHECKIN_EVENT_LABELS[event]}`);
  };

  return (
    <div className="min-h-screen bg-[#050B18] p-6 animate-fade-in text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/carrier" className="flex w-fit items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors hover:text-slate-300">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <a href="tel:(346)421-2681" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all uppercase">
            <AlertOctagon size={13} className="animate-pulse" /> Urgent Dispatch Support
          </a>
        </div>

        {/* Motive Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">Carrier Control</span>
              <h1 className="text-3xl font-black tracking-tight">{load.loadNumber}</h1>
              <LoadStatusBadge status={load.status} />
            </div>
            <p className="text-sm text-slate-400 leading-snug">
              {load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}
            </p>
          </div>
        </div>

        {/* Status Pipeline bar */}
        <div className="glass-card p-5">
          <StatusPipeline currentStatus={load.status} />
        </div>

        {/* Split Screen Workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Main workspace */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tabs Control */}
            <div className="flex border-b border-white/5 gap-1 overflow-x-auto pb-px">
              {[
                { id: 'overview', label: 'Overview & GPS', icon: Activity },
                { id: 'details', label: 'Schedules & Routing', icon: MapPin },
                { id: 'financials', label: 'Settlement & Pay', icon: DollarSign },
                { id: 'documents', label: 'Load Documents', icon: FileText },
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

            {/* TAB PANEL 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <RouteMapWidget load={load} />

                {/* Info summary details */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                    <Info size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Dispatch Notes</h3>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Commodity & Weight</p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      {load.commodity} ({load.weight.toLocaleString()} lbs)
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Dispatcher Instructions</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed bg-white/[0.01] border border-white/[0.04] p-3.5 rounded-xl">
                      {load.notes || 'Proceed safely along GPS path. Call dispatcher for detention updates.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB PANEL 2: SCHEDULES */}
            {activeTab === 'details' && (
              <div className="glass-card p-6 space-y-6">
                
                {/* Facilities */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <MapPin size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">ROUTE FACILITIES</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">Pickup Origin</p>
                      <p className="text-sm font-semibold text-white">{load.pickupFacility}</p>
                      <p className="text-xs text-slate-400">{load.pickupAddress}</p>
                      <p className="text-xs text-slate-400">{load.pickupCity}, {load.pickupState} {load.pickupZip}</p>
                      {load.pickupApptNumber && (
                        <p className="text-[10px] text-slate-500 pt-1.5 border-t border-white/5">Appt #: {load.pickupApptNumber}</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">Delivery Consignee</p>
                      <p className="text-sm font-semibold text-white">{load.deliveryFacility}</p>
                      <p className="text-xs text-slate-400">{load.deliveryAddress}</p>
                      <p className="text-xs text-slate-400">{load.deliveryCity}, {load.deliveryState} {load.deliveryZip}</p>
                      {load.deliveryApptNumber && (
                        <p className="text-[10px] text-slate-500 pt-1.5 border-t border-white/5">Appt #: {load.deliveryApptNumber}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Calendar size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">SCHEDULE TIMES</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Pickup Schedule</p>
                      <p className="text-sm text-slate-200 mt-1">{load.pickupDate} at {load.pickupTime}</p>
                    </div>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Delivery Schedule</p>
                      <p className="text-sm text-slate-200 mt-1">{load.deliveryDate} at {load.deliveryTime}</p>
                    </div>
                  </div>
                </div>

                {/* Cargo */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Package size={14} className="text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">CARGO SPECIFICATIONS</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                      <p className="text-[10px] text-slate-500 uppercase">Commodity</p>
                      <p className="text-sm font-semibold text-slate-200 truncate mt-1">{load.commodity}</p>
                    </div>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                      <p className="text-[10px] text-slate-500 uppercase">Weight</p>
                      <p className="text-sm font-semibold text-slate-200 mt-1">{load.weight.toLocaleString()} lbs</p>
                    </div>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                      <p className="text-[10px] text-slate-500 uppercase">Distance</p>
                      <p className="text-sm font-semibold text-slate-200 mt-1">{load.miles.toLocaleString()} miles</p>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB PANEL 3: SETTLEMENTS */}
            {activeTab === 'financials' && (
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <DollarSign size={14} className="text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">SETTLEMENT PAYOUTS</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col justify-between h-24">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gross Load Rate</p>
                    <p className="font-mono text-xl font-black text-white">{fmt$(Number(load.rate))}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col justify-between h-24">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dispatch Service Fee</p>
                    <p className="font-mono text-xl font-black text-red-400">{fmt$(financialPreview.dispatchFeeAmount)} ({load.dispatchFeePercent}%)</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.05] bg-[#10B981]/5 p-4 flex flex-col justify-between h-24">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Net Carrier Payout</p>
                    <p className="font-mono text-xl font-black text-emerald-400">{fmt$(financialPreview.carrierNet)}</p>
                  </div>
                </div>

                {/* Additional parameters */}
                <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-2xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Average Rate Per Mile</span>
                    <span className="text-slate-200 font-mono font-semibold">${financialPreview.ratePerMile.toFixed(2)}/mi</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Detention Compensation Rate</span>
                    <span className="text-slate-200 font-mono">${(load.detentionRate ?? 50)}/hour</span>
                  </div>
                  {load.detentionHours > 0 && (
                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                      <span className="text-amber-400 font-bold">Detention Earned ({load.detentionHours}h)</span>
                      <span className="text-amber-400 font-mono font-bold">{fmt$(load.detentionHours * (load.detentionRate ?? 50))}</span>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB PANEL 4: POD UPLOADS */}
            {activeTab === 'documents' && (
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                  <FileText size={14} className="text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Upload Load Documents</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {DOCS.map(doc => {
                    const value = load[doc.field];
                    return (
                      <div key={doc.field} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-4 flex flex-col justify-between">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white leading-tight">{doc.label}</h4>
                          <p className="text-[10px] text-slate-500">{doc.hint}</p>
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
                              accept=".pdf,.jpg,.jpeg,.png"
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
                              className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-white/10 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-white/5 hover:text-white"
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

          {/* DRIVER TIMELINE & STATUS LOGGERS */}
          <div className="space-y-6">
            
            {/* Check-ins TIMELINE */}
            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <Calendar size={14} className="text-amber-400" /> Driver Logging Actions
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

            {/* Factoring details sidebar */}
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Factoring Index</h3>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Loads can be factored with Triumph Financial at a 1.50% dispatch clearance rate. Deliver and upload PODs to release payments to your bank inside 24 hours.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
