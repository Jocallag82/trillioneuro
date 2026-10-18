import Link from 'next/link';
import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { publicPlan } from '@/lib/membership';
import { paymentsStatus } from '@/lib/env';
import { sql } from '@/lib/db';
import { formatDate, formatEuro } from '@/lib/format';
import { BizNav, StatusSteps } from '../BizNav';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { MEMBER_BENEFITS } from '@/components/MembershipCard';
import { startCheckout, openBillingPortal, setCancelAtPeriodEnd } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Membership' };

const STATE_TEXT: Record<string, string> = {
  none: 'No membership yet', active: 'Active', cancelling: 'Active — won’t renew', grace: 'Payment overdue — grace period', expired: 'Expired', suspended: 'Suspended (refund or payment dispute)',
};

export default async function Membership({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ verified?: string; checkout?: string; err?: string; msg?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/membership`);
  const [plan, pay] = [await publicPlan(), paymentsStatus()];
  const invoices = await sql<{ stripe_invoice_id: string; amount_paid: number; currency: string; status: string; hosted_invoice_url: string | null; created_at: Date; period_end: Date | null }[]>`
    select stripe_invoice_id, amount_paid, currency, status, hosted_invoice_url, created_at, period_end from invoices where business_id = ${id} order by created_at desc limit 20`;
  const pendingCheckout = sp.checkout === 'success' && !ctx.ent.active;
  const e = ctx.ent;
  return (
    <div>
      <BizNav ctx={ctx} active="membership" />
      <StatusSteps ctx={ctx} />
      <div className="mt-6 space-y-3">
        {sp.verified && <Notice kind="ok">Ownership verified — your listing is live. Choose membership to unlock your QR code and member tools.</Notice>}
        {pendingCheckout && <Notice kind="info">Thanks! We’re waiting for confirmation from our payment provider. This usually takes a few seconds — refresh this page shortly. Membership activates only once payment is confirmed.</Notice>}
        {sp.checkout === 'cancelled' && <Notice kind="warn">Checkout was cancelled. You haven’t been charged.</Notice>}
        {sp.err && <Notice kind="error">{sp.err}</Notice>}
        {sp.msg && <Notice kind="ok">{sp.msg}</Notice>}
        {pay.mode === 'test' && <Notice kind="warn"><strong>Test mode:</strong> payments use the provider’s test environment. No real money is taken.</Notice>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-6">
          <h2 className="font-sans text-lg font-bold tracking-normal">Membership status</h2>
          <p className="display mt-2 text-3xl">{STATE_TEXT[e.state]}</p>
          {e.renewsOrEndsAt && (
            <p className="mt-2 text-ink-2">
              {e.state === 'active' && <>Renews on <strong>{formatDate(e.renewsOrEndsAt)}</strong>{e.amountCents ? ` at ${formatEuro(e.amountCents)}` : ''}. We’ll remind you before it renews.</>}
              {e.state === 'cancelling' && <>Ends on <strong>{formatDate(e.renewsOrEndsAt)}</strong>. You won’t be charged again.</>}
              {e.state === 'grace' && <>Please update your payment details before <strong>{formatDate(e.renewsOrEndsAt)}</strong> to keep member tools.</>}
              {e.state === 'expired' && <>Ended on {formatDate(e.renewsOrEndsAt)}.</>}
            </p>
          )}
          {e.subscriptionId && e.state !== 'expired' && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(e.state === 'active' || e.state === 'cancelling') && (
                <form action={setCancelAtPeriodEnd}>
                  <input type="hidden" name="id" value={id} /><input type="hidden" name="cancel" value={e.state === 'active' ? 'yes' : 'no'} />
                  <SubmitButton className="btn btn-ghost" pendingText="Updating…">{e.state === 'active' ? 'Cancel future renewal' : 'Resume renewal'}</SubmitButton>
                </form>
              )}
              {e.stripeCustomerId && <form action={openBillingPortal}><input type="hidden" name="id" value={id} /><SubmitButton className="btn btn-ghost" pendingText="Opening…">Payment details & invoices</SubmitButton></form>}
            </div>
          )}

          {(!e.active || e.state === 'expired') && plan && (
            <div className="mt-6 rounded-2xl bg-paper p-5">
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1"><span className="display text-4xl">{formatEuro(plan.amount_cents)}</span> <span className="text-muted">per {plan.billing_interval}, billed annually</span></p>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-2">{MEMBER_BENEFITS.map((x) => <li key={x}>✓ {x}</li>)}</ul>
              {!ctx.verified ? (
                <div className="mt-4"><Notice kind="warn">Verify ownership first. <Link className="underline" href={`/dashboard/b/${id}/verify`}>Verify now</Link></Notice></div>
              ) : !pay.enabled ? (
                <div className="mt-4"><Notice kind="warn">Online payment isn’t switched on yet. {pay.reason}</Notice></div>
              ) : (
                <form action={startCheckout} className="mt-5 space-y-3">
                  <input type="hidden" name="id" value={id} />
                  <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="agree" value="yes" required className="mt-0.5 h-4 w-4 accent-[#1d4a35]" />
                    <span>I agree to the <Link className="text-sea underline" href="/membership-terms" target="_blank">membership terms</Link>, including automatic annual renewal until I cancel, and I understand membership doesn’t affect ratings.</span></label>
                  <SubmitButton className="btn btn-primary w-full text-base" pendingText="Opening secure checkout…">Continue to secure payment</SubmitButton>
                  <p className="text-xs text-muted">You’ll pay on Stripe’s secure checkout page. We never see or store your card details.</p>
                </form>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card p-5 text-sm leading-relaxed text-ink-2">
            <h3 className="font-sans text-base font-bold tracking-normal text-ink">If membership ends</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your public profile and all legitimate reviews <strong>stay visible</strong>. We never delete reviews because a business stops paying.</li>
              <li>Your printed QR codes <strong>keep working</strong> — customers can still rate you.</li>
              <li>Member tools pause: QR downloads, profile editing, replying to reviews and activity insights.</li>
              <li>You can still dispute reviews that break our policy — that’s free for every verified owner.</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="font-sans text-base font-bold tracking-normal">Payment history</h3>
            {invoices.length ? (
              <ul className="mt-2 divide-y divide-line text-sm">
                {invoices.map((i) => (
                  <li key={i.stripe_invoice_id} className="flex items-center justify-between gap-2 py-2">
                    <span>{formatDate(i.created_at)} · {formatEuro(i.amount_paid)} · {i.status === 'paid' ? 'Paid' : 'Payment failed'}</span>
                    {i.hosted_invoice_url && <a className="text-sea underline" href={i.hosted_invoice_url} target="_blank" rel="noopener">Invoice</a>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">No payments yet.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
