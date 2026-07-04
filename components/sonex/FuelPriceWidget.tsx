'use client';

import React, { useEffect, useState } from 'react';
import { Fuel, ArrowDownRight, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react';

interface FuelPrice {
  name: string;
  price: number;
  change: number;
}

interface FuelDataResponse {
  success: boolean;
  source: string;
  asOf: string;
  data: FuelPrice[];
}

export function FuelPriceWidget() {
  const [data, setData] = useState<FuelDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPrices = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/fuel-prices');
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.warn('Failed to load fuel prices:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Fuel size={15} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Regional Diesel Prices</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">U.S. Retail Index</p>
          </div>
        </div>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="text-slate-500 hover:text-slate-300 disabled:opacity-50 transition-colors"
          title="Refresh prices"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin text-amber-400" />
          ) : (
            <RefreshCw size={13} className="hover:rotate-180 duration-500 transition-all" />
          )}
        </button>
      </div>

      {/* Body content */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-2">
          <Loader2 size={24} className="animate-spin text-amber-400" />
          <p className="text-xs text-slate-500">Loading retail indices...</p>
        </div>
      ) : error && !data ? (
        <div className="text-center py-6">
          <p className="text-xs text-red-400">Failed to load fuel prices.</p>
          <button
            onClick={fetchPrices}
            className="mt-2 text-xs font-bold text-amber-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data?.data.map((r, i) => {
            const isDown = r.change <= 0;
            const Arrow = isDown ? ArrowDownRight : ArrowUpRight;
            // Since fuel price drop is positive for logistics margins, mark decreases green and increases red
            const changeColor = isDown ? 'text-emerald-400' : 'text-red-400';
            const changeBg = isDown ? 'bg-emerald-500/10' : 'bg-red-500/10';

            return (
              <div
                key={r.name}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/[0.05] transition-all"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="text-xs font-medium text-slate-300 truncate block">{r.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-black font-mono text-white">${r.price.toFixed(3)}</span>
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[9px] font-bold ${changeBg} ${changeColor}`}>
                    <Arrow size={10} />
                    <span>{Math.abs(r.change).toFixed(3)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Footer details */}
          <div className="flex items-center justify-between text-[9px] text-slate-600 border-t border-white/[0.04] pt-2 mt-1">
            <span>As of: {data?.asOf}</span>
            <span className="capitalize">Source: {data?.source === 'eia_api' ? 'Live EIA API' : 'Cached Baseline'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
