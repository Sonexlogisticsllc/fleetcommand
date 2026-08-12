'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Truck, DollarSign, User, LogOut
} from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { NotificationBell } from '@/components/sonex/NotificationBell';
import { SonexMark } from '@/components/sonex/SonexMark';
import { getCarrier } from '@/lib/sonexStore';
import type { SonexCarrier } from '@/lib/sonexTypes';

function statusColor(status: string) {
  if (status === 'active') return 'text-emerald-400';
  if (status === 'onboarding') return 'text-amber-400';
  return 'text-slate-400';
}

function statusLabel(status: string) {
  if (status === 'active') return 'Active';
  if (status === 'onboarding') return 'Onboarding';
  return 'Inactive';
}

export default function CarrierLayout({ children }: { children: React.ReactNode }) {
  const { user, isCarrier, isAuthenticated, logout } = useSonexAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    window.location.assign('/sonex/login');
  };
  const [carrier, setCarrier] = useState<SonexCarrier | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated || !isCarrier) {
      router.replace('/sonex/login');
      return;
    }
    if (user?.carrierId) {
      getCarrier(user.carrierId).then(setCarrier);
    }
  }, [isAuthenticated, isCarrier, user, router]);

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

  const menuItems = [
    { label: 'Loads',    href: '/carrier',           Icon: Truck },
    { label: 'Earnings', href: '/carrier/earnings',   Icon: DollarSign },
    { label: 'Profile',  href: '/carrier/profile',    Icon: User },
  ];

  // Active tab: exact match for /carrier, prefix match for the rest
  function isActive(href: string) {
    if (href === '/carrier') return pathname === '/carrier';
    return pathname.startsWith(href);
  }

  return (
    <div data-portal="carrier" data-tms-surface className="min-h-screen bg-[#090d16]">

      {/* ── Mobile top header ────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 border-b border-slate-800 bg-[#0f172a]">
        {/* Logo */}
        <span className="font-black text-base tracking-widest text-amber-400 font-mono">SONEX</span>
        {/* Carrier name + bell */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300 font-medium truncate max-w-[140px]">{carrierName}</span>
          <NotificationBell role="carrier" carrierId={user?.carrierId} />
        </div>
      </header>

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[232px] z-40 border-r border-slate-800 bg-[#0c1627] text-white">
        {/* Brand */}
        <div className="flex h-14 items-center gap-3 border-b border-slate-800 px-5">
          <SonexMark />
          <div><p className="text-sm font-bold tracking-[0.12em] text-white">SONEX</p><p className="text-[10px] text-slate-400">Carrier workspace</p></div>
        </div>

        {/* Carrier identity */}
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-sky-500 text-[11px] font-semibold text-slate-950">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-semibold truncate">{carrierName}</div>
              {carrier && (
                <div className={`text-xs font-medium ${statusColor(carrier.status)}`}>
                  ● {statusLabel(carrier.status)}
                </div>
              )}
            </div>
            <NotificationBell role="carrier" carrierId={user?.carrierId} />
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {menuItems.map(({ label, href, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                className={`group relative flex h-10 items-center gap-3 px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                }`}>
                {active && (
                  <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-sky-400" />
                )}
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="border-t border-slate-800 px-3 py-3">
          <button
            onClick={handleLogout}
            className="flex h-10 w-full items-center gap-3 px-3 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-white"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Sign out</span>
          </button>
        </div>

        {/* Footer hint */}
        <div className="border-t border-slate-800 px-4 py-3">
          <div className="text-[10px] text-slate-500">Sonex Dispatch</div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="min-h-screen pb-20 pt-14 lg:pl-[232px] lg:pt-0 lg:pb-0">
        <div className="hidden h-14 items-center gap-4 border-b border-slate-800 bg-[#0f1b2f] px-6 text-white lg:flex">
          <span className="text-sm font-semibold">Carrier workspace</span>
          <span className="text-xs text-slate-400">Loads, paperwork, and settlement status</span>
          <div className="ml-auto flex items-center gap-4"><NotificationBell role="carrier" carrierId={user?.carrierId} /><Link href="/carrier/profile" title="Profile" className="grid h-8 w-8 place-items-center text-slate-400 hover:bg-white/5 hover:text-white"><User size={18} /></Link></div>
        </div>
        {children}
      </main>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 flex items-stretch border-t border-slate-200 bg-white">
        {menuItems.map(({ label, href, Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                active ? 'text-amber-400' : 'text-slate-500'
              }`}>
              {/* Active indicator dot */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b bg-amber-500" />
              )}
              <div className="relative">
                <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-amber-400' : 'text-slate-500'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
