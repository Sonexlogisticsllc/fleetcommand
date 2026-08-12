import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PDFParse } from 'pdf-parse';
import { lucia } from '@/lib/lucia';

const MAX_PARSER_BYTES = 4 * 1024 * 1024;

function extractRawPdfStrings(buffer: Buffer): string {
  const content = buffer.toString('binary');
  
  // 1. Find all parenthesized text strings: (text)
  const parenMatches = content.match(/\(([^)]*)\)/g) || [];
  const parenText = parenMatches.map(m => {
    const val = m.slice(1, -1);
    // filter out binary junk/noise
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]/.test(val)) return '';
    return val;
  }).join(' ');

  // 2. Search for Hexadecimal strings: <434820526f62696e736f6e>
  const hexMatches = content.match(/<([0-9a-fA-F]{4,})>/g) || [];
  const hexText = hexMatches.map(m => {
    const hex = m.slice(1, -1);
    try {
      return Buffer.from(hex, 'hex').toString('utf-8');
    } catch {
      return '';
    }
  }).join(' ');

  // 3. Extract direct clean ascii sequences
  const asciiMatches = content.match(/[\x20-\x7E]{4,}/g) || [];
  const cleanAscii = asciiMatches.filter(s => {
    const str = s.trim();
    if (/^\/|obj$|endobj$|stream$|endstream$|^[0-9]+\s+[0-9]+\s+R$/.test(str)) return false;
    return true;
  }).join(' ');

  return (parenText + ' ' + hexText + ' ' + cleanAscii).replace(/\s+/g, ' ');
}

async function extractDocumentText(buffer: Buffer, contentType: string): Promise<string> {
  if (contentType !== 'application/pdf') return '';

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    return text || extractRawPdfStrings(buffer);
  } catch {
    return extractRawPdfStrings(buffer);
  } finally {
    await parser.destroy();
  }
}

function capture(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim() ?? '';
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: string) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function parseStop(text: string, stop: 'pickup' | 'delivery') {
  const value = capture(text, new RegExp(`^${stop}(?: location| facility)?\\s*[:#-]?\\s*(.+)$`, 'im'));
  const location = value.match(/^(.*?)\s+-\s+(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  return {
    facility: location?.[1]?.trim() ?? value,
    address: '',
    city: location?.[2]?.trim() ?? '',
    state: location?.[3]?.toUpperCase() ?? '',
    zip: location?.[4] ?? '',
  };
}

export async function POST(req: Request) {
  try {
    const sessionId = cookies().get(lucia.sessionCookieName)?.value;
    if (!sessionId) return NextResponse.json({ success: false, error: 'Sign in to parse documents.' }, { status: 401 });
    const { user } = await lucia.validateSession(sessionId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Dispatcher authorization required.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No document uploaded' }, { status: 400 });
    }
    if (file.size > MAX_PARSER_BYTES) {
      return NextResponse.json({ success: false, error: 'Parser files must be 4 MB or smaller. Upload the original to load paperwork after review.' }, { status: 413 });
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Use a PDF, JPG, PNG, or WEBP document.' }, { status: 415 });
    }

    const documentType = formData.get('documentType') === 'bol' ? 'bol' : 'rate_confirmation';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Heuristically extract text from PDF or fallback to filename
    const fileText = await extractDocumentText(buffer, file.type);

    const loadNumber = capture(fileText, /^(?:load|order|shipment)\s*(?:#|number|no\.?|id)?\s*[:#-]?\s*([a-z0-9-]{4,})/im).toUpperCase();
    const brokerName = capture(fileText, /^broker(?: name)?\s*[:#-]?\s*(.+)$/im);
    const brokerContact = capture(fileText, /^broker contact\s*[:#-]?\s*(.+)$/im);
    const brokerPhone = capture(fileText, /^broker phone\s*[:#-]?\s*(.+)$/im);
    const brokerEmail = capture(fileText, /^broker email\s*[:#-]?\s*(\S+@\S+)$/im);
    const brokerMC = capture(fileText, /^(?:broker\s+)?mc(?: number| no\.?)?\s*[:#-]?\s*([a-z0-9-]+)$/im);
    const pickup = parseStop(fileText, 'pickup');
    const delivery = parseStop(fileText, 'delivery');

    const pickupDateValue = capture(fileText, /^pickup date\s*[:#-]?\s*([^\s]+)(?:\s+\d{1,2}:\d{2})?/im);
    const deliveryDateValue = capture(fileText, /^delivery date\s*[:#-]?\s*([^\s]+)(?:\s+\d{1,2}:\d{2})?/im);
    const pickupDate = normalizeDate(pickupDateValue);
    const deliveryDate = normalizeDate(deliveryDateValue);
    const pickupTime = capture(fileText, /^pickup date\s*[:#-]?\s*[^\s]+\s+(\d{1,2}:\d{2})/im);
    const deliveryTime = capture(fileText, /^delivery date\s*[:#-]?\s*[^\s]+\s+(\d{1,2}:\d{2})/im);
    const commodity = capture(fileText, /^commodity\s*[:#-]?\s*(.+)$/im);
    const weightValue = capture(fileText, /^weight\s*[:#-]?\s*([\d,.]+)(?:\s*(?:lbs?|pounds?))?/im)
      || capture(fileText, /^([\d,.]+)\s*(?:lbs?|pounds?)\b/im);
    const milesValue = capture(fileText, /^(?:miles|distance)\s*[:#-]?\s*([\d,.]+)/im)
      || capture(fileText, /^([\d,.]+)\s*(?:miles?|mi)\b/im);
    const rateValue = capture(fileText, /^(?:line haul|carrier pay|total rate|rate|amount)\s*[:#-]?\s*(\$?[\d,.]+)/im);
    const weight = parseAmount(weightValue);
    const miles = parseAmount(milesValue);
    const rate = parseAmount(rateValue);

    const evidence = [
      Boolean(loadNumber), Boolean(brokerName), Boolean(pickup.city), Boolean(delivery.city),
      Boolean(pickupDate), Boolean(deliveryDate), rate > 0, weight > 0, miles > 0, Boolean(commodity),
    ];
    const evidenceCount = evidence.filter(Boolean).length;
    const confidenceScore = Math.min(0.98, Math.round((0.12 + evidenceCount * 0.085) * 100) / 100);

    return NextResponse.json({
      success: true,
      data: {
        documentType,
        loadNumber,
        confidenceScore,
        fieldConfidence: {
          brokerName: brokerName ? confidenceScore : 0.1,
          stops: pickup.city && delivery.city && pickupDate && deliveryDate ? confidenceScore : 0.1,
          rate: rate > 0 ? confidenceScore : 0.1,
          commodity: commodity ? confidenceScore : 0.1,
        },
        brokerName,
        brokerContact,
        brokerPhone,
        brokerEmail,
        brokerMC,
        pickupFacility: pickup.facility,
        pickupAddress: pickup.address,
        pickupCity: pickup.city,
        pickupState: pickup.state,
        pickupZip: pickup.zip,
        pickupDate,
        pickupTime,
        pickupApptNumber: '',
        deliveryFacility: delivery.facility,
        deliveryAddress: delivery.address,
        deliveryCity: delivery.city,
        deliveryState: delivery.state,
        deliveryZip: delivery.zip,
        deliveryDate,
        deliveryTime,
        deliveryApptNumber: '',
        commodity,
        weight,
        miles,
        rate,
        notes: `Extracted from ${file.name}. Review all fields before saving.`
      }
    });
  } catch (err: unknown) {
    console.error('AI parsing error:', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error processing document' }, { status: 500 });
  }
}
