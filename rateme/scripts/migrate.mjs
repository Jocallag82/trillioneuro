// Applies migrations/*.sql in order, once each, inside a transaction per file.
// Usage: DATABASE_URL=postgres://… node scripts/migrate.mjs
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'migrations');

try {
  await sql`create schema if not exists rateme`;
  await sql`create table if not exists rateme.schema_migrations (version text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select version from rateme.schema_migrations`).map((r) => r.version));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into rateme.schema_migrations (version) values (${file}) on conflict do nothing`;
    });
    console.log('applied', file);
  }
  console.log('migrations up to date');
} catch (e) {
  console.error('migration failed:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
