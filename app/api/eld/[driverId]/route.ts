import { NextResponse } from 'next/server';
import { MOCK_HOS } from '@/lib/mockData';

export async function GET(
  _req: Request,
  { params }: { params: { driverId: string } }
) {
  const data = MOCK_HOS[params.driverId];
  if (!data) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}
