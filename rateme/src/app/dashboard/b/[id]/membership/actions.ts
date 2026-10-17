'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { env, paymentsStatus } from '@/lib/env';
import { loadBusinessCtx } from '@/lib/dashboard';
import { publicPlan } from '@/lib/membership';
import { stripe } from '@/lib/stripe';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/security';

const back = (id: string, k: 'err' | 'msg', m: string) => `/dashboard/b/${id}/membership?${k}=${encodeURIComponent(m)}`;

export async function startCheckout(form: FormData) {
  const id = String(form.get('id') ?? '');
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/membership`);
  if (!ctx.verified) redirect(back(id, 'err', 'Verify ownership before choosing membership.'));
  if (form.get('agree') !== 'yes') redirect(back(id, 'err', 'Please accept the membership terms.'));
  if (ctx.ent.active) redirect(back(id, 'msg', 'Membership is already active.'));
  if (!paymentsStatus().enabled) redirect(back(id, 'err', 'Payments are not available yet.'));
  if (!(await rateLimit(`checkout:${ctx.user.id}`, 10, 3600))) redirect(back(id, 'err', 'Too many checkout attempts. Try again later.'));
  const plan = await publicPlan();
  if (!plan) redirect(back(id, 'err', 'No membership plan is available right now.'));
  const [prev] = await sql<{ stripe_customer_id: string | null }[]>`select stripe_customer_id from subscriptions where business_id = ${id} and stripe_customer_id is not null order by created_at desc limit 1`;
  let url: string | null = null;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ quantity: 1, price_data: { currency: plan.currency, unit_amount: plan.amount_cents, recurring: { interval: plan.billing_interval as 'year' | 'month' },
        product_data: { name: plan.name, metadata: { plan_code: plan.code } } } }],
      ...(prev?.stripe_customer_id ? { customer: prev.stripe_customer_id } : { customer_email: ctx.user.email }),
      client_reference_id: id,
      metadata: { business_id: id, plan_id: String(plan.id), user_id: ctx.user.id },
      subscription_data: { metadata: { business_id: id, plan_id: String(plan.id), user_id: ctx.user.id }, description: `RateMe.ie membership — ${ctx.business.name}` },
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      ...(env.stripeAutomaticTax ? { automatic_tax: { enabled: true } } : {}),
      locale: 'en',
      success_url: `${env.appUrl}/dashboard/b/${id}/membership?checkout=success`,
      cancel_url: `${env.appUrl}/dashboard/b/${id}/membership?checkout=cancelled`,
    });
    await sql`insert into checkout_sessions (stripe_session_id, business_id, user_id, plan_id) values (${session.id}, ${id}, ${ctx.user.id}, ${plan.id})`;
    await audit(ctx.user.id, 'membership.checkout_started', 'business', id, { plan: plan.code });
    url = session.url;
  } catch (e) {
    console.error('checkout failed', (e as Error).message);
    redirect(back(id, 'err', 'We couldn’t start checkout. Please try again in a moment.'));
  }
  if (!url) redirect(back(id, 'err', 'Checkout is unavailable.'));
  redirect(url);
}

export async function openBillingPortal(form: FormData) {
  const id = String(form.get('id') ?? '');
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/membership`);
  if (!ctx.ent.stripeCustomerId) redirect(back(id, 'err', 'No billing account found.'));
  let url: string | null = null;
  try {
    const s = await stripe().billingPortal.sessions.create({ customer: ctx.ent.stripeCustomerId, return_url: `${env.appUrl}/dashboard/b/${id}/membership` });
    url = s.url;
  } catch {
    redirect(back(id, 'err', 'The billing portal is unavailable right now.'));
  }
  redirect(url!);
}

export async function setCancelAtPeriodEnd(form: FormData) {
  const id = String(form.get('id') ?? '');
  const cancel = form.get('cancel') === 'yes';
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/membership`);
  const [sub] = await sql<{ stripe_subscription_id: string }[]>`select stripe_subscription_id from subscriptions where id = ${ctx.ent.subscriptionId}`;
  if (!sub) redirect(back(id, 'err', 'No subscription found.'));
  try {
    await stripe().subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: cancel });
  } catch {
    redirect(back(id, 'err', 'We couldn’t update your renewal. Please try again.'));
  }
  // The webhook is authoritative; reflect the request immediately so the page is accurate.
  await sql`update subscriptions set cancel_at_period_end = ${cancel}, updated_at = now() where id = ${ctx.ent.subscriptionId}`;
  await audit(ctx.user.id, cancel ? 'membership.cancel_requested' : 'membership.resume_requested', 'business', id);
  redirect(back(id, 'msg', cancel ? 'Your membership won’t renew. It stays active until the end of the current period.' : 'Automatic renewal is back on.'));
}
