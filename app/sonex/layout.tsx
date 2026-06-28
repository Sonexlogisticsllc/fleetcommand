'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Truck, LayoutDashboard, Users, Package, TableProperties,
  MessageSquare, BarChart3, Settings, LogOut,
  ChevronLeft, ChevronRight, Menu, Bell,
} from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import {
  getCarriers, getLoads, getAllMessages,
} from '@/lib/sonexStore';

// ─── Nav Item Definitions ─────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: BadgeKey;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',  href: '/sonex',            icon: LayoutDashboard,  exact: true },
  { label: 'Carriers',   href: '/sonex/carriers',   icon: Users,            badge: 'carriers' },
  { label: 'Loads',      href: '/sonex/loads',      icon: Package,          badge: 'active_loads' },
  { label: 'Load Log',   href: '/sonex/load-log',   icon: TableProperties },
  { label: 'Messages',   href: '/sonex/messages',   icon: MessageSquare,    badge: 'unread_msgs' },
  { label: 'Financials', href: '/sonex/financials', icon: BarChart3 },
  { label: 'Settings',   href: '/sonex/settings',   icon: Settings },
] ;

type BadgeKey = 'carriers' | 'active_loads' | 'unread_msgs';

// ─── Component ────────────────────────────────────────────────────────────────

export default function SonexLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, user, logout, isAuthenticated } = useSonexAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({
    carriers: 0,
    active_loads: 0,
    unread_msgs: 0,
  });

  // Auth guard — skip for the login page itself
  useEffect(() => {
    if (pathname === '/sonex/login') return;
    if (!isAuthenticated || !isAdmin) {
      router.replace('/sonex/login');
    }
  }, [isAuthenticated, isAdmin, pathname, router]);

  // Load badge counts
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    try {
      const carriers = getCarriers();
      const loads = getLoads();
      const allMessages = getAllMessages();
      const unreadMsgs = allMessages.filter(
        m => !m.read && m.senderRole === 'carrier'
      ).length;

      setBadges({
        carriers: carriers.filter(c => c.status === 'active').length,
        active_loads: loads.filter(l => ['booked', 'dispatched', 'in_transit'].includes(l.status)).length,
        unread_msgs: unreadMsgs,
      });
    } catch { /* ignore */ }
  }, [isAuthenticated, isAdmin, pathname]);

  const getBadge = (key?: string): number => {
    if (!key) return 0;
    return badges[key as BadgeKey] ?? 0;
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleLogout = () => {
    logout();
    router.push('/sonex/login');
  };

  // Don't render sidebar on login page
  if (pathname === '/sonex/login') {
    return <>{children}</>;
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Verifying credentials…</div>
      </div>
    );
  }

  return (
    <div data-portal="sonex" className="flex min-h-screen bg-[#080808]">

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          border-r border-white/[0.08]
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[68px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'rgba(15,15,15,0.97)' }}
      >
        {/* Logo Area */}
        <div className={`flex items-center h-16 px-4 border-b border-white/[0.08] shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/sonex" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Truck size={16} className="text-amber-400" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-amber-400 font-bold text-sm tracking-widest leading-none">SONEX</span>
                <span className="text-slate-600 text-[10px] font-medium tracking-wide leading-tight mt-0.5">Dispatch Hub</span>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-colors lg:flex hidden"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Expand toggle when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-2 p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-colors hidden lg:flex"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, badge, exact }) => {
            const active = isActive(href, exact);
            const badgeCount = getBadge(badge);
            return (
              <Link key={href} href={href}>
                <div
                  className={`
                    sidebar-item relative
                    ${active ? 'active' : ''}
                    ${collapsed ? 'justify-center px-0' : ''}
                  `}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {!collapsed && badgeCount > 0 && (
                    <span className={`
                      text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0
                      ${label === 'Messages' ? 'bg-amber-500 text-black' :
                        'bg-white/10 text-slate-300'}
                    `}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                  {collapsed && badgeCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: User + Sign Out */}
        <div className="border-t border-white/[0.08] p-3 space-y-2 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <span className="text-amber-400 text-xs font-bold">{user?.avatar ?? 'SD'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-slate-300 text-xs font-semibold truncate">{user?.displayName ?? 'Admin'}</p>
                <p className="text-slate-600 text-[10px] truncate">{user?.email ?? ''}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              text-slate-500 hover:text-red-400 hover:bg-red-500/10
              transition-all duration-200 text-sm font-medium
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-64'}`}>

        {/* Top Bar (Mobile) */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-white/[0.08] bg-[#0F0F0F] sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors mr-3"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-amber-400" />
            <span className="text-amber-400 font-bold text-sm tracking-widest">SONEX</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors relative">
              <Bell size={18} />
              {badges.unread_msgs > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
