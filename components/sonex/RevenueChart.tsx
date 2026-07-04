'use client';

import React, { useState, useRef } from 'react';

interface RevenueChartProps {
  data: { label: string; gross: number; fees: number }[];
}

function fmt$(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export default function RevenueChart({ data = [] }: RevenueChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-slate-600 text-xs">
        No weekly financial data available
      </div>
    );
  }

  // 1. Dimensions inside the viewBox
  const viewBoxWidth = 500;
  const viewBoxHeight = 180;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 25;
  
  const plotWidth = viewBoxWidth - padLeft - padRight;
  const plotHeight = viewBoxHeight - padTop - padBottom;

  // 2. Find max value to scale heights
  const maxVal = Math.max(...data.map(d => Math.max(d.gross, d.fees)), 1000);
  // Round up to clean tick numbers (e.g. next multiple of 5,000 or 1,000)
  const yMax = Math.ceil(maxVal / 5000) * 5000 || 5000;
  
  // 3. Define Y ticks (4 levels)
  const ticks = [0, yMax * 0.33, yMax * 0.66, yMax];

  const colWidth = plotWidth / data.length;
  const barWidth = 14;
  const barGap = 4;

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Position tooltip above the cursor
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 75,
    });
    setHoveredIndex(index);
  };

  return (
    <div ref={containerRef} className="relative h-[200px] w-full select-none">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="h-full w-full overflow-visible font-mono text-[9px] text-slate-500"
      >
        {/* Grid lines & Y ticks */}
        {ticks.map((t, idx) => {
          const y = padTop + plotHeight - (t / yMax) * plotHeight;
          return (
            <g key={idx} className="opacity-70">
              <line
                x1={padLeft}
                y1={y}
                x2={viewBoxWidth - padRight}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                fill="#636366"
              >
                {t >= 1000 ? `${(t / 1000).toFixed(0)}k` : `$${t}`}
              </text>
            </g>
          );
        })}

        {/* Bar charts & X labels */}
        {data.map((d, i) => {
          const colCenter = padLeft + (i + 0.5) * colWidth;
          
          // Scaled Heights
          const grossHeight = (d.gross / yMax) * plotHeight;
          const grossY = padTop + plotHeight - grossHeight;

          const feesHeight = (d.fees / yMax) * plotHeight;
          const feesY = padTop + plotHeight - feesHeight;

          // Bar X positions (side-by-side)
          const grossX = colCenter - barWidth - barGap / 2;
          const feesX = colCenter + barGap / 2;

          return (
            <g key={i}>
              {/* Gross Bar */}
              {d.gross > 0 && (
                <rect
                  x={grossX}
                  y={grossY}
                  width={barWidth}
                  height={grossHeight}
                  fill="#FF6B35"
                  rx={3}
                  ry={3}
                  className="transition-all duration-300 hover:brightness-110"
                />
              )}

              {/* Fees Bar */}
              {d.fees > 0 && (
                <rect
                  x={feesX}
                  y={feesY}
                  width={barWidth}
                  height={feesHeight}
                  fill="rgba(255,107,53,0.24)"
                  stroke="#FF8C5A"
                  strokeWidth={0.8}
                  rx={3}
                  ry={3}
                  className="transition-all duration-300 hover:brightness-110"
                />
              )}

              {/* X Axis Label */}
              <text
                x={colCenter}
                y={viewBoxHeight - 8}
                textAnchor="middle"
                fill="#636366"
                className="font-semibold"
              >
                {d.label}
              </text>

              {/* Hover Target Column (large transparent catchers) */}
              <rect
                x={padLeft + i * colWidth}
                y={padTop}
                width={colWidth}
                height={plotHeight}
                fill="transparent"
                onMouseMove={(e) => handleMouseMove(e, i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              />
            </g>
          );
        })}
      </svg>

      {/* Glassmorphic Interactive Floating Tooltip */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-20 flex flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-[#0E0E10]/95 p-3 shadow-xl backdrop-blur-md animate-fade-in"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {data[hoveredIndex].label}
          </p>
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-[#FF6B35]" />
                Gross Revenue
              </span>
              <span className="font-mono font-bold text-white">
                {fmt$(data[hoveredIndex].gross)}
              </span>
            </div>
            <div className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full border border-[#FF8C5A] bg-amber-500/20" />
                Dispatch Fees
              </span>
              <span className="font-mono font-bold text-[#FF8C5A]">
                {fmt$(data[hoveredIndex].fees)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
