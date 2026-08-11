'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Truck, DollarSign, User, Bell, ChevronRight, LogOut, Activity
} from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { NotificationBell } from '@/components/sonex/NotificationBell';
import { getCarrier, getLoadsByCarrier } from '@/lib/sonexStore';
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

  const handleLogout = () => {
    logout();
    router.push('/sonex/login');
  };
  const [carrier, setCarrier] = useState<SonexCarrier | undefined>(undefined);
  const [activeLoadId, setActiveLoadId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !isCarrier) {
      router.replace('/sonex/login');
      return;
    }
    if (user?.carrierId) {
      getCarrier(user.carrierId).then(setCarrier);
      
      // Look up active transit load to populate workspace tab
      getLoadsByCarrier(user.carrierId).then(loads => {
        const active = loads.find(l => ['booked', 'dispatched', 'in_transit'].includes(l.status));
        if (active) {
          setActiveLoadId(active.id);
        } else {
          setActiveLoadId(null);
        }
      });
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
    ...(activeLoadId ? [{ label: 'Workspace', href: `/carrier/loads/${activeLoadId}`, Icon: Activity }] : []),
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
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 z-40 border-r border-slate-800 bg-[#0f172a]">
        {/* Brand */}
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-sky-400 font-semibold text-base tracking-[0.18em] font-mono">SONEX</div>
          <div className="text-slate-500 text-[10px] mt-1 uppercase tracking-[0.12em]">Carrier workspace</div>
        </div>

        {/* Carrier identity */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold text-[11px] text-slate-950 bg-sky-400">
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
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {menuItems.map(({ label, href, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-colors group relative ${
                  active
                    ? 'bg-slate-800 text-sky-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}>
                {active && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-sky-400" />
                )}
                <Icon size={16} className={active ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span>{label}</span>
                {!active && <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="px-2 py-2 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors text-[13px] font-medium"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-600 text-center">Sonex Dispatch Hub v1</div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="lg:pl-60 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="hidden lg:flex h-11 items-center justify-between border-b border-slate-800 bg-[#090d16] px-6 text-[11px] text-slate-500">
          <span className="font-mono uppercase tracking-[0.08em]">Carrier operations</span>
          <span className="text-emerald-400">● System operational</span>
        </div>
        {children}
      </main>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 flex items-stretch"
        style={{ background: '#0F0F0F', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
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
