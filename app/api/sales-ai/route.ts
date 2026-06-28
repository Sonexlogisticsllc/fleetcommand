import { NextRequest, NextResponse } from 'next/server';

const SALES_SCRIPTS = [
  "Hi! This is the FleetCommand AI calling about our premium dispatch service. We average $4.20/mile on dry van freight — do you have 2 minutes?",
  "We specialize in your lanes and handle all broker communication, RC parsing, and HOS tracking automatically.",
  "With FleetCommand, you get a real-time owner portal showing every load and every dollar — full transparency, no hidden fees.",
  "Our dispatch fee is just 10% of gross — and most clients increase their monthly revenue by 20-35% within 60 days.",
  "Would you be open to a quick demo? I can have our human sales rep reach you at your preferred time.",
];

const AI_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hello! I'm the FleetCommand AI Sales Agent. I'm calling to tell you about our premium dispatch service for owner-operators and small fleets. Do you have a couple minutes?",
    "Hi there! I'm reaching out from FleetCommand about high-paying freight on your preferred lanes. Is this a good time to chat?",
  ],
  rates: [
    "Great question! On dry van freight we're averaging $4.10-$4.40 per mile. For reefer we're seeing $3.80-$4.20 depending on the lane. What equipment are you running?",
    "Our rate averages are consistently 15-20% above spot market. We negotiate directly with top brokers like Coyote, Echo, and TQL for our fleet.",
  ],
  fees: [
    "We charge a flat 10% of gross revenue — that covers full dispatch, broker negotiation, RC parsing, and 24/7 AI-assisted support. No hidden fees.",
    "Our fee is 10% of gross. But most clients offset that completely because we find loads at higher rates than they were getting independently.",
  ],
  load_board: [
    "We don't just post on DAT — we have direct broker relationships and preferred shipper contracts. Your truck won't sit empty on weekends.",
    "We use AI rate prediction to score every load before accepting, so you only take loads that maximize your net profit per mile.",
  ],
  interested: [
    "Excellent! Let me connect you with one of our human dispatch specialists. When's a good time for a callback? We can also do a live demo of the owner portal.",
    "Perfect! I'll schedule you for a demo with our team. We'll show you the full platform — load board, profit tracking, everything. What time works best?",
  ],
  not_interested: [
    "I understand completely. If your situation changes, we're always here. Can I send you our rate sheet by text so you have it for reference?",
    "No problem at all. We'd love to earn your business when the time is right. Would a follow-up in 30 days be okay?",
  ],
  default: [
    "That's a great point. FleetCommand is designed to take the stress out of dispatch — you drive, we handle everything else.",
    "I hear you. Our clients typically tell us the biggest benefit is the time they save on admin — no more chasing brokers or parsing paperwork.",
    "Absolutely. We've helped fleets from 1 truck to 20 trucks, and each gets the same dedicated attention and premium freight access.",
  ],
};

function getAIResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  let category = 'default';

  if (lower.includes('rate') || lower.includes('mile') || lower.includes('pay') || lower.includes('money')) {
    category = 'rates';
  } else if (lower.includes('fee') || lower.includes('percent') || lower.includes('cost') || lower.includes('charge')) {
    category = 'fees';
  } else if (lower.includes('load') || lower.includes('board') || lower.includes('freight') || lower.includes('dat')) {
    category = 'load_board';
  } else if (lower.includes('yes') || lower.includes('interested') || lower.includes('demo') || lower.includes('tell me more') || lower.includes('sure')) {
    category = 'interested';
  } else if (lower.includes('no') || lower.includes('not interested') || lower.includes('have dispatcher') || lower.includes('busy')) {
    category = 'not_interested';
  } else if (lower === '' || lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    category = 'greeting';
  }

  const responses = AI_RESPONSES[category];
  return responses[Math.floor(Math.random() * responses.length)];
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, leadName, mode } = body;

  // Simulate thinking time
  await new Promise(r => setTimeout(r, 400 + Math.random() * 600));

  if (mode === 'chat') {
    const response = getAIResponse(message || '');
    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      mode: 'simulated',
    });
  }

  if (mode === 'call_start') {
    return NextResponse.json({
      status: 'connected',
      opening: `Hello, am I speaking with ${leadName}? This is the FleetCommand AI Dispatch Agent. I'm reaching out about our premium dispatch service for truckers. Do you have 2-3 minutes?`,
      callId: `fc-call-${Date.now()}`,
    });
  }

  if (mode === 'call_respond') {
    const response = getAIResponse(message || '');
    return NextResponse.json({
      response,
      callId: body.callId,
    });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}
