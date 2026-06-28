'use client';
import React, { useEffect, useState } from 'react';
import { Fuel, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { FuelPrice } from '@/lib/salesData';

export function FuelPriceWidget() {
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/fuel-prices')
      .then(r => r.json())
      .then(d => { setPrices(d.prices || []); setLoading(false); });
  }, []);

  const national = prices.find(p => p.region === 'National Average');
  const top4 = prices.filter(p => p.region !== 'National Average' && p.region !== 'California').slice(0, 4);

  if (loading) return (
    <div className="rounded-2xl p-4 border border-white/[0.06] h-28 animate-pulse"
      style={{ background: 'rgba(7,16,30,0.6)' }} />
  );

  return (
    <div className="rounded-2xl p-4 border border-white/[0.06]" style={{ background: 'rgba(7,16,30,0.6)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Fuel size={13} className="text-amber-400" />
          <span className="text-xs font-bold text-white">Diesel Fuel</span>
          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20 font-semibold">LIVE</span>
        </div>
        {national && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${national.change < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {national.change < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
            {national.change > 0 ? '+' : ''}{national.change.toFixed(3)}
          </div>
        )}
      </div>

      {national && (
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-bold text-amber-400">${national.price.toFixed(3)}</span>
          <span className="text-xs text-slate-600">/gal · National Avg</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {top4.map(p => (
          <div key={p.region} className="text-center p-1.5 rounded-lg bg-white/[0.03]">
            <div className="text-[10px] text-slate-700 mb-0.5 leading-tight">{p.region.split(' ')[0]}</div>
            <div className="text-xs font-bold text-white">${p.price.toFixed(3)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
