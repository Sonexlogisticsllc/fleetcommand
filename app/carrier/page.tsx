'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck, MapPin, PackageCheck, CheckCircle, Camera, FileUp, Download,
  AlertTriangle, Clock, Weight, DollarSign, Building2, Timer,
  Moon, Zap, XCircle, PhoneCall, ChevronDown, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSonexAuth } from '@/lib/sonexAuth';
import {
  getLoadsByCarrier, getCheckins, addCheckin, updateLoad,
  addCargoPhoto, getCargoPhotos,
} from '@/lib/sonexStore';
import { uploadFile } from '@/lib/storageUtils';
import type { SonexLoad, SonexLoadCheckin, CheckinEvent, LoadStatus } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS, CHECKIN_EVENT_LABELS } from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: LoadStatus[] = ['booked', 'dispatched', 'in_transit'];
const COMPLETED_STATUSES: LoadStatus[] = ['delivered', 'pod_received', 'invoiced', 'paid'];
const CORE_CHECKIN_ORDER: CheckinEvent[] = ['arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered'];

function fmt$(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(t: string) {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
function fmtTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

function getNextCheckin(checkins: SonexLoadCheckin[]): CheckinEvent | null {
  const done = new Set(checkins.map(c => c.event));
  for (const ev of CORE_CHECKIN_ORDER) {
    if (!done.has(ev)) return ev;
  }
  return null;
}

interface CheckinCfg {
  event: CheckinEvent;
  label: string;
  subLabel?: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const CHECKIN_CONFIGS: Record<CheckinEvent, CheckinCfg> = {
  arrived_pickup:   { event: 'arrived_pickup',   label: 'Arrived at Pickup',     Icon: Truck,        color: 'text-black', bg: 'bg-amber-500 hover:bg-amber-400',   border: 'border-amber-400' },
  loaded_departing: { event: 'loaded_departing', label: 'Loaded — Departing',     Icon: PackageCheck, color: 'text-black', bg: 'bg-amber-500 hover:bg-amber-400',   border: 'border-amber-400' },
  arrived_delivery: { event: 'arrived_delivery', label: 'Arrived at Delivery',    Icon: MapPin,       color: 'text-black', bg: 'bg-amber-500 hover:bg-amber-400',   border: 'border-amber-400' },
  delivered:        { event: 'delivered',         label: 'Mark as Delivered',      Icon: CheckCircle,  color: 'text-white', bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-500' },
  detention_start:  { event: 'detention_start',  label: 'Start Detention',        subLabel: 'Waiting at facility', Icon: Timer,  color: 'text-black', bg: 'bg-orange-500 hover:bg-orange-400',  border: 'border-orange-400' },
  detention_end:    { event: 'detention_end',    label: 'End Detention',          Icon: Timer,        color: 'text-white', bg: 'bg-orange-700 hover:bg-orange-600',  border: 'border-orange-600' },
  layover_start:    { event: 'layover_start',    label: 'Start Layover',          subLabel: 'Overnight hold', Icon: Moon, color: 'text-black', bg: 'bg-violet-500 hover:bg-violet-400',  border: 'border-violet-400' },
  layover_end:      { event: 'layover_end',      label: 'End Layover',            Icon: Moon,         color: 'text-white', bg: 'bg-violet-700 hover:bg-violet-600',  border: 'border-violet-600' },
  tonu:             { event: 'tonu',              label: 'TONU',                   subLabel: 'Truck Ordered Not Used', Icon: XCircle, color: 'text-white', bg: 'bg-red-700 hover:bg-red-600', border: 'border-red-500' },
  breakdown:        { event: 'breakdown',         label: 'Report Breakdown',       Icon: Zap,          color: 'text-black', bg: 'bg-red-500 hover:bg-red-400',       border: 'border-red-400' },
  accident:         { event: 'accident',          label: 'Report Accident',        Icon: AlertTriangle, color: 'text-black', bg: 'bg-red-600 hover:bg-red-500',      border: 'border-red-400' },
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

// ─── Notes Modal ─────────────────────────────────────────────────────────────

interface NotesModalProps {
  event: CheckinEvent;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  loading?: boolean;
}
function NotesModal({ event, onConfirm, onCancel, loading }: NotesModalProps) {
  const [notes, setNotes] = useState('');
  const cfg = CHECKIN_CONFIGS[event];
  const Icon = cfg.Icon;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0D1F3C', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <Icon size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">{cfg.label}</div>
              {cfg.subLabel && <div className="text-slate-400 text-xs">{cfg.subLabel}</div>}
            </div>
          </div>
        </div>
        <div className="p-5">
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any details about this event…"
            rows={3}
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 resize-none focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <div className="flex gap-3 mt-4">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-400 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={() => onConfirm(notes)} disabled={loading}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${cfg.bg} ${cfg.color} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={{ border: `1px solid`, borderColor: cfg.border }}>
              {loading ? 'Logging…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
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
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingBol, setUploadingBol] = useState(false);
  const [uploadingPod, setUploadingPod] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showOtherEvents, setShowOtherEvents] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<CheckinEvent | null>(null);

  const bolRef = useRef<HTMLInputElement>(null);
  const podRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const refreshCheckins = useCallback(async () => {
    const [cis, photos] = await Promise.all([
      getCheckins(load.id),
      getCargoPhotos(load.id),
    ]);
    setCheckins(cis);
    setPhotoCount(photos.length);
  }, [load.id]);

  useEffect(() => { refreshCheckins(); }, [refreshCheckins]);

  const nextEvent = getNextCheckin(checkins);
  const doneEvents = new Set(checkins.map(c => c.event));
  const showUploads = ['in_transit', 'delivered', 'pod_received', 'invoiced', 'paid'].includes(load.status);
  const hasBol = !!load.bolUrl;
  const hasPod = !!load.podUrl;
  const hasDetentionRunning = doneEvents.has('detention_start') && !doneEvents.has('detention_end');
  const hasLayoverRunning = doneEvents.has('layover_start') && !doneEvents.has('layover_end');

  async function handleCheckin(event: CheckinEvent, notes: string = '') {
    if (loading) return;
    setLoading(true);
    setPendingEvent(null);
    try {
      await addCheckin({
        loadId: load.id,
        event,
        timestamp: new Date().toISOString(),
        notes,
        loggedBy: 'carrier',
      });
      const statusMap: Partial<Record<CheckinEvent, LoadStatus>> = {
        arrived_pickup: 'dispatched',
        loaded_departing: 'in_transit',
        arrived_delivery: 'in_transit',
        delivered: 'delivered',
      };
      if (statusMap[event]) {
        await updateLoad(load.id, { status: statusMap[event] });
      }
      toast.success(`✓ ${CHECKIN_EVENT_LABELS[event]} logged!`, {
        style: { background: '#0D1F3C', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' },
      });
      await refreshCheckins();
      onRefresh();
    } catch {
      toast.error('Failed to log event. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBolUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBol(true);
    try {
      const result = await uploadFile(file, 'load-documents', `${load.id}/bol`);
      await updateLoad(load.id, { bolUrl: result.url });
      toast.success('✓ BOL uploaded successfully!');
      onRefresh();
    } catch { toast.error('Upload failed. Please try again.'); }
    finally { setUploadingBol(false); if (bolRef.current) bolRef.current.value = ''; }
  }

  async function handlePodUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPod(true);
    try {
      const result = await uploadFile(file, 'load-documents', `${load.id}/pod`);
      await updateLoad(load.id, { podUrl: result.url });
      // Auto-advance status to pod_received
      if (load.status === 'delivered') {
        await updateLoad(load.id, { podUrl: result.url, status: 'pod_received' });
      }
      toast.success('✓ POD uploaded — status updated!');
      onRefresh();
    } catch { toast.error('Upload failed. Please try again.'); }
    finally { setUploadingPod(false); if (podRef.current) podRef.current.value = ''; }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingPhotos(true);
    try {
      let count = 0;
      for (const file of files) {
        const result = await uploadFile(file, 'cargo-photos', `${load.id}`);
        await addCargoPhoto({
          loadId: load.id,
          url: result.url,
          stage: doneEvents.has('loaded_departing') ? 'delivery' : 'pickup',
          caption: `Cargo photo ${new Date().toLocaleTimeString()}`,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'carrier',
        });
        count++;
      }
      setPhotoCount(p => p + count);
      toast.success(`✓ ${count} photo${count > 1 ? 's' : ''} uploaded!`);
    } catch { toast.error('Photo upload failed.'); }
    finally { setUploadingPhotos(false); if (photoRef.current) photoRef.current.value = ''; }
  }

  // Other special events to show
  const otherEvents: CheckinEvent[] = [];
  if (doneEvents.has('arrived_pickup')) {
    if (!doneEvents.has('detention_start')) otherEvents.push('detention_start');
    if (hasDetentionRunning) otherEvents.push('detention_end');
    if (!doneEvents.has('layover_start')) otherEvents.push('layover_start');
    if (hasLayoverRunning) otherEvents.push('layover_end');
    if (!doneEvents.has('tonu')) otherEvents.push('tonu');
  }
  if (!doneEvents.has('breakdown')) otherEvents.push('breakdown');
  if (!doneEvents.has('accident')) otherEvents.push('accident');

  return (
    <>
      {pendingEvent && (
        <NotesModal
          event={pendingEvent}
          onConfirm={(notes) => handleCheckin(pendingEvent, notes)}
          onCancel={() => setPendingEvent(null)}
          loading={loading}
        />
      )}

      <div className="rounded-2xl overflow-hidden" style={{
        background: 'rgba(13,31,60,0.55)',
        border: '1px solid rgba(245,158,11,0.35)',
        boxShadow: '0 0 30px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(245,158,11,0.12)', background: 'rgba(245,158,11,0.04)' }}>
          <div>
            <div className="text-xs text-amber-500/70 font-mono tracking-widest uppercase mb-0.5">Active Load</div>
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">{load.loadNumber}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={load.status} />
            {load.brokerPhone && (
              <a href={`tel:${load.brokerPhone}`}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                <PhoneCall size={15} className="text-amber-400" />
              </a>
            )}
          </div>
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
                <div className="text-white font-semibold text-base leading-tight">{load.pickupCity}, {load.pickupState}</div>
                <div className="text-slate-400 text-xs mt-0.5">{load.pickupFacility}</div>
                <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
                  <Clock size={11} />
                  {fmtDate(load.pickupDate)} · {fmtTime(load.pickupTime)}
                  {load.pickupApptNumber && <span className="text-amber-500/70">· Appt #{load.pickupApptNumber}</span>}
                </div>
              </div>
              <div>
                <div className="text-white font-semibold text-base leading-tight">{load.deliveryCity}, {load.deliveryState}</div>
                <div className="text-slate-400 text-xs mt-0.5">{load.deliveryFacility}</div>
                <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
                  <Clock size={11} />
                  {fmtDate(load.deliveryDate)} · {fmtTime(load.deliveryTime)}
                  {load.deliveryApptNumber && <span className="text-amber-500/70">· Appt #{load.deliveryApptNumber}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Cargo + Broker */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-2.5 space-y-0.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-slate-500 text-[10px] uppercase tracking-widest flex items-center gap-1"><Weight size={10} /> Cargo</div>
              <div className="text-white text-sm font-medium truncate">{load.commodity}</div>
              <div className="text-slate-400 text-xs">{load.weight.toLocaleString()} lbs · {load.miles.toLocaleString()} mi</div>
            </div>
            <div className="rounded-xl px-3 py-2.5 space-y-0.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-slate-500 text-[10px] uppercase tracking-widest flex items-center gap-1"><Building2 size={10} /> Broker</div>
              <div className="text-white text-sm font-medium truncate">{load.brokerName}</div>
              <div className="text-slate-400 text-xs">{load.brokerContact || load.brokerPhone}</div>
            </div>
          </div>

          {/* Pay breakdown */}
          <div className="mt-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-xs mb-0.5">Gross</div>
                <div className="text-slate-300 text-sm font-mono">{fmt$(load.rate)}</div>
              </div>
              <div className="text-slate-600 text-sm">−</div>
              <div>
                <div className="text-slate-400 text-xs mb-0.5">Fee ({load.dispatchFeePercent}%)</div>
                <div className="text-slate-400 text-sm font-mono">{fmt$(load.dispatchFeeAmount)}</div>
              </div>
              <div className="text-amber-500/60 text-sm">=</div>
              <div className="text-right">
                <div className="text-amber-400/80 text-xs mb-0.5">Your Net</div>
                <div className="text-amber-400 text-xl font-black font-mono">{fmt$(load.carrierNet)}</div>
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

        {/* ── Check-in progress bar ─────────────────────────────────────── */}
        <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="pt-4 mb-4">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Trip Progress</div>
            <div className="flex gap-1.5">
              {CORE_CHECKIN_ORDER.map((ev) => {
                const done = doneEvents.has(ev);
                const isCurrent = ev === nextEvent;
                return (
                  <div key={ev} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-1.5 rounded-full transition-all duration-300 ${done ? 'bg-amber-500' : isCurrent ? 'bg-amber-500/30' : 'bg-slate-700'}`} />
                    <div className={`text-[9px] text-center leading-tight transition-colors ${done ? 'text-amber-400' : isCurrent ? 'text-amber-500/60' : 'text-slate-600'}`}>
                      {ev === 'arrived_pickup' ? 'Pickup' : ev === 'loaded_departing' ? 'Loaded' : ev === 'arrived_delivery' ? 'Delivery' : 'Done'}
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
                <div key={ci.id} className="flex items-start gap-2 py-2 px-3 rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                  <CheckCircle size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-emerald-300 text-xs font-medium">{CHECKIN_EVENT_LABELS[ci.event]}</span>
                    {ci.notes && <div className="text-slate-500 text-[10px] mt-0.5 truncate">{ci.notes}</div>}
                  </div>
                  <span className="text-slate-600 text-[10px] flex-shrink-0">{fmtTs(ci.timestamp)}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Primary next check-in button ── */}
          {nextEvent && (
            <button
              onClick={() => ['detention_start','layover_start','tonu','breakdown','accident'].includes(nextEvent)
                ? setPendingEvent(nextEvent)
                : handleCheckin(nextEvent)
              }
              disabled={loading}
              className={`w-full rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${CHECKIN_CONFIGS[nextEvent].bg} ${CHECKIN_CONFIGS[nextEvent].color} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              style={{ height: '60px', border: `1px solid`, borderColor: CHECKIN_CONFIGS[nextEvent].border, boxShadow: '0 4px 20px rgba(245,158,11,0.15)' }}>
              {React.createElement(CHECKIN_CONFIGS[nextEvent].Icon, { size: 22 })}
              {loading ? 'Logging…' : CHECKIN_CONFIGS[nextEvent].label}
            </button>
          )}
          {!nextEvent && doneEvents.has('delivered') && (
            <div className="w-full rounded-2xl flex items-center justify-center gap-2 py-4 text-emerald-400 font-semibold"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <CheckCircle size={20} />
              All check-ins complete — great job!
            </div>
          )}

          {/* ── Other events: Detention, Layover, TONU, Breakdown ── */}
          {otherEvents.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowOtherEvents(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-300 transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="font-semibold">Log Other Events (Detention, Layover, TONU…)</span>
                <ChevronDown size={14} className={`transition-transform ${showOtherEvents ? 'rotate-180' : ''}`} />
              </button>
              {showOtherEvents && (
                <div className="mt-2 space-y-2">
                  {otherEvents.map(ev => {
                    const cfg = CHECKIN_CONFIGS[ev];
                    const Icon = cfg.Icon;
                    return (
                      <button
                        key={ev}
                        onClick={() => setPendingEvent(ev)}
                        disabled={loading}
                        className={`w-full rounded-xl font-semibold text-sm flex items-center gap-3 px-4 transition-all active:scale-[0.99] ${cfg.bg} ${cfg.color}`}
                        style={{ height: '48px', border: `1px solid`, borderColor: cfg.border }}>
                        <Icon size={18} />
                        <span className="flex-1 text-left">{cfg.label}</span>
                        {cfg.subLabel && <span className="text-[10px] opacity-70 hidden sm:inline">{cfg.subLabel}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Document Uploads ─────────────────────────────────────────── */}
        {showUploads && (
          <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="pt-4">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Documents & Photos</div>
              <div className="space-y-2">

                {/* Rate Con */}
                <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <FileUp size={17} className={load.ratConUrl ? 'text-emerald-400' : 'text-slate-500'} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${load.ratConUrl ? 'text-emerald-300' : 'text-slate-400'}`}>
                      {load.ratConUrl ? '✓ Rate Confirmation' : 'Rate Confirmation'}
                    </div>
                    <div className="text-xs text-slate-600">{load.ratConUrl ? 'Uploaded by dispatcher' : 'Provided by dispatcher'}</div>
                  </div>
                  {load.ratConUrl && (
                    <a href={load.ratConUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <Download size={12} />View
                    </a>
                  )}
                </div>

                {/* BOL */}
                <input ref={bolRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleBolUpload} />
                <button onClick={() => bolRef.current?.click()} disabled={uploadingBol}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all active:scale-[0.99] ${hasBol ? 'text-emerald-400' : 'text-slate-300 hover:text-white'} ${uploadingBol ? 'opacity-60' : ''}`}
                  style={{ background: hasBol ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: hasBol ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
                  {uploadingBol ? <RefreshCw size={18} className="text-amber-500 animate-spin" /> : <FileUp size={18} className={hasBol ? 'text-emerald-400' : 'text-amber-500'} />}
                  <span className="flex-1 text-left">{uploadingBol ? 'Uploading BOL…' : hasBol ? '✓ BOL Uploaded' : 'Upload BOL'}</span>
                  {hasBol && <a href={load.bolUrl!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-400"><Download size={12} />View</a>}
                  {!hasBol && !uploadingBol && <Camera size={16} className="text-slate-600" />}
                </button>

                {/* POD */}
                <input ref={podRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handlePodUpload} />
                <button onClick={() => podRef.current?.click()} disabled={uploadingPod}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all active:scale-[0.99] ${hasPod ? 'text-emerald-400' : 'text-slate-300 hover:text-white'} ${uploadingPod ? 'opacity-60' : ''}`}
                  style={{ background: hasPod ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: hasPod ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
                  {uploadingPod ? <RefreshCw size={18} className="text-amber-500 animate-spin" /> : <FileUp size={18} className={hasPod ? 'text-emerald-400' : 'text-amber-500'} />}
                  <span className="flex-1 text-left">{uploadingPod ? 'Uploading POD…' : hasPod ? '✓ POD Uploaded' : 'Upload POD'}</span>
                  {hasPod && <a href={load.podUrl!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-400"><Download size={12} />View</a>}
                  {!hasPod && !uploadingPod && <Camera size={16} className="text-slate-600" />}
                </button>

                {/* Cargo Photos */}
                <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
                <button onClick={() => photoRef.current?.click()} disabled={uploadingPhotos}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all active:scale-[0.99] text-slate-300 hover:text-white ${uploadingPhotos ? 'opacity-60' : ''}`}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {uploadingPhotos ? <RefreshCw size={18} className="text-amber-500 animate-spin" /> : <Camera size={18} className="text-amber-500" />}
                  <span className="flex-1 text-left">{uploadingPhotos ? 'Uploading photos…' : 'Upload Cargo Photos'}</span>
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
    </>
  );
}

// ─── Past Load Row ─────────────────────────────────────────────────────────────

function PastLoadRow({ load }: { load: SonexLoad }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: 'rgba(13,31,60,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-mono text-amber-400 text-sm font-bold">{load.loadNumber}</span>
          <StatusBadge status={load.status} />
        </div>
        <div className="text-slate-300 text-xs truncate">
          {load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}
        </div>
        <div className="text-slate-500 text-xs mt-0.5">{fmtDate(load.pickupDate)} · {load.miles.toLocaleString()} mi</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-slate-400 text-xs">Gross: <span className="text-slate-300 font-mono">{fmt$(load.rate)}</span></div>
        <div className="text-amber-400 text-base font-bold font-mono">{fmt$(load.carrierNet)}</div>
        <div className="text-slate-600 text-[10px]">net pay</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CarrierLoadsPage() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!carrierId) return;
    const all = await getLoadsByCarrier(carrierId);
    all.sort((a, b) => {
      const aActive = ACTIVE_STATUSES.includes(a.status);
      const bActive = ACTIVE_STATUSES.includes(b.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime();
    });
    setLoads(all);
    setLoading(false);
  }, [carrierId]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeLoad = loads.find(l => ACTIVE_STATUSES.includes(l.status));
  const pastLoads = loads.filter(l => COMPLETED_STATUSES.includes(l.status));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-black text-white tracking-tight">My Loads</h1>
        <p className="text-slate-500 text-sm mt-0.5">Active assignment and history</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-amber-500 animate-spin" />
        </div>
      ) : activeLoad ? (
        <ActiveLoadCard load={activeLoad} onRefresh={refresh} />
      ) : (
        <EmptyState />
      )}

      {pastLoads.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-amber-500/60" />
            <h2 className="text-base font-bold text-white">Recent Loads</h2>
            <span className="text-slate-600 text-sm">({pastLoads.length})</span>
          </div>
          <div className="space-y-2">
            {pastLoads.map(load => <PastLoadRow key={load.id} load={load} />)}
          </div>
        </div>
      )}
    </div>
  );
}
