'use client';
import React, { useEffect, useState } from 'react';
import { DispatcherPerformance } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Award, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

export default function PerformancePage() {
  const [dispatchers, setDispatchers] = useState<DispatcherPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof DispatcherPerformance>('netROI');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/performance').then(r => r.json()).then(d => { setDispatchers(d); setLoading(false); });
  }, []);

  if (loading) return <PageSpinner text="Loading performance data..." />;

  const sorted = [...dispatchers].sort((a, b) => {
    const va = a[sortKey] as number;
    const vb = b[sortKey] as number;
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const toggleSort = (key: keyof DispatcherPerformance) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const chartData = dispatchers.map(d => ({
    name: d.name.split(' ')[0],
    'Gross Revenue': d.grossRevenueGenerated,
    'Total Comp': d.totalCompensation,
    'Net ROI': d.netROI,
  }));

  const columns = [
    { key: 'rank', label: '#', sortable: false },
    { key: 'name', label: 'Dispatcher', sortable: false },
    { key: 'loadsThisWeek', label: 'Loads/Wk', sortable: true },
    { key: 'grossRevenueGenerated', label: 'Gross Revenue', sortable: true },
    { key: 'baseSalary', label: 'Base Salary', sortable: true },
    { key: 'performanceBonus', label: 'Perf. Bonus', sortable: true },
    { key: 'totalCompensation', label: 'Total Comp', sortable: true },
    { key: 'netROI', label: 'Net ROI', sortable: true },
    { key: 'avgRatePerMile', label: 'Avg $/Mi', sortable: true },
  ];

  const getRoiColor = (roi: number) => {
    if (roi > 80000) return 'text-success';
    if (roi > 60000) return 'text-amber';
    return 'text-danger';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Dispatcher Performance</h2>
          <p className="text-sm text-slate-400 mt-0.5">ROI tracking: gross revenue generated vs. compensation. Bonus = 5% of gross above $70k threshold.</p>
        </div>
        <button
          onClick={() => toast.success('CSV downloaded!')}
          className="flex items-center gap-2 px-3 py-1.5 bg-navy-panel border border-navy-border rounded-lg text-xs text-slate-400 hover:text-white hover:border-amber/30 transition-all"
        >
          <Download size={13} />
          Export CSV
        </button>
      </div>

      {/* Chart */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Revenue vs Compensation</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#112240', border: '1px solid #1E3A5F', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: '#E2E8F0', fontWeight: 600 }}
              formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
            />
            <Bar dataKey="Gross Revenue" fill="#F59E0B" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="Total Comp" fill="#8B5CF6" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="Net ROI" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Table */}
      <div className="bg-navy-panel border border-navy-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-border bg-navy-DEFAULT/50">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-white' : ''}`}
                  onClick={() => col.sortable && toggleSort(col.key as keyof DispatcherPerformance)}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1 text-amber">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-border">
            {sorted.map((d, i) => (
              <tr key={d.id} className="hover:bg-navy-hover transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Award size={14} className="text-amber" />}
                    <span className="text-slate-400 text-xs">#{i + 1}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-navy-border flex items-center justify-center text-xs font-bold text-white">
                      {d.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-white font-medium text-sm">{d.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-white font-medium">{d.loadsThisWeek}</td>
                <td className="px-4 py-4 text-amber font-bold">${d.grossRevenueGenerated.toLocaleString()}</td>
                <td className="px-4 py-4 text-slate-300">${d.baseSalary.toLocaleString()}/wk</td>
                <td className="px-4 py-4">
                  {d.performanceBonus > 0
                    ? <span className="text-success font-medium">+${d.performanceBonus.toLocaleString()}</span>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-4 text-white font-medium">${d.totalCompensation.toLocaleString()}</td>
                <td className="px-4 py-4">
                  <span className={`font-bold text-base ${getRoiColor(d.netROI)}`}>
                    ${d.netROI.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-300">${d.avgRatePerMile.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-navy-border bg-navy-DEFAULT/30 text-xs text-slate-500">
          Performance bonus calculated at 5% of gross revenue above $70,000/week threshold.
        </div>
      </div>
    </div>
  );
}
