import { NextResponse } from 'next/server';
import { MOCK_FUEL_PRICES, MOCK_NEARBY_STATIONS } from '@/lib/salesData';

/**
 * Fuel Prices API
 * 
 * Production: Fetches from EIA API (U.S. Energy Information Administration)
 * Endpoint: https://api.eia.gov/v2/petroleum/pri/gnd/data/
 * No API key needed for public data.
 * 
 * Falls back to mock data if EIA is unavailable.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeStations = searchParams.get('stations') === 'true';

  try {
    // Attempt real EIA API fetch
    const EIA_URL = 'https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=DEMO_KEY&facets[product][]=EPD2D&facets[duoarea][]=NUS&sort[0][column]=period&sort[0][direction]=desc&length=4';
    
    // In production, uncomment this block and add EIA_API_KEY to .env.local:
    // const res = await fetch(EIA_URL, { next: { revalidate: 1800 } }); // 30 min cache
    // const data = await res.json();
    // return NextResponse.json({ prices: transformEIAData(data), stations: includeStations ? MOCK_NEARBY_STATIONS : undefined });

    // Mock response (always used in this demo)
    // Simulate small price fluctuations
    const prices = MOCK_FUEL_PRICES.map(p => ({
      ...p,
      price: +(p.price + (Math.random() * 0.02 - 0.01)).toFixed(3),
      updatedAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      prices,
      stations: includeStations ? MOCK_NEARBY_STATIONS : undefined,
      source: 'mock', // change to 'eia' when using real API
      lastUpdated: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { prices: MOCK_FUEL_PRICES, stations: includeStations ? MOCK_NEARBY_STATIONS : undefined, source: 'mock' }
    );
  }
}
