'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Truck, FileText, Map, BarChart3,
  Receipt, Users, MessageSquare, ChevronLeft, ChevronRight,
  Zap, LogOut, Radio, PhoneCall, GitBranch, Fuel, Bot,
} from 'lucide-react';
import { useAuth, PortalRole } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const DISPATCHER_NAV: NavItem[] = [
  { href: '/dispatcher', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dispatcher/load-board', label: 'Load Board', icon: Truck, badge: '3' },
  { href: '/dispatcher/rc-parser', label: 'RC Parser', icon: FileText },
  { href: '/dispatcher/fleet-map', label: 'Fleet Map', icon: Map },
];

const OWNER_NAV: NavItem[] = [
  { href: '/owner', label: 'Net Profit', icon: BarChart3 },
  { href: '/owner/factoring', label: 'Factoring', icon: Receipt },
  { href: '/owner/performance', label: 'Performance', icon: Users },
  { href: '/owner/chat', label: 'Chat Intel', icon: MessageSquare },
];

const SALES_NAV: NavItem[] = [
  { href: '/sales', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales/pipeline', label: 'Lead Pipeline', icon: GitBranch },
  { href: '/sales/call-log', label: 'Call Log', icon: PhoneCall, badge: '5' },
  { href: '/sales/ai-caller', label: 'AI Caller', icon: Bot },
  { href: '/sales/fuel-prices', label: 'Fuel Prices', icon: Fuel },
];

const THEME = {
  dispatcher: {
    primary: '#3B82F6',
    glow: 'rgba(59,130,246,0.2)',
    activeClass: 'active-dispatcher',
    logoGrad: 'from-blue-500 to-cyan-500',
    badge: 'bg-blue-500 text-white',
    roleText: 'text-blue-400',
    label: 'Dispatcher',
  },
  owner: {
    primary: '#10B981',
    glow: 'rgba(16,185,129,0.2)',
    activeClass: 'active-owner',
    logoGrad: 'from-emerald-500 to-teal-500',
    badge: 'bg-emerald-500 text-white',
    roleText: 'text-emerald-400',
    label: 'Fleet Owner',
  },
  sales: {
    primary: '#8B5CF6',
    glow: 'rgba(139,92,246,0.2)',
    activeClass: 'active-sales',
    logoGrad: 'from-violet-500 to-pink-500',
    badge: 'bg-violet-500 text-white',
    roleText: 'text-violet-400',
    label: 'Sales Team',
  },
};

interface SidebarProps {
  role: PortalRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = role === 'dispatcher' ? DISPATCHER_NAV : role === 'owner' ? OWNER_NAV : SALES_NAV;
  const theme = THEME[role];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      data-portal={role}
      className={`flex flex-col h-screen border-r border-white/[0.06] transition-all duration-300 ease-in-out flex-shrink-0 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ background: role === 'dispatcher' ? '#07101E' : role === 'owner' ? '#071510' : '#0D0820' }}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-white/[0.06] px-4 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${theme.logoGrad}`}
          style={{ boxShadow: `0 0 12px ${theme.glow}` }}>
          <Zap size={14} className="text-white" fill="currentColor" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <div className="text-sm font-bold text-white tracking-wide">FleetCommand</div>
            <div className="text-[10px] text-slate-600 uppercase tracking-widest">TMS v2.0</div>
          </div>
        )}
      </div>

      {/* User + Role Badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/[0.06] animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.primary}40, ${theme.primary}20)`, border: `1px solid ${theme.primary}30` }}>
              {user?.avatar || theme.label.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">{user?.displayName || theme.label}</div>
              <div className={`text-[10px] font-medium ${theme.roleText}`}>{theme.label} Portal</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isBase = item.href === `/${role}`;
          const isActive = isBase ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div className={`sidebar-item ${isActive ? `active-${role}` : ''} ${collapsed ? 'justify-center px-2' : ''}`}>
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="flex-1 animate-fade-in text-[13px]">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${theme.badge}`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      {!collapsed && (
        <div className="px-2 py-3 border-t border-white/[0.06] space-y-0.5 animate-fade-in">
          {/* Sonex Dispatch Hub */}
          <Link href="/sonex">
            <div className="sidebar-item">
              <span className="text-amber-400 text-sm">⬡</span>
              <span className="text-xs text-amber-400/80">Sonex Dispatch Hub</span>
            </div>
          </Link>
          {/* Switch Portal */}
          {role !== 'dispatcher' && (
            <Link href="/dispatcher">
              <div className="sidebar-item">
                <Radio size={15} />
                <span className="text-xs">Dispatcher Portal</span>
              </div>
            </Link>
          )}
          {role !== 'owner' && (
            <Link href="/owner">
              <div className="sidebar-item">
                <BarChart3 size={15} />
                <span className="text-xs">Owner Portal</span>
              </div>
            </Link>
          )}
          {role !== 'sales' && (
            <Link href="/sales">
              <div className="sidebar-item">
                <PhoneCall size={15} />
                <span className="text-xs">Sales Portal</span>
              </div>
            </Link>
          )}
          <button onClick={handleLogout} className="sidebar-item w-full text-left">
            <LogOut size={15} />
            <span className="text-xs">Sign Out</span>
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="p-2 border-t border-white/[0.06]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-200"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
}
