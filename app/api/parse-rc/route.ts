import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { lucia } from '@/lib/lucia';
import {
  MAX_DOCUMENT_EXTRACTION_BYTES,
  parseLoadDocument,
  type ExtractableDocumentType,
} from '@/lib/documentExtraction';

export const runtime = 'nodejs';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  try {
    const sessionId = cookies().get(lucia.sessionCookieName)?.value;
    if (!sessionId) return NextResponse.json({ success: false, error: 'Sign in to parse documents.' }, { status: 401 });

    const { user } = await lucia.validateSession(sessionId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Dispatcher authorization required.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ success: false, error: 'No document uploaded.' }, { status: 400 });
    }
    if (file.size > MAX_DOCUMENT_EXTRACTION_BYTES) {
      return NextResponse.json({ success: false, error: 'Parser files must be 15 MB or smaller.' }, { status: 413 });
    }
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ success: false, error: 'Use a PDF, JPG, PNG, or WEBP document.' }, { status: 415 });
    }

    const documentType: ExtractableDocumentType = formData.get('documentType') === 'bol' ? 'bol' : 'rate_confirmation';
    const data = await parseLoadDocument({
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      documentType,
      fileName: file.name,
    });
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error('Document extraction error:', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error processing document.' }, { status: 500 });
  }
}
