'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, DollarSign, Edit3, KeyRound, Package, Save, Shield, Truck, User, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCarrier, getCarrierStats, getLoadsByCarrier, updateCarrier } from '@/lib/sonexStore';
import type { SonexCarrier, SonexLoad } from '@/lib/sonexTypes';
import { EQUIPMENT_TYPE_LABELS, INSURANCE_TYPE_LABELS, LOAD_STATUS_LABELS } from '@/lib/sonexTypes';

const STATUS_COLOR: Record<string, string> = {
  booked: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
  dispatched: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/20',
  in_transit: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  pod_received: 'bg-teal-500/20 text-teal-300 border-teal-500/20',
  invoiced: 'bg-violet-500/20 text-violet-300 border-violet-500/20',
  paid: 'bg-green-500/20 text-green-300 border-green-500/20',
};

const CARRIER_STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/25',
  inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  onboarding: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/25',
};

const TABS = ['Overview', 'Load History', 'Earnings'] as const;
type Tab = typeof TABS[number];

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function EditField({
  label, value, onSave, type = 'text',
}: {
  label: string;
  value: string | number;
  onSave: (value: string) => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div>
      {label && <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</label>}
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            className="input-primary flex-1 py-1.5 text-sm"
          />
          <button onClick={save} className="rounded-lg bg-amber-500/20 p-1.5 text-amber-400 hover:bg-amber-500/30">
            <Save size={13} />
          </button>
          <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300">
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setDraft(String(value ?? ''));
            setEditing(true);
          }}
          className="group flex items-center gap-2 text-left"
        >
          <span className="text-sm text-slate-300">{value || <span className="italic text-slate-600">-</span>}</span>
          <Edit3 size={11} className="text-slate-700 transition-colors group-hover:text-amber-500" />
        </button>
      )}
    </div>
  );
}

export default function CarrierProfilePage() {
  const params = useParams();
  const router = useRouter();
  const carrierId = params.id as string;
  const [carrier, setCarrier] = useState<SonexCarrier | null>(null);
  const [loads, setLoads] = useState<SonexLoad[]>([]);
  const [tab, setTab] = useState<Tab>('Overview');
  const [stats, setStats] = useState<ReturnType<typeof getCarrierStats> | null>(null);

  const reload = () => {
    const found = getCarrier(carrierId);
    if (!found) {
      router.push('/sonex/carriers');
      return;
    }
    setCarrier(found);
    setLoads(getLoadsByCarrier(carrierId));
    setStats(getCarrierStats(carrierId));
  };

  useEffect(() => { reload(); }, [carrierId]);

  const loadSummary = useMemo(() => ({
    total: loads.length,
    gross: loads.reduce((sum, load) => sum + load.rate, 0),
    fees: loads.reduce((sum, load) => sum + load.dispatchFeeAmount, 0),
    net: loads.reduce((sum, load) => sum + load.carrierNet, 0),
  }), [loads]);

  if (!carrier) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="animate-pulse text-sm text-slate-500">Loading carrier...</div>
      </div>
    );
  }

  const save = (field: keyof SonexCarrier, value: string | number) => {
    const updated = updateCarrier(carrierId, { [field]: value });
    if (!updated) return;
    setCarrier(updated);
    toast.success('Saved');
  };

  const initials = `${carrier.firstName[0]}${carrier.lastName[0]}`.toUpperCase();

  return (
    <div className="mx-auto max-w-6xl p-6 animate-fade-in">
      <Link href="/sonex/carriers" className="mb-5 flex w-fit items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft size={16} /> Back to Carriers
      </Link>

      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15">
          <span className="text-xl font-bold text-amber-400">{initials}</span>
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white">{carrier.firstName} {carrier.lastName}</h1>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${CARRIER_STATUS_COLOR[carrier.status]}`}>
              {carrier.status.charAt(0).toUpperCase() + carrier.status.slice(1)}
            </span>
            <span className="rounded-lg border border-white/[0.06] bg-white/5 px-2 py-0.5 text-xs text-slate-400">
              {EQUIPMENT_TYPE_LABELS[carrier.equipmentType]}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Joined {new Date(carrier.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-600">Dispatch Fee</p>
          <p className="text-2xl font-bold text-amber-400">{carrier.dispatchFeePercent}%</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[0.06]">
        {TABS.map(item => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
              tab === item ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="glass-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <User size={13} /> Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <EditField label="First Name" value={carrier.firstName} onSave={value => save('firstName', value)} />
                <EditField label="Last Name" value={carrier.lastName} onSave={value => save('lastName', value)} />
                <div className="col-span-2"><EditField label="Email" value={carrier.email} onSave={value => save('email', value)} type="email" /></div>
                <EditField label="Phone" value={carrier.phone} onSave={value => save('phone', value)} type="tel" />
                <EditField label="State" value={carrier.state ?? ''} onSave={value => save('state', value)} />
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <Truck size={13} /> Equipment
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Truck</p><p className="text-slate-300">{carrier.truckYear} {carrier.truckMake} {carrier.truckModel}</p></div>
                <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Plate</p><p className="font-mono text-slate-300">{carrier.truckPlate} ({carrier.truckState})</p></div>
                <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Capacity</p><p className="text-slate-300">{carrier.weightCapacity.toLocaleString()} lbs</p></div>
                <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Trailer</p><p className="text-slate-300">{carrier.hasTrailer ? `${carrier.trailerType ?? 'Trailer'} ${carrier.trailerLength ?? ''}ft` : 'None'}</p></div>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Shield size={13} /> Authority & Insurance
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
              <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Authority</p><p className="text-slate-300">{carrier.hasOwnAuthority ? 'Own Authority' : carrier.isLeasedMC ? 'Leased MC' : 'No Authority'}</p></div>
              <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">MC / DOT</p><p className="font-mono text-slate-300">{carrier.mcNumber || carrier.mcHolderMC || '-'} / {carrier.dotNumber || '-'}</p></div>
              <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Insurance Type</p><p className="text-slate-300">{INSURANCE_TYPE_LABELS[carrier.insuranceType]}</p></div>
              <div><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Policy</p><p className="font-mono text-slate-400">{carrier.insurancePolicyNumber || '-'}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="glass-card p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400">Notes</h3>
              <textarea
                value={carrier.notes}
                onChange={e => setCarrier(current => current ? { ...current, notes: e.target.value } : current)}
                onBlur={e => save('notes', e.target.value)}
                rows={4}
                className="input-primary resize-none py-2.5 text-sm"
                placeholder="Internal notes about this carrier..."
              />
            </div>
            <div className="glass-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <KeyRound size={13} /> Carrier Login
              </h3>
              <div className="space-y-3">
                <EditField label="Login Email" value={carrier.portalEmail} onSave={value => save('portalEmail', value)} type="email" />
                <EditField label="Temporary Password" value={carrier.portalPassword} onSave={value => save('portalPassword', value)} />
                <EditField label="Dispatch Fee %" value={carrier.dispatchFeePercent} onSave={value => save('dispatchFeePercent', Number(value))} type="number" />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Load History' && (
        <div className="space-y-5">
          <div className="glass-card overflow-hidden">
            {loads.length === 0 ? (
              <div className="py-12 text-center">
                <Package size={32} className="mx-auto mb-3 text-slate-700" />
                <p className="text-sm text-slate-500">No loads yet for this carrier.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/[0.06]">
                    <tr>
                      {['Load #', 'Date', 'Route', 'Rate', 'Fee', 'Net', 'Status'].map(header => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {loads.map(load => (
                      <tr key={load.id} onClick={() => router.push(`/sonex/loads/${load.id}`)} className="table-row-hover cursor-pointer">
                        <td className="px-4 py-3 font-mono text-xs text-amber-400">{load.loadNumber}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(load.pickupDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{load.pickupState} {'->'} {load.deliveryState}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-white">{fmt$(load.rate)}</td>
                        <td className="px-4 py-3 text-xs text-amber-400">{fmt$(load.dispatchFeeAmount)}</td>
                        <td className="px-4 py-3 text-xs text-emerald-400">{fmt$(load.carrierNet)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[load.status]}`}>
                            {LOAD_STATUS_LABELS[load.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Total Loads', value: loadSummary.total, color: 'text-white' },
              { label: 'Total Gross', value: fmt$(loadSummary.gross), color: 'text-amber-400' },
              { label: 'Total Fees', value: fmt$(loadSummary.fees), color: 'text-amber-300' },
              { label: 'Carrier Net', value: fmt$(loadSummary.net), color: 'text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card p-4">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Earnings' && stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Lifetime Gross', value: fmt$(stats.lifetimeGross), color: 'text-amber-400' },
            { label: 'Lifetime Fees', value: fmt$(stats.lifetimeFees), color: 'text-amber-300' },
            { label: 'Net Paid', value: fmt$(stats.lifetimeNet), color: 'text-emerald-400' },
            { label: 'Avg RPM', value: `$${stats.avgRPM.toFixed(2)}/mi`, color: 'text-cyan-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card p-4">
              <DollarSign size={15} className="mb-3 text-slate-600" />
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
              <p className={`font-mono text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
