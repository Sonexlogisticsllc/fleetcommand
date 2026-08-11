'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Truck, DollarSign, User, Bell, ChevronRight, LogOut, Activity
} from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { NotificationBell } from '@/components/sonex/NotificationBell';
import { DatatruckMark } from '@/components/sonex/DatatruckMark';
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
    <div data-portal="carrier" data-tms-surface className="min-h-screen bg-[#f2f5f9]">

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
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[84px] z-40 bg-gradient-to-b from-[#8d42c9] via-[#6847d2] to-[#2f66d5] text-white">
        {/* Brand */}
        <div className="flex h-[72px] items-center justify-center border-b border-white/15">
          <DatatruckMark />
        </div>

        {/* Carrier identity */}
        <div className="flex justify-center border-b border-white/15 px-2 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-white/20 text-[11px] font-semibold text-white">
              {initials}
            </div>
            <div className="hidden min-w-0 flex-1">
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
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {menuItems.map(({ label, href, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                className={`group relative flex h-12 items-center justify-center text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}>
                {active && (
                  <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-white" />
                )}
                <Icon size={22} strokeWidth={1.8} className="text-white" />
                <span className="sr-only">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="border-t border-white/15 px-2 py-2">
          <button
            onClick={handleLogout}
            className="flex h-10 w-full items-center justify-center text-white/75 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="sr-only">Sign Out</span>
          </button>
        </div>

        {/* Footer hint */}
        <div className="border-t border-white/15 px-2 py-3">
          <div className="text-center text-[9px] text-white/70">SONEX</div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="min-h-screen pb-20 pt-14 lg:pl-[84px] lg:pt-0 lg:pb-0">
        <div className="hidden h-[72px] items-center gap-4 bg-gradient-to-r from-[#8b3fc5] via-[#6b46d2] to-[#405bd9] px-5 text-white lg:flex">
          <span className="text-[20px] font-medium">Carrier portal</span>
          <div className="ml-auto flex items-center gap-4"><span className="rounded-full border border-white/80 px-4 py-2 text-sm">Live Support</span><span>Datatruck 1.0⌄</span><NotificationBell role="carrier" carrierId={user?.carrierId} /><User size={22} /></div>
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
