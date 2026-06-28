'use client';
import React, { useEffect, useState } from 'react';
import { MOCK_LOADS } from '@/lib/mockData';
import { Load } from '@/lib/types';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CheckCircle, FileText, Loader2, DollarSign, Send } from 'lucide-react';
import toast from 'react-hot-toast';

type FactoringStep = 'idle' | 'bundling' | 'uploading' | 'done';

interface SubmissionResult {
  submissionId: string;
  expectedFundingDate: string;
  advanceRate: number;
  advanceAmount: number;
}

export default function FactoringPage() {
  const [loads] = useState<Load[]>(MOCK_LOADS.filter(l => l.status === 'delivered'));
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [step, setStep] = useState<FactoringStep>('idle');
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const handleFactor = async (load: Load) => {
    setSubmittingId(load.id);
    setStep('bundling');

    await new Promise(r => setTimeout(r, 1400));
    setStep('uploading');

    const res = await fetch('/api/factoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loadId: load.id }),
    }).then(r => r.json());

    setStep('done');
    setResult({
      ...res,
      advanceAmount: Math.round(load.rate * (res.advanceRate / 100)),
    });
    setCompletedIds(prev => new Set([...prev, load.id]));
  };

  const handleClose = () => {
    setSubmittingId(null);
    setStep('idle');
    setResult(null);
  };

  const STEPS = [
    { key: 'bundling', label: 'Bundling RC + BOL + POD into secure PDF package...' },
    { key: 'uploading', label: 'Transmitting to OTR Capital API...' },
    { key: 'done', label: 'Submission complete!' },
  ];

  const currentStepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">One-Click Factoring</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Delivered loads ready for factoring. RC, BOL, and POD are auto-bundled and submitted to OTR Capital.
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-navy-panel border border-navy-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{loads.length}</div>
          <div className="text-xs text-slate-400 mt-1">Delivered Loads</div>
        </div>
        <div className="bg-navy-panel border border-amber/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber">${loads.reduce((s, l) => s + l.rate, 0).toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Total Eligible</div>
        </div>
        <div className="bg-navy-panel border border-success/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-success">
            ${loads.filter(l => completedIds.has(l.id)).reduce((s, l) => s + Math.round(l.rate * 0.97), 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">Advance (97%) Submitted</div>
        </div>
      </div>

      {/* Loads Table */}
      <div className="bg-navy-panel border border-navy-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-border bg-navy-DEFAULT/50">
              {['Load Ref', 'Broker', 'Route', 'Rate', 'Documents', 'Status', 'Action'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-border">
            {loads.map(load => {
              const done = completedIds.has(load.id);
              return (
                <tr key={load.id} className={done ? 'opacity-60' : 'hover:bg-navy-hover transition-colors'}>
                  <td className="px-5 py-4 font-mono text-xs text-amber font-bold">{load.referenceNumber}</td>
                  <td className="px-5 py-4 text-white text-xs">{load.broker}</td>
                  <td className="px-5 py-4 text-xs">
                    <span className="text-white">{load.pickup.facility.state}</span>
                    <span className="text-slate-600 mx-1">→</span>
                    <span className="text-white">{load.delivery.facility.state}</span>
                  </td>
                  <td className="px-5 py-4 text-amber font-bold">${load.rate.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {[
                        { key: 'RC', hasDoc: !!load.rcUrl },
                        { key: 'BOL', hasDoc: !!load.bolUrl },
                        { key: 'POD', hasDoc: !!load.podUrl },
                      ].map(doc => (
                        <span key={doc.key} className={`text-xs px-2 py-0.5 rounded border font-medium ${
                          doc.hasDoc ? 'text-success border-success/30 bg-success/10' : 'text-slate-500 border-navy-border'
                        }`}>
                          {doc.hasDoc ? '✓' : '?'} {doc.key}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {done
                      ? <Badge variant="success" dot>Submitted</Badge>
                      : <StatusBadge status={load.status} />
                    }
                  </td>
                  <td className="px-5 py-4">
                    <Button
                      variant={done ? 'ghost' : 'primary'}
                      size="sm"
                      icon={done ? <CheckCircle size={13} /> : <Send size={13} />}
                      disabled={done}
                      onClick={() => handleFactor(load)}
                    >
                      {done ? 'Submitted' : 'Submit to Factor'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Factoring Modal */}
      <Modal open={!!submittingId} onClose={handleClose} title="OTR Capital Factoring" size="sm" glass>
        <div className="space-y-5">
          {STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isDone = i < currentStepIdx || step === 'done';
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  isDone ? 'bg-success' : isActive ? 'bg-amber animate-pulse' : 'bg-navy-border'
                }`}>
                  {isDone ? <CheckCircle size={13} className="text-white" /> :
                    isActive ? <Loader2 size={13} className="text-navy-DEFAULT animate-spin" /> :
                    <div className="w-2 h-2 rounded-full bg-navy-hover" />}
                </div>
                <div className={`text-sm pt-0.5 ${isDone || isActive ? 'text-white' : 'text-slate-600'}`}>
                  {s.label}
                </div>
              </div>
            );
          })}

          {step === 'done' && result && (
            <div className="bg-success/5 border border-success/25 rounded-xl p-4 space-y-2 animate-slide-in-up">
              <div className="text-success font-bold text-sm">✅ Submitted Successfully</div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between"><span className="text-slate-500">Submission ID</span><span className="font-mono">{result.submissionId}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Advance Rate</span><span className="text-amber font-bold">{result.advanceRate}%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Advance Amount</span><span className="text-success font-bold">${result.advanceAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Expected Funding</span><span>{result.expectedFundingDate}</span></div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <Button variant="primary" className="w-full" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
