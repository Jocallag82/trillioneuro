'use server';
import { redirect } from 'next/navigation';
import { sql } from './db';
import { ipRateLimit, looksAutomated } from './security';

const KINDS = ['access', 'erasure', 'rectification', 'objection', 'legal_removal', 'complaint'];

export async function submitRequest(form: FormData) {
  const back = String(form.get('back') ?? '') === '/contact' ? '/contact' : '/data-request';
  const email = String(form.get('email') ?? '').trim().slice(0, 200);
  const kind = String(form.get('kind') ?? '');
  const details = String(form.get('details') ?? '').trim().slice(0, 4000);
  if (looksAutomated(form) || !email.includes('@') || !KINDS.includes(kind) || details.length < 10) redirect(`${back}?error=${encodeURIComponent('Please fill in every field.')}`);
  if (!(await ipRateLimit('data-request', 5, 86400))) redirect(`${back}?error=${encodeURIComponent('Too many requests today.')}`);
  await sql`insert into data_requests (email, kind, details) values (${email}, ${kind}, ${details})`;
  redirect(`${back}?sent=1`);
}
