// ─── Supabase Storage Upload Utility ─────────────────────────────────────────
// Handles file uploads to Supabase Storage buckets
// Buckets needed in Supabase Dashboard:
//   - load-documents  (BOL, POD, Rate Con, Detention, Layover docs)
//   - carrier-documents  (CDL, Med Card, Insurance, etc.)
//   - message-attachments  (photos/docs sent in chat)
//   - cargo-photos  (pickup/delivery photos)
// All buckets: Public=true OR use signed URLs

import { supabase } from './supabaseClient';

export type StorageBucket =
  | 'load-documents'
  | 'carrier-documents'
  | 'message-attachments'
  | 'cargo-photos';

export interface UploadResult {
  url: string;
  path: string;
  bucket: StorageBucket;
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 * Falls back gracefully to base64 if Storage upload fails.
 */
export async function uploadFile(
  file: File,
  bucket: StorageBucket,
  pathPrefix: string = '',
): Promise<UploadResult> {
  // Build a unique path
  const ext = file.name.split('.').pop() || 'bin';
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
  const path = pathPrefix
    ? `${pathPrefix}/${timestamp}_${rand}_${safeName}`
    : `${timestamp}_${rand}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error(`Storage upload failed for bucket "${bucket}":`, error.message);
    // Fallback: return base64 data URL
    const base64Url = await fileToBase64(file);
    return { url: base64Url, path: '', bucket };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
    bucket,
  };
}

/**
 * Upload multiple files and return array of results
 */
export async function uploadFiles(
  files: File[],
  bucket: StorageBucket,
  pathPrefix: string = '',
): Promise<UploadResult[]> {
  return Promise.all(files.map(f => uploadFile(f, bucket, pathPrefix)));
}

/**
 * Delete a file from Supabase Storage by path
 */
export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  if (!path) return; // base64 fallback — nothing to delete
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error(`Storage delete failed for bucket "${bucket}" path "${path}":`, error.message);
  }
}

/**
 * Fallback: read file as base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get a signed URL for private bucket access (60 min expiry)
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path || path.startsWith('data:')) return path; // base64 fallback
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error('Failed to create signed URL:', error.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if a URL is a Supabase Storage URL (vs base64)
 */
export function isStorageUrl(url: string): boolean {
  return url.startsWith('http') && url.includes('supabase');
}
