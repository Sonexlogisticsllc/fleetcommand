import { NextResponse } from 'next/server';
import { RatePredictionRequest, RatePredictionResponse } from '@/lib/types';

const LANE_SCORES: Record<string, 'hot' | 'warm' | 'soft'> = {
  'TX-CA': 'hot', 'CA-TX': 'hot', 'MI-TN': 'hot', 'IL-MN': 'warm',
  'NJ-MN': 'warm', 'NC-OH': 'warm', 'CA-NV': 'soft',
};

export async function POST(req: Request) {
  const body: RatePredictionRequest = await req.json();
  const laneKey = `${body.originState}-${body.destinationState}`;
  const laneScore = LANE_SCORES[laneKey] ?? 'warm';

  const baseRpm = laneScore === 'hot' ? 4.8 : laneScore === 'warm' ? 4.1 : 3.5;
  const weightAdj = body.weight > 40000 ? 0.15 : body.weight > 30000 ? 0.08 : 0;
  const ratePerMile = parseFloat((baseRpm + weightAdj + (Math.random() * 0.3 - 0.15)).toFixed(2));
  const suggestedRate = Math.round(ratePerMile * body.miles);
  const historicalAvg = Math.round(suggestedRate * (0.92 + Math.random() * 0.12));
  const confidence = laneScore === 'hot' ? 88 + Math.floor(Math.random() * 10) : laneScore === 'warm' ? 74 + Math.floor(Math.random() * 12) : 58 + Math.floor(Math.random() * 15);
  const demandIndex = laneScore === 'hot' ? 7 + Math.random() * 3 : laneScore === 'warm' ? 4 + Math.random() * 3 : 1 + Math.random() * 3;

  const result: RatePredictionResponse = {
    suggestedRate, ratePerMile, confidence,
    historicalAvg, laneScore,
    demandIndex: parseFloat(demandIndex.toFixed(1)),
    seasonalAdjustment: laneScore === 'hot' ? 5.2 : laneScore === 'warm' ? 1.8 : -2.1,
    comparisons: [
      { source: 'DAT Truckload', rate: Math.round(suggestedRate * 0.97) },
      { source: 'Truckstop.com', rate: Math.round(suggestedRate * 1.02) },
      { source: 'Historical (90d)', rate: historicalAvg },
    ],
  };

  await new Promise(r => setTimeout(r, 400)); // simulate AI latency
  return NextResponse.json(result);
}
