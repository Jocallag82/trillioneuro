import crypto from 'node:crypto';
import postgres from 'postgres';
import Stripe from 'stripe';
import type { Page, APIRequestContext } from '@playwright/test';

export const TEST_DB = process.env.TEST_DATABASE_URL || 'postgres://rateme:rateme@localhost:5432/rateme_test';
export const db = postgres(TEST_DB, { max: 2, onnotice: () => {}, connection: { search_path: 'rateme,extensions,public' } });
export const WEBHOOK_SECRET = 'whsec_e2e_test_secret';

export function scrypt(pw: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function createUser(email: string, password: string, role = 'user', name = 'E2E User') {
  const [u] = await db<{ id: string }[]>`insert into users (email, password_hash, display_name, role, email_verified_at)
    values (${email}, ${scrypt(password)}, ${name}, ${role}, now()) on conflict (email) do update set role = excluded.role returning id`;
  return u.id;
}

export async function emailLink(to: string, template: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const [m] = await db<{ body_text: string }[]>`select body_text from email_outbox where to_email = ${to} and template = ${template} order by created_at desc limit 1`;
    const link = m?.body_text.match(/http:\/\/localhost:3200\/\S+/)?.[0];
    if (link) return link.replace('http://localhost:3200', '');
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no ${template} email for ${to}`);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

export async function sendWebhook(request: APIRequestContext, event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return request.post('/api/stripe/webhook', { data: payload, headers: { 'stripe-signature': header, 'content-type': 'application/json' } });
}

export async function publishedBusiness(name: string, slug: string, opts: { website?: string } = {}) {
  const [b] = await db<{ id: string }[]>`
    insert into businesses (slug, name, category_id, county_id, locality_id, status, source, published_at, website, website_domain, description)
    select ${slug}, ${name}, (select id from categories where slug = 'bakeries'), co.id, (select id from localities where slug = 'kilkenny'), 'published', 'admin', now(),
      ${opts.website ?? null}, ${opts.website ? new URL(opts.website).hostname : null}, 'A family bakery used for automated tests.'
    from counties co where co.slug = 'kilkenny'
    on conflict (slug) do update set name = excluded.name returning id`;
  return b.id;
}

export async function fillReview(page: Page, o: { stars: number; title?: string; body?: string; name: string; email: string; ip?: string }) {
  // Each simulated reviewer comes from a different network unless the test says otherwise.
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': o.ip ?? `203.0.113.${Math.floor(Math.random() * 250) + 1}` });
  await page.getByLabel(new RegExp(`^${o.stars} star`)).check({ force: true });
  await page.getByLabel('When was your experience?').selectOption({ index: 2 });
  if (o.title) await page.getByLabel(/Headline/).fill(o.title);
  if (o.body) await page.getByLabel(/Your review/).fill(o.body);
  await page.getByLabel('Name to show publicly').fill(o.name);
  await page.getByLabel('Your email').fill(o.email);
  await page.getByRole('checkbox', { name: /I confirm this review is based on my own genuine experience/ }).check();
  await page.waitForTimeout(2600); // the form rejects sub-2.5s bot submissions
  await page.getByRole('button', { name: 'Submit review' }).click();
}
