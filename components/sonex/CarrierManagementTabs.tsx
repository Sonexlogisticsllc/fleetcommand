'use client';

import Link from 'next/link';
import { Building2, UsersRound } from 'lucide-react';

type CarrierManagementTabsProps = {
  active: 'owners' | 'carriers';
  ownerCount?: number;
  carrierCount?: number;
};

export function CarrierManagementTabs({ active, ownerCount, carrierCount }: CarrierManagementTabsProps) {
  const tab = (selected: boolean) => `inline-flex h-9 items-center gap-2 border px-3 text-xs font-semibold transition-colors ${
    selected
      ? 'border-blue-600 bg-blue-600 text-white'
      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
  }`;

  return (
    <nav aria-label="Carrier management views" className="mb-5 flex w-fit items-center gap-1 border border-slate-200 bg-slate-50 p-1">
      <Link href="/sonex/carriers" className={tab(active === 'carriers')}>
        <UsersRound size={15} />
        Carrier Profiles
        {typeof carrierCount === 'number' && <span className={active === 'carriers' ? 'text-blue-100' : 'text-slate-400'}>{carrierCount}</span>}
      </Link>
      <Link href="/sonex/mc-owners" className={tab(active === 'owners')}>
        <Building2 size={15} />
        MC Owners
        {typeof ownerCount === 'number' && <span className={active === 'owners' ? 'text-blue-100' : 'text-slate-400'}>{ownerCount}</span>}
      </Link>
    </nav>
  );
}
