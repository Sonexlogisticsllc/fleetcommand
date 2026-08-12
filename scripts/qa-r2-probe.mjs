import { readFile } from 'node:fs/promises';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const required = [
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'NEXT_PUBLIC_CDN_URL',
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
const cdn = process.env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, '');
let body;
try {
  body = await readFile('scratch/e2e/qa-rate-confirmation.pdf');
} catch {
  body = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
}
const key = `qa-probe/${Date.now()}-rate-confirmation.pdf`;
const directKey = `qa-probe/${Date.now()}-direct-upload.pdf`;

async function waitForCors(url) {
  let response;
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://dispatch.sonexlogistics.com',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    if (response.headers.get('access-control-allow-origin') === 'https://dispatch.sonexlogistics.com') {
      return response;
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  return response;
}

try {
  await client.send(new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [{
        AllowedOrigins: ['https://dispatch.sonexlogistics.com', 'http://localhost:3000'],
        AllowedMethods: ['GET', 'HEAD', 'PUT'],
        AllowedHeaders: ['Content-Type'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      }],
    },
  }));
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/pdf' }));
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const publicResponse = await fetch(`${cdn}/${key}`, { cache: 'no-store' });
  const publicBody = Buffer.from(await publicResponse.arrayBuffer());

  const directUrl = await getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: directKey,
    ContentType: 'application/pdf',
  }), { expiresIn: 300 });
  const corsResponse = await waitForCors(directUrl);
  const directResponse = await fetch(directUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body,
  });

  const results = {
    authenticatedPut: true,
    storedBytes: Number(head.ContentLength),
    publicStatus: publicResponse.status,
    publicContentType: publicResponse.headers.get('content-type'),
    publicBytes: publicBody.length,
    publicBytesMatch: publicBody.equals(body),
    corsStatus: corsResponse.status,
    corsOrigin: corsResponse.headers.get('access-control-allow-origin'),
    corsMethods: corsResponse.headers.get('access-control-allow-methods'),
    corsHeaders: corsResponse.headers.get('access-control-allow-headers'),
    directPutStatus: directResponse.status,
  };
  console.log(JSON.stringify(results, null, 2));

  if (!results.publicBytesMatch || results.publicStatus !== 200 || !directResponse.ok) {
    throw new Error('Production storage probe failed.');
  }
  if (results.corsOrigin !== 'https://dispatch.sonexlogistics.com') {
    throw new Error('R2 CORS does not allow the production portal origin.');
  }
} finally {
  await Promise.allSettled([
    client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    client.send(new DeleteObjectCommand({ Bucket: bucket, Key: directKey })),
  ]);
  console.log('QA probe objects deleted.');
}
