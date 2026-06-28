'use client';
import React, { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { FinancialSummary } from '@/lib/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { PageSpinner } from '@/components/ui/Spinner';
import { DollarSign, TrendingUp, Truck, Package } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-panel border border-navy-border rounded-xl p-4 shadow-navy-lg text-xs">
      <div className="font-bold text-white mb-2 text-sm">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-bold">${p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export default function OwnerDashboard() {
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/financial').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return <PageSpinner text="Loading financial data..." />;

  const { totals, weekly, perTruck } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Gross Revenue"
          value={`$${totals.grossRevenue.toLocaleString()}`}
          sub="This month"
          icon={DollarSign}
          accent
          trend={{ value: 14, label: 'vs last month' }}
        />
        <StatCard
          label="True Net Profit"
          value={`$${totals.netProfit.toLocaleString()}`}
          sub={`${((totals.netProfit / totals.grossRevenue) * 100).toFixed(1)}% margin`}
          icon={TrendingUp}
          trend={{ value: 9, label: 'vs last month' }}
        />
        <StatCard
          label="Fuel + Maintenance"
          value={`$${(totals.fuelCost + totals.maintenanceCost).toLocaleString()}`}
          sub={`${(((totals.fuelCost + totals.maintenanceCost) / totals.grossRevenue) * 100).toFixed(1)}% of revenue`}
          icon={Truck}
          trend={{ value: -3, label: 'fuel efficiency up' }}
        />
        <StatCard
          label="Loads This Month"
          value={totals.loadsThisMonth}
          sub={`${totals.activeLoads} active now`}
          icon={Package}
          trend={{ value: 6, label: 'vs last month' }}
        />
      </div>

      {/* Main Revenue Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-white">Weekly P&L Overview</h3>
            <p className="text-xs text-slate-400 mt-0.5">8-week rolling · WEX fuel data simulated</p>
          </div>
          <div className="flex gap-4 text-xs">
            {[
              { label: 'Gross Revenue', color: '#F59E0B' },
              { label: 'Fuel Cost', color: '#EF4444' },
              { label: 'Maintenance', color: '#8B5CF6' },
              { label: 'Net Profit', color: '#10B981' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                <span className="text-slate-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={weekly} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="grossRevenue" name="Gross Revenue" fill="#F59E0B" opacity={0.85} radius={[4, 4, 0, 0]} />
            <Bar dataKey="fuelCost" name="Fuel Cost" fill="#EF4444" opacity={0.75} radius={[4, 4, 0, 0]} />
            <Bar dataKey="maintenanceCost" name="Maintenance" fill="#8B5CF6" opacity={0.75} radius={[4, 4, 0, 0]} />
            <Line dataKey="netProfit" name="Net Profit" stroke="#10B981" strokeWidth={2.5}
              dot={{ fill: '#10B981', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Per-Truck Cards */}
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Per-Truck Breakdown</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {perTruck.map(truck => {
            const marginColor = truck.netMarginPct > 72 ? 'text-success' : truck.netMarginPct > 65 ? 'text-amber' : 'text-danger';
            return (
              <Card key={truck.truckId} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{truck.truckNumber}</div>
                    <div className="text-xs text-slate-400">{truck.driverName}</div>
                  </div>
                  <div className={`text-lg font-bold ${marginColor}`}>{truck.netMarginPct}%</div>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Gross Revenue', value: truck.grossRevenue, color: 'text-amber' },
                    { label: 'Fuel Cost', value: -truck.fuelCost, color: 'text-danger' },
                    { label: 'Maintenance', value: -truck.maintenanceCost, color: 'text-purple-400' },
                    { label: 'Factoring Fee', value: -truck.factoringFee, color: 'text-slate-400' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={`font-medium ${row.color}`}>
                        {row.value < 0 ? '-' : ''}${Math.abs(row.value).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-navy-border flex justify-between text-sm">
                    <span className="font-semibold text-white">Net Profit</span>
                    <span className={`font-bold ${marginColor}`}>${truck.netProfit.toLocaleString()}</span>
                  </div>
                </div>
                {/* Margin bar */}
                <div className="h-1.5 bg-navy-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${truck.netMarginPct > 72 ? 'bg-success' : truck.netMarginPct > 65 ? 'bg-amber' : 'bg-danger'}`}
                    style={{ width: `${truck.netMarginPct}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-center">
                  <div className="bg-navy-DEFAULT rounded-lg p-2">
                    <div className="text-slate-500">Loads</div>
                    <div className="font-bold text-white">{truck.loadsCompleted}</div>
                  </div>
                  <div className="bg-navy-DEFAULT rounded-lg p-2">
                    <div className="text-slate-500">Miles</div>
                    <div className="font-bold text-white">{(truck.milesRun / 1000).toFixed(1)}k</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
