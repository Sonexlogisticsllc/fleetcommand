'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Load, Driver, HOSData, RatePredictionResponse } from '@/lib/types';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  Truck, MapPin, DollarSign, Clock, Link2, X, TrendingUp,
  AlertTriangle, CheckCircle, Shield, Zap, BarChart2, Copy, ExternalLink,
} from 'lucide-react';
import { formatInTimezone, formatInLocalTime, getTimezoneOffsetLabel, TIMEZONE_COLORS } from '@/lib/timezoneUtils';
import toast from 'react-hot-toast';

// ─── Timezone Display ──────────────────────────────────────────────────────────
function TimezoneBlock({ label, isoTime, state }: { label: string; isoTime: string; state: string }) {
  const tz = state === 'CA' || state === 'NV' || state === 'OR' || state === 'WA' ? 'PST'
    : state === 'CO' || state === 'AZ' || state === 'UT' || state === 'NM' ? 'MST'
    : state === 'TX' || state === 'IL' || state === 'MN' || state === 'WI' || state === 'IA' ? 'CST'
    : 'EST';
  const facilityTime = formatInTimezone(isoTime, tz);
  const localTime = formatInLocalTime(isoTime);
  const tzLabel = getTimezoneOffsetLabel(tz);
  const color = TIMEZONE_COLORS[tz];

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-navy-DEFAULT rounded-lg p-2.5 border border-navy-border">
          <div className="text-[10px] font-bold mb-1" style={{ color }}>
            FACILITY ({tzLabel})
          </div>
          <div className="text-xs text-white font-medium">{facilityTime}</div>
        </div>
        <div className="bg-navy-DEFAULT rounded-lg p-2.5 border border-navy-border">
          <div className="text-[10px] font-bold text-amber mb-1">YOUR LOCAL</div>
          <div className="text-xs text-white font-medium">{localTime}</div>
        </div>
      </div>
    </div>
  );
}

// ─── HOS Checker ──────────────────────────────────────────────────────────────
function HOSChecker({ driverId, requiredHours }: { driverId: string; requiredHours: number }) {
  const [hos, setHos] = useState<HOSData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/eld/${driverId}`)
      .then(r => r.json())
      .then(d => { setHos(d); setLoading(false); });
  }, [driverId]);

  if (loading) return <Spinner text="Checking ELD data..." size={14} />;
  if (!hos) return null;

  const compliant = hos.driveTimeRemaining >= requiredHours;
  const deficit = requiredHours - hos.driveTimeRemaining;

  return (
    <div className={`rounded-lg p-3 border ${compliant ? 'bg-success/5 border-success/25' : 'bg-danger/5 border-danger/25'}`}>
      <div className="flex items-center gap-2 mb-3">
        {compliant
          ? <CheckCircle size={15} className="text-success" />
          : <AlertTriangle size={15} className="text-danger" />
        }
        <span className={`text-sm font-semibold ${compliant ? 'text-success' : 'text-danger'}`}>
          {compliant ? 'HOS Compliant ✓' : `HOS Insufficient — ${deficit.toFixed(1)}h deficit`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-slate-500 mb-0.5">Drive Time Left</div>
          <div className={`font-bold ${hos.driveTimeRemaining < 3 ? 'text-danger' : 'text-white'}`}>
            {hos.driveTimeRemaining.toFixed(1)}h / 11h
          </div>
          <div className="mt-1 h-1.5 bg-navy-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${hos.driveTimeRemaining < 3 ? 'bg-danger' : 'bg-success'}`}
              style={{ width: `${(hos.driveTimeRemaining / 11) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-0.5">Cycle Hours Left</div>
          <div className="font-bold text-white">{hos.cycleHoursRemaining.toFixed(1)}h / 70h</div>
          <div className="mt-1 h-1.5 bg-navy-border rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-info"
              style={{ width: `${(hos.cycleHoursRemaining / 70) * 100}%` }} />
          </div>
        </div>
      </div>
      {hos.violations.length > 0 && (
        <div className="mt-2 text-xs text-danger">{hos.violations[0]}</div>
      )}
    </div>
  );
}

// ─── AI Rate Sidebar ──────────────────────────────────────────────────────────
function AIRateSidebar({
  load, drivers, onClose,
}: {
  load: Load;
  drivers: Driver[];
  onClose: () => void;
}) {
  const [rateData, setRateData] = useState<RatePredictionResponse | null>(null);
  const [loadingRate, setLoadingRate] = useState(true);
  const [brokerModal, setBrokerModal] = useState(false);
  const [trackingLink] = useState(`https://track.fleetcommand.io/t/fc-${Math.random().toString(36).slice(2, 10)}`);
  const [selectedDriver, setSelectedDriver] = useState('');

  const availableDrivers = drivers.filter(d => d.status === 'available' || d.status === 'off_duty');
  const loadDurationHrs = Math.ceil(load.miles / 55);

  useEffect(() => {
    setLoadingRate(true);
    fetch('/api/rate-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originCity: load.pickup.facility.city,
        originState: load.pickup.facility.state,
        destinationCity: load.delivery.facility.city,
        destinationState: load.delivery.facility.state,
        miles: load.miles,
        commodity: load.commodity,
        weight: load.weight,
      }),
    }).then(r => r.json()).then(d => { setRateData(d); setLoadingRate(false); });
  }, [load]);

  const copyLink = () => {
    navigator.clipboard.writeText(trackingLink);
    toast.success('Tracking link copied to clipboard!');
    setBrokerModal(false);
  };

  const laneColor = rateData?.laneScore === 'hot' ? 'text-red-400'
    : rateData?.laneScore === 'warm' ? 'text-amber' : 'text-slate-400';

  return (
    <>
      <div className="w-96 flex-shrink-0 bg-navy-panel border-l border-navy-border flex flex-col h-full animate-slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-border">
          <div>
            <div className="text-sm font-bold text-white">{load.referenceNumber}</div>
            <div className="text-xs text-slate-400">{load.broker}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-4 space-y-5">
          {/* Route */}
          <div className="bg-navy-DEFAULT rounded-xl p-4 border border-navy-border space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-success border-2 border-success/30" />
                <div className="w-px h-8 bg-navy-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber border-2 border-amber/30" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-slate-500">PICKUP</div>
                  <div className="text-sm font-medium text-white">{load.pickup.facility.name}</div>
                  <div className="text-xs text-slate-400">{load.pickup.facility.city}, {load.pickup.facility.state}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">DELIVERY</div>
                  <div className="text-sm font-medium text-white">{load.delivery.facility.name}</div>
                  <div className="text-xs text-slate-400">{load.delivery.facility.city}, {load.delivery.facility.state}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-navy-border text-center">
              <div><div className="text-xs text-slate-500">Miles</div><div className="text-sm font-bold text-white">{load.miles.toLocaleString()}</div></div>
              <div><div className="text-xs text-slate-500">Weight</div><div className="text-sm font-bold text-white">{(load.weight / 1000).toFixed(0)}k lbs</div></div>
              <div><div className="text-xs text-slate-500">Commodity</div><div className="text-xs font-medium text-white">{load.commodity}</div></div>
            </div>
          </div>

          {/* AI Rate */}
          <div className="bg-navy-DEFAULT rounded-xl p-4 border border-amber/20">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-amber" />
              <span className="text-xs font-bold text-amber uppercase tracking-wider">AI Fair Rate Analysis</span>
            </div>
            {loadingRate ? (
              <div className="space-y-2">
                <div className="shimmer h-8 rounded" />
                <div className="shimmer h-4 rounded w-3/4" />
                <div className="shimmer h-4 rounded w-1/2" />
              </div>
            ) : rateData && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold text-amber">${rateData.suggestedRate.toLocaleString()}</div>
                    <div className="text-xs text-slate-400">${rateData.ratePerMile}/mi · {rateData.confidence}% confidence</div>
                  </div>
                  <Badge variant={rateData.laneScore as any}>
                    {rateData.laneScore.toUpperCase()} LANE
                  </Badge>
                </div>
                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>AI Confidence</span><span>{rateData.confidence}%</span>
                  </div>
                  <div className="h-1.5 bg-navy-border rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber to-amber-light rounded-full transition-all"
                      style={{ width: `${rateData.confidence}%` }} />
                  </div>
                </div>
                {/* Comparisons */}
                <div className="space-y-1.5">
                  {rateData.comparisons.map(c => (
                    <div key={c.source} className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">{c.source}</span>
                      <span className="font-medium text-white">${c.rate.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <TrendingUp size={12} className={laneColor} />
                  <span className={laneColor}>
                    Demand Index {rateData.demandIndex}/10 · {rateData.seasonalAdjustment > 0 ? '+' : ''}{rateData.seasonalAdjustment}% seasonal
                  </span>
                </div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-navy-border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Broker Offering</span>
                <span className="font-bold text-white">${load.rate.toLocaleString()}</span>
              </div>
              {rateData && (
                <div className={`text-xs mt-1 ${load.rate >= rateData.suggestedRate ? 'text-success' : 'text-warning'}`}>
                  {load.rate >= rateData.suggestedRate
                    ? `✓ Rate is $${(load.rate - rateData.suggestedRate).toLocaleString()} above AI estimate`
                    : `⚠ Rate is $${(rateData.suggestedRate - load.rate).toLocaleString()} below AI estimate — consider negotiating`
                  }
                </div>
              )}
            </div>
          </div>

          {/* Timezone Sync */}
          <div className="space-y-3">
            <TimezoneBlock label="📍 Pickup Appointment" isoTime={load.pickup.scheduledTime} state={load.pickup.facility.state} />
            <TimezoneBlock label="🏁 Delivery Appointment" isoTime={load.delivery.scheduledTime} state={load.delivery.facility.state} />
          </div>

          {/* HOS Check */}
          {selectedDriver && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={13} className="text-info" />
                <span className="text-xs font-bold text-info uppercase tracking-wider">HOS Compatibility</span>
              </div>
              <HOSChecker driverId={selectedDriver} requiredHours={loadDurationHrs} />
            </div>
          )}

          {/* Driver Select */}
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Assign Driver</label>
            <select
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
              className="w-full bg-navy-DEFAULT border border-navy-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50 transition-colors"
            >
              <option value="">Select driver to check HOS...</option>
              {availableDrivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.truckNumber})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-navy-border space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            icon={<Link2 size={14} />}
            onClick={() => setBrokerModal(true)}
          >
            Generate Broker Tracking Link
          </Button>
          <Button
            variant="primary"
            className="w-full"
            icon={<Truck size={14} />}
            disabled={!selectedDriver}
            onClick={() => toast.success(`Load ${load.referenceNumber} assigned!`)}
          >
            Assign & Dispatch
          </Button>
        </div>
      </div>

      {/* Broker Link Modal */}
      <Modal open={brokerModal} onClose={() => setBrokerModal(false)} title="Broker Visibility Link" size="sm" glass>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Share this secure link with the broker for real-time load tracking. Link expires in 72 hours.</p>
          <div className="bg-navy-DEFAULT rounded-lg p-3 border border-navy-border flex items-center gap-2">
            <ExternalLink size={13} className="text-amber flex-shrink-0" />
            <span className="text-xs text-slate-300 flex-1 truncate font-mono">{trackingLink}</span>
          </div>
          <Button variant="primary" className="w-full" icon={<Copy size={14} />} onClick={copyLink}>
            Copy to Clipboard
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ─── Main Load Board Page ──────────────────────────────────────────────────────
export default function LoadBoardPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    Promise.all([
      fetch('/api/loads').then(r => r.json()),
      fetch('/api/drivers').then(r => r.json()),
    ]).then(([l, d]) => { setLoads(l); setDrivers(d); setLoading(false); });
  }, []);

  const filtered = filter === 'all' ? loads : loads.filter(l => l.status === filter);

  const FILTERS = [
    { key: 'all', label: 'All Loads' },
    { key: 'available', label: 'Available' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'delivered', label: 'Delivered' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner text="Loading load board..." /></div>;

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-0 -m-6 animate-fade-in">
      {/* Main table */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.key
                  ? 'bg-amber text-navy-DEFAULT shadow-amber-glow'
                  : 'bg-navy-panel border border-navy-border text-slate-400 hover:text-white hover:border-amber/20'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">
                ({f.key === 'all' ? loads.length : loads.filter(l => l.status === f.key).length})
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-navy-panel border border-navy-border rounded-xl overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-border bg-navy-DEFAULT/50">
                  {['Ref #', 'Broker', 'Route', 'Miles', 'Weight', 'Rate', '$/Mi', 'Pickup', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border">
                {filtered.map(load => (
                  <tr
                    key={load.id}
                    onClick={() => setSelectedLoad(selectedLoad?.id === load.id ? null : load)}
                    className={`table-row-hover ${selectedLoad?.id === load.id ? 'bg-amber/5 border-l-2 border-l-amber' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-amber font-bold">{load.referenceNumber}</td>
                    <td className="px-4 py-3 text-white text-xs">{load.broker}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-white font-medium">{load.pickup.facility.state}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-white font-medium">{load.delivery.facility.state}</span>
                      </div>
                      <div className="text-slate-500 text-[11px]">{load.pickup.facility.city} → {load.delivery.facility.city}</div>
                    </td>
                    <td className="px-4 py-3 text-white text-xs font-medium">{load.miles.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{(load.weight / 1000).toFixed(0)}k</td>
                    <td className="px-4 py-3 text-amber font-bold text-sm">${load.rate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">${load.ratePerMile}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(load.pickup.scheduledTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={load.status} /></td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-amber hover:underline whitespace-nowrap">
                        {selectedLoad?.id === load.id ? 'Close ←' : 'AI Analyze →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Sidebar */}
      {selectedLoad && (
        <AIRateSidebar
          load={selectedLoad}
          drivers={drivers}
          onClose={() => setSelectedLoad(null)}
        />
      )}
    </div>
  );
}
