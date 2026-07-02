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
 * Compresses an image file on the client side using HTML Canvas.
 * Downscales images larger than maxW/maxH and encodes at specified JPEG quality.
 */
export function compressImage(
  file: File,
  maxW = 1600,
  maxH = 1600,
  quality = 0.8,
): Promise<File | Blob> {
  return new Promise((resolve) => {
    // Only compress images (exclude SVG, GIF, etc. if needed, but JPEG/PNG are primary targets)
    if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale maintaining aspect ratio
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality,
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 * Automatically compresses image files client-side before uploading.
 * Falls back gracefully to base64 if Storage upload fails.
 */
export async function uploadFile(
  file: File,
  bucket: StorageBucket,
  pathPrefix: string = '',
): Promise<UploadResult> {
  // Compress images to save storage and user bandwidth
  let fileToUpload: File | Blob = file;
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file);
    } catch (e) {
      console.warn('Image compression failed, uploading original:', e);
    }
  }

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
    .upload(path, fileToUpload, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error(`Storage upload failed for bucket "${bucket}":`, error.message);
    // Fallback: return base64 data URL (read the original file or compressed one)
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
