import { NextResponse } from 'next/server';
import { MOCK_DISPATCHER_PERFORMANCE } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json(MOCK_DISPATCHER_PERFORMANCE);
}
