import { NextRequest, NextResponse } from 'next/server';

/**
 * OpenPhone Integration
 * 
 * To activate real calling:
 * 1. Get API key from https://app.openphone.com/settings/api
 * 2. Add OPENPHONE_API_KEY=your_key_here to .env.local
 * 3. Uncomment the real API call block below
 * 
 * OpenPhone API docs: https://www.openphone.com/docs/api-reference
 */

const OPENPHONE_BASE = 'https://api.openphone.com/v1';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, phoneNumber, leadName, script } = body;

  const apiKey = process.env.OPENPHONE_API_KEY;

  if (!apiKey) {
    // Simulate OpenPhone response for demo
    if (action === 'call') {
      return NextResponse.json({
        success: true,
        callId: `mock-call-${Date.now()}`,
        status: 'initiated',
        to: phoneNumber,
        message: '[DEMO] OpenPhone call initiated. Add OPENPHONE_API_KEY to .env.local for real calling.',
        estimatedDuration: 300,
      });
    }
    if (action === 'send_sms') {
      return NextResponse.json({
        success: true,
        messageId: `mock-sms-${Date.now()}`,
        status: 'delivered',
        to: phoneNumber,
        message: '[DEMO] SMS sent. Add OPENPHONE_API_KEY for real SMS.',
      });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  // ── REAL OpenPhone API (activate when key is available) ──────────────────────
  try {
    if (action === 'call') {
      // POST /v1/calls — initiate outbound call
      const res = await fetch(`${OPENPHONE_BASE}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          to: phoneNumber,
          from: process.env.OPENPHONE_NUMBER, // your OpenPhone number
          // Optional: Attach AI script for sales agent
          notes: `Calling: ${leadName}\nScript: ${script}`,
        }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, ...data });
    }

    if (action === 'send_sms') {
      const res = await fetch(`${OPENPHONE_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          to: phoneNumber,
          from: process.env.OPENPHONE_NUMBER,
          content: script,
        }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, ...data });
    }

    if (action === 'get_recordings') {
      const res = await fetch(`${OPENPHONE_BASE}/call-recordings?callId=${body.callId}`, {
        headers: { 'Authorization': apiKey },
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[OpenPhone API Error]', err);
    return NextResponse.json({ error: 'OpenPhone API error', details: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get('callId');

  const apiKey = process.env.OPENPHONE_API_KEY;
  if (!apiKey || !callId) {
    return NextResponse.json({ transcript: [], recording: null, demo: true });
  }

  const res = await fetch(`${OPENPHONE_BASE}/calls/${callId}`, {
    headers: { 'Authorization': apiKey },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
