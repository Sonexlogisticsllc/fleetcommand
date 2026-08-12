'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Command,
  LayoutDashboard, LogOut, Menu, Package, ReceiptText, Search, Settings,
  Users, Plus,
} from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { NotificationBell } from '@/components/sonex/NotificationBell';
import { getCarriers, getLoads } from '@/lib/sonexStore';
import { SonexMark } from '@/components/sonex/SonexMark';

type BadgeKey = 'carriers' | 'activeLoads';
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'Operations' | 'Finance' | 'Administration';
  badge?: BadgeKey;
  exact?: boolean;
};

const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/sonex', icon: LayoutDashboard, group: 'Operations', exact: true },
  { label: 'Load Management', href: '/sonex/loads', icon: Package, group: 'Operations', badge: 'activeLoads' },
  { label: 'Carriers & Drivers', href: '/sonex/carriers', icon: Users, group: 'Operations', badge: 'carriers' },
  { label: 'Accounting', href: '/sonex/accounting', icon: ReceiptText, group: 'Finance' },
  { label: 'Settings', href: '/sonex/settings', icon: Settings, group: 'Administration' },
];

const groups: NavItem['group'][] = ['Operations', 'Finance', 'Administration'];

export default function SonexLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, user, logout, isAuthenticated } = useSonexAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ carriers: 0, activeLoads: 0 });

  useEffect(() => {
    if (pathname === '/sonex/login') return;
    if (!isAuthenticated || !isAdmin) router.replace('/sonex/login');
  }, [isAdmin, isAuthenticated, pathname, router]);

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

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    Promise.all([getCarriers(), getLoads()])
      .then(([carriers, loads]) => setBadges({
        carriers: carriers.filter(carrier => carrier.status === 'active').length,
        activeLoads: loads.filter(load => ['booked', 'dispatched', 'in_transit'].includes(load.status)).length,
      }))
      .catch(() => undefined);
  }, [isAuthenticated, isAdmin, pathname]);

  const matchingCommands = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? navigation.filter(item => item.label.toLowerCase().includes(term)) : navigation;
  }, [query]);

  const isActive = (item: NavItem) => item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/');

  const navigate = (href: string) => {
    setCommandOpen(false);
    setMobileOpen(false);
    setQuery('');
    router.push(href);
  };

  const currentSection = navigation.find(isActive)?.label ?? 'Dispatch';

  if (pathname === '/sonex/login') return <>{children}</>;

  if (!isAuthenticated || !isAdmin) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">Loading workspace...</div>;
  }

  const sidebarWidth = 'lg:ml-[84px]';

  return (
    <div data-portal="sonex" className="min-h-screen bg-[#f2f5f9]">
      {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[84px] flex-col bg-gradient-to-b from-[#8d42c9] via-[#6847d2] to-[#2f66d5] text-white transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-[72px] items-center justify-center border-b border-white/15">
          <Link href="/sonex" className="flex min-w-0 items-center gap-2.5" title="Sonex Dispatch">
            <SonexMark />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map(group => {
            const items = navigation.filter(item => item.group === group);
            return (
              <div key={group} className="mb-4">
                <div className="space-y-0.5">
                  {items.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    const badge = item.badge ? badges[item.badge] : 0;
                    return (
                      <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMobileOpen(false)} title={item.label} className={`relative mx-2 flex h-12 items-center justify-center transition-colors ${active ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                        <Icon size={23} strokeWidth={1.8} />
                        {badge > 0 && <span className="absolute right-1 top-1 min-w-4 bg-[#ffd44d] px-1 text-center text-[9px] font-bold text-[#39248b]">{badge > 99 ? '99+' : badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/15 p-2">
          <div className="mb-2 grid h-8 place-items-center bg-white/20 text-[10px] font-semibold text-white">{user?.avatar ?? 'SD'}</div>
          <button onClick={async () => { await logout(); window.location.assign('/sonex/login'); }} title="Sign out" className="flex h-10 w-full items-center justify-center text-white/75 hover:bg-white/10 hover:text-white">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className={`min-h-screen transition-all duration-200 ${sidebarWidth}`}>
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 bg-gradient-to-r from-[#8b3fc5] via-[#6b46d2] to-[#405bd9] px-5 text-white">
          <button onClick={() => setMobileOpen(true)} title="Open navigation" className="inline-flex h-9 w-9 items-center justify-center text-white lg:hidden"><Menu size={19} /></button>
          <span className="hidden text-[20px] font-medium lg:inline-flex">Sonex Dispatch / <span className="ml-1">{currentSection}</span></span>
          <button onClick={() => setCommandOpen(true)} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 text-left text-sm text-[#43517a] shadow-sm sm:mx-auto sm:max-w-[395px]">
            <Search size={15} className="text-blue-500" />
            <span className="truncate">Ctrl + K to search</span>
            <span className="ml-auto text-xs text-[#5e35c1]">All</span>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => navigate('/sonex/loads?new=1')} title="Create load" className="hidden items-center gap-2 rounded-full border border-white/80 px-5 py-2 text-sm sm:inline-flex"><Plus size={16} /> New load</button>
            <NotificationBell role="admin" />
            <button onClick={() => navigate('/sonex/settings')} title="Settings" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><Settings size={19} /></button>
          </div>
        </header>
        <main data-tms-surface className="min-h-[calc(100vh-64px)]">{children}</main>
      </div>

      {commandOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-start bg-slate-950/30 px-4 pt-[12vh]" onMouseDown={() => setCommandOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden border border-slate-200 bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-slate-200 px-3">
              <Command size={16} className="text-slate-400" />
              <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search navigation..." className="h-12 min-w-0 flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
              <button onClick={() => setCommandOpen(false)} className="text-[11px] text-slate-400">Esc</button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {matchingCommands.map(item => {
                const Icon = item.icon;
                return <button key={item.href} onClick={() => navigate(item.href)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"><Icon size={16} className="text-slate-400" /><span className="flex-1">{item.label}</span><span className="text-[10px] text-slate-400">{item.group}</span></button>;
              })}
              {!matchingCommands.length && <p className="px-3 py-8 text-center text-sm text-slate-400">No matching workspace command.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
