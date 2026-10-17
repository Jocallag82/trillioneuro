// Fails if any server secret (or secret-shaped string) appears in the browser bundle.
// Run after `next build`. Uses the values from the current environment / .env.local.
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), '.next', 'static');
if (!fs.existsSync(root)) { console.error('Run `next build` first.'); process.exit(1); }
const envFile = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const fromFile = Object.fromEntries(envFile.split('\n').filter((l) => l.includes('=')).map((l) => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()]));
const NAMES = ['DATABASE_URL', 'APP_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'CRON_SECRET'];
const values = NAMES.map((n) => process.env[n] || fromFile[n]).filter((v) => v && v.length >= 8);
const patterns = [/sk_(live|test)_[A-Za-z0-9]{8,}/, /whsec_[A-Za-z0-9]{8,}/, /re_[A-Za-z0-9]{20,}/, /postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/];
const hits = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return walk(p);
  const text = fs.readFileSync(p, 'utf8');
  for (const v of values) if (text.includes(v)) hits.push(`${p}: contains a configured secret value`);
  for (const re of patterns) if (re.test(text)) hits.push(`${p}: matches ${re}`);
  for (const n of NAMES) if (text.includes(n)) hits.push(`${p}: references ${n}`);
});
walk(root);
if (hits.length) { console.error('Secret exposure found:\n' + hits.join('\n')); process.exit(1); }
console.log(`OK — scanned ${root}; no secrets or secret names in client bundles (${values.length} configured values checked).`);
