'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck, MapPin, PackageCheck, CheckCircle, Camera, FileUp,
  AlertTriangle, Clock, Weight, DollarSign, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSonexAuth } from '@/lib/sonexAuth';
import {
  getLoadsByCarrier, getCheckins, addCheckin, updateLoad,
  addCargoPhoto, getCargoPhotos,
} from '@/lib/sonexStore';
import type { SonexLoad, SonexLoadCheckin, CheckinEvent, LoadStatus } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS, CHECKIN_EVENT_LABELS } from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: LoadStatus[] = ['booked', 'dispatched', 'in_transit'];
const COMPLETED_STATUSES: LoadStatus[] = ['delivered', 'pod_received', 'invoiced', 'paid'];

function fmt$(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(t: string) {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

const STATUS_COLORS: Record<LoadStatus, string> = {
  booked: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  dispatched: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  in_transit: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  pod_received: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  invoiced: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  paid: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const CHECKIN_ORDER: CheckinEvent[] = [
  'arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered',
];

function getNextCheckin(checkins: SonexLoadCheckin[]): CheckinEvent | null {
  const done = new Set(checkins.map(c => c.event));
  for (const ev of CHECKIN_ORDER) {
    if (!done.has(ev)) return ev;
  }
  return null;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Check-in button config ────────────────────────────────────────────────────

interface CheckinConfig {
  event: CheckinEvent;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
}

const CHECKIN_CONFIGS: Record<CheckinEvent, CheckinConfig> = {
  arrived_pickup: {
    event: 'arrived_pickup',
    label: 'Arrived at Pickup',
    Icon: Truck,
    color: 'text-[#050B18]',
    bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
    border: 'border-amber-400',
  },
  loaded_departing: {
    event: 'loaded_departing',
    label: 'Loaded — Departing',
    Icon: PackageCheck,
    color: 'text-[#050B18]',
    bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
    border: 'border-amber-400',
  },
  arrived_delivery: {
    event: 'arrived_delivery',
    label: 'Arrived at Delivery',
    Icon: MapPin,
    color: 'text-[#050B18]',
    bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
    border: 'border-amber-400',
  },
  delivered: {
    event: 'delivered',
    label: 'Mark as Delivered',
    Icon: CheckCircle,
    color: 'text-white',
    bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
    border: 'border-emerald-500',
  },
};

// ─── Components ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LoadStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[status]}`}>
      {LOAD_STATUS_LABELS[status]}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <Truck size={36} className="text-amber-500/60" />
      </div>
      <h3 className="text-white text-lg font-semibold mb-2">No Active Loads</h3>
      <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
        You're all caught up! When your dispatcher assigns a new load, it will appear here.
      </p>
    </div>
  );
}

// ─── Active Load Card ─────────────────────────────────────────────────────────

interface ActiveLoadCardProps {
  load: SonexLoad;
  onRefresh: () => void;
}

function ActiveLoadCard({ load, onRefresh }: ActiveLoadCardProps) {
  const [checkins, setCheckins] = useState<SonexLoadCheckin[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasBol, setHasBol] = useState(false);
  const [hasPod, setHasPod] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  const bolRef = useRef<HTMLInputElement>(null);
  const podRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const refreshCheckins = useCallback(() => {
    setCheckins(getCheckins(load.id));
    setPhotoCount(getCargoPhotos(load.id).length);
  }, [load.id]);

  useEffect(() => {
    refreshCheckins();
    // Also check load bolUrl / podUrl
    if (load.bolUrl) setHasBol(true);
    if (load.podUrl) setHasPod(true);
  }, [load, refreshCheckins]);

  const nextEvent = getNextCheckin(checkins);
  const doneEvents = new Set(checkins.map(c => c.event));
  const showUploads = ['in_transit', 'delivered', 'pod_received', 'invoiced', 'paid'].includes(load.status);

  async function handleCheckin(event: CheckinEvent) {
    if (loading) return;
    setLoading(true);
    try {
      addCheckin({
        loadId: load.id,
        event,
        timestamp: new Date().toISOString(),
        notes: '',
        loggedBy: 'carrier',
      });
      // Auto-update load status
      const statusMap: Partial<Record<CheckinEvent, LoadStatus>> = {
        arrived_pickup: 'dispatched',
        loaded_departing: 'in_transit',
        arrived_delivery: 'in_transit',
        delivered: 'delivered',
      };
      if (statusMap[event]) {
        updateLoad(load.id, { status: statusMap[event] });
      }
      toast.success(`✓ ${CHECKIN_EVENT_LABELS[event]} logged!`, {
        style: { background: '#0D1F3C', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' },
      });
      refreshCheckins();
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleBolUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await toBase64(file);
    updateLoad(load.id, { bolUrl: url });
    setHasBol(true);
    toast.success('BOL uploaded!');
    if (bolRef.current) bolRef.current.value = '';
  }

  async function handlePodUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await toBase64(file);
    updateLoad(load.id, { podUrl: url });
    setHasPod(true);
    toast.success('POD uploaded!');
    if (podRef.current) podRef.current.value = '';
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    let count = 0;
    for (const file of files) {
      const url = await toBase64(file);
      addCargoPhoto({
        loadId: load.id,
        url,
        stage: doneEvents.has('loaded_departing') ? 'delivery' : 'pickup',
        caption: `Cargo photo ${new Date().toLocaleTimeString()}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'carrier',
      });
      count++;
    }
    setPhotoCount(prev => prev + count);
    toast.success(`${count} photo${count > 1 ? 's' : ''} uploaded!`);
    if (photoRef.current) photoRef.current.value = '';
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(13,31,60,0.55)',
        border: '1px solid rgba(245,158,11,0.35)',
        boxShadow: '0 0 30px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}>

      {/* Card header */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(245,158,11,0.12)', background: 'rgba(245,158,11,0.04)' }}>
        <div>
          <div className="text-xs text-amber-500/70 font-mono tracking-widest uppercase mb-0.5">Active Load</div>
          <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">{load.loadNumber}</div>
        </div>
        <StatusBadge status={load.status} />
      </div>

      {/* Route */}
      <div className="px-5 py-5">
        <div className="flex items-stretch gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="w-3 h-3 rounded-full border-2 border-amber-500 bg-amber-500/20" />
            <div className="flex-1 w-0.5 bg-gradient-to-b from-amber-500/50 to-slate-500/30 min-h-[32px]" />
            <MapPin size={14} className="text-amber-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="text-white font-semibold text-base leading-tight">
                {load.pickupCity}, {load.pickupState}
              </div>
              <div className="text-slate-400 text-xs mt-0.5">{load.pickupFacility}</div>
              <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
                <Clock size={11} />
                {fmtDate(load.pickupDate)} · {fmtTime(load.pickupTime)}
                {load.pickupApptNumber && <span className="text-amber-500/70">· Appt #{load.pickupApptNumber}</span>}
              </div>
            </div>
            <div>
              <div className="text-white font-semibold text-base leading-tight">
                {load.deliveryCity}, {load.deliveryState}
              </div>
              <div className="text-slate-400 text-xs mt-0.5">{load.deliveryFacility}</div>
              <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
                <Clock size={11} />
                {fmtDate(load.deliveryDate)} · {fmtTime(load.deliveryTime)}
                {load.deliveryApptNumber && <span className="text-amber-500/70">· Appt #{load.deliveryApptNumber}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Cargo + financials */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl px-3 py-2.5 space-y-0.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-slate-500 text-[10px] uppercase tracking-widest flex items-center gap-1">
              <Weight size={10} /> Commodity
            </div>
            <div className="text-white text-sm font-medium truncate">{load.commodity}</div>
            <div className="text-slate-400 text-xs">{load.weight.toLocaleString()} lbs</div>
          </div>
          <div className="rounded-xl px-3 py-2.5 space-y-0.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-slate-500 text-[10px] uppercase tracking-widest flex items-center gap-1">
              <Building2 size={10} /> Broker
            </div>
            <div className="text-white text-sm font-medium truncate">{load.brokerName}</div>
            <div className="text-slate-400 text-xs">{load.miles.toLocaleString()} mi</div>
          </div>
        </div>

        {/* Pay breakdown */}
        <div className="mt-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-xs mb-0.5">Gross Rate</div>
              <div className="text-slate-300 text-sm font-mono">{fmt$(load.rate)}</div>
            </div>
            <div className="text-slate-600 text-sm">→</div>
            <div>
              <div className="text-slate-400 text-xs mb-0.5">Fee ({load.dispatchFeePercent}%)</div>
              <div className="text-slate-400 text-sm font-mono">-{fmt$(load.dispatchFeeAmount)}</div>
            </div>
            <div className="text-amber-500/60 text-sm">=</div>
            <div className="text-right">
              <div className="text-amber-400/80 text-xs mb-0.5">Your Net</div>
              <div className="text-amber-400 text-lg font-black font-mono">{fmt$(load.carrierNet)}</div>
            </div>
          </div>
        </div>

        {load.notes && (
          <div className="mt-3 px-3 py-2.5 rounded-xl flex gap-2"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)' }}>
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-300 text-xs leading-relaxed">{load.notes}</p>
          </div>
        )}
      </div>

      {/* ── Check-in progress ─────────────────────────────────────────────── */}
      <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="pt-4 mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Check-in Progress</div>
          <div className="flex gap-2">
            {CHECKIN_ORDER.map((ev, i) => {
              const done = doneEvents.has(ev);
              return (
                <div key={ev} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-1.5 rounded-full ${done ? 'bg-amber-500' : 'bg-slate-700'}`} />
                  <div className={`text-[9px] text-center leading-tight ${done ? 'text-amber-400' : 'text-slate-600'}`}>
                    {i === 0 ? 'Pickup' : i === 1 ? 'Loaded' : i === 2 ? 'Delivery' : 'Done'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completed check-ins */}
        {checkins.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {checkins.map(ci => (
              <div key={ci.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                <span className="text-emerald-300 text-xs font-medium flex-1">{CHECKIN_EVENT_LABELS[ci.event]}</span>
                <span className="text-slate-500 text-[10px]">
                  {new Date(ci.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Next check-in button */}
        {nextEvent && (
          <button
            onClick={() => handleCheckin(nextEvent)}
            disabled={loading}
            className={`w-full rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${CHECKIN_CONFIGS[nextEvent].bg} ${CHECKIN_CONFIGS[nextEvent].color} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            style={{ height: '60px', border: `1px solid ${CHECKIN_CONFIGS[nextEvent].border}`, boxShadow: '0 4px 20px rgba(245,158,11,0.15)' }}>
            {React.createElement(CHECKIN_CONFIGS[nextEvent].Icon, { size: 22 })}
            {loading ? 'Logging…' : CHECKIN_CONFIGS[nextEvent].label}
          </button>
        )}
        {!nextEvent && (
          <div className="w-full rounded-2xl flex items-center justify-center gap-2 py-4 text-emerald-400 font-semibold"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle size={20} />
            All check-ins complete!
          </div>
        )}
      </div>

      {/* ── Upload section ────────────────────────────────────────────────── */}
      {showUploads && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="pt-4">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Documents & Photos</div>
            <div className="space-y-2">

              {/* BOL */}
              <input ref={bolRef} type="file" accept="image/*,application/pdf" capture="environment"
                className="hidden" onChange={handleBolUpload} />
              <button onClick={() => bolRef.current?.click()}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all active:scale-[0.99] ${
                  hasBol
                    ? 'text-emerald-400'
                    : 'text-slate-300 hover:text-white'
                }`}
                style={{
                  background: hasBol ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  border: hasBol ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                <FileUp size={18} className={hasBol ? 'text-emerald-400' : 'text-amber-500'} />
                <span className="flex-1 text-left">{hasBol ? '✓ BOL Uploaded' : 'Upload BOL'}</span>
                {!hasBol && <Camera size={16} className="text-slate-600" />}
              </button>

              {/* POD */}
              <input ref={podRef} type="file" accept="image/*,application/pdf" capture="environment"
                className="hidden" onChange={handlePodUpload} />
              <button onClick={() => podRef.current?.click()}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all active:scale-[0.99] ${
                  hasPod ? 'text-emerald-400' : 'text-slate-300 hover:text-white'
                }`}
                style={{
                  background: hasPod ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  border: hasPod ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                <FileUp size={18} className={hasPod ? 'text-emerald-400' : 'text-amber-500'} />
                <span className="flex-1 text-left">{hasPod ? '✓ POD Uploaded' : 'Upload POD'}</span>
                {!hasPod && <Camera size={16} className="text-slate-600" />}
              </button>

              {/* Cargo Photos */}
              <input ref={photoRef} type="file" accept="image/*" capture="environment"
                multiple className="hidden" onChange={handlePhotoUpload} />
              <button onClick={() => photoRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all active:scale-[0.99] text-slate-300 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Camera size={18} className="text-amber-500" />
                <span className="flex-1 text-left">Upload Cargo Photos</span>
                {photoCount > 0 && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5 font-semibold">
                    {photoCount} photo{photoCount !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Past Load Row ─────────────────────────────────────────────────────────────

function PastLoadRow({ load }: { load: SonexLoad }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: 'rgba(13,31,60,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-amber-400 text-sm font-bold">{load.loadNumber}</span>
          <StatusBadge status={load.status} />
        </div>
        <div className="text-slate-300 text-xs truncate">
          {load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}
        </div>
        <div className="text-slate-500 text-xs mt-0.5">{fmtDate(load.pickupDate)}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-slate-400 text-xs">Gross: <span className="text-slate-300 font-mono">{fmt$(load.rate)}</span></div>
        <div className="text-amber-400 text-sm font-bold font-mono">{fmt$(load.carrierNet)}</div>
        <div className="text-slate-600 text-[10px]">net</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CarrierLoadsPage() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';
  const [loads, setLoads] = useState<SonexLoad[]>([]);

  const refresh = useCallback(() => {
    if (!carrierId) return;
    const all = getLoadsByCarrier(carrierId);
    all.sort((a, b) => {
      const aActive = ACTIVE_STATUSES.includes(a.status);
      const bActive = ACTIVE_STATUSES.includes(b.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime();
    });
    setLoads(all);
  }, [carrierId]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeLoad = loads.find(l => ACTIVE_STATUSES.includes(l.status));
  const pastLoads = loads.filter(l => COMPLETED_STATUSES.includes(l.status));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Section header */}
      <div>
        <h1 className="text-xl font-black text-white tracking-tight">My Loads</h1>
        <p className="text-slate-500 text-sm mt-0.5">Active assignment and history</p>
      </div>

      {/* Active load */}
      {activeLoad ? (
        <ActiveLoadCard load={activeLoad} onRefresh={refresh} />
      ) : (
        <EmptyState />
      )}

      {/* Past loads */}
      {pastLoads.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-amber-500/60" />
            <h2 className="text-base font-bold text-white">Recent Loads</h2>
            <span className="text-slate-600 text-sm">({pastLoads.length})</span>
          </div>
          <div className="space-y-2">
            {pastLoads.map(load => (
              <PastLoadRow key={load.id} load={load} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
