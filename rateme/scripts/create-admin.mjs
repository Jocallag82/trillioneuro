// Promote an existing, email-verified account to admin (run once after first sign-up in production).
// Usage: DATABASE_URL=… node scripts/create-admin.mjs you@example.ie
import postgres from 'postgres';
const email = process.argv[2];
if (!process.env.DATABASE_URL || !email) { console.error('Usage: DATABASE_URL=… node scripts/create-admin.mjs <email>'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const r = await sql`update rateme.users set role = 'admin' where email = ${email.toLowerCase()} and email_verified_at is not null and status = 'active' returning id`;
console.log(r.length ? `Promoted ${email} to admin.` : 'No verified, active account with that email.');
await sql.end();
