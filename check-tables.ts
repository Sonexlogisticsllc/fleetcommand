import { createClient } from '@libsql/client';
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
  .then(r => console.log('TABLES:', JSON.stringify(r.rows)))
  .catch(e => console.error('FAILED:', e.message));
