import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import path from 'path';
import { promises as fs } from 'fs';
import { db } from '@/db/client';
import { loads } from '@/db/schema';
import { lucia } from '@/lib/lucia';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_BUCKETS = new Set(['load-documents', 'cargo-photos']);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface ValidatedUpload {
  bucket: string;
  contentType: string;
  safeName: string;
  safePrefix: string;
}

export function getR2Config() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT?.trim() || '';
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() || '';
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() || '';
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || 'sonex-dispatch';
  const publicAssetUrl = process.env.NEXT_PUBLIC_CDN_URL?.trim() || process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim() || '';

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicAssetUrl,
    configured: Boolean(endpoint && accessKeyId && secretAccessKey),
  };
}

export function createR2Client() {
  const config = getR2Config();
  if (!config.configured) return null;
  return new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function validateUploadMetadata(input: {
  bucket: string;
  contentType?: string;
  fileName: string;
  pathPrefix: string;
  size: number;
}): ValidatedUpload {
  const { bucket, fileName, pathPrefix, size } = input;
  const normalizedType = (input.contentType || '').toLowerCase();
  const extension = path.extname(fileName).toLowerCase();
  const genericBinaryType = normalizedType === 'application/octet-stream';

  if (!ALLOWED_BUCKETS.has(bucket)) throw new Error('Unsupported upload destination.');
  if (!Number.isFinite(size) || size <= 0) throw new Error('Choose a file before uploading.');
  if (size > MAX_UPLOAD_BYTES) throw new Error('Files must be 20 MB or smaller.');
  if (!allowedExtensions.has(extension) || (normalizedType && !genericBinaryType && !allowedMimeTypes.has(normalizedType))) {
    throw new Error('Use a PDF, JPG, PNG, WEBP, HEIC, or HEIF file.');
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const safePrefix = pathPrefix.replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/^\/+|\/+$/g, '');
  if (!safePrefix) throw new Error('A load is required before uploading paperwork.');

  return {
    bucket,
    contentType: normalizedType || 'application/octet-stream',
    safeName,
    safePrefix,
  };
}

export async function authorizeUpload(bucket: string, safePrefix: string) {
  const [loadId, documentSlot] = safePrefix.split('/');
  const sessionId = cookies().get(lucia.sessionCookieName)?.value;
  if (!sessionId) throw new Error('Your session has expired. Please sign in again.');

  const { user } = await lucia.validateSession(sessionId);
  if (!user) throw new Error('Your session has expired. Please sign in again.');

  const [load] = await db
    .select({ carrierId: loads.carrierId })
    .from(loads)
    .where(eq(loads.id, loadId))
    .limit(1);
  if (!load) throw new Error('This load no longer exists. Refresh the page and try again.');
  if (user.role === 'admin') return;
  if (user.role !== 'carrier' || user.carrierId !== load.carrierId) {
    throw new Error('You do not have permission to upload paperwork for this load.');
  }
  if (bucket === 'load-documents' && !['bol', 'bolUrl', 'pod', 'podUrl'].includes(documentSlot ?? '')) {
    throw new Error('Carriers can upload BOL and POD paperwork only.');
  }
}

export function createStorageKey(upload: ValidatedUpload) {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${upload.bucket}/${upload.safePrefix}/${timestamp}_${rand}_${upload.safeName}`;
}

export function publicUrlForKey(key: string) {
  const { publicAssetUrl } = getR2Config();
  if (!publicAssetUrl) {
    throw new Error('Paperwork storage is missing its public delivery URL. Set NEXT_PUBLIC_CDN_URL in Vercel before uploading.');
  }
  return `${publicAssetUrl.replace(/\/$/, '')}/${key}`;
}

export async function storeUploadBuffer(buffer: Buffer, upload: ValidatedUpload, key: string) {
  const config = getR2Config();
  const client = createR2Client();
  if (config.configured && client) {
    await client.send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: upload.contentType,
    }));
    return { url: publicUrlForKey(key), path: key };
  }

  if (process.env.VERCEL) {
    throw new Error('Paperwork storage is not configured for this deployment. Contact the Sonex administrator.');
  }

  const publicDir = path.join(process.cwd(), 'public');
  const localName = key.replace(/[\\/?%*:|"<>\s]/g, '_');
  const localDir = path.join(publicDir, 'uploads', upload.bucket);
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(path.join(localDir, localName), buffer);
  const localUrl = `/uploads/${upload.bucket}/${localName}`;
  return { url: localUrl, path: key };
}

export async function removeStoredObject(key: string) {
  const config = getR2Config();
  const client = createR2Client();
  if (config.configured && client) {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
    return;
  }
  const localPath = key.startsWith('/uploads/')
    ? path.join(process.cwd(), 'public', key.replace(/^\/+/, ''))
    : path.join(
        process.cwd(),
        'public',
        'uploads',
        key.split('/')[0],
        key.replace(/[\\/?%*:|"<>\s]/g, '_'),
      );
  await fs.unlink(localPath);
}
