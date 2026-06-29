'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Mail, Phone, Percent, Save, RotateCcw, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SonexSettings } from '@/lib/sonexTypes';
import { getSettings, updateSettings } from '@/lib/sonexStore';
import { DEFAULT_SETTINGS } from '@/lib/sonexData';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SonexSettings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) {
    return (
      <div className="p-8 flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-500 animate-pulse">Loading settings...</div>
      </div>
    );
  }

  const set = <K extends keyof SonexSettings>(key: K, value: SonexSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    const saved = await updateSettings(settings);
    setSettings(saved);
    toast.success('Settings saved');
  };

  const handleReset = async () => {
    const saved = await updateSettings(DEFAULT_SETTINGS);
    setSettings(saved);
    toast.success('Defaults restored');
  };

  const input = (
    label: string,
    key: keyof SonexSettings,
    icon: React.ElementType,
    type = 'text',
  ) => {
    const Icon = icon;
    return (
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Icon size={12} className="text-amber-500/80" />
          {label}
        </span>
        <input
          type={type}
          value={String(settings[key] ?? '')}
          onChange={e => {
            const next = type === 'number' ? Number(e.target.value) : e.target.value;
            set(key, next as never);
          }}
          className="input-primary py-2.5 text-sm"
        />
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-[#050B18] p-6 animate-fade-in">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="mt-0.5 text-sm text-slate-400">Company info, PDF headers, and default carrier terms.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-amber-400 active:scale-95"
            >
              <Save size={14} /> Save
            </button>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-white">Company Information for PDFs</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">{input('Company Name', 'companyName', Building2)}</div>
            <div className="md:col-span-2">{input('Street Address', 'companyAddress', Building2)}</div>
            {input('City', 'companyCity', Building2)}
            {input('State', 'companyState', Building2)}
            {input('ZIP', 'companyZip', Building2)}
            {input('Email', 'companyEmail', Mail, 'email')}
            {input('Phone', 'companyPhone', Phone, 'tel')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Percent size={16} className="text-amber-400" />
              <h2 className="text-sm font-bold text-white">Carrier Defaults</h2>
            </div>
            {input('Default Dispatch Fee %', 'defaultDispatchFeePercent', Percent, 'number')}
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              New carrier forms start with this percentage. Each carrier can still be overridden from the carrier profile.
            </p>
          </div>

          <div className="glass-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users size={16} className="text-amber-400" />
              <h2 className="text-sm font-bold text-white">Admin Users</h2>
            </div>
            <div className="space-y-2">
              {settings.adminUsers.map(admin => (
                <div key={admin.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <p className="text-sm font-semibold text-white">{admin.name}</p>
                  <p className="text-xs text-slate-500">{admin.email}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
