'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, CheckCircle, AlertTriangle, XCircle, Upload,
  Eye, Clock, RefreshCw, Shield, Search, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCarriers, getDocuments, addDocument, computeDocStatus } from '@/lib/sonexStore';
import { uploadFile } from '@/lib/storageUtils';
import type { SonexCarrier, SonexDocument, DocType, DocStatus } from '@/lib/sonexTypes';
import { ALL_DOC_TYPES, DOC_TYPE_LABELS, DOCS_WITH_EXPIRY } from '@/lib/sonexTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<DocStatus, { color: string; bg: string; border: string; label: string; Icon: React.ElementType }> = {
  valid:         { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.25)', label: 'Valid',         Icon: CheckCircle },
  expiring_soon: { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.30)', label: 'Expiring',      Icon: AlertTriangle },
  expired:       { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.30)',  label: 'Expired',       Icon: XCircle },
  missing:       { color: '#64748B', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.20)',label: 'Missing',       Icon: XCircle },
};

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function fmtExpiry(d?: string): string {
  if (!d) return '';
  const days = daysUntil(d);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today!';
  if (days <= 30) return `${days}d left`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// ─── Expiry Modal ─────────────────────────────────────────────────────────────

function ExpiryModal({ docType, onConfirm, onSkip, onCancel }: {
  docType: DocType; onConfirm: (d: string) => void; onSkip: () => void; onCancel: () => void;
}) {
  const [date, setDate] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0D1421', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2"><Clock size={15} className="text-amber-400" /><span className="text-white font-bold text-sm">Set Expiration Date</span></div>
          <p className="text-slate-400 text-xs mt-1">{DOC_TYPE_LABELS[docType]}</p>
        </div>
        <div className="p-5 space-y-4">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }} />
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-xs text-slate-400" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
            <button onClick={onSkip} className="px-4 py-2.5 rounded-xl text-xs text-slate-300" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>No Expiry</button>
            <button onClick={() => date && onConfirm(date)} disabled={!date}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${date ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Doc Slot (compact card) ──────────────────────────────────────────────────

function DocSlot({ carrierId, docType, document, onUploaded }: {
  carrierId: string; docType: DocType; document?: SonexDocument; onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showExpiry, setShowExpiry] = useState(false);
  const [uploading, setUploading] = useState(false);
  const needsExpiry = DOCS_WITH_EXPIRY.includes(docType);

  const status: DocStatus = document ? computeDocStatus(document.expirationDate) : 'missing';
  const cfg = STATUS_CFG[status];
  const Icon = cfg.Icon;

  async function doUpload(file: File, expirationDate?: string) {
    setUploading(true);
    try {
      const result = await uploadFile(file, 'carrier-documents', `${carrierId}/${docType}`);
      await addDocument({ carrierId, docType, fileName: file.name, fileUrl: result.url, filePath: result.path, expirationDate, uploadedAt: new Date().toISOString(), uploadedBy: 'admin' });
      toast.success(`✓ ${DOC_TYPE_LABELS[docType]} uploaded`);
      onUploaded();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (needsExpiry) { setPendingFile(file); setShowExpiry(true); }
    else doUpload(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <>
      {showExpiry && pendingFile && (
        <ExpiryModal docType={docType}
          onConfirm={d => { setShowExpiry(false); doUpload(pendingFile, d); setPendingFile(null); }}
          onSkip={() => { setShowExpiry(false); doUpload(pendingFile); setPendingFile(null); }}
          onCancel={() => { setShowExpiry(false); setPendingFile(null); }} />
      )}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
        style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${cfg.border}` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
          <Icon size={12} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white truncate">{DOC_TYPE_LABELS[docType]}</div>
          {document?.expirationDate && (
            <div className="text-[10px] font-medium" style={{ color: cfg.color }}>{fmtExpiry(document.expirationDate)}</div>
          )}
          {!document && <div className="text-[10px] text-slate-600">Not uploaded</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {document?.fileUrl && (
            <a href={document.fileUrl} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="View">
              <Eye size={11} className="text-amber-400" />
            </a>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Upload">
            {uploading ? <RefreshCw size={11} className="text-amber-500 animate-spin" /> : <Upload size={11} className="text-slate-400 hover:text-amber-400" />}
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
    </>
  );
}

// ─── Carrier Doc Card ─────────────────────────────────────────────────────────

function CarrierDocCard({ carrier, documents, onUploaded }: {
  carrier: SonexCarrier; documents: SonexDocument[]; onUploaded: () => void;
}) {
  const docMap = new Map(documents.map(d => [d.docType, d]));
  const expired = documents.filter(d => computeDocStatus(d.expirationDate) === 'expired').length;
  const expiring = documents.filter(d => computeDocStatus(d.expirationDate) === 'expiring_soon').length;
  const missing = ALL_DOC_TYPES.filter(t => !docMap.has(t)).length;
  const initials = `${carrier.firstName[0]}${carrier.lastName[0]}`.toUpperCase();

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(8,20,40,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Carrier header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-black flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#FCD34D)' }}>{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm">{carrier.firstName} {carrier.lastName}</div>
          <div className="text-slate-500 text-xs">{carrier.equipmentType} · {carrier.email}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {expired > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">{expired} expired</span>}
          {expiring > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">{expiring} expiring</span>}
          {missing > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-slate-500">{missing} missing</span>}
        </div>
      </div>
      {/* Document grid */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {ALL_DOC_TYPES.map(docType => (
          <DocSlot key={docType} carrierId={carrier.id} docType={docType}
            document={docMap.get(docType)} onUploaded={onUploaded} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDocumentsPage() {
  const [carriers, setCarriers] = useState<SonexCarrier[]>([]);
  const [documents, setDocuments] = useState<SonexDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues'>('all');

  const refresh = useCallback(async () => {
    const [c, d] = await Promise.all([getCarriers(), getDocuments()]);
    setCarriers(c); setDocuments(d); setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Stats
  const expired = documents.filter(d => computeDocStatus(d.expirationDate) === 'expired').length;
  const expiring = documents.filter(d => computeDocStatus(d.expirationDate) === 'expiring_soon').length;
  const missing = carriers.length * ALL_DOC_TYPES.length - documents.length;

  const filteredCarriers = carriers.filter(c => {
    const q = search.toLowerCase();
    const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    if (statusFilter === 'issues') {
      const carrierDocs = documents.filter(d => d.carrierId === c.id);
      const carrierDocMap = new Map(carrierDocs.map(d => [d.docType, d]));
      const hasIssue = carrierDocs.some(d => ['expired', 'expiring_soon'].includes(computeDocStatus(d.expirationDate))) ||
        ALL_DOC_TYPES.some(t => !carrierDocMap.has(t));
      return nameMatch && hasIssue;
    }
    return nameMatch;
  });

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield size={18} className="text-amber-400" /> Document Vault
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Carrier compliance documents</p>
        </div>
        <div className="flex items-center gap-2">
          {expired > 0 && <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">{expired} Expired</span>}
          {expiring > 0 && <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">{expiring} Expiring</span>}
          {missing > 0 && <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-400">{missing} Missing</span>}
        </div>
      </div>

      {/* Alert banner */}
      {(expired > 0 || expiring > 0) && (
        <div className="mb-5 px-4 py-3 rounded-2xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)' }}>
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-red-300 text-sm">
            {expired > 0 && <><strong>{expired}</strong> document{expired > 1 ? 's' : ''} have <strong>expired</strong> and need immediate renewal. </>}
            {expiring > 0 && <><strong>{expiring}</strong> document{expiring > 1 ? 's' : ''} expire within 30 days.</>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search carriers…"
            className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl text-white placeholder-slate-600 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }} />
        </div>
        <div className="flex gap-2">
          {(['all', 'issues'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${statusFilter === f ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'text-slate-500 border-white/10 hover:text-slate-300'}`}>
              {f === 'all' ? 'All Carriers' : '⚠ Has Issues'}
            </button>
          ))}
        </div>
        <button onClick={refresh} className="p-2.5 rounded-xl text-slate-500 hover:text-slate-300 transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="text-amber-500 animate-spin" />
        </div>
      ) : filteredCarriers.length === 0 ? (
        <div className="py-20 text-center">
          <FileText size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{search ? 'No carriers match your search' : 'No carriers found'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCarriers.map(carrier => (
            <CarrierDocCard
              key={carrier.id}
              carrier={carrier}
              documents={documents.filter(d => d.carrierId === carrier.id)}
              onUploaded={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
