import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { loadId } = await req.json();
  await new Promise(r => setTimeout(r, 1500)); // simulate processing

  const submissionId = `FC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const fundingDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return NextResponse.json({
    submissionId,
    loadId,
    factoringCompany: 'OTR Capital',
    status: 'approved',
    advanceRate: 97,
    advanceAmount: null, // will be computed client-side from load rate
    expectedFundingDate: fundingDate,
    documents: { rc: true, bol: true, pod: true },
    message: 'Documents verified and submitted successfully. Funds will be deposited within 24 hours.',
  });
}
