'use client';
import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, Loader2, Edit2, Truck } from 'lucide-react';
import { ParsedRC } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TimezoneDisplay } from '@/components/dispatcher/TimezoneDisplay';
import toast from 'react-hot-toast';

const MOCK_PARSED_RC: ParsedRC = {
  broker: 'Coyote Logistics', brokerMC: 'MC-965345', loadReference: 'CH-7823999',
  commodity: 'Automotive Parts', weight: '42,000 lbs', rate: 3800, miles: 847,
  pickup: {
    facilityName: 'Detroit Auto Suppliers', address: '4401 Michigan Ave',
    city: 'Detroit', state: 'MI', zip: '48210', timezone: 'EST',
    appointmentTime: '2026-04-21T08:00:00-04:00',
  },
  delivery: {
    facilityName: 'Toyota Plant Nashville', address: '7000 Motor Village Dr',
    city: 'Nashville', state: 'TN', zip: '37207', timezone: 'CST',
    appointmentTime: '2026-04-22T14:00:00-05:00',
  },
  specialInstructions: 'Driver must have TWIC card. No touch freight. Seal required.',
  confidence: 94,
};

type Phase = 'idle' | 'uploading' | 'parsing' | 'done';

const PARSE_STEPS = [
  { label: 'Reading document structure...', ms: 600 },
  { label: 'Extracting facility addresses...', ms: 500 },
  { label: 'Parsing appointment times...', ms: 500 },
  { label: 'Identifying rate confirmation...', ms: 400 },
  { label: 'Cross-referencing broker MC#...', ms: 400 },
  { label: 'Finalizing extraction...', ms: 300 },
];

export default function RCParserPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedRC | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editedRC, setEditedRC] = useState<ParsedRC | null>(null);

  const runParsing = useCallback(async (name: string) => {
    setFileName(name);
    setPhase('uploading');
    await new Promise(r => setTimeout(r, 800));
    setPhase('parsing');

    for (let i = 0; i < PARSE_STEPS.length; i++) {
      setStepIndex(i);
      await new Promise(r => setTimeout(r, PARSE_STEPS[i].ms));
    }

    setPhase('done');
    setParsed(MOCK_PARSED_RC);
    setEditedRC(MOCK_PARSED_RC);
    toast.success('RC parsed successfully — 94% confidence');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) runParsing(file.name);
  }, [runParsing]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runParsing(file.name);
  };

  const updateField = (path: string, value: string) => {
    if (!editedRC) return;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(editedRC));
    let obj: any = updated;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    setEditedRC(updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">AI Rate Confirmation Parser</h2>
          <p className="text-sm text-slate-400 mt-0.5">Drop any RC document — AI extracts all fields in seconds</p>
        </div>
        {phase === 'done' && (
          <Badge variant="success" dot>AI Parsing Complete</Badge>
        )}
      </div>

      {/* Drop Zone */}
      {phase === 'idle' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200
            ${dragging
              ? 'border-amber bg-amber/5 scale-[1.01]'
              : 'border-navy-border hover:border-amber/40 hover:bg-navy-panel/50'
            }
          `}
        >
          <div className="w-16 h-16 bg-amber/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload size={28} className="text-amber" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Drop Rate Confirmation Here</h3>
          <p className="text-slate-400 text-sm mb-6">Supports PDF, PNG, JPG, TIFF · Max 25MB</p>
          <label className="cursor-pointer">
            <span className="bg-amber text-navy-DEFAULT font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-amber-light transition-colors shadow-amber-glow">
              Browse File
            </span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff" className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      )}

      {/* Uploading */}
      {phase === 'uploading' && (
        <div className="bg-navy-panel border border-navy-border rounded-2xl p-12 text-center animate-fade-in">
          <div className="w-16 h-16 bg-info/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 size={28} className="text-info animate-spin" />
          </div>
          <h3 className="text-white font-semibold mb-2">Uploading {fileName}...</h3>
          <div className="w-48 h-1.5 bg-navy-border rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-info rounded-full animate-[shimmer_1s_linear_infinite] w-full" />
          </div>
        </div>
      )}

      {/* Parsing */}
      {phase === 'parsing' && (
        <div className="bg-navy-panel border border-amber/20 rounded-2xl p-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber/10 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-amber animate-pulse" />
            </div>
            <div>
              <div className="text-white font-semibold">AI Document Intelligence Processing</div>
              <div className="text-xs text-slate-400">{fileName}</div>
            </div>
          </div>
          <div className="space-y-3">
            {PARSE_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  i < stepIndex ? 'bg-success' : i === stepIndex ? 'bg-amber animate-pulse' : 'bg-navy-border'
                }`}>
                  {i < stepIndex && <CheckCircle size={12} className="text-white" />}
                  {i === stepIndex && <div className="w-2 h-2 rounded-full bg-navy-DEFAULT" />}
                </div>
                <div className={`text-sm transition-colors ${
                  i <= stepIndex ? 'text-white' : 'text-slate-600'
                }`}>{step.label}</div>
              </div>
            ))}
          </div>
          {/* Scanner line animation */}
          <div className="mt-6 h-24 bg-navy-DEFAULT rounded-xl overflow-hidden relative border border-navy-border">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_10px,rgba(245,158,11,0.03)_10px,rgba(245,158,11,0.03)_11px)]" />
            <div className="absolute left-0 right-0 h-0.5 bg-amber/60 shadow-amber-glow animate-scan" />
            <div className="absolute inset-3 space-y-1.5">
              {[80, 60, 90, 45, 70].map((w, i) => (
                <div key={i} className="h-1.5 bg-navy-border/80 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Done — Parsed Form */}
      {phase === 'done' && editedRC && (
        <div className="space-y-4 animate-slide-in-up">
          {/* Confidence */}
          <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-xl">
            <CheckCircle size={16} className="text-success" />
            <div className="flex-1">
              <span className="text-sm font-medium text-white">Extraction complete — </span>
              <span className="text-sm text-slate-400">All fields extracted with {editedRC.confidence}% confidence. Review and edit below.</span>
            </div>
            <Badge variant="success">{editedRC.confidence}% Confidence</Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Load Info */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={14} className="text-amber" />
                <span className="text-xs font-bold text-amber uppercase tracking-wider">Load Information</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Broker', key: 'broker', value: editedRC.broker },
                  { label: 'MC Number', key: 'brokerMC', value: editedRC.brokerMC },
                  { label: 'Load Reference', key: 'loadReference', value: editedRC.loadReference },
                  { label: 'Commodity', key: 'commodity', value: editedRC.commodity },
                  { label: 'Weight', key: 'weight', value: editedRC.weight },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                    <input
                      value={f.value}
                      onChange={e => updateField(f.key, e.target.value)}
                      className="w-full bg-navy-DEFAULT border border-navy-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber/50 transition-colors"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Rate ($)</label>
                    <input
                      value={editedRC.rate}
                      onChange={e => updateField('rate', e.target.value)}
                      type="number"
                      className="w-full bg-navy-DEFAULT border border-navy-border rounded-lg px-3 py-1.5 text-sm text-amber font-bold focus:outline-none focus:border-amber/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Miles</label>
                    <input
                      value={editedRC.miles}
                      onChange={e => updateField('miles', e.target.value)}
                      type="number"
                      className="w-full bg-navy-DEFAULT border border-navy-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Pickup & Delivery */}
            <div className="space-y-4">
              {(['pickup', 'delivery'] as const).map(leg => (
                <Card key={leg}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${leg === 'pickup' ? 'bg-success' : 'bg-amber'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">{leg}</span>
                    <Badge variant={leg === 'pickup' ? 'success' : 'amber'} className="ml-auto">
                      {editedRC[leg].timezone}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Facility', key: `${leg}.facilityName`, value: editedRC[leg].facilityName },
                      { label: 'City, State ZIP', key: `${leg}.city`, value: `${editedRC[leg].city}, ${editedRC[leg].state} ${editedRC[leg].zip}` },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                        <input
                          defaultValue={f.value}
                          className="w-full bg-navy-DEFAULT border border-navy-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber/50 transition-colors"
                        />
                      </div>
                    ))}
                    <TimezoneDisplay isoTime={editedRC[leg].appointmentTime} state={editedRC[leg].state} label="Appointment" />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {editedRC.specialInstructions && (
            <Card>
              <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider">Special Instructions</label>
              <textarea
                defaultValue={editedRC.specialInstructions}
                rows={2}
                className="w-full bg-navy-DEFAULT border border-navy-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50 transition-colors resize-none"
              />
            </Card>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setPhase('idle'); setParsed(null); setEditedRC(null); }}>
              Parse New RC
            </Button>
            <Button
              variant="primary"
              icon={<Truck size={14} />}
              onClick={() => toast.success('Load created from RC — appearing on load board!')}
            >
              Create Load from RC
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
