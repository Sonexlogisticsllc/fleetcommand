import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import path from 'path';
import { promises as fs } from 'fs';
import { db } from '@/db/client';
import { loads } from '@/db/schema';
import { lucia, validateSonexSession } from '@/lib/lucia';

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

const mimeByExtension: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

export interface ValidatedUpload {
  bucket: string;
  contentType: string;
  safeName: string;
  safePrefix: string;
}

function safeStoragePrefix(pathPrefix: string) {
  const segments = pathPrefix.split('/').filter(Boolean);
  if (segments.length !== 2 || segments.some(segment => !/^[a-zA-Z0-9_-]{1,128}$/.test(segment))) {
    throw new Error('A valid load and document type are required before uploading paperwork.');
  }
  return segments.join('/');
}

function sniffContentType(buffer: Buffer): string | null {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}

export function getR2Config() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT?.trim() || '';
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() || '';
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() || '';
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || 'sonex-dispatch';
  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
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
  const safePrefix = safeStoragePrefix(pathPrefix);

  return {
    bucket,
    contentType: normalizedType || 'application/octet-stream',
    safeName,
    safePrefix,
  };
}

/** Rejects files whose bytes do not match the declared filename and MIME type. */
export function validateUploadContent(buffer: Buffer, upload: ValidatedUpload): ValidatedUpload {
  const expectedType = mimeByExtension[path.extname(upload.safeName).toLowerCase()];
  const detectedType = sniffContentType(buffer);
  if (!expectedType || !detectedType || expectedType !== detectedType) {
    throw new Error('The selected file does not match its declared document type.');
  }
  if (upload.contentType !== 'application/octet-stream' && upload.contentType !== detectedType) {
    throw new Error('The selected file type does not match its contents.');
  }
  return { ...upload, contentType: detectedType };
}

export function parseStorageKey(key: string) {
  const normalized = key.replace(/^\/+/, '');
  const [bucket, loadId, documentSlot, ...fileParts] = normalized.split('/');
  if (!ALLOWED_BUCKETS.has(bucket) || !/^[a-zA-Z0-9_-]{1,128}$/.test(loadId || '') || !/^[a-zA-Z0-9_-]{1,128}$/.test(documentSlot || '') || !fileParts.length || fileParts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid storage object.');
  }
  return { key: normalized, bucket, loadId, documentSlot };
}

async function getAuthorizedLoad(loadId: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value;
  if (!sessionId) throw new Error('Your session has expired. Please sign in again.');

  const { user } = await validateSonexSession(sessionId);
  if (!user) throw new Error('Your session has expired. Please sign in again.');

  const [load] = await db.select({ carrierId: loads.carrierId, mcOwnerId: loads.mcOwnerId }).from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) throw new Error('This load no longer exists. Refresh the page and try again.');
  if (user.role === 'admin') return { user, load };
  if (user.role === 'mc_owner' && user.mcOwnerId && user.mcOwnerId === load.mcOwnerId) return { user, load };
  if (user.role !== 'carrier' || user.carrierId !== load.carrierId) {
    throw new Error('You do not have permission to access paperwork for this load.');
  }
  return { user, load };
}

export async function authorizeUpload(bucket: string, safePrefix: string) {
  if (!ALLOWED_BUCKETS.has(bucket)) throw new Error('Unsupported upload destination.');
  const [loadId, documentSlot] = safeStoragePrefix(safePrefix).split('/');
  const { user } = await getAuthorizedLoad(loadId);
  if (user.role !== 'carrier') return;
  if (bucket === 'load-documents' && !['bol', 'bolUrl', 'pod', 'podUrl'].includes(documentSlot ?? '')) {
    throw new Error('Carriers can upload BOL and POD paperwork only.');
  }
}

export async function authorizeStorageRead(key: string) {
  const parsed = parseStorageKey(key);
  await getAuthorizedLoad(parsed.loadId);
  return parsed;
}

export function createStorageKey(upload: ValidatedUpload) {
  const timestamp = Date.now();
  const rand = randomUUID().slice(0, 12);
  return `${upload.bucket}/${upload.safePrefix}/${timestamp}_${rand}_${upload.safeName}`;
}

export function storageUrlForKey(key: string) {
  return `/api/storage/object?key=${encodeURIComponent(parseStorageKey(key).key)}`;
}

export function secureStoredUrl(value: string | null | undefined) {
  if (!value || value.startsWith('/api/storage/object?')) return value || undefined;
  let candidate = value.replace(/^\/uploads\//, '');
  try {
    candidate = new URL(value).pathname.replace(/^\/+/, '');
  } catch {
    // Local storage URLs are handled above.
  }
  try {
    return storageUrlForKey(candidate);
  } catch {
    return value;
  }
}

export async function storeUploadBuffer(buffer: Buffer, upload: ValidatedUpload, key: string) {
  const validatedUpload = validateUploadContent(buffer, upload);
  const object = parseStorageKey(key);
  if (object.bucket !== validatedUpload.bucket || `${object.loadId}/${object.documentSlot}` !== validatedUpload.safePrefix) {
    throw new Error('Upload destination does not match the selected load.');
  }
  const config = getR2Config();
  const client = createR2Client();
  if (config.configured && client) {
    await client.send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: object.key,
      Body: buffer,
      ContentType: validatedUpload.contentType,
    }));
    return { url: storageUrlForKey(object.key), path: object.key };
  }

  if (process.env.VERCEL) {
    throw new Error('Paperwork storage is not configured for this deployment. Contact the Sonex administrator.');
  }

  const publicDir = path.join(process.cwd(), 'public');
  const localName = object.key.replace(/[\\/?%*:|"<>\s]/g, '_');
  const localDir = path.join(publicDir, 'uploads', validatedUpload.bucket);
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(path.join(localDir, localName), buffer);
  return { url: storageUrlForKey(object.key), path: object.key };
}

export async function removeStoredObject(key: string) {
  const object = parseStorageKey(key);
  const config = getR2Config();
  const client = createR2Client();
  if (config.configured && client) {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: object.key }));
    return;
  }
  const localPath = path.join(
    process.cwd(),
    'public',
    'uploads',
    object.bucket,
    object.key.replace(/[\\/?%*:|"<>\s]/g, '_'),
  );
  await fs.unlink(localPath);
}
