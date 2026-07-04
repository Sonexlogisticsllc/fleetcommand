// â”€â”€â”€ Cloudflare R2 Storage & CDN Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Handles file uploads to Cloudflare R2 S3-compatible buckets with local static fallbacks.
// Replaces Supabase Storage calls.

import { uploadFileAction, deleteFileFromStorage } from './storageActions';

export type StorageBucket =
  | 'load-documents'
  | 'carrier-documents'
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
 * Upload a file via Server Action and return its URL.
 * Automatically compresses image files client-side before uploading.
 */
export async function uploadFile(
  file: File,
  bucket: StorageBucket,
  pathPrefix: string = '',
): Promise<UploadResult> {
  let fileToUpload: File | Blob = file;
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file);
    } catch (e) {
      console.warn('Image compression failed, uploading original:', e);
    }
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('bucket', bucket);
  formData.append('pathPrefix', pathPrefix);

  const result = await uploadFileAction(formData);
  return {
    url: result.url,
    path: result.path,
    bucket: result.bucket as StorageBucket,
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
 * Delete a file from Storage by path
 */
export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  if (!path) return;
  await deleteFileFromStorage(path);
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
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if a URL is a remote Storage URL
 */
export function isStorageUrl(url: string): boolean {
  return url.startsWith('http') && (url.includes('r2') || url.includes('cloudflarestorage') || url.includes('cdn'));
}

/**
 * Maps a URL to its responsive CDN version with image resizing query parameters.
 * If the image is loaded from our R2 bucket CDN worker, it appends the resizing query.
 * For local uploads or base64, it returns the original URL unchanged.
 */
export function getResizedImageUrl(url: string, width = 800): string {
  if (!url || url.startsWith('data:')) return url;
  
  if (url.startsWith('http')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}`;
  }
  
  return url;
}

