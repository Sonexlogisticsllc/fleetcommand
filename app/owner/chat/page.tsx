'use client';
import React, { useEffect, useState } from 'react';
import { ChatThread, ChatMessage } from '@/lib/types';
import { PageSpinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { MessageSquare, Zap, ChevronDown, ChevronUp, Clock, User, Truck } from 'lucide-react';

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isDriver = msg.sender === 'driver';
  const isSystem = msg.sender === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-info/10 border border-info/20 rounded-full px-4 py-1.5 text-xs text-info text-center max-w-md">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isDriver ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
        isDriver ? 'bg-amber/20 text-amber border border-amber/30' : 'bg-info/20 text-info border border-info/30'
      }`}>
        {isDriver ? <Truck size={12} /> : <User size={12} />}
      </div>
      <div className={`max-w-[72%] ${isDriver ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="text-[10px] text-slate-500">{msg.senderName}</div>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isDriver
            ? 'bg-amber/10 border border-amber/15 text-white rounded-tr-sm'
            : 'bg-info/10 border border-info/15 text-white rounded-tl-sm'
        }`}>
          {msg.content}
        </div>
        <div className="text-[10px] text-slate-600">
          {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selected, setSelected] = useState<ChatThread | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/chat').then(r => r.json()).then(d => {
      setThreads(d);
      setSelected(d[0] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return <PageSpinner text="Loading conversations..." />;

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-6 animate-fade-in">
      {/* Thread list */}
      <div className="w-80 flex-shrink-0 bg-navy-panel border-r border-navy-border flex flex-col">
        <div className="p-4 border-b border-navy-border">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-amber" />
            <span className="text-sm font-bold text-white">Chat Intelligence</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Owner view · All dispatcher-driver conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-navy-border">
          {threads.map(thread => (
            <div
              key={thread.id}
              onClick={() => { setSelected(thread); setAiExpanded(false); }}
              className={`p-4 cursor-pointer transition-all ${
                selected?.id === thread.id ? 'bg-amber/5 border-l-2 border-l-amber' : 'hover:bg-navy-hover border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{thread.driverName}</div>
                  <div className="text-xs text-slate-500">← {thread.dispatcherName}</div>
                  <div className="text-xs text-amber font-mono mt-0.5">{thread.loadReference}</div>
                </div>
                {thread.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber text-navy-DEFAULT text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {thread.unreadCount}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-2 line-clamp-2">
                {thread.messages[thread.messages.length - 1].content}
              </div>
              <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                <Clock size={9} />
                {new Date(thread.lastActivity).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat view */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="p-4 border-b border-navy-border bg-navy-panel flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">{selected.driverName} ↔ {selected.dispatcherName}</div>
              <div className="text-xs text-slate-400">Load {selected.loadReference} · {selected.messages.length} messages</div>
            </div>
            <Badge variant="info">Read-Only (Owner View)</Badge>
          </div>

          {/* AI Summary Banner */}
          <div className="mx-4 mt-4">
            <div
              className="glass-card border-amber/20 cursor-pointer"
              onClick={() => setAiExpanded(!aiExpanded)}
            >
              <div className="p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber/15 flex items-center justify-center flex-shrink-0">
                  <Zap size={15} className="text-amber" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-amber uppercase tracking-wider">AI Load Summary</div>
                  {!aiExpanded && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {selected.aiSummary.slice(0, 90)}...
                    </div>
                  )}
                </div>
                {aiExpanded ? <ChevronUp size={16} className="text-amber flex-shrink-0" /> : <ChevronDown size={16} className="text-amber flex-shrink-0" />}
              </div>
              {aiExpanded && (
                <div className="px-4 pb-4 text-sm text-slate-300 leading-relaxed border-t border-amber/10 pt-3 animate-slide-in-up">
                  {selected.aiSummary}
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selected.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>

          {/* Owner read-only footer */}
          <div className="p-4 border-t border-navy-border bg-navy-panel/50">
            <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
              <MessageSquare size={12} />
              You are viewing this conversation in read-only mode as Fleet Owner. Messages are sent by dispatchers and drivers.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Select a conversation to view
        </div>
      )}
    </div>
  );
}
