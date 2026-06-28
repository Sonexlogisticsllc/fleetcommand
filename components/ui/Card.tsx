'use client';
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  glass?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', glow = false, glass = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl border border-navy-border p-4
        ${glass ? 'glass-card' : 'bg-navy-panel'}
        ${glow ? 'shadow-amber-glow border-amber/20' : ''}
        ${onClick ? 'cursor-pointer hover:border-amber/30 transition-all duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-4 flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-sm font-semibold text-white uppercase tracking-wider ${className}`}>
      {children}
    </h3>
  );
}
