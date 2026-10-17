import 'server-only';
import { sql } from './db';
import type { Tx } from './db';

import { decideEntitlement, type SubRow, type Entitlement } from './entitlement';
export type { Entitlement, MembershipState } from './entitlement';

export async function graceDays(tx?: Tx): Promise<number> {
  const q = tx ?? sql;
  const [s] = await q<{ value: { grace_days?: number } }[]>`select value from settings where key = 'membership'`;
  return Number(s?.value?.grace_days ?? 14);
}

export async function getEntitlement(businessId: string): Promise<Entitlement> {
  const [sub] = await sql<SubRow[]>`
    select s.id, s.status, s.current_period_end, s.cancel_at_period_end, s.refunded_at, s.disputed_at, s.ended_at,
           s.stripe_customer_id, s.amount_cents, p.name plan_name
    from subscriptions s left join plans p on p.id = s.plan_id
    where s.business_id = ${businessId}
    order by (s.status in ('active','trialing','past_due')) desc, s.created_at desc limit 1`;
  return decideEntitlement(sub, await graceDays());
}

export async function activeMemberIds(businessIds: string[]): Promise<Set<string>> {
  if (!businessIds.length) return new Set();
  const days = await graceDays();
  const rows = await sql<{ business_id: string }[]>`
    select distinct business_id from subscriptions
    where business_id = any(${businessIds}::uuid[]) and refunded_at is null and disputed_at is null
      and (
        (status in ('active','trialing') and (current_period_end is null or current_period_end + make_interval(days => ${days}) > now()))
        or (status = 'past_due' and current_period_end + make_interval(days => ${days}) > now())
      )`;
  return new Set(rows.map((r) => r.business_id));
}

export type Plan = { id: number; code: string; name: string; description: string | null; amount_cents: number; currency: string; billing_interval: string; is_founding: boolean; active: boolean };

export async function publicPlan(): Promise<Plan | null> {
  const [p] = await sql<Plan[]>`
    select p.* from plans p
    where p.active and p.code = coalesce((select value->>'public_plan' from settings where key = 'membership'), p.code)
    order by p.sort_order limit 1`;
  if (p) return p;
  const [fallback] = await sql<Plan[]>`select * from plans where active order by sort_order limit 1`;
  return fallback ?? null;
}
