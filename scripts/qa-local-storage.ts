import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_UPLOAD_BYTES,
  createStorageKey,
  removeStoredObject,
  storeUploadBuffer,
  validateUploadContent,
  validateUploadMetadata,
} from '../lib/storageServer';

async function main() {
  delete process.env.VERCEL;
  delete process.env.CLOUDFLARE_R2_ENDPOINT;
  delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  const source = await readFile(path.join(process.cwd(), 'scratch', 'e2e', 'qa-rate-confirmation.pdf'));
  const upload = validateUploadMetadata({
    bucket: 'load-documents',
    contentType: 'application/pdf',
    fileName: 'QA Rate Confirmation.pdf',
    pathPrefix: 'load-local-qa-001/ratConUrl',
    size: source.length,
  });
  const key = createStorageKey(upload);
  const verifiedUpload = validateUploadContent(source, upload);

  try {
    const stored = await storeUploadBuffer(source, verifiedUpload, key);
    assert.match(stored.url, /^\/api\/storage\/object\?key=/);
    assert.equal(stored.path, key);
    const localName = key.replace(/[\\/?%*:|"<>\s]/g, '_');
    const localBytes = await readFile(path.join(process.cwd(), 'public', 'uploads', upload.bucket, localName));
    assert.deepEqual(localBytes, source);

    assert.throws(() => validateUploadMetadata({
      bucket: 'carrier-documents',
      contentType: 'application/pdf',
      fileName: 'license.pdf',
      pathPrefix: 'load-local-qa-001/bol',
      size: 10,
    }), /Unsupported upload destination/);
    assert.throws(() => validateUploadMetadata({
      bucket: 'load-documents',
      contentType: 'text/plain',
      fileName: 'payload.exe',
      pathPrefix: 'load-local-qa-001/bol',
      size: 10,
    }), /Use a PDF/);
    assert.throws(() => validateUploadMetadata({
      bucket: 'load-documents',
      contentType: 'application/pdf',
      fileName: 'too-large.pdf',
      pathPrefix: 'load-local-qa-001/bol',
      size: MAX_UPLOAD_BYTES + 1,
    }), /20 MB or smaller/);
    assert.throws(() => validateUploadMetadata({
      bucket: 'load-documents',
      contentType: 'application/pdf',
      fileName: 'rate.pdf',
      pathPrefix: '../outside',
      size: 10,
    }), /valid load and document type/);
    assert.throws(() => validateUploadContent(Buffer.from('not a PDF'), upload), /does not match/);

    console.log(`Local storage QA passed (${source.length} bytes round-tripped).`);
  } finally {
    await removeStoredObject(key);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
