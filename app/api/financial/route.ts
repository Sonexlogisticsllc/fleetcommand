import { NextResponse } from 'next/server';
import { MOCK_FINANCIAL } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json(MOCK_FINANCIAL);
}
