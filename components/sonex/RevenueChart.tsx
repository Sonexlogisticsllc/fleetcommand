'use client';

import React from 'react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface RevenueChartProps {
  data: { label: string; gross: number; fees: number }[];
}

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barGap={4} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#636366', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#636366', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: '#0F0F0F',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            fontSize: '11px',
            color: '#F5F5F7',
          }}
          formatter={(v: number, name: string) => [fmt$(v), name === 'gross' ? 'Gross' : 'Fees']}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="gross" fill="#FF6B35" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar
          dataKey="fees"
          fill="rgba(255,107,53,0.24)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
          stroke="#FF8C5A"
          strokeWidth={1}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
