'use client';

import { useEffect, useState } from 'react';
import { Building2, KeyRound, Mail, Percent, Phone, RotateCcw, Save, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SonexSettings } from '@/lib/sonexTypes';
import type { CarrierPortalAccount } from '@/lib/sonexStore';
import { getCarrierPortalAccounts, getSettings, resetCarrierPortalPassword, updateSettings } from '@/lib/sonexStore';
import { DEFAULT_SETTINGS } from '@/lib/sonexData';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SonexSettings | null>(null);
  const [accounts, setAccounts] = useState<CarrierPortalAccount[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [savingAccount, setSavingAccount] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSettings(), getCarrierPortalAccounts()])
      .then(([nextSettings, nextAccounts]) => { setSettings(nextSettings); setAccounts(nextAccounts); })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Could not load settings.'));
  }, []);

  if (!settings) return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">Loading settings...</div>;

  const set = <K extends keyof SonexSettings>(key: K, value: SonexSettings[K]) => setSettings(current => current ? { ...current, [key]: value } : current);
  const save = async () => { try { setSettings(await updateSettings(settings)); toast.success('Settings saved.'); } catch { toast.error('Could not save settings.'); } };
  const reset = async () => { try { setSettings(await updateSettings(DEFAULT_SETTINGS)); toast.success('Defaults restored.'); } catch { toast.error('Could not restore defaults.'); } };
  const resetPassword = async (account: CarrierPortalAccount) => {
    const password = passwords[account.userId] || '';
    if (password.length < 10) return toast.error('Use a password with at least 10 characters.');
    setSavingAccount(account.userId);
    try { await resetCarrierPortalPassword(account.userId, password); setPasswords(current => ({ ...current, [account.userId]: '' })); toast.success(`Password reset for ${account.carrierName}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not reset password.'); }
    finally { setSavingAccount(null); }
  };
  const field = (label: string, key: keyof SonexSettings, Icon: typeof Building2, type = 'text') => <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500"><Icon size={12} className="text-blue-600" />{label}</span><input type={type} value={String(settings[key] ?? '')} onChange={event => set(key, (type === 'number' ? Number(event.target.value) : event.target.value) as never)} className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500" /></label>;

  return <div className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-6"><div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium text-blue-700">Administration</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Settings</h1><p className="mt-1 text-sm text-slate-500">Company details, defaults, and carrier portal access.</p></div><div className="flex gap-2"><button onClick={reset} className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"><RotateCcw size={14} /> Reset</button><button onClick={save} className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Save size={14} /> Save</button></div></header>
    <section className="glass-card p-5"><div className="mb-4 flex items-center gap-2"><Building2 size={16} className="text-blue-600" /><h2 className="text-sm font-semibold text-slate-900">Company information for PDFs</h2></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="md:col-span-2">{field('Company name', 'companyName', Building2)}</div><div className="md:col-span-2">{field('Street address', 'companyAddress', Building2)}</div>{field('City', 'companyCity', Building2)}{field('State', 'companyState', Building2)}{field('ZIP', 'companyZip', Building2)}{field('Email', 'companyEmail', Mail, 'email')}{field('Phone', 'companyPhone', Phone, 'tel')}</div></section>
    <div className="grid gap-5 lg:grid-cols-2"><section className="glass-card p-5"><div className="mb-4 flex items-center gap-2"><Percent size={16} className="text-blue-600" /><h2 className="text-sm font-semibold text-slate-900">Carrier defaults</h2></div>{field('Default dispatch fee %', 'defaultDispatchFeePercent', Percent, 'number')}<p className="mt-3 text-xs leading-relaxed text-slate-500">New carrier forms begin with this fee. Carrier-specific values can still be adjusted on their profile.</p></section><section className="glass-card p-5"><div className="mb-4 flex items-center gap-2"><Users size={16} className="text-blue-600" /><h2 className="text-sm font-semibold text-slate-900">Admin users</h2></div><div className="space-y-2">{settings.adminUsers.map(admin => <div key={admin.id} className="border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-sm font-medium text-slate-900">{admin.name}</p><p className="text-xs text-slate-500">{admin.email}</p></div>)}</div></section></div>
    <section className="glass-card p-5"><div className="mb-1 flex items-center gap-2"><KeyRound size={16} className="text-blue-600" /><h2 className="text-sm font-semibold text-slate-900">Carrier portal passwords</h2></div><p className="mb-4 text-xs text-slate-500">Assign a new password when a carrier needs access restored. Existing passwords are never displayed.</p><div className="overflow-x-auto border border-slate-200"><div className="min-w-[740px] divide-y divide-slate-200">{accounts.map(account => <div key={account.userId} className="grid grid-cols-[1.1fr_1fr_220px_auto] items-center gap-3 bg-white p-3"><div><p className="text-sm font-medium text-slate-900">{account.carrierName}</p><p className="text-xs text-slate-500">{account.displayName}</p></div><p className="text-sm text-slate-600">{account.email}</p><input type="password" value={passwords[account.userId] || ''} onChange={event => setPasswords(current => ({ ...current, [account.userId]: event.target.value }))} placeholder="New password (10+ chars)" className="border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" /><button onClick={() => resetPassword(account)} disabled={savingAccount === account.userId} className="bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{savingAccount === account.userId ? 'Saving...' : 'Reset'}</button></div>)}{!accounts.length && <p className="p-5 text-center text-sm text-slate-500">No carrier portal accounts have been created yet.</p>}</div></div></section>
  </div></div>;
}
