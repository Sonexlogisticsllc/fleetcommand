'use client';
import React, { useEffect, useState } from 'react';
import { Fuel, TrendingDown, TrendingUp, MapPin, RefreshCw, Star, Calculator } from 'lucide-react';
import { FuelPrice, NearbyStation } from '@/lib/salesData';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const WEEK_LABELS = ['4 Wks Ago', '3 Wks Ago', '2 Wks Ago', 'This Week'];

export default function FuelPricesPage() {
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [stations, setStations] = useState<NearbyStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [miles, setMiles] = useState('500');
  const [mpg, setMpg] = useState('6.5');
  const [calcResult, setCalcResult] = useState<number | null>(null);

  const fetchPrices = async () => {
    setLoading(true);
    const res = await fetch('/api/fuel-prices?stations=true');
    const data = await res.json();
    setPrices(data.prices || []);
    setStations(data.stations || []);
    setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 1800000); // 30 min
    return () => clearInterval(id);
  }, []);

  const calculateFuel = () => {
    const m = parseFloat(miles);
    const g = parseFloat(mpg);
    const national = prices.find(p => p.region === 'National Average');
    if (!national || !m || !g) return;
    setCalcResult((m / g) * national.price);
  };

  const national = prices.find(p => p.region === 'National Average');
  const regional = prices.filter(p => p.region !== 'National Average');

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Fuel size={16} className="text-amber-400" />
            <h2 className="text-lg font-bold text-white">Live Diesel Fuel Prices</h2>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">LIVE</span>
          </div>
          <p className="text-xs text-slate-600">
            {lastUpdated ? `Updated ${lastUpdated} · ` : ''}Data from EIA (U.S. Energy Information Administration)
          </p>
        </div>
        <button onClick={fetchPrices} disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:border-amber-500/30 transition-all disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin text-amber-400' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* National Average — Hero */}
      {national && (
        <div className="rounded-2xl p-6 relative overflow-hidden border"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.06) 100%)',
            borderColor: 'rgba(245,158,11,0.2)',
          }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 -translate-y-1/4 translate-x-1/4"
            style={{ background: 'radial-gradient(circle, #F59E0B, transparent)' }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-400/70 uppercase tracking-wider mb-2">🇺🇸 National Average · Diesel</div>
              <div className="text-5xl font-bold text-white mb-2">
                ${national.price.toFixed(3)}
                <span className="text-xl text-slate-500 font-normal ml-1">/gal</span>
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${national.change < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {national.change < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                {national.change > 0 ? '+' : ''}{national.change.toFixed(3)}/gal vs last week
              </div>
            </div>
            <div className="w-48 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={national.trend.map((v, i) => ({ week: WEEK_LABELS[i], price: v }))}>
                  <defs>
                    <linearGradient id="natGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="price" stroke="#F59E0B" fill="url(#natGrad)" strokeWidth={2}
                    dot={{ fill: '#F59E0B', r: 3, strokeWidth: 0 }} />
                  <Tooltip
                    contentStyle={{ background: '#0D0820', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v: number) => [`$${v.toFixed(3)}/gal`, 'Price']}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Regional Prices */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Regional Breakdown</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {regional.map(region => {
              const isUp = region.change > 0;
              const trendData = region.trend.map((v, i) => ({ week: WEEK_LABELS[i], price: v }));
              return (
                <div key={region.region} className="rounded-xl p-4 border border-white/[0.06] hover:border-amber-500/20 transition-colors"
                  style={{ background: 'rgba(13,8,30,0.5)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold text-white">{region.region}</div>
                      <div className={`flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {region.change > 0 ? '+' : ''}{region.change.toFixed(3)} vs last wk
                      </div>
                    </div>
                    <div className="text-lg font-bold text-white">${region.price.toFixed(3)}</div>
                  </div>
                  <div className="h-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id={`g-${region.region}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isUp ? '#EF4444' : '#10B981'} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={isUp ? '#EF4444' : '#10B981'} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="price"
                          stroke={isUp ? '#EF4444' : '#10B981'}
                          fill={`url(#g-${region.region})`}
                          strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Fuel Cost Calculator */}
          <div className="rounded-2xl p-4 border border-white/[0.06]" style={{ background: 'rgba(13,8,30,0.6)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={14} className="text-amber-400" />
              <h3 className="text-xs font-bold text-white">Fuel Cost Calculator</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Trip Miles</label>
                <input value={miles} onChange={e => setMiles(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors"
                  placeholder="500" type="number" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">MPG (avg truck)</label>
                <input value={mpg} onChange={e => setMpg(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors"
                  placeholder="6.5" type="number" step="0.1" />
              </div>
              <button onClick={calculateFuel}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 0 15px rgba(245,158,11,0.3)' }}>
                Calculate
              </button>
              {calcResult !== null && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-xs text-amber-400/70 mb-0.5">Estimated Fuel Cost</div>
                  <div className="text-2xl font-bold text-amber-400">${calcResult.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">at ${national?.price.toFixed(3)}/gal national avg</div>
                </div>
              )}
            </div>
          </div>

          {/* Best Nearby Stations */}
          <div className="rounded-2xl p-4 border border-white/[0.06]" style={{ background: 'rgba(13,8,30,0.6)' }}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={13} className="text-emerald-400" />
              <h3 className="text-xs font-bold text-white">Best Stations Nearby</h3>
              <span className="text-[10px] text-slate-600 ml-auto">Waco, TX area</span>
            </div>
            <div className="space-y-2.5">
              {stations.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: i === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.08)' }}>
                    {i === 0 ? <Star size={11} className="text-emerald-400" fill="currentColor" /> : <span className="text-[10px] font-bold text-slate-600">{i + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-slate-600">{s.city}, {s.state} · {s.distance}mi</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.amenities.slice(0, 3).map(a => (
                        <span key={a} className="text-[9px] bg-white/[0.03] text-slate-600 px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                    </div>
                  </div>
                  <div className={`text-sm font-bold flex-shrink-0 ${i === 0 ? 'text-emerald-400' : 'text-white'}`}>
                    ${s.price.toFixed(3)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
