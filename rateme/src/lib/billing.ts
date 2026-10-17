import 'server-only';
import type Stripe from 'stripe';
import { sql } from './db';
import type { Tx } from './db';
import { env } from './env';
import { audit } from './audit';
import { ensureQrCode } from './qr';
import { sendEmail, templates } from './email';
import { stripe } from './stripe';

type Obj = Record<string, any>;

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000) : null);
const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as Obj).id) : null);

function periodEnd(sub: Obj): Date | null {
  // Newer API versions moved the billing period onto subscription items.
  return ts(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end);
}

function subAmount(sub: Obj): { amount: number | null; currency: string | null } {
  const price = sub.items?.data?.[0]?.price ?? sub.plan;
  return { amount: price?.unit_amount ?? null, currency: price?.currency ?? null };
}

export type ProcessResult = 'processed' | 'duplicate' | 'ignored';

/**
 * Applies one verified Stripe event. Idempotent: the event id is claimed inside the same
 * transaction as its effects, so a redelivered event is a no-op and a failed one can retry.
 */
export async function processStripeEvent(event: Stripe.Event | Obj): Promise<ProcessResult> {
  const ev = event as Obj;
  return sql.begin(async (tx) => {
    const claimed = await tx`insert into stripe_events (id, type) values (${ev.id}, ${ev.type}) on conflict (id) do nothing returning id`;
    if (!claimed.length) {
      const [prev] = await tx<{ processed_at: Date | null }[]>`select processed_at from stripe_events where id = ${ev.id} for update`;
      if (prev?.processed_at) return 'duplicate' as const;
    }
    const outcome = await apply(tx, ev);
    await tx`update stripe_events set processed_at = now(), error = null where id = ${ev.id}`;
    return outcome;
  }) as Promise<ProcessResult>;
}

async function apply(tx: Tx, ev: Obj): Promise<ProcessResult> {
  const o = ev.data?.object as Obj;
  switch (ev.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return onCheckoutCompleted(tx, o, ev);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return onSubscription(tx, o, ev);
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return onInvoicePaid(tx, o);
    case 'invoice.payment_failed':
      return onInvoiceFailed(tx, o);
    case 'charge.refunded':
      return onRefund(tx, o);
    case 'charge.dispute.created':
      return onDispute(tx, o, true);
    case 'charge.dispute.closed':
      return onDispute(tx, o, o.status === 'lost');
    default:
      return 'ignored';
  }
}

async function onCheckoutCompleted(tx: Tx, s: Obj, ev: Obj): Promise<ProcessResult> {
  if (s.mode !== 'subscription') return 'ignored';
  if (!['paid', 'no_payment_required'].includes(s.payment_status)) return 'ignored'; // async methods confirm later
  const [cs] = await tx<{ business_id: string; user_id: string; plan_id: number }[]>`
    select business_id, user_id, plan_id from checkout_sessions where stripe_session_id = ${s.id}`;
  const businessId = cs?.business_id ?? s.metadata?.business_id;
  if (!businessId) return 'ignored';
  const subId = idOf(s.subscription);
  if (!subId) return 'ignored';
  await tx`update checkout_sessions set completed_at = coalesce(completed_at, now()) where stripe_session_id = ${s.id}`;
  await tx`
    insert into subscriptions (business_id, plan_id, purchaser_id, stripe_customer_id, stripe_subscription_id, status, amount_cents, currency, last_event_created)
    values (${businessId}, ${cs?.plan_id ?? (Number(s.metadata?.plan_id) || null)}, ${cs?.user_id ?? s.metadata?.user_id ?? null},
            ${idOf(s.customer)}, ${subId}, 'active', ${s.amount_total ?? null}, ${s.currency ?? 'eur'}, 0)
    on conflict (stripe_subscription_id) do update set
      stripe_customer_id = coalesce(subscriptions.stripe_customer_id, excluded.stripe_customer_id),
      purchaser_id = coalesce(subscriptions.purchaser_id, excluded.purchaser_id),
      plan_id = coalesce(subscriptions.plan_id, excluded.plan_id)`;
  await ensureQrCode(businessId, tx);
  await audit(cs?.user_id ?? null, 'membership.checkout_completed', 'business', businessId, { stripe_event: ev.id, subscription: subId }, tx);
  return 'processed';
}

async function onSubscription(tx: Tx, sub: Obj, ev: Obj): Promise<ProcessResult> {
  const businessId: string | undefined = sub.metadata?.business_id;
  const [existing] = await tx<{ id: string; business_id: string; last_event_created: string }[]>`
    select id, business_id, last_event_created from subscriptions where stripe_subscription_id = ${sub.id} for update`;
  if (!existing && !businessId) return 'ignored';
  // Out-of-order protection: never let an older event overwrite newer state.
  if (existing && Number(existing.last_event_created) > Number(ev.created)) return 'ignored';
  const { amount, currency } = subAmount(sub);
  const status = ev.type === 'customer.subscription.deleted' ? 'canceled' : String(sub.status);
  const end = periodEnd(sub);
  if (existing) {
    await tx`update subscriptions set
        status = ${status}, current_period_end = coalesce(${end}, current_period_end),
        cancel_at_period_end = ${!!sub.cancel_at_period_end}, canceled_at = ${ts(sub.canceled_at)},
        ended_at = ${ts(sub.ended_at)}, amount_cents = coalesce(${amount}, amount_cents), currency = coalesce(${currency}, currency),
        stripe_customer_id = coalesce(stripe_customer_id, ${idOf(sub.customer)}),
        last_event_created = ${ev.created}, updated_at = now()
      where id = ${existing.id}`;
  } else {
    await tx`insert into subscriptions (business_id, plan_id, purchaser_id, stripe_customer_id, stripe_subscription_id, status, amount_cents, currency,
               current_period_end, cancel_at_period_end, canceled_at, ended_at, last_event_created)
             values (${businessId!}, ${Number(sub.metadata?.plan_id) || null}, ${sub.metadata?.user_id || null}, ${idOf(sub.customer)}, ${sub.id}, ${status},
               ${amount}, ${currency}, ${end}, ${!!sub.cancel_at_period_end}, ${ts(sub.canceled_at)}, ${ts(sub.ended_at)}, ${ev.created})`;
  }
  const bid = existing?.business_id ?? businessId!;
  if (['active', 'trialing'].includes(status)) await ensureQrCode(bid, tx);
  await audit(null, `membership.subscription_${ev.type.split('.').pop()}`, 'business', bid, { status, cancel_at_period_end: !!sub.cancel_at_period_end, stripe_event: ev.id }, tx);
  return 'processed';
}

async function onInvoicePaid(tx: Tx, inv: Obj): Promise<ProcessResult> {
  const subId = idOf(inv.subscription ?? inv.parent?.subscription_details?.subscription);
  if (!subId) return 'ignored';
  const [sub] = await tx<{ id: string; business_id: string }[]>`select id, business_id from subscriptions where stripe_subscription_id = ${subId}`;
  const line = inv.lines?.data?.[0];
  const pEnd = ts(line?.period?.end ?? inv.period_end);
  await tx`insert into invoices (subscription_id, business_id, stripe_invoice_id, stripe_charge_id, amount_paid, currency, status, hosted_invoice_url, invoice_pdf, period_start, period_end)
           values (${sub?.id ?? null}, ${sub?.business_id ?? null}, ${inv.id}, ${idOf(inv.charge) ?? idOf(inv.payments?.data?.[0]?.payment?.charge)},
                   ${inv.amount_paid ?? 0}, ${inv.currency ?? 'eur'}, 'paid', ${inv.hosted_invoice_url ?? null}, ${inv.invoice_pdf ?? null},
                   ${ts(line?.period?.start ?? inv.period_start)}, ${pEnd})
           on conflict (stripe_invoice_id) do update set status = 'paid', amount_paid = excluded.amount_paid,
             hosted_invoice_url = excluded.hosted_invoice_url, invoice_pdf = excluded.invoice_pdf,
             stripe_charge_id = coalesce(excluded.stripe_charge_id, invoices.stripe_charge_id)`;
  if (sub) {
    await tx`update subscriptions set payment_failed_at = null,
               current_period_end = greatest(coalesce(current_period_end, ${pEnd}), coalesce(${pEnd}, current_period_end)),
               status = case when status in ('past_due','incomplete') then 'active' else status end, updated_at = now()
             where id = ${sub.id}`;
  }
  return 'processed';
}

async function onInvoiceFailed(tx: Tx, inv: Obj): Promise<ProcessResult> {
  const subId = idOf(inv.subscription ?? inv.parent?.subscription_details?.subscription);
  if (!subId) return 'ignored';
  const [sub] = await tx<{ id: string; business_id: string; name: string; email: string | null }[]>`
    with u as (
      update subscriptions set payment_failed_at = now(), updated_at = now()
      where stripe_subscription_id = ${subId} returning id, business_id, purchaser_id
    )
    select u.id, u.business_id, b.name, usr.email
    from u join businesses b on b.id = u.business_id left join users usr on usr.id = u.purchaser_id`;
  if (!sub) return 'ignored';
  await tx`insert into invoices (subscription_id, business_id, stripe_invoice_id, amount_paid, currency, status, hosted_invoice_url)
           values (${sub.id}, ${sub.business_id}, ${inv.id}, 0, ${inv.currency ?? 'eur'}, 'payment_failed', ${inv.hosted_invoice_url ?? null})
           on conflict (stripe_invoice_id) do update set status = case when invoices.status = 'paid' then 'paid' else 'payment_failed' end`;
  await audit(null, 'membership.payment_failed', 'business', sub.business_id, { invoice: inv.id }, tx);
  if (sub.email) await sendEmail({ to: sub.email, template: 'payment_failed', ...templates.paymentFailed(sub.name, `${env.appUrl}/dashboard/b/${sub.business_id}/membership`) });
  return 'processed';
}

async function subscriptionForCharge(tx: Tx, chargeId: string | null, customerId: string | null) {
  if (chargeId) {
    const [r] = await tx<{ id: string; business_id: string }[]>`
      select s.id, s.business_id from invoices i join subscriptions s on s.id = i.subscription_id where i.stripe_charge_id = ${chargeId}`;
    if (r) return r;
  }
  if (customerId) {
    const [r] = await tx<{ id: string; business_id: string }[]>`
      select id, business_id from subscriptions where stripe_customer_id = ${customerId} order by created_at desc limit 1`;
    if (r) return r;
  }
  return null;
}

async function onRefund(tx: Tx, charge: Obj): Promise<ProcessResult> {
  // Only a full refund ends membership; partial refunds (e.g. goodwill credits) do not.
  if (!charge.refunded) return 'ignored';
  const sub = await subscriptionForCharge(tx, charge.id, idOf(charge.customer));
  if (!sub) return 'ignored';
  await tx`update subscriptions set refunded_at = now(), updated_at = now() where id = ${sub.id}`;
  await audit(null, 'membership.refunded', 'business', sub.business_id, { charge: charge.id }, tx);
  return 'processed';
}

async function onDispute(tx: Tx, dispute: Obj, suspend: boolean): Promise<ProcessResult> {
  const chargeId = idOf(dispute.charge);
  let customerId: string | null = idOf(dispute.customer);
  if (!customerId && chargeId && typeof dispute.charge === 'object') customerId = idOf((dispute.charge as Obj).customer);
  let sub = await subscriptionForCharge(tx, chargeId, customerId);
  if (!sub && chargeId && env.stripeSecretKey) {
    try {
      const ch = await stripe().charges.retrieve(chargeId);
      sub = await subscriptionForCharge(tx, chargeId, idOf(ch.customer));
    } catch { /* fall through */ }
  }
  if (!sub) return 'ignored';
  await tx`update subscriptions set disputed_at = ${suspend ? new Date() : null}, updated_at = now() where id = ${sub.id}`;
  await audit(null, suspend ? 'membership.payment_disputed' : 'membership.dispute_won', 'business', sub.business_id, { dispute: dispute.id }, tx);
  return 'processed';
}
