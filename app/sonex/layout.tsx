'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, CalendarDays, ChevronLeft, ChevronRight, CircleHelp, Command,
  LayoutDashboard, LogOut, Menu, Package, ReceiptText, Search, Settings,
  Truck, Users, Wrench,
} from 'lucide-react';
import { useSonexAuth } from '@/lib/sonexAuth';
import { NotificationBell } from '@/components/sonex/NotificationBell';
import { getCarriers, getLoads } from '@/lib/sonexStore';

type BadgeKey = 'carriers' | 'activeLoads';
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'Operations' | 'Finance' | 'Fleet' | 'Administration';
  badge?: BadgeKey;
  exact?: boolean;
};

const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/sonex', icon: LayoutDashboard, group: 'Operations', exact: true },
  { label: 'Load Management', href: '/sonex/loads', icon: Package, group: 'Operations', badge: 'activeLoads' },
  { label: 'Planning Board', href: '/sonex/planning', icon: CalendarDays, group: 'Operations' },
  { label: 'Carriers & Drivers', href: '/sonex/carriers', icon: Users, group: 'Operations', badge: 'carriers' },
  { label: 'Accounting', href: '/sonex/accounting', icon: ReceiptText, group: 'Finance' },
  { label: 'Performance Reports', href: '/sonex/load-log', icon: BarChart3, group: 'Finance' },
  { label: 'Fleet Management', href: '/sonex/fleet', icon: Wrench, group: 'Fleet' },
  { label: 'Settings', href: '/sonex/settings', icon: Settings, group: 'Administration' },
];

const groups: NavItem['group'][] = ['Operations', 'Finance', 'Fleet', 'Administration'];

export default function SonexLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, user, logout, isAuthenticated } = useSonexAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
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

  if (pathname === '/sonex/login') return <>{children}</>;

  if (!isAuthenticated || !isAdmin) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">Loading workspace...</div>;
  }

  const sidebarWidth = collapsed ? 'lg:ml-[76px]' : 'lg:ml-[248px]';

  return (
    <div data-portal="sonex" className="min-h-screen bg-slate-50">
      {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-all duration-200 ${collapsed ? 'w-[76px]' : 'w-[248px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`flex h-16 items-center border-b border-slate-800 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/sonex" className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center bg-blue-600 text-white"><Truck size={17} /></div>
            {!collapsed && <div className="min-w-0"><p className="text-sm font-semibold tracking-wide text-white">SONEX</p><p className="text-[10px] font-medium text-slate-500">TRANSPORTATION OS</p></div>}
          </Link>
          {!collapsed && <button onClick={() => setCollapsed(true)} title="Collapse sidebar" className="hidden p-1.5 text-slate-500 hover:text-white lg:inline-flex"><ChevronLeft size={16} /></button>}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map(group => {
            const items = navigation.filter(item => item.group === group);
            return (
              <div key={group} className="mb-5">
                {!collapsed && <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{group}</p>}
                <div className="space-y-0.5">
                  {items.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    const badge = item.badge ? badges[item.badge] : 0;
                    return (
                      <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined} className={`relative flex h-10 items-center gap-3 px-2.5 text-sm transition-colors ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'} ${collapsed ? 'justify-center px-0' : ''}`}>
                        <Icon size={17} className={active ? 'text-blue-400' : ''} />
                        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                        {!collapsed && badge > 0 && <span className="min-w-[18px] bg-slate-800 px-1.5 py-0.5 text-center text-[10px] font-semibold text-slate-300">{badge > 99 ? '99+' : badge}</span>}
                        {collapsed && badge > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 bg-blue-400" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className={`mb-2 flex items-center gap-2.5 px-1 ${collapsed ? 'justify-center' : ''}`}>
            <div className="grid h-7 w-7 place-items-center bg-slate-800 text-[10px] font-semibold text-white">{user?.avatar ?? 'SD'}</div>
            {!collapsed && <div className="min-w-0"><p className="truncate text-xs font-medium text-white">{user?.displayName ?? 'Dispatch'}</p><p className="truncate text-[10px] text-slate-500">{user?.email}</p></div>}
          </div>
          <button onClick={() => { logout(); router.push('/sonex/login'); }} title={collapsed ? 'Sign out' : undefined} className={`flex h-9 w-full items-center gap-3 px-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-white ${collapsed ? 'justify-center' : ''}`}>
            <LogOut size={16} />{!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      <div className={`min-h-screen transition-all duration-200 ${sidebarWidth}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button onClick={() => setMobileOpen(true)} title="Open navigation" className="inline-flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={19} /></button>
          {collapsed && <button onClick={() => setCollapsed(false)} title="Expand sidebar" className="hidden h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 lg:inline-flex"><ChevronRight size={17} /></button>}
          <button onClick={() => setCommandOpen(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-500 hover:border-slate-300 sm:max-w-md">
            <Search size={15} />
            <span className="truncate">Search workspace or run a command</span>
            <span className="ml-auto hidden border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline-flex">Ctrl K</span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button title="Help center" className="hidden h-9 w-9 items-center justify-center text-slate-500 hover:bg-slate-100 sm:inline-flex"><CircleHelp size={18} /></button>
            <NotificationBell role="admin" />
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
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
