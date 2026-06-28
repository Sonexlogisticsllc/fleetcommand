import { NextResponse } from 'next/server';
import { MOCK_CHAT_THREADS } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json(MOCK_CHAT_THREADS);
}
