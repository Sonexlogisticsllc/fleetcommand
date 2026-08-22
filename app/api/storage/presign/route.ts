import { NextResponse } from 'next/server';
import {
  authorizeUpload,
  validateUploadMetadata,
} from '@/lib/storageServer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const upload = validateUploadMetadata({
      bucket: String(body.bucket || ''),
      contentType: String(body.contentType || ''),
      fileName: String(body.fileName || ''),
      pathPrefix: String(body.pathPrefix || ''),
      size: Number(body.size),
    });
    await authorizeUpload(upload.bucket, upload.safePrefix);

    // Compatibility endpoint: browser-signed PUTs are intentionally disabled.
    // All uploads now pass through the server action for byte-level validation.
    return NextResponse.json({ mode: 'server' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The upload could not be prepared.';
    const status = message.includes('session has expired')
      ? 401
      : message.includes('permission') || message.startsWith('Carriers can')
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
