'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck, MapPin, PackageCheck, CheckCircle, Camera, FileUp, Download,
  AlertTriangle, Clock, Weight, DollarSign, Building2, Timer,
  Moon, Zap, XCircle, PhoneCall, ChevronDown, RefreshCw, Plus,
  Image as ImageIcon, FileText, Trash2, Eye, Navigation, AlertOctagon, Wrench,
  Sparkles, UploadCloud, Loader2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSonexAuth } from '@/lib/sonexAuth';
import { FuelPriceWidget } from '@/components/sonex/FuelPriceWidget';
import {
  getLoadsByCarrier, getCheckins, addCheckin, updateLoad,
  addCargoPhoto, getCargoPhotos, addLoad, getCarrier,
} from '@/lib/sonexStore';
import { uploadFile, uploadFiles } from '@/lib/storageUtils';
import type { SonexLoad, SonexLoadCheckin, SonexCargoPhoto, CheckinEvent, LoadStatus, SonexCarrier } from '@/lib/sonexTypes';
import { LOAD_STATUS_LABELS, CHECKIN_EVENT_LABELS } from '@/lib/sonexTypes';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PhotoStage = 'pickup' | 'delivery';

interface StageUploadConfig {
  key: string;
  stage: PhotoStage;
  label: string;
  sublabel: string;
  docField?: 'bolUrl' | 'podUrl';
  advancesStatus?: LoadStatus;
  color: string;
  bg: string;
  border: string;
  Icon: React.ElementType;
  accept: string;
  multiple: boolean;
  unlock: CheckinEvent[];  // which checkin events must be done to unlock this slot
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ACTIVE_STATUSES: LoadStatus[] = ['booked', 'dispatched', 'in_transit'];
const COMPLETED_STATUSES: LoadStatus[] = ['delivered', 'pod_received', 'invoiced', 'paid'];
const CORE_CHECKIN_ORDER: CheckinEvent[] = ['arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered'];

function fmt$(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
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

const STATUS_COLORS: Record<LoadStatus, string> = {
  booked: 'bg-blue-50 text-blue-700 border-blue-200',
  dispatched: 'bg-sky-50 text-sky-700 border-sky-200',
  in_transit: 'bg-amber-50 text-amber-700 border-amber-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pod_received: 'bg-teal-50 text-teal-700 border-teal-200',
  invoiced: 'bg-violet-50 text-violet-700 border-violet-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
};

const CHECKIN_CONFIGS: Record<CheckinEvent, {
  label: string; subLabel?: string;
  Icon: React.ElementType; color: string; bg: string; border: string;
}> = {
  arrived_pickup:   { label: 'Arrived at Pickup',  Icon: Truck,        color: 'text-white', bg: 'bg-violet-600 hover:bg-violet-700', border: 'border-violet-600' },
  loaded_departing: { label: 'Loaded - Departing', Icon: PackageCheck, color: 'text-white', bg: 'bg-violet-600 hover:bg-violet-700', border: 'border-violet-600' },
  arrived_delivery: { label: 'Arrived at Delivery',Icon: MapPin,       color: 'text-white', bg: 'bg-violet-600 hover:bg-violet-700', border: 'border-violet-600' },
  delivered:        { label: 'Mark as Delivered',  Icon: CheckCircle,  color: 'text-white', bg: 'bg-emerald-600 hover:bg-emerald-500',border: 'border-emerald-500' },
  detention_start:  { label: 'Start Detention',    subLabel: 'Waiting at facility', Icon: Timer, color: 'text-black', bg: 'bg-orange-500 hover:bg-orange-400', border: 'border-orange-400' },
  detention_end:    { label: 'End Detention',      Icon: Timer,        color: 'text-white', bg: 'bg-orange-700 hover:bg-orange-600',  border: 'border-orange-600' },
  layover_start:    { label: 'Start Layover',      subLabel: 'Overnight hold', Icon: Moon, color: 'text-black', bg: 'bg-violet-500 hover:bg-violet-400',  border: 'border-violet-400' },
  layover_end:      { label: 'End Layover',        Icon: Moon,         color: 'text-white', bg: 'bg-violet-700 hover:bg-violet-600',  border: 'border-violet-600' },
  tonu:             { label: 'TONU',               subLabel: 'Truck Ordered Not Used', Icon: XCircle, color: 'text-white', bg: 'bg-red-700 hover:bg-red-600', border: 'border-red-500' },
  breakdown:        { label: 'Report Breakdown',   Icon: Zap,          color: 'text-black', bg: 'bg-red-500 hover:bg-red-400',       border: 'border-red-400' },
  accident:         { label: 'Report Accident',    Icon: AlertTriangle,color: 'text-black', bg: 'bg-red-600 hover:bg-red-500',       border: 'border-red-400' },
};

function getNextCheckin(checkins: SonexLoadCheckin[]): CheckinEvent | null {
  const done = new Set(checkins.map(c => c.event));
  for (const ev of CORE_CHECKIN_ORDER) {
    if (!done.has(ev)) return ev;
  }
  return null;
}

// â”€â”€â”€ Upload slot config per stage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getUploadSlots(doneEvents: Set<CheckinEvent>): StageUploadConfig[] {
  return [
    // â”€â”€ Pickup stage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      key: 'bol',
      stage: 'pickup',
      label: 'Bill of Lading (BOL)',
      sublabel: 'Signed BOL at pickup - required',
      docField: 'bolUrl',
      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',
      Icon: FileText,
      accept: 'image/*,application/pdf',
      multiple: false,
      unlock: ['arrived_pickup'],
    },
    {
      key: 'bol-photos',
      stage: 'pickup',
      label: 'BOL Photos',
      sublabel: 'Photos of all BOL pages',
      color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)',
      Icon: Camera,
      accept: 'image/*',
      multiple: true,
      unlock: ['arrived_pickup'],
    },
    {
      key: 'commodity',
      stage: 'pickup',
      label: 'Commodity Photos',
      sublabel: 'Photos of load / freight condition',
      color: '#06B6D4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.20)',
      Icon: Camera,
      accept: 'image/*',
      multiple: true,
      unlock: ['arrived_pickup'],
    },
    {
      key: 'scale-ticket',
      stage: 'pickup',
      label: 'Scale Ticket',
      sublabel: 'Weight slip if overweight load',
      color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.20)',
      Icon: Camera,
      accept: 'image/*,application/pdf',
      multiple: false,
      unlock: ['arrived_pickup'],
    },
    {
      key: 'pickup-misc',
      stage: 'pickup',
      label: 'Other Pickup Docs',
      sublabel: 'Any other pickup paperwork',
      color: '#64748B', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.20)',
      Icon: FileUp,
      accept: 'image/*,application/pdf',
      multiple: true,
      unlock: ['arrived_pickup'],
    },
    // â”€â”€ Delivery stage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      key: 'pod',
      stage: 'delivery',
      label: 'Proof of Delivery (POD)',
      sublabel: 'Signed POD - advances status',
      docField: 'podUrl',
      advancesStatus: 'pod_received',
      color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)',
      Icon: FileText,
      accept: 'image/*,application/pdf',
      multiple: false,
      unlock: ['arrived_delivery'],
    },
    {
      key: 'pod-photos',
      stage: 'delivery',
      label: 'POD Photos',
      sublabel: 'Photos of signed POD pages',
      color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)',
      Icon: Camera,
      accept: 'image/*',
      multiple: true,
      unlock: ['arrived_delivery'],
    },
    {
      key: 'delivery-condition',
      stage: 'delivery',
      label: 'Delivery Condition',
      sublabel: 'Photos of unloaded freight',
      color: '#06B6D4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.20)',
      Icon: Camera,
      accept: 'image/*',
      multiple: true,
      unlock: ['arrived_delivery'],
    },
    {
      key: 'lumper-receipt',
      stage: 'delivery',
      label: 'Lumper Receipt',
      sublabel: 'Unloading fee receipt (if paid)',
      color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.20)',
      Icon: FileText,
      accept: 'image/*,application/pdf',
      multiple: false,
      unlock: ['arrived_delivery'],
    },
    {
      key: 'detention-receipt',
      stage: 'delivery',
      label: 'Detention / Layover Receipt',
      sublabel: 'Any detention or layover paperwork',
      color: '#A855F7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.20)',
      Icon: FileText,
      accept: 'image/*,application/pdf',
      multiple: false,
      unlock: ['arrived_delivery'],
    },
    {
      key: 'delivery-misc',
      stage: 'delivery',
      label: 'Other Delivery Docs',
      sublabel: 'Receipts, exceptions, claims',
      color: '#64748B', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.20)',
      Icon: FileUp,
      accept: 'image/*,application/pdf',
      multiple: true,
      unlock: ['arrived_delivery'],
    },
  ];
}

// â”€â”€â”€ Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusBadge({ status }: { status: LoadStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[status]}`}>
      {LOAD_STATUS_LABELS[status]}
    </span>
  );
}

// â”€â”€â”€ Notes Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            placeholder="Add any details about this event..."
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
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all bg-amber-500 text-black hover:bg-amber-400 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {loading ? 'Logging...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Photo Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PhotoGrid({ photos, label }: { photos: SonexCargoPhoto[]; label: string }) {
  if (!photos.length) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">{label} — {photos.length} photo{photos.length !== 1 ? 's' : ''}</div>
      <div className="flex flex-wrap gap-1.5">
        {photos.map(p => (
          <button key={p.id} onClick={() => openDocument(p.url)}
            className="w-14 h-14 rounded-xl overflow-hidden relative group text-left" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption || 'photo'} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye size={14} className="text-white" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// â”€â”€â”€ Upload Slot Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface UploadSlotProps {
  slot: StageUploadConfig;
  load: SonexLoad;
  photos: SonexCargoPhoto[];
  doneEvents: Set<CheckinEvent>;
  onRefresh: () => void;
  carrierId: string;
}

function UploadSlotCard({ slot, load, photos, doneEvents, onRefresh, carrierId }: UploadSlotProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const unlocked = slot.unlock.every(ev => doneEvents.has(ev));
  const slotPhotos = photos.filter(p => p.caption?.startsWith(`[${slot.key}]`));
  
  // For docField slots, check if the doc URL exists on the load
  const docUrl = slot.docField ? (load as any)[slot.docField] as string | undefined : undefined;
  const hasContent = slot.docField ? !!docUrl : slotPhotos.length > 0;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      if (slot.docField) {
        // Single doc upload â€” store URL in load record
        const file = files[0];
        const result = await uploadFile(file, 'load-documents', `${load.id}/${slot.key}`);
        const updateData: Partial<SonexLoad> = { [slot.docField]: result.url } as any;
        // POD is unlocked only after arrival at delivery. Promote it immediately so
        // the carrier does not lose the paperwork action when the load leaves active work.
        if (slot.advancesStatus) {
          (updateData as any).status = slot.advancesStatus;
        }
        await updateLoad(load.id, updateData as any);
        toast.success(`✓ ${slot.label} uploaded!`);
      } else {
        // Photo(s) upload â€” store as cargo photos
        const results = await uploadFiles(files, 'cargo-photos', `${load.id}`);
        for (const result of results) {
          await addCargoPhoto({
            loadId: load.id,
            url: result.url,
            stage: slot.stage,
            caption: `[${slot.key}] ${slot.label} — ${new Date().toLocaleTimeString()}`,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'carrier',
          });
        }
        toast.success(`✓ ${results.length} photo${results.length > 1 ? 's' : ''} uploaded!`);
      }
      onRefresh();
    } catch (e: any) {
      console.error('Upload error:', e);
      toast.error(`Upload failed: ${e?.message || e || 'Unknown error'}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={`rounded-xl p-3 transition-all ${!unlocked ? 'opacity-40' : ''}`}
      style={{ background: hasContent ? slot.bg : 'rgba(255,255,255,0.025)', border: `1px solid ${hasContent ? slot.border : 'rgba(255,255,255,0.06)'}` }}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: slot.bg, border: `1px solid ${slot.border}` }}>
          <slot.Icon size={14} style={{ color: slot.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-white leading-tight">{slot.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{slot.sublabel}</div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {docUrl && (
                <button onClick={() => openDocument(docUrl)}
                  className="p-1.5 rounded-lg text-amber-400 hover:bg-white/10 transition-colors" title="View">
                  <Eye size={12} />
                </button>
              )}
              <button
                onClick={() => unlocked && fileRef.current?.click()}
                disabled={uploading || !unlocked}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10 disabled:cursor-not-allowed"
                style={{ color: unlocked ? slot.color : '#475569' }}
                title={unlocked ? `Upload ${slot.label}` : `Complete: ${slot.unlock.map(e => CHECKIN_EVENT_LABELS[e]).join(', ')} first`}>
                {uploading ? <RefreshCw size={12} className="animate-spin" /> : <Camera size={12} />}
              </button>
            </div>
          </div>
          {hasContent && !slot.docField && (
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle size={9} /> {slotPhotos.length} photo{slotPhotos.length !== 1 ? 's' : ''} uploaded
            </div>
          )}
          {docUrl && (
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle size={9} /> Uploaded ✓
            </div>
          )}
          {!unlocked && (
            <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
              <Clock size={9} /> Unlocks after: {slot.unlock.map(e => CHECKIN_EVENT_LABELS[e]).join(', ')}
            </div>
          )}
        </div>
      </div>
      {/* Photo thumbnails */}
      {slotPhotos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {slotPhotos.slice(0, 6).map(p => (
            <button key={p.id} onClick={() => openDocument(p.url)}
              className="w-10 h-10 rounded-lg overflow-hidden text-left" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {slotPhotos.length > 6 && (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-800 text-slate-400 text-[10px] font-bold">
              +{slotPhotos.length - 6}
            </div>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={slot.accept}
        multiple={slot.multiple}
        capture={slot.accept.includes('image') && !slot.accept.includes('pdf') ? 'environment' : undefined}
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

/**
 * Live ticking clock for active Detention or Layover times.
 */
function LiveTimer({ startTime, label, colorClass = 'text-amber-400' }: { startTime: string; label: string; colorClass?: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const update = () => {
      const diffMs = Date.now() - start;
      const secs = Math.floor(diffMs / 1000) % 60;
      const mins = Math.floor(diffMs / 60000) % 60;
      const hrs = Math.floor(diffMs / 3600000);
      setElapsed(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 animate-pulse mb-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="text-slate-300 text-xs font-semibold">{label}</span>
      </div>
      <span className={`font-mono font-black text-sm ${colorClass}`}>{elapsed}</span>
    </div>
  );
}

// â”€â”€â”€ Active Load Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ActiveLoadCardProps {
  load: SonexLoad;
  onRefresh: () => void;
}

function ActiveLoadCard({ load, onRefresh }: ActiveLoadCardProps) {
  const [checkins, setCheckins] = useState<SonexLoadCheckin[]>([]);
  const [photos, setPhotos] = useState<SonexCargoPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOtherEvents, setShowOtherEvents] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<CheckinEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'checkin' | 'docs'>('checkin');
  const { user } = useSonexAuth();

  const refreshDetail = useCallback(async () => {
    const [cis, ph] = await Promise.all([getCheckins(load.id), getCargoPhotos(load.id)]);
    setCheckins(cis); setPhotos(ph);
  }, [load.id]);

  useEffect(() => { refreshDetail(); }, [refreshDetail]);

  const nextEvent = getNextCheckin(checkins);
  const doneEvents = new Set(checkins.map(c => c.event));
  const hasDetentionRunning = doneEvents.has('detention_start') && !doneEvents.has('detention_end');
  const hasLayoverRunning = doneEvents.has('layover_start') && !doneEvents.has('layover_end');

  async function handleCheckin(event: CheckinEvent, notes: string = '') {
    if (loading) return;
    setLoading(true);
    setPendingEvent(null);
    try {
      await addCheckin({ loadId: load.id, event, timestamp: new Date().toISOString(), notes, loggedBy: 'carrier' });
      toast.success(`✓ ${CHECKIN_EVENT_LABELS[event]} logged!`, {
        style: { background: '#0D1F3C', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' },
      });
      await refreshDetail();
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log event. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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

  const uploadSlots = getUploadSlots(doneEvents);
  const pickupSlots = uploadSlots.filter(s => s.stage === 'pickup');
  const deliverySlots = uploadSlots.filter(s => s.stage === 'delivery');

  // Count uploaded items
  const uploadedCount = uploadSlots.filter(s => {
    if (s.docField) return !!(load as any)[s.docField];
    return photos.some(p => p.caption?.startsWith(`[${s.key}]`));
  }).length;

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
        background: '#ffffff',
        border: '1px solid #dbe4ef',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid #ede9fe', background: '#f5f3ff' }}>
          <div>
            <div className="text-[11px] text-violet-600 font-semibold tracking-widest uppercase mb-0.5">Active assignment</div>
            <div className="text-xl font-black text-violet-700 font-mono tracking-tight">
              {load.loadNumber}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={load.status} />
            {load.brokerPhone && (
              <a href={`tel:${load.brokerPhone}`}
                className="w-9 h-9 rounded-md flex items-center justify-center bg-white hover:bg-violet-50 border border-violet-200 transition-colors">
                <PhoneCall size={15} className="text-violet-700" />
              </a>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="px-5 py-4">
          <div className="flex items-stretch gap-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="w-3 h-3 rounded-full border-2 border-violet-600 bg-violet-100" />
              <div className="flex-1 w-0.5 bg-gradient-to-b from-violet-500/60 to-sky-400/40 min-h-[28px]" />
              <MapPin size={14} className="text-sky-600" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold text-sm leading-snug">{load.pickupCity}, {load.pickupState}</div>
                  <div className="text-slate-400 text-xs mt-0.5 truncate">{load.pickupFacility} {load.pickupAddress && ` · ${load.pickupAddress}`}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                    <Clock size={11} />{fmtDate(load.pickupDate)} · {fmtTime(load.pickupTime)}
                    {load.pickupApptNumber && <span className="text-amber-500/70"> · Appt #{load.pickupApptNumber}</span>}
                  </div>
                </div>
                <a href={`geo:0,0?q=${encodeURIComponent(`${load.pickupFacility} ${load.pickupAddress || ''} ${load.pickupCity} ${load.pickupState} ${load.pickupZip || ''}`)}(${encodeURIComponent(load.pickupFacility.replace(/[()]/g, ''))})`}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors shrink-0">
                  <Navigation size={10} /> Navigate
                </a>
              </div>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold text-sm leading-snug">{load.deliveryCity}, {load.deliveryState}</div>
                  <div className="text-slate-400 text-xs mt-0.5 truncate">{load.deliveryFacility} {load.deliveryAddress && `· ${load.deliveryAddress}`}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                    <Clock size={11} />{fmtDate(load.deliveryDate)} · {fmtTime(load.deliveryTime)}
                    {load.deliveryApptNumber && <span className="text-amber-500/70"> · Appt #{load.deliveryApptNumber}</span>}
                  </div>
                </div>
                <a href={`geo:0,0?q=${encodeURIComponent(`${load.deliveryFacility} ${load.deliveryAddress || ''} ${load.deliveryCity} ${load.deliveryState} ${load.deliveryZip || ''}`)}(${encodeURIComponent(load.deliveryFacility.replace(/[()]/g, ''))})`}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors shrink-0">
                  <Navigation size={10} /> Navigate
                </a>
              </div>
            </div>
          </div>

          {/* Cargo + Broker */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md px-3 py-2.5 bg-slate-50 border border-slate-200">
              <div className="text-slate-500 text-[10px] uppercase tracking-widest flex items-center gap-1 mb-0.5"><Weight size={10} />Cargo</div>
              <div className="text-white text-sm font-medium truncate">{load.commodity}</div>
              <div className="text-slate-400 text-xs">{load.weight.toLocaleString()} lbs · {load.miles.toLocaleString()} mi</div>
            </div>
            <div className="rounded-md px-3 py-2.5 bg-slate-50 border border-slate-200">
              <div className="text-slate-500 text-[10px] uppercase tracking-widest flex items-center gap-1 mb-0.5"><Building2 size={10} />Broker</div>
              <div className="text-white text-sm font-medium truncate">{load.brokerName}</div>
              <div className="text-slate-400 text-xs">{load.brokerContact || load.brokerPhone}</div>
            </div>
          </div>

          {/* Pay */}
          <div className="mt-3 rounded-md px-4 py-3 bg-violet-50 border border-violet-100">
            <div className="flex items-center justify-between">
              <div><div className="text-slate-400 text-xs mb-0.5">Gross</div><div className="text-slate-300 text-sm font-mono">{fmt$(load.rate)}</div></div>
              <div className="text-slate-600 text-sm">-</div>
              <div><div className="text-slate-400 text-xs mb-0.5">Fee ({load.dispatchFeePercent}%)</div><div className="text-slate-400 text-sm font-mono">{fmt$(load.dispatchFeeAmount)}</div></div>
              <div className="text-violet-500 text-sm">=</div>
              <div className="text-right"><div className="text-violet-600 text-xs mb-0.5">Your Net</div><div className="text-violet-700 text-xl font-black font-mono">{fmt$(load.carrierNet)}</div></div>
            </div>
          </div>

          {load.notes && (
            <div className="mt-3 px-3 py-2.5 rounded-xl flex gap-2" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-300 text-xs leading-relaxed">{load.notes}</p>
            </div>
          )}
        </div>

        {/* â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ borderTop: '1px solid #e2e8f0' }}>
          <div className="flex" style={{ borderBottom: '1px solid #e2e8f0' }}>
            {[
              { id: 'checkin', label: 'Check-In' },
              { id: 'docs', label: `Documents & Photos${uploadedCount > 0 ? ` (${uploadedCount})` : ''}` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === tab.id ? 'text-violet-700' : 'text-slate-500 hover:text-slate-800'}`}
                style={{ borderBottom: activeTab === tab.id ? '2px solid #6d28d9' : '2px solid transparent' }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* â”€â”€ Check-In Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'checkin' && (
            <div className="px-5 py-5 space-y-4">
              {/* Live Active Timers */}
              {doneEvents.has('arrived_pickup') && !doneEvents.has('loaded_departing') && checkins.find(c => c.event === 'arrived_pickup') && (
                <LiveTimer 
                  startTime={checkins.find(c => c.event === 'arrived_pickup')!.timestamp} 
                  label="Pickup Dwell Timer" 
                  colorClass="text-amber-400"
                />
              )}
              {doneEvents.has('arrived_delivery') && !doneEvents.has('delivered') && checkins.find(c => c.event === 'arrived_delivery') && (
                <LiveTimer 
                  startTime={checkins.find(c => c.event === 'arrived_delivery')!.timestamp} 
                  label="Delivery Dwell Timer" 
                  colorClass="text-amber-400"
                />
              )}
              {hasDetentionRunning && checkins.find(c => c.event === 'detention_start') && (
                <LiveTimer 
                  startTime={checkins.find(c => c.event === 'detention_start')!.timestamp} 
                  label="Active Facility Detention Timer" 
                />
              )}
              {hasLayoverRunning && checkins.find(c => c.event === 'layover_start') && (
                <LiveTimer 
                  startTime={checkins.find(c => c.event === 'layover_start')!.timestamp} 
                  label="Active Overnight Layover Timer" 
                  colorClass="text-violet-400" 
                />
              )}

              {/* Progress bar */}
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Trip Progress</div>
                <div className="flex gap-1.5">
                  {CORE_CHECKIN_ORDER.map(ev => {
                    const done = doneEvents.has(ev);
                    const isCurrent = ev === nextEvent;
                    return (
                      <div key={ev} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full h-1.5 rounded-full transition-all ${done ? 'bg-amber-500' : isCurrent ? 'bg-amber-500/30' : 'bg-slate-700'}`} />
                        <div className={`text-[9px] text-center ${done ? 'text-amber-400' : isCurrent ? 'text-amber-500/60' : 'text-slate-600'}`}>
                          {ev === 'arrived_pickup' ? 'Pickup' : ev === 'loaded_departing' ? 'Loaded' : ev === 'arrived_delivery' ? 'Delivery' : 'Done'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Completed events */}
              {checkins.length > 0 && (
                <div className="space-y-1.5">
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

              {/* Primary next button */}
              {nextEvent && (
                <button
                  onClick={() => ['detention_start','layover_start','tonu','breakdown','accident'].includes(nextEvent)
                    ? setPendingEvent(nextEvent) : handleCheckin(nextEvent)}
                  disabled={loading}
                  className={`w-full rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${CHECKIN_CONFIGS[nextEvent].bg} ${CHECKIN_CONFIGS[nextEvent].color} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  style={{ height: '60px', boxShadow: '0 8px 20px rgba(109,40,217,0.22)' }}>
                  {React.createElement(CHECKIN_CONFIGS[nextEvent].Icon, { size: 22 })}
                  {loading ? 'Logging...' : CHECKIN_CONFIGS[nextEvent].label}
                </button>
              )}
              {!nextEvent && doneEvents.has('delivered') && (
                <div className="w-full rounded-2xl flex items-center justify-center gap-2 py-4 text-emerald-400 font-semibold"
                  style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <CheckCircle size={20} /> All check-ins complete — great job!
                </div>
              )}

              {/* Other events */}
              {otherEvents.length > 0 && (
                <div>
                  <button onClick={() => setShowOtherEvents(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-300 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="font-semibold">Log: Detention · Layover · TONU · Breakdown · Accident</span>
                    <ChevronDown size={14} className={`transition-transform ${showOtherEvents ? 'rotate-180' : ''}`} />
                  </button>
                  {showOtherEvents && (
                    <div className="mt-2 space-y-2">
                      {otherEvents.map(ev => {
                        const cfg = CHECKIN_CONFIGS[ev];
                        return (
                          <button key={ev} onClick={() => setPendingEvent(ev)} disabled={loading}
                            className={`w-full rounded-xl font-semibold text-sm flex items-center gap-3 px-4 transition-all ${cfg.bg} ${cfg.color}`}
                            style={{ height: '48px', border: '1px solid', borderColor: cfg.border.replace('border-','') }}>
                            {React.createElement(cfg.Icon, { size: 18 })}
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
          )}

          {/* â”€â”€ Documents & Photos Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'docs' && (
            <div className="px-5 py-5 space-y-5">
              {/* Rate Con */}
              {load.ratConUrl && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-emerald-300 text-sm font-medium">Rate Confirmation</div>
                    <div className="text-slate-500 text-xs">Provided by dispatcher</div>
                  </div>
                  <button onClick={() => openDocument(load.ratConUrl ?? '')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-amber-400"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <Eye size={12} /> View
                  </button>
                </div>
              )}

              {/* Pickup section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Truck size={11} className="text-amber-400" />
                  </div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Pickup Documents</span>
                  {!doneEvents.has('arrived_pickup') && (
                    <span className="text-[10px] text-slate-600 italic">— Unlocks after "Arrived at Pickup"</span>
                  )}
                </div>
                <div className="space-y-2">
                  {pickupSlots.map(slot => (
                    <UploadSlotCard
                      key={slot.key} slot={slot} load={load} photos={photos}
                      doneEvents={doneEvents} onRefresh={async () => { await refreshDetail(); onRefresh(); }}
                      carrierId={user?.carrierId ?? ''}
                    />
                  ))}
                </div>
              </div>

              {/* Delivery section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <MapPin size={11} className="text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Delivery Documents</span>
                  {!doneEvents.has('arrived_delivery') && (
                    <span className="text-[10px] text-slate-600 italic">— Unlocks after "Arrived at Delivery"</span>
                  )}
                </div>
                <div className="space-y-2">
                  {deliverySlots.map(slot => (
                    <UploadSlotCard
                      key={slot.key} slot={slot} load={load} photos={photos}
                      doneEvents={doneEvents} onRefresh={async () => { await refreshDetail(); onRefresh(); }}
                      carrierId={user?.carrierId ?? ''}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// â”€â”€â”€ Past Load Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PastLoadRow({ load }: { load: SonexLoad }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: '#ffffff', border: '1px solid #dbe4ef' }}
    >
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
      <div className="text-right flex-shrink-0 mr-1">
        <div className="text-slate-400 text-xs">Gross: <span className="text-slate-300 font-mono">{fmt$(load.rate)}</span></div>
        <div className="text-amber-400 text-base font-bold font-mono">{fmt$(load.carrierNet)}</div>
        <div className="text-slate-600 text-[10px]">net pay</div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function CarrierLoadsPage() {
  const { user } = useSonexAuth();
  
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Effective carrierId
  const carrierId = user?.carrierId || '';

  const refresh = useCallback(async () => {
    if (!carrierId) {
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    const isFirst = loads.length === 0;
    if (isFirst) setInitialLoading(true);
    try {
      const all = await getLoadsByCarrier(carrierId);
      all.sort((a, b) => {
        const aActive = ACTIVE_STATUSES.includes(a.status);
        const bActive = ACTIVE_STATUSES.includes(b.status);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime();
      });
      setLoads(all);
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.includes('session has expired')) {
        window.location.assign('/sonex/login');
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [carrierId, loads.length]);

  const activeLoad = loads.find(l => ACTIVE_STATUSES.includes(l.status));
  const pastLoads = loads.filter(l => COMPLETED_STATUSES.includes(l.status));

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div data-carrier-workspace className="mx-auto max-w-[1180px] px-3 py-5 sm:px-5 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">My Loads</h1>
          <p className="text-slate-500 text-sm mt-0.5">Active assignment and history</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="tel:(346)421-2681" 
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all shrink-0 tracking-wide uppercase">
            <AlertOctagon size={13} className="animate-pulse" />
            SOS Support
          </a>
        </div>
      </div>

      {!carrierId ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl border border-white/[0.06] bg-white/[0.01]">
          <div className="w-16 h-16 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-amber-500" />
          </div>
          <h3 className="text-white text-base font-bold mb-1">Carrier Link Required</h3>
          <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
            This account is not linked to any carrier profile in the database. Please select a carrier from the simulator above to preview the portal features.
          </p>
        </div>
      ) : initialLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-amber-500 animate-spin" />
        </div>
      ) : activeLoad ? (
        <ActiveLoadCard load={activeLoad} onRefresh={refresh} />
      ) : (
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
      )}

      {carrierId && pastLoads.length > 0 && (
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

      {/* Fuel Pricing Widget */}
      <FuelPriceWidget />

    </div>
  );
}

interface NewCarrierLoadModalProps {
  carrierId: string;
  carrierFee: number;
  onClose: () => void;
  onSaved: () => void;
}

function NewCarrierLoadModal({ carrierId, carrierFee, onClose, onSaved }: NewCarrierLoadModalProps) {
  const [form, setForm] = useState({
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

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.pickupDate || !form.deliveryDate || !form.rate) {
      toast.error('Required fields: pickup date, delivery date, and rate.');
      return;
    }
    try {
      await addLoad({
        ...form,
        carrierId,
        dispatchFeePercent: carrierFee,
        ratConUrl: undefined,
        bolUrl: undefined,
        podUrl: undefined,
      });
      toast.success('Load added successfully!');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save load: ' + (err?.message || err));
    }
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
        className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500/30"
      />
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
            <Plus size={16} className="text-amber-400" /> Add Load Manually
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
            This load will be added manually to your carrier dashboard.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">{input('Broker Name', 'brokerName', 'text', 'C.H. Robinson')}</div>
            {input('Contact Name', 'brokerContact')}
            {input('Broker Phone', 'brokerPhone', 'tel')}
            {input('Broker Email', 'brokerEmail', 'email')}
            {input('Broker MC #', 'brokerMC')}
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pickup Stops</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">{input('Facility Name', 'pickupFacility', 'text', 'Logistics Terminal', true)}</div>
              <div className="col-span-2">{input('Address', 'pickupAddress')}</div>
              {input('City', 'pickupCity')}
              {input('State', 'pickupState', 'text', 'TX')}
              {input('ZIP', 'pickupZip')}
              {input('Pickup Date', 'pickupDate', 'date', '', true)}
              {input('Pickup Time', 'pickupTime', 'time')}
              {input('Appt #', 'pickupApptNumber')}
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Delivery Stops</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">{input('Facility Name', 'deliveryFacility', 'text', 'Consignee Port', true)}</div>
              <div className="col-span-2">{input('Address', 'deliveryAddress')}</div>
              {input('City', 'deliveryCity')}
              {input('State', 'deliveryState', 'text', 'CA')}
              {input('ZIP', 'deliveryZip')}
              {input('Delivery Date', 'deliveryDate', 'date', '', true)}
              {input('Delivery Time', 'deliveryTime', 'time')}
              {input('Appt #', 'deliveryApptNumber')}
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Cargo & Rates</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">{input('Commodity', 'commodity', 'text', 'Steel Coils')}</div>
              {input('Weight (lbs)', 'weight', 'number')}
              {input('Miles', 'miles', 'number')}
              {input('Gross Rate ($)', 'rate', 'number', '', true)}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Load Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full rounded-xl px-3 py-2 bg-[#080B14] border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="booked">Booked</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Dispatch Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Operational details..."
              className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-[#03060E] shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 text-black hover:bg-amber-400 transition-all">
            Create Load
          </button>
        </div>
      </div>
    </div>
  );
}


