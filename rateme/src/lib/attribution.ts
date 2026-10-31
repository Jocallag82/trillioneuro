import 'server-only';
import { sql } from './db';
import type { User } from './auth';

export const normPartnerCode = (c: unknown) => String(c ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

/** Records the first-touch source for a business. Never overwrites; ignores self-referrals. */
export async function attributeClaim(businessId: string, user: User, claimToken?: string | null) {
  if (!claimToken) claimToken = (await sql<{ t: string | null }[]>`select signup_claim_token t from users where id = ${user.id}`)[0]?.t;
  if (claimToken && /^[A-Za-z0-9_-]{16,64}$/.test(claimToken)) {
    const [p] = await sql<{ campaign_id: number | null; status: string }[]>`
      select campaign_id, status from outreach_prospects where claim_token = ${claimToken} and business_id = ${businessId}`;
    if (p) {
      await sql`insert into business_attribution (business_id, source, campaign_id, user_id) values (${businessId}, 'campaign', ${p.campaign_id}, ${user.id})
                on conflict (business_id) do nothing`;
      if (['not_contacted', 'contacted', 'interested'].includes(p.status))
        await sql`update outreach_prospects set status = 'claim_started', updated_at = now() where business_id = ${businessId}`;
      return 'campaign';
    }
  }
  const [u] = await sql<{ ref_code: string | null }[]>`select ref_code from users where id = ${user.id}`;
  if (!u?.ref_code) return null;
  const [partner] = await sql<{ id: number; user_id: string | null; contact_email: string | null }[]>`
    select id, user_id, contact_email from partners where code = ${u.ref_code} and active`;
  if (!partner) return null;
  if (partner.user_id === user.id || (partner.contact_email && partner.contact_email.toLowerCase() === user.email.toLowerCase())) return 'self_referral_ignored';
  await sql`insert into business_attribution (business_id, source, partner_id, user_id) values (${businessId}, 'partner', ${partner.id}, ${user.id})
            on conflict (business_id) do nothing`;
  return 'partner';
}

/**
 * Commission is earned only on a business's FIRST paid invoice, and only while that subscription
 * hasn't been refunded or disputed. Figures are gross amounts as charged by Stripe.
 */
export async function partnerReport() {
  return sql<{ id: number; code: string; name: string; kind: string; active: boolean; reward: { type: string; value?: number };
    referred: number; claimed: number; paying: number; first_payments_cents: number }[]>`
    with firsts as (
      select distinct on (i.business_id) i.business_id, i.amount_paid, s.refunded_at, s.disputed_at
      from invoices i join subscriptions s on s.id = i.subscription_id
      where i.status = 'paid' and i.amount_paid > 0 order by i.business_id, i.created_at)
    select p.id, p.code, p.name, p.kind, p.active, p.reward,
      (select count(*)::int from users u where u.ref_code = p.code) referred,
      count(a.business_id)::int claimed,
      count(f.business_id) filter (where f.refunded_at is null and f.disputed_at is null)::int paying,
      coalesce(sum(f.amount_paid) filter (where f.refunded_at is null and f.disputed_at is null), 0)::int first_payments_cents
    from partners p left join business_attribution a on a.partner_id = p.id left join firsts f on f.business_id = a.business_id
    group by p.id order by p.created_at desc`;
}

export function rewardDue(reward: { type: string; value?: number }, firstPaymentsCents: number, paying: number) {
  if (reward.type === 'percent_first_payment') return { cents: Math.round(firstPaymentsCents * (Number(reward.value ?? 0) / 100)), text: `${reward.value}% of first payment` };
  if (reward.type === 'free_months') return { months: paying * Number(reward.value ?? 0), text: `${reward.value} free month(s) per paying referral` };
  return { text: 'No reward configured' };
}
