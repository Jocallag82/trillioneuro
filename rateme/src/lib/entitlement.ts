// Pure membership-entitlement policy (no I/O) — unit-tested.
export type MembershipState = 'none' | 'active' | 'cancelling' | 'grace' | 'expired' | 'suspended';

export type Entitlement = {
  active: boolean;
  state: MembershipState;
  renewsOrEndsAt: Date | null;
  subscriptionId: string | null;
  stripeCustomerId: string | null;
  amountCents: number | null;
  planName: string | null;
};

export type SubRow = {
  id: string; status: string; current_period_end: Date | null; cancel_at_period_end: boolean;
  refunded_at: Date | null; disputed_at: Date | null; ended_at: Date | null; stripe_customer_id: string | null;
  amount_cents: number | null; plan_name: string | null;
};

/** Pure decision function: kept separate so the policy is unit-tested. */
export function decideEntitlement(sub: SubRow | undefined, graceDays: number, now = new Date()): Entitlement {
  const base = { subscriptionId: sub?.id ?? null, stripeCustomerId: sub?.stripe_customer_id ?? null, amountCents: sub?.amount_cents ?? null, planName: sub?.plan_name ?? null };
  if (!sub) return { active: false, state: 'none', renewsOrEndsAt: null, ...base };
  const end = sub.current_period_end;
  if (sub.refunded_at || sub.disputed_at) return { active: false, state: 'suspended', renewsOrEndsAt: end, ...base };
  if (['active', 'trialing'].includes(sub.status)) {
    // Stripe keeps status "active" until the period ends; guard against a missed deletion event too.
    if (end && end.getTime() + graceDays * 86400000 < now.getTime()) return { active: false, state: 'expired', renewsOrEndsAt: end, ...base };
    return { active: true, state: sub.cancel_at_period_end ? 'cancelling' : 'active', renewsOrEndsAt: end, ...base };
  }
  if (sub.status === 'past_due') {
    const graceEnd = end ? new Date(end.getTime() + graceDays * 86400000) : null;
    if (graceEnd && graceEnd > now) return { active: true, state: 'grace', renewsOrEndsAt: graceEnd, ...base };
    return { active: false, state: 'expired', renewsOrEndsAt: end, ...base };
  }
  return { active: false, state: 'expired', renewsOrEndsAt: sub.ended_at ?? end, ...base };
}

