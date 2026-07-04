import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = readFileSync('./drizzle/0000_tranquil_expediter.sql', 'utf-8');
const statements = sql.split('-->').filter(s => s.trim().length > 0);

async function run() {
  for (const stmt of statements) {
    const clean = stmt.replace(/statement-breakpoint/g, '').trim();
    if (clean.length === 0) continue;
    try {
      await client.execute(clean);
      console.log('OK:', clean.slice(0, 60).replace(/\n/g, ' '));
    } catch (e) {
      console.error('FAILED:', clean.slice(0, 60).replace(/\n/g, ' '), '-->', e.message);
    }
  }
  console.log('Done.');
}

run();
