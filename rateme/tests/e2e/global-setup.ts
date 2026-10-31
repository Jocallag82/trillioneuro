import { execSync } from 'node:child_process';
import postgres from 'postgres';
import http from 'node:http';

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL || 'postgres://rateme:rateme@localhost:5432/rateme_test';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('E2E tests only run against a local database');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`drop schema if exists rateme cascade`;
  await sql.end();
  execSync('node scripts/migrate.mjs', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
  // Local stand-in for the Anthropic Messages API: no real calls, no cost. Echoes the tone it was asked for.
  const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const tone = /Tone: (\w+)/.exec(body)?.[1] ?? 'Professional';
      const leaked = /@|087/.test(body) ? ' LEAK' : '';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', stop_reason: 'end_turn', stop_sequence: null,
        content: [{ type: 'text', text: `Thank you for your feedback. We take your concern seriously and would like to put it right. Please contact us at [contact details]. (${tone} draft${leaked})` }],
        usage: { input_tokens: 420, output_tokens: 90 } }));
    });
  });
  await new Promise<void>((r) => mock.listen(3299, r));
  return async () => { mock.close(); };
}
