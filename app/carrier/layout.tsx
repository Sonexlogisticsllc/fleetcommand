'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardList, Command, DollarSign, LayoutDashboard, LogOut, Package, Search, Undo2, User
} from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { returnFromPortalPreviewAction } from '@/lib/authActions';
import { NotificationBell } from '@/components/sonex/NotificationBell';
import { SonexMark } from '@/components/sonex/SonexMark';
import { getCarrier } from '@/lib/sonexStore';
import type { SonexCarrier } from '@/lib/sonexTypes';

export default function CarrierLayout({ children }: { children: React.ReactNode }) {
  const { user, isCarrier, isAuthenticated, logout } = useSonexAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    window.location.assign('/sonex/login');
  };
  const returnToAdmin = async () => {
    const result = await returnFromPortalPreviewAction();
    if (result.success) window.location.assign('/sonex');
  };
  const [carrier, setCarrier] = useState<SonexCarrier | undefined>(undefined);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');

  const menuItems = [
    { label: 'Dashboard', href: '/carrier', Icon: LayoutDashboard },
    { label: 'Loads', href: '/carrier/loads', Icon: Package },
    { label: 'Load History', href: '/carrier/history', Icon: ClipboardList },
    { label: 'Earnings', href: '/carrier/earnings', Icon: DollarSign },
    { label: 'Profile', href: '/carrier/profile', Icon: User },
  ];

  // Active tab: exact match for /carrier, prefix match for the rest.
  const isActive = (href: string) => href === '/carrier' ? pathname === '/carrier' : pathname.startsWith(href);
  const currentSection = menuItems.find(item => isActive(item.href))?.label ?? 'Dashboard';
  const term = query.trim().toLowerCase();
  const matchingCommands = term
    ? menuItems.filter(item => item.label.toLowerCase().includes(term))
    : menuItems;

  useEffect(() => {
    if (!isAuthenticated || !isCarrier) {
      router.replace('/sonex/login');
      return;
    }
    if (user?.carrierId) {
      getCarrier(user.carrierId).then(setCarrier);
    }
  }, [isAuthenticated, isCarrier, user, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Don't render portal until auth confirmed
  if (!isAuthenticated || !isCarrier) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-amber-500 text-sm animate-pulse">Authenticating…</div>
      </div>
    );
  }

  const carrierName = carrier
    ? `${carrier.firstName} ${carrier.lastName}`
    : user?.displayName ?? 'Driver';
  const initials = carrier
    ? `${carrier.firstName[0]}${carrier.lastName[0]}`.toUpperCase()
    : (user?.avatar ?? '?');

  const navigate = (href: string) => {
    setCommandOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <div data-portal="carrier" className="min-h-screen bg-[#f2f5f9]">

      {/* ── Mobile top header ────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/15 bg-gradient-to-r from-[#8b3fc5] via-[#6b46d2] to-[#405bd9] px-4 text-white lg:hidden">
        {/* Logo */}
        <span className="font-black text-base tracking-widest text-white">SONEX</span>
        {/* Carrier name + bell */}
        <div className="flex items-center gap-3">
          <span className="max-w-[140px] truncate text-sm font-medium text-white">{carrierName}</span>
          {user?.adminPreview && <button onClick={() => void returnToAdmin()} title="Return to Sonex admin" className="grid h-8 w-8 place-items-center text-white hover:bg-white/10"><Undo2 size={16} /></button>}
          <NotificationBell role="carrier" carrierId={user?.carrierId} />
        </div>
      </header>

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[84px] flex-col bg-gradient-to-b from-[#8d42c9] via-[#6847d2] to-[#2f66d5] text-white lg:flex">
        {/* Brand */}
        <div className="flex h-[72px] items-center justify-center border-b border-white/15">
          <SonexMark />
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {menuItems.map(({ label, href, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                title={label}
                className={`group relative mx-2 flex h-12 items-center justify-center transition-colors ${
                  active
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}>
                {active && (
                  <span className="absolute bottom-0 left-0 top-0 w-1 bg-white" />
                )}
                <Icon size={23} strokeWidth={1.8} />
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="mt-auto border-t border-white/15 p-2">
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-10 w-full items-center justify-center text-white/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={20} className="shrink-0" />
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-2 pb-2">
          <Link href="/carrier/profile" title="Carrier profile" className="grid h-8 place-items-center bg-white/20 text-[10px] font-semibold text-white">{initials}</Link>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-[#f2f5f9] pb-16 pt-14 lg:ml-[84px] lg:pb-0 lg:pt-0">
        <header className="hidden h-[72px] items-center gap-4 bg-gradient-to-r from-[#8b3fc5] via-[#6b46d2] to-[#405bd9] px-5 text-white lg:flex">
          <span className="text-[20px] font-medium">Sonex Carrier / <span className="ml-1">{currentSection}</span></span>
          <button onClick={() => setCommandOpen(true)} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 text-left text-sm text-[#43517a] shadow-sm sm:mx-auto sm:max-w-[395px]">
            <Search size={15} className="text-blue-500" /><span className="truncate">Ctrl + K to search</span><span className="ml-auto text-xs text-[#5e35c1]">All</span>
          </button>
          <div className="ml-auto flex items-center gap-3"><Link href="/carrier/loads" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/80 px-4 text-sm font-medium hover:bg-white/10"><Package size={16} /> Open loads</Link>{user?.adminPreview && <button onClick={() => void returnToAdmin()} title="Return to Sonex admin" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/80 px-4 text-sm font-medium hover:bg-white/10"><Undo2 size={15} /> Return to admin</button>}<NotificationBell role="carrier" carrierId={user?.carrierId} /><Link href="/carrier/profile" title="Profile" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><User size={18} /></Link></div>
        </header>
        <main className="min-h-[calc(100vh-72px)]">{children}</main>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-slate-200 bg-white lg:hidden">
        {menuItems.map(({ label, href, Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                active ? 'text-blue-700' : 'text-slate-500'
              }`}>
              {/* Active indicator dot */}
              {active && (
                <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b bg-blue-600" />
              )}
              <div className="relative">
                <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-blue-700' : 'text-slate-500'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {commandOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-start bg-slate-950/30 px-4 pt-[12vh]" onMouseDown={() => setCommandOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden border border-slate-200 bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-slate-200 px-3"><Command size={16} className="text-slate-400" /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search carrier workspace..." className="h-12 min-w-0 flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-400" /><button onClick={() => setCommandOpen(false)} className="text-[11px] text-slate-400">Esc</button></div>
            <div className="max-h-80 overflow-y-auto p-2">{matchingCommands.map(({ href, label, Icon }) => <button key={href} onClick={() => navigate(href)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"><Icon size={16} className="text-slate-400" /><span>{label}</span></button>)}{!matchingCommands.length && <p className="px-3 py-8 text-center text-sm text-slate-400">No matching workspace command.</p>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
