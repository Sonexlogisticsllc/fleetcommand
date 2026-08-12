'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CarrierLoadRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/carrier');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-400">
      Opening your load workspace...
    </div>
  );
}
