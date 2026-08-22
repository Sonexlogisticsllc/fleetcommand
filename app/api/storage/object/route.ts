import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { authorizeStorageRead, createR2Client, getR2Config } from '@/lib/storageServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get('key') || '';
    const object = await authorizeStorageRead(key);
    const config = getR2Config();
    const client = createR2Client();

    if (config.configured && client) {
      const signedUrl = await getSignedUrl(client, new GetObjectCommand({
        Bucket: config.bucketName,
        Key: object.key,
      }), { expiresIn: 60 });
      const response = NextResponse.redirect(signedUrl, 307);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }

    if (!process.env.VERCEL) {
      const fileName = object.key.replace(/[\\/?%*:|"<>\s]/g, '_');
      const response = NextResponse.redirect(new URL(`/uploads/${object.bucket}/${fileName}`, request.url), 307);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }

    return NextResponse.json({ error: 'Paperwork storage is not configured.' }, { status: 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to access this document.';
    const status = message.includes('session has expired') ? 401 : message.includes('permission') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
