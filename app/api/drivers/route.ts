import { NextResponse } from 'next/server';
import { MOCK_DRIVERS } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json(MOCK_DRIVERS);
}
