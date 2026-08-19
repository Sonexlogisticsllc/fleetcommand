import { v1 } from '@google-cloud/documentai';
import { PDFParse } from 'pdf-parse';

export const MAX_DOCUMENT_EXTRACTION_BYTES = 15 * 1024 * 1024;

export type ExtractableDocumentType = 'rate_confirmation' | 'bol';
export type ExtractionEngine = 'google_document_ai' | 'local_text_review';

export type ParsedLoadDocument = {
  documentType: ExtractableDocumentType;
  engine: ExtractionEngine;
  loadNumber: string;
  confidenceScore: number;
  fieldConfidence: Record<string, number>;
  brokerName: string;
  brokerContact: string;
  brokerPhone: string;
  brokerEmail: string;
  brokerMC: string;
  pickupFacility: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  pickupDate: string;
  pickupTime: string;
  pickupApptNumber: string;
  deliveryFacility: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryApptNumber: string;
  commodity: string;
  weight: number;
  miles: number;
  rate: number;
  notes: string;
  reviewRequired: boolean;
  validationIssues: string[];
};

type GoogleEntity = {
  type?: string | null;
  mentionText?: string | null;
  normalizedValue?: { text?: string | null } | null;
  confidence?: number | null;
};

const EMPTY_LOAD: Omit<ParsedLoadDocument, 'documentType' | 'engine' | 'notes' | 'confidenceScore' | 'reviewRequired' | 'validationIssues'> = {
  loadNumber: '', fieldConfidence: {}, brokerName: '', brokerContact: '', brokerPhone: '', brokerEmail: '', brokerMC: '',
  pickupFacility: '', pickupAddress: '', pickupCity: '', pickupState: '', pickupZip: '', pickupDate: '', pickupTime: '', pickupApptNumber: '',
  deliveryFacility: '', deliveryAddress: '', deliveryCity: '', deliveryState: '', deliveryZip: '', deliveryDate: '', deliveryTime: '', deliveryApptNumber: '',
  commodity: '', weight: 0, miles: 0, rate: 0,
};

type ExtractionField = Exclude<keyof typeof EMPTY_LOAD, 'fieldConfidence'>;

const ENTITY_ALIASES: Record<string, ExtractionField> = {
  load_number: 'loadNumber', load_id: 'loadNumber', shipment_number: 'loadNumber',
  broker_name: 'brokerName', broker_contact: 'brokerContact', broker_phone: 'brokerPhone', broker_email: 'brokerEmail', broker_mc: 'brokerMC',
  pickup_facility: 'pickupFacility', pickup_address: 'pickupAddress', pickup_city: 'pickupCity', pickup_state: 'pickupState', pickup_zip: 'pickupZip', pickup_date: 'pickupDate', pickup_time: 'pickupTime', pickup_appointment_number: 'pickupApptNumber',
  delivery_facility: 'deliveryFacility', delivery_address: 'deliveryAddress', delivery_city: 'deliveryCity', delivery_state: 'deliveryState', delivery_zip: 'deliveryZip', delivery_date: 'deliveryDate', delivery_time: 'deliveryTime', delivery_appointment_number: 'deliveryApptNumber',
  commodity: 'commodity', weight: 'weight', miles: 'miles', rate: 'rate', carrier_pay: 'rate', total_rate: 'rate',
};

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

function normalizeTime(value: string) {
  const match = value.match(/\b(\d{1,2}):(\d{2})(?:\s*([ap]m))?\b/i);
  if (!match) return '';
  let hours = Number(match[1]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

function normalizeFieldName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseStop(text: string, stop: 'pickup' | 'delivery') {
  const value = capture(text, new RegExp(`^${stop}(?: location| facility)?\\s*[:#-]?\\s*(.+)$`, 'im'));
  const location = value.match(/^(.*?)\s+-\s+(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  return { facility: location?.[1]?.trim() ?? value, city: location?.[2]?.trim() ?? '', state: location?.[3]?.toUpperCase() ?? '', zip: location?.[4] ?? '' };
}

function weightedConfidence(data: Pick<ParsedLoadDocument, 'fieldConfidence'>) {
  const critical = ['loadNumber', 'brokerName', 'pickupCity', 'pickupDate', 'deliveryCity', 'deliveryDate', 'rate'];
  const scores = critical.map(field => data.fieldConfidence[field]).filter((score): score is number => typeof score === 'number');
  if (!scores.length) return 0;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100;
}

function validateExtractedLoad(data: ParsedLoadDocument) {
  const issues: string[] = [];
  if (!data.loadNumber) issues.push('Load number was not found.');
  if (!data.brokerName) issues.push('Broker name was not found.');
  if (!data.pickupCity || !data.pickupState) issues.push('Pickup city and state need review.');
  if (!data.deliveryCity || !data.deliveryState) issues.push('Delivery city and state need review.');
  if (data.pickupDate && data.deliveryDate && data.deliveryDate < data.pickupDate) issues.push('Delivery date is before pickup date.');
  if (data.rate <= 0) issues.push('Rate was not found or is not valid.');
  if (data.weight < 0 || data.weight > 100_000) issues.push('Weight is outside the accepted range.');
  if (data.miles < 0 || data.miles > 10_000) issues.push('Mileage is outside the accepted range.');
  return issues;
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    return (await parser.getText()).text.trim();
  } finally {
    await parser.destroy();
  }
}

function buildResult(data: Omit<ParsedLoadDocument, 'documentType' | 'engine' | 'notes' | 'confidenceScore' | 'reviewRequired' | 'validationIssues'>, documentType: ExtractableDocumentType, engine: ExtractionEngine, fileName: string) {
  const base = {
    ...data,
    documentType,
    engine,
    confidenceScore: weightedConfidence(data),
    notes: `Extracted from ${fileName} using ${engine === 'google_document_ai' ? 'Google Document AI' : 'local text review'}. Review all fields before saving.`,
    reviewRequired: true,
    validationIssues: [],
  } satisfies ParsedLoadDocument;
  return { ...base, validationIssues: validateExtractedLoad(base) };
}

export async function parseLocalTextDocument(buffer: Buffer, contentType: string, documentType: ExtractableDocumentType, fileName: string): Promise<ParsedLoadDocument> {
  if (contentType !== 'application/pdf') throw new Error('Scanned images need Google Document AI. Configure the production extraction provider before parsing image paperwork.');
  const text = await extractPdfText(buffer);
  if (!text) throw new Error('No readable text was found. Use a clear original document or configure Google Document AI for OCR.');
  const pickup = parseStop(text, 'pickup');
  const delivery = parseStop(text, 'delivery');
  const pickupDateRaw = capture(text, /^pickup date\s*[:#-]?\s*([^\n]+)$/im);
  const deliveryDateRaw = capture(text, /^delivery date\s*[:#-]?\s*([^\n]+)$/im);
  const data: typeof EMPTY_LOAD = {
    ...EMPTY_LOAD,
    loadNumber: capture(text, /^(?:load|order|shipment)\s*(?:#|number|no\.?|id)?\s*[:#-]?\s*([a-z0-9-]{4,})/im).toUpperCase(),
    brokerName: capture(text, /^broker(?: name)?\s*[:#-]?\s*(.+)$/im),
    brokerContact: capture(text, /^broker contact\s*[:#-]?\s*(.+)$/im),
    brokerPhone: capture(text, /^broker phone\s*[:#-]?\s*(.+)$/im),
    brokerEmail: capture(text, /^broker email\s*[:#-]?\s*(\S+@\S+)$/im),
    brokerMC: capture(text, /^(?:broker\s+)?mc(?: number| no\.?)?\s*[:#-]?\s*([a-z0-9-]+)$/im),
    pickupFacility: pickup.facility, pickupCity: pickup.city, pickupState: pickup.state, pickupZip: pickup.zip, pickupDate: normalizeDate(pickupDateRaw), pickupTime: normalizeTime(pickupDateRaw),
    deliveryFacility: delivery.facility, deliveryCity: delivery.city, deliveryState: delivery.state, deliveryZip: delivery.zip, deliveryDate: normalizeDate(deliveryDateRaw), deliveryTime: normalizeTime(deliveryDateRaw),
    commodity: capture(text, /^commodity\s*[:#-]?\s*(.+)$/im),
    weight: parseAmount(capture(text, /^weight\s*[:#-]?\s*([\d,.]+)/im)),
    miles: parseAmount(capture(text, /^(?:miles|distance)\s*[:#-]?\s*([\d,.]+)/im)),
    rate: parseAmount(capture(text, /^(?:line haul|carrier pay|total rate|rate|amount)\s*[:#-]?\s*(\$?[\d,.]+)/im)),
    fieldConfidence: {},
  };
  for (const [field, value] of Object.entries(data)) {
    if (field !== 'fieldConfidence' && value !== '' && value !== 0) data.fieldConfidence[field] = 0.45;
  }
  return buildResult(data, documentType, 'local_text_review', fileName);
}

function getDocumentAiConfig() {
  const projectId = process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID?.trim();
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION?.trim() || 'us';
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();
  const processorVersion = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_VERSION?.trim();
  const serviceAccount = process.env.GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_JSON?.trim();
  return { projectId, location, processorId, processorVersion, serviceAccount, configured: Boolean(projectId && processorId && serviceAccount) };
}

export function isGoogleDocumentAiConfigured() {
  return getDocumentAiConfig().configured;
}

export async function parseGoogleDocumentAi(buffer: Buffer, contentType: string, documentType: ExtractableDocumentType, fileName: string): Promise<ParsedLoadDocument> {
  const config = getDocumentAiConfig();
  if (!config.configured || !config.projectId || !config.processorId || !config.serviceAccount) throw new Error('Google Document AI is not configured.');
  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(config.serviceAccount) as { client_email: string; private_key: string };
  } catch {
    throw new Error('GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  const client = new v1.DocumentProcessorServiceClient({ projectId: config.projectId, credentials, apiEndpoint: `${config.location}-documentai.googleapis.com`, fallback: true });
  const processorName = config.processorVersion
    ? `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}/processorVersions/${config.processorVersion}`
    : `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;
  try {
    const [result] = await client.processDocument({ name: processorName, rawDocument: { content: buffer.toString('base64'), mimeType: contentType }, skipHumanReview: true });
    const data: typeof EMPTY_LOAD = { ...EMPTY_LOAD, fieldConfidence: {} };
    const entities = (result.document?.entities ?? []) as GoogleEntity[];
    for (const entity of entities) {
      const field = ENTITY_ALIASES[normalizeFieldName(entity.type ?? '')];
      const value = entity.normalizedValue?.text?.trim() || entity.mentionText?.trim() || '';
      if (!field || !value) continue;
      const confidence = Math.max(0, Math.min(1, entity.confidence ?? 0));
      if (field === 'rate' || field === 'weight' || field === 'miles') data[field] = parseAmount(value);
      else if (field === 'pickupDate' || field === 'deliveryDate') data[field] = normalizeDate(value);
      else if (field === 'pickupTime' || field === 'deliveryTime') data[field] = normalizeTime(value);
      else if (field === 'loadNumber') data[field] = value.toUpperCase();
      else data[field] = value;
      data.fieldConfidence[field] = confidence;
    }
    return buildResult(data, documentType, 'google_document_ai', fileName);
  } finally {
    await client.close();
  }
}

export async function parseLoadDocument(input: { buffer: Buffer; contentType: string; documentType: ExtractableDocumentType; fileName: string }) {
  if (isGoogleDocumentAiConfigured()) return parseGoogleDocumentAi(input.buffer, input.contentType, input.documentType, input.fileName);
  return parseLocalTextDocument(input.buffer, input.contentType, input.documentType, input.fileName);
}
