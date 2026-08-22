'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Lock, Mail, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSonexAuth } from '@/lib/sonexAuth';

export default function SonexLoginPage() {
  const { login, user, isAuthenticated } = useSonexAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    router.replace(user.role === 'carrier' ? '/carrier' : '/sonex');
  }, [isAuthenticated, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (!result.success || !result.user) {
      setError(result.error ?? 'Invalid email or password.');
      return;
    }

    toast.success('Welcome back');
    router.replace(result.user.role === 'carrier' ? '/carrier' : '/sonex');
  };

  return (
    <div className="grid min-h-screen bg-[#08111f] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden lg:block" style={{ backgroundImage: "linear-gradient(90deg, rgba(7,17,31,0.2), rgba(7,17,31,0.88)), url('https://images.unsplash.com/photo-1737768041497-bf19668eeb1a?auto=format&fit=crop&fm=jpg&q=82&w=2400')", backgroundPosition: 'center', backgroundSize: 'cover' }}>
        <div className="absolute inset-x-12 top-11 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-sky-500 text-slate-950"><Truck size={21} /></div><span className="text-xl font-bold tracking-[0.12em] text-white">SONEX</span></div>
        <div className="absolute bottom-14 left-12 max-w-lg"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Transportation management</p><h1 className="mt-4 text-4xl font-semibold leading-tight text-white">Move every load with a clear operational view.</h1><p className="mt-4 max-w-md text-sm leading-6 text-slate-200">Dispatch, paperwork, settlements, and carrier updates in one secure Sonex workspace.</p></div>
      </section>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-slide-in-up">
          <div className="mb-9 lg:hidden"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-sky-500 text-slate-950"><Truck size={20} /></div><div><p className="text-lg font-bold tracking-[0.12em] text-white">SONEX</p><p className="text-xs text-slate-400">Dispatch Hub</p></div></div></div>
          <div className="border border-slate-700 bg-[#0d1929] p-7 shadow-2xl shadow-black/25 sm:p-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Secure sign in</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">Use the credentials assigned by Sonex Dispatch.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 animate-fade-in">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Email
              </span>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="input-primary pl-11"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Password
              </span>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  className="input-primary pl-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-600 transition-colors hover:bg-white/5 hover:text-slate-300"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center bg-sky-500 py-3.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          </div>
        </div>
      </main>
    </div>
  );
}
