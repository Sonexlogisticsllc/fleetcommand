'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CarrierLoadRedirect() {
  const router = useRouter();

  useEffect(() => {
    const loadId = window.location.pathname.split('/').pop();
    router.replace(`/carrier/loads?load=${encodeURIComponent(loadId ?? '')}`);
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-400">
      Opening your load workspace...
    </div>
  );
}
