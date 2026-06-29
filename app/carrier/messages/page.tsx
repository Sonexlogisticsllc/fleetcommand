'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Camera, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSonexAuth } from '@/lib/sonexAuth';
import { getMessages, addMessage, markMessagesRead } from '@/lib/sonexStore';
import type { SonexMessage } from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Group messages by day for date separators
function groupByDay(messages: SonexMessage[]): Array<{ day: string; messages: SonexMessage[] }> {
  const groups: Array<{ day: string; messages: SonexMessage[] }> = [];
  for (const msg of messages) {
    const dayStr = new Date(msg.createdAt).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.day === dayStr) {
      last.messages.push(msg);
    } else {
      groups.push({ day: dayStr, messages: [msg] });
    }
  }
  return groups;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isCarrier }: { msg: SonexMessage; isCarrier: boolean }) {
  return (
    <div className={`flex ${isCarrier ? 'justify-end' : 'justify-start'} px-1`}>
      <div className="max-w-[78%]">
        {!isCarrier && (
          <div className="text-[10px] text-slate-500 mb-1 ml-1 font-semibold">{msg.senderName}</div>
        )}
        <div
          className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
          style={isCarrier ? {
            background: 'rgba(245,158,11,0.18)',
            border: '1px solid rgba(245,158,11,0.28)',
            color: '#FEF3C7',
            borderBottomRightRadius: '6px',
          } : {
            background: 'rgba(30,41,59,0.9)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#CBD5E1',
            borderBottomLeftRadius: '6px',
          }}>
          {msg.attachmentUrl && msg.attachmentType === 'image' && (
            <div className="mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.attachmentUrl}
                alt="Attachment"
                className="rounded-xl max-w-full max-h-48 object-cover"
              />
            </div>
          )}
          {msg.messageText && <span>{msg.messageText}</span>}
        </div>
        <div className={`flex items-center gap-1 mt-0.5 ${isCarrier ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-slate-600">{fmtTime(msg.createdAt)}</span>
          {isCarrier && (
            <CheckCheck size={11} className={msg.read ? 'text-amber-400' : 'text-slate-600'} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Day Separator ────────────────────────────────────────────────────────────

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4">
      <div className="flex-1 h-px bg-white/5" />
      <span className="text-[10px] text-slate-600 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CarrierMessagesPage() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';
  const carrierName = user?.displayName ?? 'Driver';

  const [messages, setMessages] = useState<SonexMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(() => {
    if (!carrierId) return;
    getMessages(carrierId).then(setMessages);
  }, [carrierId]);

  // On mount: mark admin messages as read + load
  useEffect(() => {
    if (!carrierId) return;
    markMessagesRead(carrierId, 'carrier').then(() => refresh());
  }, [carrierId, refresh]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const grouped = groupByDay(messages);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await addMessage({
        carrierId,
        senderId: carrierId,
        senderName: carrierName,
        senderRole: 'carrier',
        messageText: trimmed,
        read: false,
        createdAt: new Date().toISOString(),
      });
      setText('');
      refresh();
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  async function handlePhotoSend(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const url = await toBase64(file);
      await addMessage({
        carrierId,
        senderId: carrierId,
        senderName: carrierName,
        senderRole: 'carrier',
        messageText: text.trim() || '',
        attachmentUrl: url,
        attachmentType: 'image',
        read: false,
        createdAt: new Date().toISOString(),
      });
      setText('');
      refresh();
      toast.success('Photo sent!');
    } catch {
      toast.error('Failed to send photo.');
    } finally {
      setSending(false);
      if (photoRef.current) photoRef.current.value = '';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    // Auto-grow textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-56px-64px)] lg:h-screen">

      {/* ── Chat header ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
        style={{
          background: 'rgba(12,10,0,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}>
        {/* SD Avatar */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-[#050B18] flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}>
          SD
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold">Sonex Dispatch</div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400 text-[11px]">Online</span>
          </div>
        </div>
      </div>

      {/* ── Message area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1"
        style={{ background: '#050B18' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 font-black text-xl text-[#050B18]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}>
              SD
            </div>
            <div className="text-slate-300 text-sm font-semibold mb-1">Your dispatcher is here</div>
            <div className="text-slate-600 text-xs max-w-xs leading-relaxed">
              Send a message anytime — your Sonex dispatcher will respond as quickly as possible.
            </div>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.day} className="space-y-1">
              <div className="py-2">
                <DaySeparator label={fmtDay(group.messages[0].createdAt)} />
              </div>
              {group.messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isCarrier={msg.senderRole === 'carrier'}
                />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* ── Input area ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-3 py-3"
        style={{
          background: 'rgba(12,10,0,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}>
        <div className="flex items-end gap-2">
          {/* Photo attach */}
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSend}
          />
          <button
            onClick={() => photoRef.current?.click()}
            disabled={sending}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Camera size={19} className="text-slate-400" />
          </button>

          {/* Text input */}
          <div className="flex-1 flex items-end rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Message your dispatcher…"
              rows={1}
              disabled={sending}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-95"
            style={{
              background: text.trim() && !sending ? '#F59E0B' : 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>
            <Send
              size={18}
              className={text.trim() && !sending ? 'text-black' : 'text-amber-500/40'}
              style={{ transform: 'rotate(0deg)' }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
