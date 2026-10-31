import 'server-only';
import QRCode from 'qrcode';
import { sql } from './db';
import { env } from './env';
import { randomToken } from './util';

export const OUTREACH_STATUSES = {
  not_contacted: 'Not contacted', contacted: 'Contacted', interested: 'Interested', claim_started: 'Claim started',
  claimed_free: 'Claimed free', paid: 'Paid', not_interested: 'Not interested', do_not_contact: 'Do not contact',
} as const;
export type OutreachStatus = keyof typeof OUTREACH_STATUSES;

/** Real state always wins over the manual label once a claim or payment exists. */
export function effectiveStatus(manual: string | null, claimPending: boolean, verified: boolean, paying: boolean): OutreachStatus {
  if (manual === 'do_not_contact') return 'do_not_contact';
  if (paying) return 'paid';
  if (verified) return 'claimed_free';
  if (claimPending) return 'claim_started';
  return (manual as OutreachStatus) ?? 'not_contacted';
}

export const claimLink = (token: string) => `${env.appUrl}/claim/${token}`;
export const claimQrSvg = (token: string) => QRCode.toString(claimLink(token), { type: 'svg', margin: 2, errorCorrectionLevel: 'Q', color: { dark: '#10202BFF', light: '#FFFFFFFF' } });

export async function ensureClaimToken(businessId: string, userId: string) {
  await sql`insert into outreach_prospects (business_id, updated_by) values (${businessId}, ${userId}) on conflict (business_id) do nothing`;
  const [p] = await sql<{ claim_token: string | null }[]>`select claim_token from outreach_prospects where business_id = ${businessId}`;
  if (p.claim_token) return p.claim_token;
  const t = randomToken(18).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  await sql`update outreach_prospects set claim_token = ${t}, updated_at = now() where business_id = ${businessId} and claim_token is null`;
  return (await sql<{ claim_token: string }[]>`select claim_token from outreach_prospects where business_id = ${businessId}`)[0].claim_token;
}

const paidSub = sql`exists(select 1 from subscriptions s where s.business_id = b.id and s.status in ('active','trialing','past_due') and s.refunded_at is null and s.disputed_at is null)`;
export const prospectColumns = sql`b.id, b.name, b.slug, b.status, b.phone, b.public_email, co.name county, c.name category, b.rating_count,
  p.status manual_status, p.campaign_id, p.contact_name, p.contact_phone, p.notes, p.last_contact_at, p.next_action, p.next_action_at, p.claim_token,
  exists(select 1 from business_members m where m.business_id = b.id and m.status = 'pending') claim_pending,
  exists(select 1 from business_members m where m.business_id = b.id and m.status = 'verified') verified,
  ${paidSub} paying`;

export type ProspectRow = { id: string; name: string; slug: string; status: string; phone: string | null; public_email: string | null; county: string; category: string;
  rating_count: number; manual_status: string | null; campaign_id: number | null; contact_name: string | null; contact_phone: string | null; notes: string | null;
  last_contact_at: Date | null; next_action: string | null; next_action_at: Date | null; claim_token: string | null; claim_pending: boolean; verified: boolean; paying: boolean };

export async function campaignReport() {
  return sql<{ id: number; name: string; channel: string; active: boolean; prospects: number; contacted: number; claims: number; verified: number; paid: number; revenue_cents: number }[]>`
    select c.id, c.name, c.channel, c.active,
      count(p.business_id)::int prospects,
      count(p.business_id) filter (where p.status not in ('not_contacted'))::int contacted,
      (select count(*)::int from business_attribution a where a.campaign_id = c.id) claims,
      (select count(*)::int from business_attribution a where a.campaign_id = c.id and exists(select 1 from business_members m where m.business_id = a.business_id and m.status = 'verified')) verified,
      (select count(distinct a.business_id)::int from business_attribution a join subscriptions s on s.business_id = a.business_id
         where a.campaign_id = c.id and s.status in ('active','trialing','past_due') and s.refunded_at is null and s.disputed_at is null) paid,
      (select coalesce(sum(i.amount_paid), 0)::int from business_attribution a join invoices i on i.business_id = a.business_id join subscriptions s on s.id = i.subscription_id
         where a.campaign_id = c.id and i.status = 'paid' and s.refunded_at is null) revenue_cents
    from outreach_campaigns c left join outreach_prospects p on p.campaign_id = c.id
    group by c.id order by c.created_at desc`;
}
