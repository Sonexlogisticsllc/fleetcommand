'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PhoneCall, Users, TrendingUp, DollarSign, Bot, GitBranch,
  ArrowRight, Fuel, Mic, CheckCircle, Clock, Phone
} from 'lucide-react';
import { MOCK_SALES_STATS, MOCK_LEADS, MOCK_CALL_RECORDS } from '@/lib/salesData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const WEEKLY_CALLS = [
  { day: 'Mon', calls: 8, signed: 0 },
  { day: 'Tue', calls: 14, signed: 1 },
  { day: 'Wed', calls: 11, signed: 0 },
  { day: 'Thu', calls: 17, signed: 1 },
  { day: 'Fri', calls: 9, signed: 1 },
  { day: 'Sat', calls: 5, signed: 0 },
  { day: 'Today', calls: 14, signed: 0 },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'New',         color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  contacted:   { label: 'Contacted',   color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  demo:        { label: 'Demo',        color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  negotiating: { label: 'Negotiating', color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  signed:      { label: 'Signed',      color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  lost:        { label: 'Lost',        color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

export default function SalesDashboard() {
  const stats = MOCK_SALES_STATS;
  const recentCalls = MOCK_CALL_RECORDS.slice(0, 4);
  const hotLeads = MOCK_LEADS.filter(l => ['negotiating', 'demo'].includes(l.status));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden border border-violet-500/15"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(236,72,153,0.08) 100%)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 -translate-y-1/2 translate-x-1/4"
          style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={18} className="text-violet-400" />
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">AI Sales Engine · Active</span>
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Good Morning, Sales Team 👋</h2>
          <p className="text-slate-400 text-sm">Your AI has made <span className="text-violet-300 font-semibold">14 outbound calls</span> today. 2 warm leads ready for follow-up.</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Calls Today', value: stats.callsToday, sub: `${stats.callsThisWeek} this week`, icon: PhoneCall, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
          { label: 'Leads This Month', value: stats.leadsThisMonth, sub: `${stats.signedThisMonth} signed`, icon: Users, color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
          { label: 'Pipeline Value', value: `$${(stats.pipelineValue / 1000).toFixed(0)}K`, sub: 'monthly potential', icon: TrendingUp, color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
          { label: 'Revenue Closed', value: `$${(stats.revenueGenerated / 1000).toFixed(1)}K`, sub: `${stats.conversionRate}% conversion`, icon: DollarSign, color: '#F9A8D4', bg: 'rgba(249,168,212,0.12)' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl p-5 border border-white/[0.06]"
              style={{ background: 'rgba(13,8,30,0.6)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                  <Icon size={17} style={{ color: s.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-0.5">{s.value}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</div>
              <div className="text-xs text-slate-600 mt-1">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Call Activity Chart */}
        <div className="lg:col-span-2 rounded-2xl p-5 border border-white/[0.06]"
          style={{ background: 'rgba(13,8,30,0.6)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white">Weekly Call Activity</h3>
              <p className="text-xs text-slate-600 mt-0.5">AI + manual calls this week</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-violet-500" /><span className="text-slate-500">Calls</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /><span className="text-slate-500">Signed</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={WEEKLY_CALLS}>
              <defs>
                <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0D0820', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#A78BFA', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="calls" name="Calls" stroke="#8B5CF6" fill="url(#callGrad)" strokeWidth={2} dot={{ fill: '#8B5CF6', r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Actions</h3>
          {[
            { href: '/sales/ai-caller', icon: Bot, label: 'Launch AI Caller', sub: 'Start outbound campaign', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.2)' },
            { href: '/sales/pipeline', icon: GitBranch, label: 'View Pipeline', sub: `${hotLeads.length} hot leads need attention`, color: '#EC4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.2)' },
            { href: '/sales/call-log', icon: Mic, label: 'Call Recordings', sub: `${MOCK_CALL_RECORDS.length} calls logged`, color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.2)' },
            { href: '/sales/fuel-prices', icon: Fuel, label: 'Fuel Prices', sub: 'National avg $3.748/gal', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.15)' },
          ].map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.href} href={a.href}>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer hover:scale-[1.01] transition-all duration-200 group"
                  style={{ background: a.bg, borderColor: a.border }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${a.color}20` }}>
                    <Icon size={16} style={{ color: a.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{a.label}</div>
                    <div className="text-xs text-slate-600">{a.sub}</div>
                  </div>
                  <ArrowRight size={14} className="text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Calls */}
        <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: 'rgba(13,8,30,0.6)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Recent AI Calls</h3>
            <Link href="/sales/call-log" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">View all →</Link>
          </div>
          <div className="space-y-2.5">
            {recentCalls.map(call => (
              <div key={call.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-violet-500/20 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${call.type === 'ai_outbound' ? 'bg-violet-500/15' : 'bg-blue-500/15'}`}>
                  {call.type === 'ai_outbound' ? <Bot size={14} className="text-violet-400" /> : <Phone size={14} className="text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{call.leadName}</div>
                  <div className="text-[11px] text-slate-600 truncate">{call.outcome}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full`}
                    style={{
                      background: call.status === 'completed' ? 'rgba(16,185,129,0.12)' : call.status === 'voicemail' ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.1)',
                      color: call.status === 'completed' ? '#34D399' : call.status === 'voicemail' ? '#FCD34D' : '#94A3B8',
                    }}>
                    {call.status}
                  </span>
                  <span className="text-[10px] text-slate-700">{Math.floor(call.duration / 60)}m {call.duration % 60}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hot Leads */}
        <div className="rounded-2xl p-5 border border-white/[0.06]" style={{ background: 'rgba(13,8,30,0.6)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">🔥 Hot Leads</h3>
            <Link href="/sales/pipeline" className="text-xs text-pink-400 hover:text-pink-300 transition-colors">Pipeline →</Link>
          </div>
          <div className="space-y-2.5">
            {MOCK_LEADS.filter(l => ['negotiating', 'demo', 'contacted'].includes(l.status)).slice(0, 4).map(lead => {
              const sm = STATUS_META[lead.status];
              return (
                <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-pink-500/20 transition-colors">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))', border: '1px solid rgba(139,92,246,0.2)' }}>
                    {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{lead.name}</div>
                    <div className="text-[11px] text-slate-600">{lead.trucks} truck{lead.trucks > 1 ? 's' : ''} · {lead.equipment}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: sm.bg, color: sm.color }}>
                      {sm.label}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-400">${(lead.monthlyRevenuePotential / 1000).toFixed(0)}K/mo</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
