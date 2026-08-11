import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';

const migrations = [
  ['0001_remove_carrier_documents', 'drizzle/0001_remove_carrier_documents.sql'],
  ['0002_add_tms_operations', 'drizzle/0002_add_tms_operations.sql'],
  ['0003_add_load_dispatch_assignments', 'drizzle/0003_add_load_dispatch_assignments.sql'],
  ['0004_add_driver_pay_profiles', 'drizzle/0004_add_driver_pay_profiles.sql'],
];

const databaseUrl = process.env.TURSO_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('TURSO_DATABASE_URL is required for a production database migration.');
}

const client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function statements(sql) {
  return sql
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean);
}

async function run() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __sonex_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const [id, file] of migrations) {
    const applied = await client.execute({
      sql: 'SELECT id FROM __sonex_migrations WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (applied.rows.length) {
      console.log(`Skipping ${id}; already applied.`);
      continue;
    }

    const sql = await readFile(path.resolve(process.cwd(), file), 'utf8');
    for (const statement of statements(sql)) {
      await client.execute(statement);
    }
    await client.execute({
      sql: 'INSERT INTO __sonex_migrations (id) VALUES (?)',
      args: [id],
    });
    console.log(`Applied ${id}.`);
  }
}

run().catch(error => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
});
