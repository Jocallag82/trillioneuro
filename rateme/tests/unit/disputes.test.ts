// Integration tests: fair dispute workflow against a real Postgres test database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { sql } from '@/lib/db';
import { openReconfirmation, reconfirm, withdrawDisputed, processDisputeDeadlines, decideDispute, submitAppeal, decideAppeal } from '@/lib/disputes';
import { afterReviewerStandsBy, canAppeal, appealGrantedReviewStatus } from '@/lib/dispute-policy';

let businessId = '';
let ownerId = '';
let staffId = '';
let i = 0;

async function newReview() {
  const [r] = await sql<{ id: string }[]>`
    insert into reviews (business_id, rating, body, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status, published_at, is_test_data)
    values (${businessId}, 2, 'Slow service and the job was not finished.', date_trunc('month', now())::date, 'Test Reviewer',
            ${`reviewer${++i}-${Date.now()}@example.ie`}, ${`h${i}-${Date.now()}`}, now(), 'published', now(), true) returning id`;
  return r.id;
}
const disputeFor = async (reviewId: string) => (await sql<{ id: string; status: string; escalation_reason: string | null }[]>`select id, status, escalation_reason from disputes where review_id = ${reviewId} order by created_at desc limit 1`)[0];
const reviewStatus = async (id: string) => (await sql<{ status: string }[]>`select status from reviews where id = ${id}`)[0].status;
const open = (reviewId: string, reasonCode = 'not_a_customer', evidence: string | null = null) =>
  openReconfirmation({ reviewId, businessId, source: 'business', raisedBy: ownerId, reasonCode, allegation: 'We have no booking under this name in that month at all.', evidence });

beforeAll(async () => {
  execSync('node scripts/migrate.mjs', { env: { ...process.env }, stdio: 'ignore' });
  await sql`truncate rateme.disputes, rateme.appeals cascade`;
  // Many disputes for one test business; the 5-per-30-days cap is covered separately below.
  await sql`update settings set value = value || '{"max_per_business_per_30_days": 100}'::jsonb where key = 'disputes'`;
  const [u] = await sql<{ id: string }[]>`insert into users (email, password_hash, display_name, email_verified_at) values ('dispute-owner@example.ie', 'x', 'Owner', now())
    on conflict (email) do update set display_name = excluded.display_name returning id`;
  ownerId = u.id;
  const [s] = await sql<{ id: string }[]>`insert into users (email, password_hash, display_name, email_verified_at, role) values ('dispute-mod@example.ie', 'x', 'Mod', now(), 'moderator')
    on conflict (email) do update set display_name = excluded.display_name returning id`;
  staffId = s.id;
  const [b] = await sql<{ id: string }[]>`
    insert into businesses (slug, name, category_id, county_id, status, source, is_test_data)
    select 'dispute-test-biz', 'Dispute Test Biz', (select id from categories where slug = 'plumbers'), (select id from counties where slug = 'cork'), 'published', 'admin', true
    on conflict (slug) do update set name = excluded.name returning id`;
  businessId = b.id;
});
afterAll(async () => {
  await sql`update settings set value = value || '{"max_per_business_per_30_days": 5}'::jsonb where key = 'disputes'`;
  await sql.end();
});

describe('dispute policy (pure)', () => {
  it('unsupported allegation + reviewer stands by → review kept', () => {
    expect(afterReviewerStandsBy({ source: 'business', reasonCode: 'not_a_customer', evidence: null }).status).toBe('rejected');
  });
  it('evidence or policy allegations → human decision', () => {
    expect(afterReviewerStandsBy({ source: 'business', reasonCode: 'not_a_customer', evidence: 'Booking system export shows no job on that street in March.' }).status).toBe('escalated');
    expect(afterReviewerStandsBy({ source: 'reports', reasonCode: 'personal_info', evidence: null }).status).toBe('escalated');
  });
  it('appeal window and reversal', () => {
    expect(canAppeal({ status: 'upheld', appealUntil: new Date(Date.now() + 1000) })).toBe(true);
    expect(canAppeal({ status: 'upheld', appealUntil: new Date(Date.now() - 1000) })).toBe(false);
    expect(canAppeal({ status: 'escalated', appealUntil: new Date(Date.now() + 1000) })).toBe(false);
    expect(appealGrantedReviewStatus('upheld')).toBe('published');
    expect(appealGrantedReviewStatus('rejected')).toBe('removed');
  });
});

describe('fair dispute workflow', () => {
  it('reviewer silence escalates to a moderator and never removes the review', async () => {
    const rid = await newReview();
    expect((await open(rid)).ok).toBe(true);
    await sql`update disputes set deadline_at = now() - interval '1 minute' where review_id = ${rid}`;
    const res = await processDisputeDeadlines();
    expect(res.escalated).toBeGreaterThanOrEqual(1);
    const d = await disputeFor(rid);
    expect(d.status).toBe('escalated');
    expect(d.escalation_reason).toBe('no_response');
    expect(await reviewStatus(rid)).toBe('published');
  });

  it('sends one reminder before the deadline', async () => {
    const rid = await newReview();
    await open(rid);
    await sql`update disputes set deadline_at = now() + interval '2 days' where review_id = ${rid}`;
    const first = await processDisputeDeadlines();
    const second = await processDisputeDeadlines();
    expect(first.reminded).toBeGreaterThanOrEqual(1);
    expect(second.reminded).toBe(0);
  });

  it('reviewer standing by an unsupported allegation keeps the review and closes the dispute', async () => {
    const rid = await newReview();
    await open(rid);
    const r = await reconfirm((await disputeFor(rid)).id, 'I was there on the 3rd.');
    expect(r?.outcome).toBe('kept');
    expect((await disputeFor(rid)).status).toBe('rejected');
    expect(await reviewStatus(rid)).toBe('published');
  });

  it('evidence-backed dispute goes to a moderator even if the reviewer stands by it', async () => {
    const rid = await newReview();
    await open(rid, 'not_a_customer', 'Our booking system has no job at that address in that month; ref export attached on request.');
    const r = await reconfirm((await disputeFor(rid)).id, 'Paid in cash.');
    expect(r?.outcome).toBe('escalated');
    expect((await disputeFor(rid)).escalation_reason).toBe('contested_evidence');
  });

  it('reviewer can withdraw', async () => {
    const rid = await newReview();
    await open(rid);
    expect(await withdrawDisputed((await disputeFor(rid)).id)).toBe(true);
    expect(await reviewStatus(rid)).toBe('withdrawn');
  });

  it('blocks a second active dispute on the same review', async () => {
    const rid = await newReview();
    await open(rid);
    const again = await open(rid);
    expect(again.ok).toBe(false);
  });

  it('moderator decision is documented, appealable once, and a granted appeal reverses it', async () => {
    const rid = await newReview();
    await open(rid, 'harassment');
    const d = await disputeFor(rid);
    expect(await decideDispute({ disputeId: d.id, staffId, outcome: 'upheld', finding: 'The review names a staff member and makes a threat; removed under policy 4.' })).toBe(true);
    expect(await reviewStatus(rid)).toBe('removed');
    const short = await submitAppeal({ reviewId: rid, appellant: 'reviewer', userId: null, body: 'no' });
    expect(short.ok).toBe(false);
    const ok = await submitAppeal({ reviewId: rid, appellant: 'reviewer', userId: null, body: 'There was no threat; I said I would contact the CCPC, which is my right.' });
    expect(ok.ok).toBe(true);
    const dup = await submitAppeal({ reviewId: rid, appellant: 'reviewer', userId: null, body: 'Appealing again with the same complaint as before, please.' });
    expect(dup.ok).toBe(false);
    const [a] = await sql<{ id: string }[]>`select id from appeals where review_id = ${rid}`;
    await decideAppeal({ appealId: a.id, staffId, outcome: 'granted', notes: 'Reference to a regulator is not a threat.' });
    expect(await reviewStatus(rid)).toBe('published');
  });

  it('enforces the per-business dispute cap', async () => {
    await sql`update settings set value = value || '{"max_per_business_per_30_days": 1}'::jsonb where key = 'disputes'`;
    const res = await open(await newReview());
    await sql`update settings set value = value || '{"max_per_business_per_30_days": 100}'::jsonb where key = 'disputes'`;
    expect(res.ok).toBe(false);
  });

  it('a business cannot appeal another business’s dispute', async () => {
    const rid = await newReview();
    await open(rid, 'harassment');
    await decideDispute({ disputeId: (await disputeFor(rid)).id, staffId, outcome: 'rejected', finding: 'No abusive language found; this is a negative but fair review.' });
    const res = await submitAppeal({ reviewId: rid, appellant: 'business', userId: ownerId, businessId: '00000000-0000-0000-0000-000000000000', body: 'We think the review is unfair and should be removed now.' });
    expect(res.ok).toBe(false);
  });
});
