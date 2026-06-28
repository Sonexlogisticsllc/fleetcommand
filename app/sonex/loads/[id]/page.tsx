'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Check, DollarSign, ExternalLink, FileText,
  MapPin, Package, Save, Truck, Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CheckinTimeline } from '@/components/sonex/CheckinTimeline';
import { LoadStatusBadge, StatusPipeline } from '@/components/sonex/StatusPipeline';
import {
  addCheckin, computeLoadFinancials, getCarrier, getCarriers, getCheckins, getLoad,
  updateLoad,
} from '@/lib/sonexStore';
import type { CheckinEvent, LoadStatus, SonexCarrier, SonexLoad, SonexLoadCheckin } from '@/lib/sonexTypes';
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
  { field: 'bolUrl', label: 'BOL', hint: 'Bill of lading' },
  { field: 'podUrl', label: 'POD', hint: 'Proof of delivery' },
];

const CHECKIN_EVENTS: CheckinEvent[] = ['arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered'];

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
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input-primary py-2.5 text-sm"
      />
    </label>
  );
}

export default function LoadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loadId = params.id as string;
  const [load, setLoad] = useState<SonexLoad | null>(null);
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [checkins, setCheckins] = useState<SonexLoadCheckin[]>([]);

  const reload = () => {
    const found = getLoad(loadId);
    if (!found) {
      router.push('/sonex/loads');
      return;
    }
    setLoad(found);
    setCarriers(getCarriers());
    setCheckins(getCheckins(loadId));
  };

  useEffect(() => {
    reload();
  }, [loadId]);

  const carrier = useMemo(() => load ? getCarrier(load.carrierId) : undefined, [load]);
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

  const patch = (data: Partial<SonexLoad>, message = 'Load updated') => {
    const updated = updateLoad(load.id, data);
    if (!updated) return;
    setLoad(updated);
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

  const handleUpload = (field: DocumentField, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      patch({ [field]: reader.result as string } as Partial<SonexLoad>, 'Document uploaded');
    };
    reader.readAsDataURL(file);
  };

  const handleCheckin = (event: CheckinEvent) => {
    addCheckin({
      loadId: load.id,
      event,
      timestamp: new Date().toISOString(),
      notes: '',
      loggedBy: 'admin',
    });
    if (event === 'delivered' && LOAD_STATUS_ORDER.indexOf(load.status) < LOAD_STATUS_ORDER.indexOf('delivered')) {
      updateLoad(load.id, { status: 'delivered' });
    }
    reload();
    toast.success(CHECKIN_EVENT_LABELS[event]);
  };

  return (
    <div className="min-h-screen bg-[#050B18] p-6 animate-fade-in">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link href="/sonex/loads" className="flex w-fit items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-300">
          <ArrowLeft size={16} /> Back to Loads
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{load.loadNumber}</h1>
              <LoadStatusBadge status={load.status} />
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {carrier ? `${carrier.firstName} ${carrier.lastName}` : 'Unassigned'} - {load.pickupState} to {load.deliveryState}
            </p>
          </div>
          <button
            onClick={saveEditableFields}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-amber-400 active:scale-95"
          >
            <Save size={14} /> Save Changes
          </button>
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Truck size={15} className="text-amber-400" /> Load Status
            </h2>
            <select
              value={load.status}
              onChange={e => patch({ status: e.target.value as LoadStatus }, 'Status updated')}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500/40"
            >
              {LOAD_STATUS_ORDER.map(status => (
                <option key={status} value={status}>{LOAD_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <StatusPipeline currentStatus={load.status} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <MapPin size={15} className="text-amber-400" /> Route & Schedule
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pickup</p>
                  <p className="text-sm font-semibold text-white">{load.pickupFacility || 'Pickup Facility'}</p>
                  <p className="mt-1 text-xs text-slate-400">{load.pickupAddress}</p>
                  <p className="text-xs text-slate-400">{load.pickupCity}, {load.pickupState} {load.pickupZip}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Delivery</p>
                  <p className="text-sm font-semibold text-white">{load.deliveryFacility || 'Delivery Facility'}</p>
                  <p className="mt-1 text-xs text-slate-400">{load.deliveryAddress}</p>
                  <p className="text-xs text-slate-400">{load.deliveryCity}, {load.deliveryState} {load.deliveryZip}</p>
                </div>
                <Field label="Pickup Date" value={load.pickupDate} type="date" onChange={v => set('pickupDate', v)} />
                <Field label="Pickup Time" value={load.pickupTime} type="time" onChange={v => set('pickupTime', v)} />
                <Field label="Delivery Date" value={load.deliveryDate} type="date" onChange={v => set('deliveryDate', v)} />
                <Field label="Delivery Time" value={load.deliveryTime} type="time" onChange={v => set('deliveryTime', v)} />
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <Package size={15} className="text-amber-400" /> Broker, Cargo & Notes
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Broker" value={load.brokerName} onChange={v => set('brokerName', v)} />
                <Field label="Broker Contact" value={load.brokerContact} onChange={v => set('brokerContact', v)} />
                <Field label="Broker Phone" value={load.brokerPhone} onChange={v => set('brokerPhone', v)} />
                <Field label="Commodity" value={load.commodity} onChange={v => set('commodity', v)} />
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Notes</span>
                  <textarea
                    value={load.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={3}
                    className="input-primary resize-none py-2.5 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <FileText size={15} className="text-amber-400" /> Load Documents
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {DOCS.map(doc => {
                  const value = load[doc.field];
                  return (
                    <div key={doc.field} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-white">{doc.label}</p>
                        <p className="text-xs text-slate-500">{doc.hint}</p>
                      </div>
                      <div className="flex gap-2">
                        <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-2 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/10">
                          <Upload size={12} /> {value ? 'Update' : 'Upload'}
                          <input
                            type="file"
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
                          <a
                            href={value}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                          >
                            <ExternalLink size={12} /> View
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <DollarSign size={15} className="text-amber-400" /> Financials
              </h2>
              <div className="space-y-4">
                <select
                  value={load.carrierId}
                  onChange={e => {
                    const nextCarrier = carriers.find(c => c.id === e.target.value);
                    set('carrierId', e.target.value);
                    if (nextCarrier) set('dispatchFeePercent', nextCarrier.dispatchFeePercent);
                  }}
                  className="input-primary py-2.5 text-sm"
                >
                  {carriers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} - {EQUIPMENT_TYPE_LABELS[c.equipmentType]}
                    </option>
                  ))}
                </select>
                <Field label="Gross Rate" value={load.rate} type="number" onChange={v => set('rate', Number(v))} />
                <Field label="Miles" value={load.miles} type="number" onChange={v => set('miles', Number(v))} />
                <Field label="Dispatch Fee %" value={load.dispatchFeePercent} type="number" onChange={v => set('dispatchFeePercent', Number(v))} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Dispatch Fee</p>
                    <p className="mt-1 font-mono text-lg font-bold text-amber-400">{fmt$(financialPreview.dispatchFeeAmount)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Carrier Net</p>
                    <p className="mt-1 font-mono text-lg font-bold text-emerald-400">{fmt$(financialPreview.carrierNet)}</p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.06] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Rate Per Mile</p>
                    <p className="mt-1 font-mono text-lg font-bold text-cyan-400">${financialPreview.ratePerMile.toFixed(2)}/mi</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <Calendar size={15} className="text-amber-400" /> Check-ins
              </h2>
              <div className="mb-4 grid grid-cols-1 gap-2">
                {CHECKIN_EVENTS.map(event => (
                  <button
                    key={event}
                    onClick={() => handleCheckin(event)}
                    disabled={loggedEvents.has(event)}
                    className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {CHECKIN_EVENT_LABELS[event]}
                    {loggedEvents.has(event) && <Check size={13} className="text-emerald-400" />}
                  </button>
                ))}
              </div>
              <CheckinTimeline checkins={checkins} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
