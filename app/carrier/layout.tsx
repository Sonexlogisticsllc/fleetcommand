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
    <div data-portal="carrier" className="min-h-screen" style={{ background: '#080808' }}>

      {/* ── Mobile top header ────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: 'rgba(15,15,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Logo */}
        <span className="font-black text-base tracking-widest text-amber-400 font-mono">SONEX</span>
        {/* Carrier name + bell */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300 font-medium truncate max-w-[140px]">{carrierName}</span>
          <NotificationBell role="carrier" carrierId={user?.carrierId} />
        </div>
      </header>

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 z-40"
        style={{ background: 'rgba(15,15,15,0.97)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/5">
          <div className="text-amber-400 font-black text-xl tracking-widest font-mono">SONEX</div>
          <div className="text-slate-500 text-xs mt-0.5 tracking-wide">Carrier Portal</div>
        </div>

        {/* Carrier identity */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm text-[#050B18]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}>
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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map(({ label, href, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all group relative ${
                  active
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}>
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-amber-500" />
                )}
                <Icon size={18} className={active ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span>{label}</span>
                {!active && <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="px-3 py-2 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-sm font-medium"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-white/5">
          <div className="text-[10px] text-slate-600 text-center">Sonex Dispatch Hub v1</div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="lg:pl-56 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
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
