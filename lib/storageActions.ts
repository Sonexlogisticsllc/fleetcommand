'use server';

import {
  authorizeUpload,
  createStorageKey,
  removeStoredObject,
  storeUploadBuffer,
  validateUploadMetadata,
} from './storageServer';

export async function uploadFileAction(formData: FormData): Promise<{ url: string; path: string; bucket: string }> {
  const file = formData.get('file') as File;
  const bucket = formData.get('bucket') as string;
  const pathPrefix = formData.get('pathPrefix') as string;
  
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Choose a file before uploading.');
  const upload = validateUploadMetadata({
    bucket,
    contentType: file.type,
    fileName: file.name,
    pathPrefix,
    size: file.size,
  });
  await authorizeUpload(upload.bucket, upload.safePrefix);
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const result = await storeUploadBuffer(fileBuffer, upload, createStorageKey(upload));
  return {
    url: result.url,
    path: result.path,
    bucket: upload.bucket,
  };
}

export async function deleteFileFromStorage(key: string): Promise<void> {
  if (!key) return;
  try {
    const normalized = key.startsWith('/uploads/') ? key.replace(/^\/uploads\//, '') : key;
    const [bucket, loadId, documentSlot = ''] = normalized.split('/');
    if (!bucket || !loadId) return;
    await authorizeUpload(bucket, `${loadId}/${documentSlot}`);
    await removeStoredObject(key);
  } catch (err) {
    console.warn(`File deletion failed for "${key}":`, err);
  }
}
