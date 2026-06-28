'use client';
import React, { useState } from 'react';
import { MOCK_LEADS, TruckerLead, LeadStatus } from '@/lib/salesData';
import { Phone, Truck, MapPin, DollarSign, Bot, User, Plus, Search } from 'lucide-react';

const STAGES: { key: LeadStatus; label: string; color: string; bg: string; border: string }[] = [
  { key: 'new',         label: 'New Leads',     color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
  { key: 'contacted',  label: 'Contacted',     color: '#3B82F6', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.2)' },
  { key: 'demo',       label: 'Demo Scheduled',color: '#F59E0B', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)' },
  { key: 'negotiating',label: 'Negotiating',   color: '#EC4899', bg: 'rgba(236,72,153,0.06)',  border: 'rgba(236,72,153,0.2)' },
  { key: 'signed',     label: 'Signed! 🎉',    color: '#10B981', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.2)' },
];

const EQUIPMENT_COLORS: Record<string, string> = {
  'Dry Van': '#3B82F6', 'Reefer': '#06B6D4', 'Flatbed': '#F59E0B',
  'Step Deck': '#A78BFA', 'Tanker': '#EC4899', 'Box Truck': '#10B981',
};

function LeadCard({ lead }: { lead: TruckerLead }) {
  const eqColor = EQUIPMENT_COLORS[lead.equipment] || '#94A3B8';
  const isAI = lead.assignedTo === 'AI Caller';

  return (
    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0D0820] hover:border-violet-500/20 transition-all duration-200 cursor-pointer hover:scale-[1.01] group">
      {/* Header */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: `linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.15))`, border: '1px solid rgba(139,92,246,0.2)' }}>
            {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="text-xs font-bold text-white leading-tight">{lead.name}</div>
            <div className="text-[10px] text-slate-600">{lead.company}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAI ? <Bot size={11} className="text-violet-400" /> : <User size={11} className="text-blue-400" />}
        </div>
      </div>

      {/* Info pills */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${eqColor}15`, color: eqColor }}>
          {lead.equipment}
        </span>
        <span className="text-[10px] text-slate-600 flex items-center gap-1">
          <Truck size={9} /> {lead.trucks} truck{lead.trucks > 1 ? 's' : ''}
        </span>
        <span className="text-[10px] text-slate-600 flex items-center gap-1">
          <MapPin size={9} /> {lead.homeState}
        </span>
      </div>

      {/* Lanes */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {lead.preferredLanes.slice(0, 2).map(lane => (
          <span key={lane} className="text-[10px] text-slate-700 bg-white/[0.03] px-1.5 py-0.5 rounded">{lane}</span>
        ))}
        {lead.preferredLanes.length > 2 && (
          <span className="text-[10px] text-slate-700">+{lead.preferredLanes.length - 2}</span>
        )}
      </div>

      {/* Revenue + contact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
          <DollarSign size={10} />
          {(lead.monthlyRevenuePotential / 1000).toFixed(0)}K/mo
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-600">
          <Phone size={9} />
          {lead.phone.slice(-8)}
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [leads] = useState(MOCK_LEADS.filter(l => l.status !== 'lost'));
  const [search, setSearch] = useState('');

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.company.toLowerCase().includes(search.toLowerCase()) ||
    l.equipment.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Lead Pipeline</h2>
          <p className="text-xs text-slate-600 mt-0.5">{leads.length} active prospects · drag to move between stages</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-violet-500/40 w-44 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', boxShadow: '0 0 16px rgba(139,92,246,0.3)' }}>
            <Plus size={13} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {STAGES.map(stage => {
          const count = leads.filter(l => l.status === stage.key).length;
          const value = leads.filter(l => l.status === stage.key).reduce((s, l) => s + l.monthlyRevenuePotential, 0);
          return (
            <div key={stage.key} className="text-center p-3 rounded-xl border" style={{ background: stage.bg, borderColor: stage.border }}>
              <div className="text-xl font-bold" style={{ color: stage.color }}>{count}</div>
              <div className="text-[10px] text-slate-600 font-medium">{stage.label}</div>
              {value > 0 && <div className="text-[10px] text-emerald-500 font-semibold mt-0.5">${(value / 1000).toFixed(0)}K</div>}
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
        {STAGES.map(stage => {
          const stageLeads = filtered.filter(l => l.status === stage.key);
          return (
            <div key={stage.key} className="flex-shrink-0 w-64 rounded-2xl border" style={{ background: stage.bg, borderColor: stage.border }}>
              {/* Column header */}
              <div className="flex items-center justify-between p-3.5 border-b" style={{ borderColor: stage.border }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: `${stage.color}30` }}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto" style={{ maxHeight: '500px' }}>
                {stageLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
                {stageLeads.length === 0 && (
                  <div className="text-center py-8 text-slate-700 text-xs">
                    <div className="text-2xl mb-2">📭</div>
                    No leads here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
