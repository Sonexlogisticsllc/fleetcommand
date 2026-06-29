'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Phone, Mail, MapPin, Truck, Shield, FileText,
  Percent, LogOut, Save, Lock, ChevronRight, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useSonexAuth } from '@/lib/sonexAuth';
import { getCarrier, updateCarrier } from '@/lib/sonexStore';
import type { SonexCarrier } from '@/lib/sonexTypes';
import { EQUIPMENT_TYPE_LABELS, INSURANCE_TYPE_LABELS } from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'active') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (s === 'onboarding') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-slate-700/40 text-slate-400 border-slate-600/30';
}
function statusLabel(s: string) {
  if (s === 'active') return 'Active';
  if (s === 'onboarding') return 'Onboarding';
  return 'Inactive';
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(13,31,60,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2.5 px-4 py-3.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="text-amber-500">{icon}</div>
        <h2 className="text-white text-sm font-bold">{title}</h2>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

// ─── Info row (read-only) ─────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value?: string | number; mono?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-slate-500 text-xs flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-slate-200 text-sm text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ─── Editable field ────────────────────────────────────────────────────────────

function EditField({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-slate-500 text-xs uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.50)'}
        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CarrierProfilePage() {
  const { user, logout } = useSonexAuth();
  const router = useRouter();
  const carrierId = user?.carrierId ?? '';

  const [carrier, setCarrier] = useState<SonexCarrier | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Editable contact fields
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const load = useCallback(() => {
    if (!carrierId) return;
    getCarrier(carrierId).then(c => {
      setCarrier(c);
      if (c) {
        setPhone(c.phone);
        setEmail(c.email);
        setAddress(c.address ?? '');
        setCity(c.city ?? '');
        setState(c.state ?? '');
        setZip(c.zip ?? '');
      }
    });
  }, [carrierId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!carrierId || saving) return;
    setSaving(true);
    try {
      await updateCarrier(carrierId, { phone, email, address, city, state, zip });
      toast.success('Profile updated!', {
        style: { background: '#0D1F3C', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' },
      });
      load();
    } catch {
      toast.error('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace('/sonex/login');
  }

  if (!carrier) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-amber-500 text-sm animate-pulse">Loading profile…</div>
      </div>
    );
  }

  const initials = `${carrier.firstName[0]}${carrier.lastName[0]}`.toUpperCase();
  const fullName = `${carrier.firstName} ${carrier.lastName}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* ── Profile header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-5 rounded-2xl"
        style={{ background: 'rgba(13,31,60,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Avatar circle */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl text-[#050B18] flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-lg font-black leading-tight">{fullName}</div>
          <div className="text-slate-500 text-xs mt-0.5 truncate">{carrier.portalEmail}</div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor(carrier.status)}`}>
              ● {statusLabel(carrier.status)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Contact Info (editable) ────────────────────────────────── */}
      <Section title="Contact Information" icon={<User size={16} />}>
        <EditField label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="+1 (555) 000-0000" />
        <EditField label="Email" value={email} onChange={setEmail} type="email" placeholder="your@email.com" />
        <EditField label="Street Address" value={address} onChange={setAddress} placeholder="123 Main St" />
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-3">
            <EditField label="City" value={city} onChange={setCity} placeholder="City" />
          </div>
          <div className="col-span-1">
            <EditField label="State" value={state} onChange={setState} placeholder="TX" />
          </div>
          <div className="col-span-1">
            <EditField label="ZIP" value={zip} onChange={setZip} placeholder="75001" />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm transition-all active:scale-[0.98]"
          style={{
            background: saving ? 'rgba(245,158,11,0.20)' : '#F59E0B',
            color: saving ? '#64748B' : '#050B18',
          }}>
          {saving ? (
            <>Saving…</>
          ) : (
            <><Save size={16} />Save Changes</>
          )}
        </button>
      </Section>

      {/* ── Equipment (read-only) ──────────────────────────────────── */}
      <Section title="My Equipment" icon={<Truck size={16} />}>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-500/25 bg-amber-500/12 text-amber-300">
            {EQUIPMENT_TYPE_LABELS[carrier.equipmentType]}
          </span>
          <span className="text-slate-600 text-xs">Read-only — contact dispatcher to update</span>
        </div>
        <InfoRow label="Truck" value={`${carrier.truckYear} ${carrier.truckMake} ${carrier.truckModel}`} />
        <InfoRow label="Truck Plate" value={`${carrier.truckPlate} · ${carrier.truckState}`} mono />
        <InfoRow label="Truck VIN" value={carrier.truckVin} mono />
        <InfoRow label="Capacity" value={`${carrier.weightCapacity.toLocaleString()} lbs`} />
        {carrier.hasTrailer && (
          <>
            <div className="text-slate-600 text-[10px] uppercase tracking-widest pt-2 pb-0.5">Trailer</div>
            {carrier.trailerType && <InfoRow label="Type" value={carrier.trailerType} />}
            {carrier.trailerLength && <InfoRow label="Length" value={`${carrier.trailerLength} ft`} />}
            {carrier.trailerPlate && <InfoRow label="Plate" value={`${carrier.trailerPlate} · ${carrier.trailerState}`} mono />}
            {carrier.trailerVin && <InfoRow label="VIN" value={carrier.trailerVin} mono />}
          </>
        )}
      </Section>

      {/* ── Authority & Insurance ──────────────────────────────────── */}
      <Section title="Authority & Insurance" icon={<Shield size={16} />}>
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-2"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
          <Lock size={13} className="text-amber-500/60 mt-0.5 flex-shrink-0" />
          <p className="text-slate-400 text-xs leading-relaxed">
            Contact your dispatcher to update authority or insurance information.
          </p>
        </div>

        <InfoRow label="Authority Type" value={carrier.hasOwnAuthority ? 'Own Authority' : 'Leased to MC'} />
        {carrier.mcNumber && <InfoRow label="MC Number" value={`MC-${carrier.mcNumber}`} mono />}
        {carrier.dotNumber && <InfoRow label="DOT Number" value={carrier.dotNumber} mono />}
        {carrier.isLeasedMC && carrier.mcHolderName && (
          <InfoRow label="MC Holder" value={`${carrier.mcHolderName}${carrier.mcHolderMC ? ` (MC-${carrier.mcHolderMC})` : ''}`} />
        )}
        <InfoRow label="Insurance Type" value={INSURANCE_TYPE_LABELS[carrier.insuranceType]} />
        {carrier.insuranceCompany && <InfoRow label="Insurance Co." value={carrier.insuranceCompany} />}
        {carrier.insurancePolicyNumber && <InfoRow label="Policy #" value={carrier.insurancePolicyNumber} mono />}
      </Section>

      {/* ── Dispatch Agreement ─────────────────────────────────────── */}
      <Section title="Dispatch Agreement" icon={<FileText size={16} />}>
        <div className="flex items-center justify-between py-2 px-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <div className="flex items-center gap-2">
            <Percent size={16} className="text-amber-400" />
            <span className="text-slate-300 text-sm">Your dispatch fee</span>
          </div>
          <span className="text-amber-400 text-xl font-black">{carrier.dispatchFeePercent}%</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
          <CheckCircle size={12} className="text-slate-700 flex-shrink-0 mt-0.5" />
          Fee applied to gross broker rate per load. See your settlement for full breakdown.
        </div>
        {carrier.notes && (
          <div className="text-slate-500 text-xs italic border-t border-white/5 pt-2">{carrier.notes}</div>
        )}
      </Section>

      {/* ── Portal Access ──────────────────────────────────────────── */}
      <Section title="Portal Access" icon={<Lock size={16} />}>
        <div className="py-1.5 flex items-center justify-between">
          <span className="text-slate-500 text-xs">Portal Email</span>
          <span className="text-slate-300 text-sm font-mono truncate max-w-[55%]">{carrier.portalEmail}</span>
        </div>
        <div className="py-1.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="text-slate-500 text-xs">Password</span>
          <span className="text-slate-600 text-sm font-mono">••••••••</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1">
          <Lock size={11} />
          Contact your dispatcher to change your portal password.
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm text-red-400 transition-all active:scale-[0.98] hover:text-red-300"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <LogOut size={16} />
          Log Out
        </button>
      </Section>

      {/* Bottom padding for mobile tab bar */}
      <div className="h-4" />
    </div>
  );
}
