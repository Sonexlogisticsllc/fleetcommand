import { createClient } from '@libsql/client';

const databaseUrl = process.env.TURSO_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('TURSO_DATABASE_URL is required to inspect remote tables.');
}

const client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

client.execute("SELECT name FROM sqlite_master WHERE type='table'")
  .then(result => console.log('TABLES:', JSON.stringify(result.rows)))
  .catch(error => console.error('FAILED:', error instanceof Error ? error.message : String(error)));
