'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/dispatcher': { title: 'Dispatcher Dashboard', sub: 'Real-time operations center' },
  '/dispatcher/load-board': { title: 'Load Board', sub: 'Available & active loads' },
  '/dispatcher/rc-parser': { title: 'RC Parser', sub: 'AI document intelligence' },
  '/dispatcher/fleet-map': { title: 'Live Fleet Map', sub: 'Real-time driver positions' },
  '/owner': { title: 'Net Profit Dashboard', sub: 'True revenue after all costs' },
  '/owner/factoring': { title: 'One-Click Factoring', sub: 'Submit invoices instantly' },
  '/owner/performance': { title: 'Dispatcher Performance', sub: 'ROI & efficiency metrics' },
  '/owner/chat': { title: 'Chat Intelligence', sub: 'AI-summarized communications' },
  '/sales': { title: 'Sales Dashboard', sub: 'Trucker outreach & pipeline' },
  '/sales/pipeline': { title: 'Lead Pipeline', sub: 'Prospects & conversion tracking' },
  '/sales/call-log': { title: 'Call Log', sub: 'AI call recordings & summaries' },
  '/sales/ai-caller': { title: 'AI Caller', sub: 'Automated trucker outreach' },
  '/sales/fuel-prices': { title: 'Live Fuel Prices', sub: 'National & regional diesel data' },
};

const PORTAL_THEME: Record<string, { color: string; glow: string; dot: string }> = {
  dispatcher: { color: '#3B82F6', glow: 'rgba(59,130,246,0.3)', dot: 'bg-blue-400' },
  owner:       { color: '#10B981', glow: 'rgba(16,185,129,0.3)', dot: 'bg-emerald-400' },
  sales:       { color: '#8B5CF6', glow: 'rgba(139,92,246,0.3)', dot: 'bg-violet-400' },
};

function LiveClock() {
  const [time, setTime] = React.useState('');
  React.useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono hidden md:flex">
      <Clock size={11} />
      <span>{time}</span>
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const page = PAGE_TITLES[pathname] ?? { title: 'FleetCommand TMS', sub: 'Transportation Management System' };
  const role = user?.role ?? 'dispatcher';
  const theme = PORTAL_THEME[role];

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <header
      className="h-14 border-b border-white/[0.06] flex items-center px-5 gap-4 sticky top-0 z-30"
      style={{ background: 'rgba(7,16,30,0.85)', backdropFilter: 'blur(20px)' }}
    >
      {/* Colored accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.color}50, transparent)` }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-white truncate">{page.title}</h1>
          <div className="hidden md:flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`} />
            <span className="text-[11px] text-slate-600">{page.sub}</span>
          </div>
        </div>
      </div>

      <LiveClock />

      {/* Search */}
      <div className="relative hidden lg:block">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          placeholder="Search..."
          className="bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-700
                     focus:outline-none w-44 transition-all duration-200"
          onFocus={e => { e.target.style.borderColor = `${theme.color}50`; e.target.style.boxShadow = `0 0 0 2px ${theme.glow}`; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Notification */}
      <button className="relative p-2 rounded-xl text-slate-600 hover:text-slate-300 hover:bg-white/[0.05] transition-colors">
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: theme.color }} />
      </button>

      {/* User avatar */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold text-white cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${theme.color}50, ${theme.color}30)`, border: `1px solid ${theme.color}30` }}
          title={user?.displayName}
        >
          {user?.avatar || 'U'}
        </div>
        {user && (
          <button onClick={handleLogout} className="p-1.5 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Sign out">
            <LogOut size={14} />
          </button>
        )}
      </div>
    </header>
  );
}
