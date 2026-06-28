'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Send, Paperclip, MessageSquare, Check, CheckCheck,
  Image as ImageIcon, FileText, ChevronRight, Circle
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SonexCarrier, SonexMessage } from '@/lib/sonexTypes';
import {
  getCarriers, getMessages, addMessage, markMessagesRead, getUnreadCountForCarrier, getAllMessages
} from '@/lib/sonexStore';
import { useSonexAuth } from '@/lib/sonexAuth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMsgFull(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Carrier List Item ────────────────────────────────────────────────────────

function CarrierListItem({
  carrier, lastMessage, unreadCount, isActive, onClick
}: {
  carrier: SonexCarrier;
  lastMessage?: SonexMessage;
  unreadCount: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const initials = getInitials(`${carrier.firstName} ${carrier.lastName}`);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-left ${
        isActive
          ? 'bg-amber-500/[0.12] border border-amber-500/20'
          : 'hover:bg-white/[0.04] border border-transparent'
      }`}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold relative ${
        isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
      }`}>
        {initials}
        {carrier.status === 'active' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#050B18]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm font-semibold truncate ${isActive ? 'text-amber-300' : 'text-white'}`}>
            {carrier.firstName} {carrier.lastName}
          </span>
          <span className="text-[10px] text-slate-600 flex-shrink-0">
            {lastMessage ? formatMsgTime(lastMessage.createdAt) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-xs text-slate-500 truncate">
            {lastMessage
              ? (lastMessage.senderRole === 'admin' ? '↑ ' : '') + lastMessage.messageText.slice(0, 45)
              : 'No messages yet'}
          </p>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isAdmin }: { msg: SonexMessage; isAdmin: boolean }) {
  const isMe = isAdmin && msg.senderRole === 'admin';

  return (
    <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar */}
      {!isMe && (
        <div className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-auto">
          {getInitials(msg.senderName)}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
          isMe
            ? 'bg-amber-500/20 border border-amber-500/20 text-amber-100 rounded-tr-sm'
            : 'bg-white/[0.07] border border-white/[0.06] text-slate-200 rounded-tl-sm'
        }`}>
          {msg.messageText}

          {/* Attachment */}
          {msg.attachmentUrl && msg.attachmentType === 'image' && (
            <img
              src={msg.attachmentUrl}
              alt="attachment"
              className="mt-2 max-w-[220px] rounded-lg border border-white/10"
            />
          )}
          {msg.attachmentUrl && msg.attachmentType === 'document' && (
            <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-white/[0.06] border border-white/10">
              <FileText size={14} className="text-slate-400" />
              <span className="text-xs text-slate-400">Attachment</span>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className={`flex items-center gap-1 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'flex-row-reverse' : ''}`}>
          <span>{msg.senderName}</span>
          <span>·</span>
          <span>{formatMsgFull(msg.createdAt)}</span>
          {isMe && (
            msg.read
              ? <CheckCheck size={10} className="text-amber-500" />
              : <Check size={10} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <MessageSquare size={28} className="text-amber-500/60" />
      </div>
      <div>
        <p className="text-white font-semibold">Select a conversation</p>
        <p className="text-sm text-slate-500 mt-1">Choose a carrier from the left to view messages</p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useSonexAuth();
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [allMessages, setAllMessages] = useState<SonexMessage[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [thread, setThread] = useState<SonexMessage[]>([]);
  const [searchCarrier, setSearchCarrier] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshAll = useCallback(() => {
    const cs = getCarriers();
    const msgs = getAllMessages();
    setCarriers(cs);
    setAllMessages(msgs);
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Update thread when selectedCarrierId changes
  useEffect(() => {
    if (!selectedCarrierId) { setThread([]); return; }
    const msgs = getMessages(selectedCarrierId);
    setThread(msgs);
    markMessagesRead(selectedCarrierId, 'admin');
    refreshAll();
  }, [selectedCarrierId, refreshAll]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  // Build carrier list sorted by most recent message
  const carrierList = carriers
    .map(carrier => {
      const msgs = allMessages.filter(m => m.carrierId === carrier.id);
      const lastMessage = msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const unreadCount = getUnreadCountForCarrier(carrier.id, 'admin');
      return { carrier, lastMessage, unreadCount };
    })
    .filter(({ carrier }) =>
      `${carrier.firstName} ${carrier.lastName}`.toLowerCase().includes(searchCarrier.toLowerCase())
    )
    .sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });

  const selectedCarrier = carriers.find(c => c.id === selectedCarrierId);

  const handleSelectCarrier = (carrierId: string) => {
    setSelectedCarrierId(carrierId);
    const msgs = getMessages(carrierId);
    setThread(msgs);
    markMessagesRead(carrierId, 'admin');
    setTimeout(() => refreshAll(), 100);
  };

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !selectedCarrierId || sending) return;
    setSending(true);
    try {
      const msg = addMessage({
        carrierId: selectedCarrierId,
        senderId: 'admin',
        senderName: 'Sonex Dispatch',
        senderRole: 'admin',
        messageText: newMessage.trim(),
        read: false,
        createdAt: new Date().toISOString(),
      });
      setThread(prev => [...prev, msg]);
      setNewMessage('');
      refreshAll();
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedCarrierId, sending, refreshAll]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCarrierId) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      const isImage = file.type.startsWith('image/');
      const msg = addMessage({
        carrierId: selectedCarrierId,
        senderId: 'admin',
        senderName: 'Sonex Dispatch',
        senderRole: 'admin',
        messageText: file.name,
        attachmentUrl: url,
        attachmentType: isImage ? 'image' : 'document',
        read: false,
        createdAt: new Date().toISOString(),
      });
      setThread(prev => [...prev, msg]);
      refreshAll();
      toast.success('File attached');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const totalUnread = carriers.reduce((sum, c) => sum + getUnreadCountForCarrier(c.id, 'admin'), 0);

  return (
    <div className="h-screen bg-[#050B18] flex flex-col">
      {/* Page Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Messages
            {totalUnread > 0 && (
              <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-amber-500 text-black">
                {totalUnread}
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Carrier communication hub</p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex gap-4 px-6 pb-6 min-h-0">
        {/* Left Panel — Carrier List */}
        <div className="w-80 flex-shrink-0 flex flex-col glass-card overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search carriers…"
                value={searchCarrier}
                onChange={e => setSearchCarrier(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40 transition-all"
              />
            </div>
          </div>

          {/* Carrier list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {carrierList.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">No carriers found</div>
            ) : carrierList.map(({ carrier, lastMessage, unreadCount }) => (
              <CarrierListItem
                key={carrier.id}
                carrier={carrier}
                lastMessage={lastMessage}
                unreadCount={unreadCount}
                isActive={selectedCarrierId === carrier.id}
                onClick={() => handleSelectCarrier(carrier.id)}
              />
            ))}
          </div>
        </div>

        {/* Right Panel — Chat Thread */}
        <div className="flex-1 flex flex-col glass-card overflow-hidden min-w-0">
          {!selectedCarrier ? (
            <EmptyState />
          ) : (
            <>
              {/* Thread Header */}
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
                  {getInitials(`${selectedCarrier.firstName} ${selectedCarrier.lastName}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{selectedCarrier.firstName} {selectedCarrier.lastName}</p>
                  <p className="text-xs text-slate-500">{selectedCarrier.equipmentType} · {selectedCarrier.phone}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  selectedCarrier.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : selectedCarrier.status === 'onboarding'
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-slate-700/40 text-slate-500'
                }`}>
                  {selectedCarrier.status}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {thread.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center">
                      <MessageSquare size={20} className="text-slate-600" />
                    </div>
                    <p className="text-slate-500 text-sm">No messages yet.<br />Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {thread.map(msg => (
                      <MessageBubble key={msg.id} msg={msg} isAdmin={true} />
                    ))}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="flex-shrink-0 p-3 border-t border-white/[0.06]">
                <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all"
                    title="Attach file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 resize-none focus:outline-none py-1.5 max-h-28 overflow-y-auto leading-relaxed"
                    style={{ minHeight: '36px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500 text-black flex items-center justify-center hover:bg-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Send size={15} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-700 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttach} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
