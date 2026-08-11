'use server';

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';

const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'sonex-dispatch';
const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || '';

const isR2Configured = !!(endpoint && accessKeyId && secretAccessKey);
const allowedBuckets = new Set(['load-documents', 'cargo-photos']);
const maxUploadBytes = 20 * 1024 * 1024;

let s3Client: S3Client | null = null;
if (isR2Configured) {
  s3Client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
}

export async function uploadFileToStorage(
  fileBuffer: Buffer,
  contentType: string,
  bucket: string,
  safePath: string
): Promise<{ url: string; path: string }> {
  try {
    if (isR2Configured && s3Client) {
      const key = `${bucket}/${safePath}`;
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });
      
      await s3Client.send(command);
      
      const url = cdnUrl 
        ? `${cdnUrl.replace(/\/$/, '')}/${key}` 
        : `${endpoint.replace(/\/$/, '')}/${bucketName}/${key}`;
        
      return { url, path: key };
    } else {
      // Fallback: Save locally in public/uploads for local development
      const publicDir = path.join(process.cwd(), 'public');
      const uploadsDir = path.join(publicDir, 'uploads', bucket);
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const fileSafeName = safePath.replace(/[\/\\?%*:|"<>\s]/g, '_');
      const filePath = path.join(uploadsDir, fileSafeName);
      await fs.writeFile(filePath, fileBuffer);
      
      const localUrl = `/uploads/${bucket}/${fileSafeName}`;
      return { url: localUrl, path: localUrl };
    }
  } catch (err) {
    console.error('Storage upload failed:', err);
    throw new Error('The file could not be stored. Please retry or contact dispatch.');
  }
}

export async function uploadFileAction(formData: FormData): Promise<{ url: string; path: string; bucket: string }> {
  const file = formData.get('file') as File;
  const bucket = formData.get('bucket') as string;
  const pathPrefix = formData.get('pathPrefix') as string;
  
  if (!file || file.size === 0) throw new Error('Choose a file before uploading.');
  if (!allowedBuckets.has(bucket)) throw new Error('Unsupported upload destination.');
  if (file.size > maxUploadBytes) throw new Error('Files must be 20 MB or smaller.');
  
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
  const safePrefix = pathPrefix.replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/^\/+|\/+$/g, '');
  const safePath = safePrefix
    ? `${safePrefix}/${timestamp}_${rand}_${safeName}`
    : `${timestamp}_${rand}_${safeName}`;
    
  const result = await uploadFileToStorage(fileBuffer, file.type, bucket, safePath);
  return {
    url: result.url,
    path: result.path,
    bucket,
  };
}

export async function deleteFileFromStorage(key: string): Promise<void> {
  if (!key) return;
  
  try {
    if (isR2Configured && s3Client) {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      await s3Client.send(command);
    } else if (key.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), 'public', key.replace(/^\/+/, ''));
      await fs.unlink(filePath);
    }
  } catch (err) {
    console.warn(`File deletion failed for "${key}":`, err);
  }
}
