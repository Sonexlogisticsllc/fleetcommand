'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, CheckCircle, AlertTriangle, XCircle, Upload,
  Eye, Clock, Camera, RefreshCw, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSonexAuth } from '@/lib/sonexAuth';
import { getDocuments, addDocument, computeDocStatus } from '@/lib/sonexStore';
import { uploadFile } from '@/lib/storageUtils';
import type { SonexDocument, DocType, DocStatus } from '@/lib/sonexTypes';
import { ALL_DOC_TYPES, DOC_TYPE_LABELS, DOCS_WITH_EXPIRY } from '@/lib/sonexTypes';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<DocStatus, { icon: React.ElementType; label: string; color: string; bg: string; border: string }> = {
  valid:         { icon: CheckCircle,   label: 'Valid',         color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.25)' },
  expiring_soon: { icon: AlertTriangle, label: 'Expiring Soon', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.30)' },
  expired:       { icon: XCircle,       label: 'Expired',       color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.30)' },
  missing:       { icon: XCircle,       label: 'Missing',       color: '#64748B', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.20)' },
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function fmtExpiry(dateStr?: string): string {
  if (!dateStr) return '';
  const d = daysUntil(dateStr);
  if (d < 0) return `Expired ${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''} ago`;
  if (d === 0) return 'Expires today!';
  if (d <= 30) return `Expires in ${d} day${d !== 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Expiry Date Modal ────────────────────────────────────────────────────────

interface ExpiryModalProps {
  docType: DocType;
  onConfirm: (expiryDate: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}
function ExpiryModal({ docType, onConfirm, onSkip, onCancel }: ExpiryModalProps) {
  const [date, setDate] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0D1F3C', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-amber-400" />
            <span className="text-white font-bold text-sm">Set Expiration Date</span>
          </div>
          <p className="text-slate-400 text-xs">{DOC_TYPE_LABELS[docType]} — enter the expiry date for compliance tracking.</p>
        </div>
        <div className="p-5 space-y-4">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-sm text-slate-400 transition-all flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={onSkip}
              className="px-4 py-2.5 rounded-xl text-sm text-slate-300 transition-all flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Skip Date
            </button>
            <button onClick={() => date && onConfirm(date)} disabled={!date}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${date ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Doc Card ─────────────────────────────────────────────────────────────────

interface DocCardProps {
  docType: DocType;
  document?: SonexDocument;
  onUpload: (docType: DocType, file: File, expirationDate?: string) => Promise<void>;
}

function DocCard({ docType, document, onUpload }: DocCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const needsExpiry = DOCS_WITH_EXPIRY.includes(docType);

  const docStatus: DocStatus = document
    ? computeDocStatus(document.expirationDate)
    : 'missing';
  const cfg = STATUS_CFG[docStatus];
  const StatusIcon = cfg.icon;

  async function doUpload(file: File, expirationDate?: string) {
    setUploading(true);
    try {
      await onUpload(docType, file, expirationDate);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (needsExpiry) {
      setPendingFile(file);
      setShowExpiryModal(true);
    } else {
      doUpload(file, undefined);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <>
      {showExpiryModal && pendingFile && (
        <ExpiryModal
          docType={docType}
          onConfirm={(date) => { setShowExpiryModal(false); doUpload(pendingFile, date); setPendingFile(null); }}
          onSkip={() => { setShowExpiryModal(false); doUpload(pendingFile, undefined); setPendingFile(null); }}
          onCancel={() => { setShowExpiryModal(false); setPendingFile(null); }}
        />
      )}

      <div
        className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200"
        style={{ background: 'rgba(8,20,40,0.8)', border: `1px solid ${cfg.border}` }}
      >
        {/* Doc type + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: cfg.bg }}>
              <FileText size={14} style={{ color: cfg.color }} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white leading-tight">{DOC_TYPE_LABELS[docType]}</div>
              {document?.expirationDate && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={9} style={{ color: cfg.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                    {fmtExpiry(document.expirationDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <StatusIcon size={9} style={{ color: cfg.color }} />
            <span className="text-[9px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
        </div>

        {/* Expiry bar for expiring-soon */}
        {docStatus === 'expiring_soon' && document?.expirationDate && (
          <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${Math.max(5, Math.min(100, (daysUntil(document.expirationDate) / 30) * 100))}%` }} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {document?.fileUrl && (
            <a href={document.fileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Eye size={11} />View
            </a>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold flex-1 justify-center transition-all ${
              uploading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            style={{
              background: uploading ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.30)',
              color: '#FCD34D',
            }}>
            {uploading
              ? <><RefreshCw size={11} className="animate-spin" />Uploading…</>
              : <><Upload size={11} />{document ? 'Update' : 'Upload'}</>
            }
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFileChange}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CarrierDocumentsPage() {
  const { user } = useSonexAuth();
  const carrierId = user?.carrierId ?? '';
  const [documents, setDocuments] = useState<SonexDocument[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!carrierId) return;
    setLoading(true);
    const docs = await getDocuments(carrierId);
    setDocuments(docs);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [carrierId]);

  async function handleUpload(docType: DocType, file: File, expirationDate?: string) {
    try {
      const result = await uploadFile(file, 'carrier-documents', `${carrierId}/${docType}`);
      await addDocument({
        carrierId,
        docType,
        fileName: file.name,
        fileUrl: result.url,
        filePath: result.path,
        expirationDate,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'carrier',
      });
      toast.success(`✓ ${DOC_TYPE_LABELS[docType]} uploaded!`, {
        style: { background: '#0D1F3C', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' },
      });
      await refresh();
    } catch {
      toast.error('Upload failed. Please check your connection and try again.');
    }
  }

  const docMap = new Map(documents.map(d => [d.docType, d]));

  // Urgency counts
  const expired = documents.filter(d => computeDocStatus(d.expirationDate) === 'expired').length;
  const expiring = documents.filter(d => computeDocStatus(d.expirationDate) === 'expiring_soon').length;
  const missing = ALL_DOC_TYPES.filter(t => !docMap.has(t)).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-white tracking-tight">My Documents</h1>
        <p className="text-slate-500 text-sm mt-0.5">Upload and manage your compliance documents</p>
      </div>

      {/* Alert banner */}
      {(expired > 0 || expiring > 0) && (
        <div className="mb-5 rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-red-300 font-bold text-sm">Action Required</div>
              <div className="text-red-400/80 text-xs mt-0.5 space-y-0.5">
                {expired > 0 && <div>• {expired} document{expired > 1 ? 's' : ''} expired — update immediately to remain compliant</div>}
                {expiring > 0 && <div>• {expiring} document{expiring > 1 ? 's' : ''} expiring within 30 days</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399' }}>
          <CheckCircle size={11} />
          {documents.filter(d => computeDocStatus(d.expirationDate) === 'valid').length} Valid
        </div>
        {expiring > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#FCD34D' }}>
            <AlertTriangle size={11} />
            {expiring} Expiring
          </div>
        )}
        {expired > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#FCA5A5' }}>
            <XCircle size={11} />
            {expired} Expired
          </div>
        )}
        {missing > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(100,116,139,0.10)', border: '1px solid rgba(100,116,139,0.20)', color: '#94A3B8' }}>
            <FileText size={11} />
            {missing} Missing
          </div>
        )}
      </div>

      {/* Upload tip */}
      <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-xl"
        style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.10)' }}>
        <Info size={13} className="text-amber-500/60 flex-shrink-0 mt-0.5" />
        <p className="text-slate-500 text-xs leading-relaxed">
          Use your phone camera to take a clear photo of each document, or tap to upload a file from your gallery. JPG, PNG, and PDF accepted.
        </p>
      </div>

      {/* Document grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={22} className="text-amber-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_DOC_TYPES.map(docType => (
            <DocCard
              key={docType}
              docType={docType}
              document={docMap.get(docType)}
              onUpload={handleUpload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
