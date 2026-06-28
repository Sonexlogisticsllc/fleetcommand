'use client';
import React, { useState, useRef, useEffect } from 'react';
import { MOCK_LEADS, TruckerLead } from '@/lib/salesData';
import {
  Bot, Phone, PhoneOff, Send, Mic, Truck, User, MapPin, Clock,
  Zap, ChevronDown, PhoneCall, Info
} from 'lucide-react';

type CallState = 'idle' | 'calling' | 'connected' | 'ended';

interface Message {
  id: string;
  speaker: 'ai' | 'trucker' | 'system';
  text: string;
  timestamp: Date;
}

function WaveformBars({ active }: { active: boolean }) {
  if (!active) return (
    <div className="flex items-end gap-0.5 h-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="w-1 rounded-full bg-violet-500/20" style={{ height: '4px' }} />
      ))}
    </div>
  );
  return (
    <div className="flex items-end gap-0.5 h-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="waveform-bar rounded-full"
          style={{ animationDelay: `${i * 0.1}s`, background: '#8B5CF6', minHeight: '4px' }} />
      ))}
    </div>
  );
}

function RingAnimation() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border-2 border-violet-500/40 animate-call-ring" />
      <div className="absolute inset-2 rounded-full border-2 border-violet-500/30 animate-call-ring" style={{ animationDelay: '0.4s' }} />
      <div className="absolute inset-4 rounded-full border-2 border-violet-500/20 animate-call-ring" style={{ animationDelay: '0.8s' }} />
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-violet-glow-lg">
        <Phone size={28} className="text-white" />
      </div>
    </div>
  );
}

const PITCH_SCRIPTS = [
  "Hi, is this [Name]? I'm calling from FleetCommand, a premium dispatch service. Do you have 2 minutes?",
  "We average $4.20/mile on dry van freight and handle all broker comms & RC parsing. Sound interesting?",
  "Our clients see 20-35% revenue increase within 60 days. Want to see a live demo?",
];

export default function AICallerPage() {
  const [selectedLead, setSelectedLead] = useState<TruckerLead>(MOCK_LEADS[0]);
  const [callState, setCallState] = useState<CallState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [callTimer, setCallTimer] = useState(0);
  const [callId, setCallId] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callState === 'idle') setCallTimer(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const formatTimer = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const addMessage = (speaker: Message['speaker'], text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      speaker,
      text,
      timestamp: new Date(),
    }]);
  };

  const startCall = async () => {
    setCallState('calling');
    setMessages([]);
    setCallTimer(0);
    addMessage('system', `📞 Initiating AI call to ${selectedLead.name} at ${selectedLead.phone}...`);

    await new Promise(r => setTimeout(r, 2000)); // Ring time

    // Via OpenPhone (mock)
    await fetch('/api/openphone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'call', phoneNumber: selectedLead.phone, leadName: selectedLead.name }),
    });

    setCallState('connected');
    const newCallId = `fc-${Date.now()}`;
    setCallId(newCallId);
    addMessage('system', `✅ Connected! AI agent is speaking...`);

    // Get AI opening
    setIsAITyping(true);
    const res = await fetch('/api/sales-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'call_start', leadName: selectedLead.name }),
    });
    const data = await res.json();
    setIsAITyping(false);
    addMessage('ai', data.opening);
  };

  const endCall = () => {
    setCallState('ended');
    addMessage('system', `📵 Call ended · Duration: ${formatTimer(callTimer)}`);
    setTimeout(() => setCallState('idle'), 2000);
  };

  const sendTruckerResponse = async () => {
    if (!inputText.trim() || callState !== 'connected') return;
    const text = inputText.trim();
    setInputText('');
    addMessage('trucker', text);

    setIsAITyping(true);
    const res = await fetch('/api/sales-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'call_respond', message: text, callId }),
    });
    const data = await res.json();
    setIsAITyping(false);
    addMessage('ai', data.response);
  };

  const sendQuickResponse = (text: string) => {
    setInputText(text);
  };

  const QUICK_RESPONSES = [
    "Yeah, what's your rate?",
    "I already have a dispatcher.",
    "How much is your fee?",
    "Tell me more.",
    "Not interested.",
    "Can you call back later?",
  ];

  return (
    <div className="animate-fade-in h-full">
      <div className="grid lg:grid-cols-3 gap-5 h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>

        {/* LEFT: Lead Selection + Call Controls */}
        <div className="space-y-4">
          {/* Lead Selector */}
          <div className="rounded-2xl p-4 border border-violet-500/15" style={{ background: 'rgba(13,8,30,0.7)' }}>
            <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3">Select Prospect</div>
            <div className="relative">
              <button
                onClick={() => setShowLeadDropdown(!showLeadDropdown)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-violet-500/30 transition-colors"
                disabled={callState !== 'idle'}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.2))' }}>
                  {selectedLead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{selectedLead.name}</div>
                  <div className="text-xs text-slate-600">{selectedLead.company}</div>
                </div>
                <ChevronDown size={14} className="text-slate-600 flex-shrink-0" />
              </button>
              {showLeadDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-violet-500/20 z-50 overflow-hidden"
                  style={{ background: '#0D0820' }}>
                  {MOCK_LEADS.filter(l => !['signed', 'lost'].includes(l.status)).map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => { setSelectedLead(lead); setShowLeadDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left border-b border-white/[0.04] last:border-0"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: 'rgba(139,92,246,0.2)' }}>
                        {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{lead.name}</div>
                        <div className="text-[10px] text-slate-600">{lead.trucks} truck{lead.trucks > 1 ? 's' : ''} · {lead.equipment}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lead details */}
            <div className="mt-3 space-y-2">
              {[
                { icon: Phone, label: selectedLead.phone },
                { icon: Truck, label: `${selectedLead.trucks} ${selectedLead.equipment} truck${selectedLead.trucks > 1 ? 's' : ''}` },
                { icon: MapPin, label: selectedLead.preferredLanes.join(', ') },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-slate-500">
                  <Icon size={11} className="text-slate-700 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Call Control */}
          <div className="rounded-2xl p-5 border border-violet-500/15 flex flex-col items-center gap-4"
            style={{ background: 'rgba(13,8,30,0.7)' }}>

            {/* Call status display */}
            {callState === 'idle' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '2px solid rgba(139,92,246,0.2)' }}>
                  <Bot size={28} className="text-violet-400" />
                </div>
                <div className="text-sm font-bold text-white mb-1">AI Caller Ready</div>
                <div className="text-xs text-slate-600">Press Start to connect with {selectedLead.name.split(' ')[0]}</div>
              </div>
            )}

            {callState === 'calling' && (
              <div className="flex flex-col items-center gap-2">
                <RingAnimation />
                <div className="text-sm font-bold text-white">Calling...</div>
                <div className="text-xs text-slate-600">{selectedLead.phone}</div>
              </div>
            )}

            {callState === 'connected' && (
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', boxShadow: '0 0 30px rgba(139,92,246,0.4)' }}>
                  <Bot size={26} className="text-white" />
                </div>
                <div className="text-sm font-bold text-white">Live Call</div>
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {formatTimer(callTimer)}
                </div>
                <WaveformBars active={!isAITyping} />
                <div className="text-[10px] text-violet-400">{isAITyping ? 'AI is speaking...' : 'AI listening...'}</div>
              </div>
            )}

            {callState === 'ended' && (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-slate-700/50 mx-auto mb-2 flex items-center justify-center">
                  <PhoneOff size={20} className="text-slate-500" />
                </div>
                <div className="text-sm font-bold text-slate-300">Call Ended</div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 w-full">
              {callState === 'idle' && (
                <button onClick={startCall} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', boxShadow: '0 0 20px rgba(139,92,246,0.4)' }}>
                  <PhoneCall size={16} />
                  Start AI Call
                </button>
              )}
              {callState === 'connected' && (
                <button onClick={endCall} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}>
                  <PhoneOff size={16} />
                  End Call
                </button>
              )}
            </div>
          </div>

          {/* Pitch Script */}
          <div className="rounded-2xl p-4 border border-white/[0.06]" style={{ background: 'rgba(13,8,30,0.5)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} className="text-amber-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pitch Checklist</span>
            </div>
            <div className="space-y-2">
              {PITCH_SCRIPTS.map((script, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-bold text-slate-700">{i + 1}</div>
                  {script.replace('[Name]', selectedLead.name.split(' ')[0])}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Chat Transcript + Input */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-violet-500/15 overflow-hidden"
          style={{ background: 'rgba(13,8,30,0.7)' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Bot size={14} className="text-violet-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">AI Sales Agent</div>
                <div className="text-[10px] text-slate-600">OpenPhone · Simulated</div>
              </div>
            </div>
            {callState === 'connected' && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Info size={10} />
              Demo Mode
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-4">
                  <Bot size={28} className="text-violet-400" />
                </div>
                <div className="text-white font-semibold mb-2">AI Sales Chatbot</div>
                <div className="text-sm text-slate-500 max-w-xs">
                  Select a prospect and press <strong className="text-violet-400">Start AI Call</strong> to begin a simulated outbound call with transcription.
                </div>
                <div className="mt-4 p-3 rounded-xl bg-violet-500/[0.05] border border-violet-500/10 text-xs text-slate-600 max-w-xs">
                  💡 You'll play the trucker by typing responses. The AI will respond intelligently based on your replies.
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.speaker === 'trucker' ? 'justify-end' : ''} animate-slide-in-up`}>
                {msg.speaker === 'ai' && (
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={13} className="text-violet-400" />
                  </div>
                )}
                {msg.speaker === 'system' && (
                  <div className="w-full text-center">
                    <span className="text-[11px] text-slate-600 bg-white/[0.03] px-3 py-1 rounded-full">{msg.text}</span>
                  </div>
                )}
                {msg.speaker !== 'system' && (
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.speaker === 'ai'
                      ? 'bg-violet-500/10 border border-violet-500/15 text-slate-200 rounded-tl-sm'
                      : 'bg-blue-500/10 border border-blue-500/15 text-slate-200 rounded-tr-sm'
                  }`}>
                    <div className="text-[9px] font-bold mb-1 opacity-50 uppercase">
                      {msg.speaker === 'ai' ? '🤖 AI Agent' : '🚛 Trucker Response'}
                    </div>
                    {msg.text}
                  </div>
                )}
                {msg.speaker === 'trucker' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Truck size={13} className="text-blue-400" />
                  </div>
                )}
              </div>
            ))}

            {isAITyping && (
              <div className="flex gap-2.5 animate-fade-in">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} className="text-violet-400" />
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/15 rounded-tl-sm">
                  <div className="flex items-center gap-1">
                    {[0, 0.2, 0.4].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                        style={{ animationDelay: `${d}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Responses */}
          {callState === 'connected' && (
            <div className="px-4 py-2 border-t border-white/[0.04]">
              <div className="text-[10px] text-slate-700 mb-2 uppercase tracking-wider">Quick Responses (play as trucker)</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_RESPONSES.map(r => (
                  <button key={r} onClick={() => sendQuickResponse(r)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.06] text-slate-500 hover:text-white hover:border-blue-500/30 transition-colors">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" />
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendTruckerResponse()}
                  placeholder={callState === 'connected' ? "Type trucker's response..." : "Call must be active to chat..."}
                  disabled={callState !== 'connected'}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-700
                             focus:outline-none focus:border-violet-500/40 transition-all disabled:opacity-40"
                />
              </div>
              <button
                onClick={sendTruckerResponse}
                disabled={callState !== 'connected' || !inputText.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}
              >
                <Send size={15} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
