import { execSync } from 'node:child_process';
import postgres from 'postgres';

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL || 'postgres://rateme:rateme@localhost:5432/rateme_test';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('E2E tests only run against a local database');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`drop schema if exists rateme cascade`;
  await sql.end();
  execSync('node scripts/migrate.mjs', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}
