'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  className?: string;
  text?: string;
}

export function Spinner({ size = 20, className = '', text }: SpinnerProps) {
  return (
    <div className={`flex items-center gap-2 text-slate-400 ${className}`}>
      <Loader2 size={size} className="animate-spin text-amber" />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}

export function PageSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[300px]">
      <Spinner size={28} text={text} />
    </div>
  );
}
