import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import {
  authorizeUpload,
  createR2Client,
  createStorageKey,
  getR2Config,
  publicUrlForKey,
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

    const config = getR2Config();
    const client = createR2Client();
    if (!config.configured || !client) {
      if (process.env.VERCEL) {
        return NextResponse.json({ error: 'Paperwork storage is not configured for this deployment.' }, { status: 503 });
      }
      return NextResponse.json({ mode: 'server' });
    }

    const key = createStorageKey(upload);
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: upload.contentType,
    }), { expiresIn: 300 });

    return NextResponse.json({
      mode: 'direct',
      uploadUrl,
      url: publicUrlForKey(key),
      path: key,
      bucket: upload.bucket,
    });
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
