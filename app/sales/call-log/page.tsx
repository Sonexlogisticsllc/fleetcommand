'use client';
import React, { useState } from 'react';
import { MOCK_CALL_RECORDS, CallRecord } from '@/lib/salesData';
import { Bot, Phone, Play, ChevronDown, ChevronUp, Clock, Mic, User, Truck } from 'lucide-react';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed',   color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  no_answer: { label: 'No Answer',   color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  voicemail: { label: 'Voicemail',   color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  callback:  { label: 'Callback',    color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  busy:      { label: 'Busy',        color: '#94A3B8', bg: 'rgba(148,163,184,0.08)' },
};

function CallRow({ call }: { call: CallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const ss = STATUS_STYLE[call.status];
  const isAI = call.type === 'ai_outbound';

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-200 hover:border-violet-500/20">
      {/* Main row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAI ? 'bg-violet-500/15' : 'bg-blue-500/15'}`}>
          {isAI ? <Bot size={18} className="text-violet-400" /> : <Phone size={18} className="text-blue-400" />}
        </div>

        {/* Lead info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white">{call.leadName}</span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">{call.company}</span>
          </div>
          <div className="text-xs text-slate-600 truncate">{call.outcome}</div>
        </div>

        {/* Type badge */}
        <div className="hidden md:block">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isAI ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
            {isAI ? '🤖 AI Call' : '👤 Manual'}
          </span>
        </div>

        {/* Status */}
        <div className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: ss.bg, color: ss.color }}>
          {ss.label}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 w-14 flex-shrink-0">
          <Clock size={11} />
          {formatDuration(call.duration)}
        </div>

        {/* Timestamp */}
        <div className="text-xs text-slate-600 w-28 text-right flex-shrink-0 hidden lg:block">
          {formatTime(call.timestamp)}
        </div>

        {/* Agent */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 w-28 flex-shrink-0">
          {isAI ? <Bot size={11} /> : <User size={11} />}
          <span className="truncate">{call.agentName}</span>
        </div>

        {/* Expand */}
        <div className="text-slate-600 flex-shrink-0">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {/* Expanded: Summary + Transcript */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 animate-fade-in"
          style={{ background: 'rgba(13,8,30,0.4)' }}>
          {/* Summary */}
          <div className="mb-4">
            <div className="text-[11px] font-bold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bot size={11} />
              AI Call Summary
            </div>
            <p className="text-sm text-slate-300 leading-relaxed bg-violet-500/[0.05] border border-violet-500/10 rounded-xl p-3">
              {call.summary}
            </p>
          </div>

          {/* Recording */}
          {call.recordingUrl && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <Mic size={14} className="text-violet-400" />
              <span className="text-xs text-slate-400 flex-1">Recording available</span>
              <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-500/15 border border-violet-500/20 text-violet-400 text-xs font-semibold hover:bg-violet-500/25 transition-colors">
                <Play size={11} />
                Play
              </button>
            </div>
          )}

          {/* Transcript */}
          {call.transcript && call.transcript.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Transcript</div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {call.transcript.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.speaker === 'ai' ? '' : 'justify-end'}`}>
                    {msg.speaker === 'ai' && (
                      <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot size={11} className="text-violet-400" />
                      </div>
                    )}
                    <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      msg.speaker === 'ai'
                        ? 'bg-violet-500/10 border border-violet-500/15 text-slate-300'
                        : 'bg-white/[0.05] border border-white/[0.08] text-slate-300'
                    }`}>
                      <div className="text-[9px] font-bold mb-1 opacity-60 uppercase">
                        {msg.speaker === 'ai' ? '🤖 AI Agent' : '🚛 Trucker'} · {msg.timestamp}s
                      </div>
                      {msg.text}
                    </div>
                    {msg.speaker === 'trucker' && (
                      <div className="w-6 h-6 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Truck size={11} className="text-slate-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CallLogPage() {
  const [filter, setFilter] = useState<'all' | 'ai_outbound' | 'manual_outbound'>('all');

  const filtered = MOCK_CALL_RECORDS.filter(c =>
    filter === 'all' ? true : c.type === filter
  );

  const stats = {
    total: MOCK_CALL_RECORDS.length,
    completed: MOCK_CALL_RECORDS.filter(c => c.status === 'completed').length,
    aiCalls: MOCK_CALL_RECORDS.filter(c => c.type === 'ai_outbound').length,
    avgDuration: Math.round(MOCK_CALL_RECORDS.filter(c => c.status === 'completed').reduce((s, c) => s + c.duration, 0) / MOCK_CALL_RECORDS.filter(c => c.status === 'completed').length),
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: stats.total, color: '#A78BFA' },
          { label: 'Completed', value: stats.completed, color: '#10B981' },
          { label: 'AI Calls', value: stats.aiCalls, color: '#8B5CF6' },
          { label: 'Avg Duration', value: formatDuration(stats.avgDuration), color: '#EC4899' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(13,8,30,0.6)' }}>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all', label: 'All Calls' },
          { key: 'ai_outbound', label: '🤖 AI Calls' },
          { key: 'manual_outbound', label: '👤 Manual Calls' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
            style={{
              background: filter === f.key ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f.key ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: filter === f.key ? '#A78BFA' : '#64748B',
            }}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-600">{filtered.length} records</span>
      </div>

      {/* Call records */}
      <div className="space-y-2.5">
        {filtered.map(call => <CallRow key={call.id} call={call} />)}
      </div>
    </div>
  );
}
