import { NextResponse } from 'next/server';
import { MOCK_LOADS } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json(MOCK_LOADS);
}
