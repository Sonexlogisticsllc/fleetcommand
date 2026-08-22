import { readFile } from 'node:fs/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const required = [
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Production storage is missing: ${missing.join(', ')}`);

const client = new S3Client({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
let body;
try {
  body = await readFile('scratch/e2e/qa-rate-confirmation.pdf');
} catch {
  body = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
}
const key = `qa-probe/${Date.now()}-rate-confirmation.pdf`;

try {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/pdf' }));
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const stored = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const storedBody = Buffer.from(await stored.Body.transformToByteArray());

  const results = {
    authenticatedPut: true,
    storedBytes: Number(head.ContentLength),
    storedContentType: stored.ContentType,
    storedBytesMatch: storedBody.equals(body),
  };
  console.log(JSON.stringify(results, null, 2));

  if (!results.storedBytesMatch || results.storedBytes !== body.length || results.storedContentType !== 'application/pdf') {
    throw new Error('Production storage probe failed.');
  }
} finally {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log('QA probe objects deleted.');
}
