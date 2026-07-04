import { NextResponse } from 'next/server';

const REGIONS = [
  { name: 'U.S. National Average', series: 'EMD_EPD2D_PTE_NUS_DPG', fallback: 3.784, change: -0.015 },
  { name: 'East Coast (PADD 1)', series: 'EMD_EPD2D_PTE_R10_DPG', fallback: 3.824, change: -0.021 },
  { name: 'Midwest (PADD 2)', series: 'EMD_EPD2D_PTE_R20_DPG', fallback: 3.691, change: -0.008 },
  { name: 'Gulf Coast (PADD 3)', series: 'EMD_EPD2D_PTE_R30_DPG', fallback: 3.487, change: -0.011 },
  { name: 'Rocky Mountain (PADD 4)', series: 'EMD_EPD2D_PTE_R40_DPG', fallback: 3.742, change: 0.004 },
  { name: 'West Coast (PADD 5)', series: 'EMD_EPD2D_PTE_R50_DPG', fallback: 4.419, change: -0.032 },
];

export async function GET() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: true,
      source: 'fallback',
      asOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      data: REGIONS.map(r => ({
        name: r.name,
        price: r.fallback,
        change: r.change,
      }))
    });
  }

  try {
    const dataList = await Promise.all(REGIONS.map(async (r) => {
      const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${apiKey}&frequency=weekly&data[]=value&facets[series][]=${r.series}&sort[0][column]=period&sort[0][direction]=desc&length=2`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error(`EIA API returned status ${res.status}`);
      const json = await res.json();
      const records = json?.response?.data || [];
      if (records.length === 0) {
        return { name: r.name, price: r.fallback, change: r.change };
      }
      const latestPrice = Number(records[0].value);
      const prevPrice = records.length > 1 ? Number(records[1].value) : latestPrice;
      const change = latestPrice - prevPrice;
      return {
        name: r.name,
        price: Number(latestPrice.toFixed(3)),
        change: Number(change.toFixed(3)),
      };
    }));

    return NextResponse.json({
      success: true,
      source: 'eia_api',
      asOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      data: dataList,
    });
  } catch (err) {
    console.warn('EIA API fetch failed, serving fallback:', err);
    return NextResponse.json({
      success: true,
      source: 'fallback_error',
      asOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      data: REGIONS.map(r => ({
        name: r.name,
        price: r.fallback,
        change: r.change,
      }))
    });
  }
}
