import Link from 'next/link';
import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { sql } from '@/lib/db';
import { isContested, getOrCreateChallenge, validDomain } from '@/lib/verification';
import { FREE_EMAIL_DOMAINS, emailDomain } from '@/lib/util';
import { BizNav, StatusSteps } from '../BizNav';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { verifyByAccountEmail, sendBusinessEmail, checkDomain, requestManual } from './actions';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Verify ownership' };

export default async function Verify({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/verify`, { allowPending: true });
  const b = ctx.business;
  if (ctx.verified) {
    return (<div><BizNav ctx={ctx} active="verify" /><StatusSteps ctx={ctx} />
      <div className="mt-6"><Notice kind="ok">Ownership verified. <Link className="underline" href={`/dashboard/b/${id}/membership`}>Next: membership</Link></Notice></div></div>);
  }
  const contested = await isContested(b.id, ctx.user.id);
  const domain = validDomain(b.website_domain) ? b.website_domain : null;
  const accountDomain = emailDomain(ctx.user.email);
  const accountMatches = !!domain && !FREE_EMAIL_DOMAINS.has(accountDomain) && (accountDomain === domain || accountDomain.endsWith(`.${domain}`));
  const pending = await sql<{ id: string; method: string; status: string; target: string | null; created_at: Date; decision_notes: string | null }[]>`
    select id, method, status, target, created_at, decision_notes from verification_requests where member_id = ${ctx.member.id} order by created_at desc limit 5`;
  const manualOpen = pending.find((p) => p.method === 'manual' && p.status === 'pending');
  const lastRejected = pending.find((p) => p.status === 'rejected');
  const dnsCh = domain && !contested ? await getOrCreateChallenge(b.id, ctx.member.id, ctx.user.id, 'dns_txt', domain) : null;
  const fileCh = domain && !contested ? await getOrCreateChallenge(b.id, ctx.member.id, ctx.user.id, 'website_file', domain) : null;

  return (
    <div>
      <BizNav ctx={ctx} active="verify" />
      <StatusSteps ctx={ctx} />
      <div className="mt-6 space-y-3">
        {sp.msg && <Notice kind="ok">{sp.msg}</Notice>}
        {sp.err && <Notice kind="error">{sp.err}</Notice>}
        {lastRejected && <Notice kind="warn">A previous verification attempt wasn’t approved{lastRejected.decision_notes ? `: ${lastRejected.decision_notes}` : ''}.</Notice>}
      </div>
      <h2 className="mt-8 text-2xl font-semibold">Verify that you own or manage {b.name}</h2>
      <p className="mt-2 max-w-2xl text-ink-2">This protects businesses from impostors. Paying for membership never verifies ownership on its own.
        {contested && ' This listing already has a verified owner, so we need to check your request manually and may contact the existing owner.'}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {!contested && domain && (
          <section className="card p-5">
            <p className="badge badge-sea">Fastest</p>
            <h3 className="mt-2 font-sans text-lg font-bold tracking-normal">Business email at {domain}</h3>
            {accountMatches ? (
              <>
                <p className="mt-1 text-sm text-ink-2">Your confirmed account email <strong>{ctx.user.email}</strong> is at the business’s website domain.</p>
                <form action={verifyByAccountEmail} className="mt-4"><input type="hidden" name="id" value={b.id} /><SubmitButton pendingText="Verifying…">Verify with my account email</SubmitButton></form>
              </>
            ) : (
              <form action={sendBusinessEmail} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={b.id} />
                <p className="text-sm text-ink-2">We’ll send a link to an address at <strong>@{domain}</strong>. Open it while signed in to this account.</p>
                <div className="flex items-center gap-1"><input name="local" className="input" placeholder="info" required maxLength={64} pattern="[A-Za-z0-9._%+\-]+" aria-label="Email name before the @" /><span className="shrink-0 text-ink-2">@{domain}</span></div>
                <SubmitButton pendingText="Sending…">Send verification link</SubmitButton>
              </form>
            )}
          </section>
        )}
        {!contested && domain && dnsCh && fileCh && (
          <section className="card p-5">
            <h3 className="font-sans text-lg font-bold tracking-normal">Website or domain check</h3>
            <p className="mt-1 text-sm text-ink-2">Prove control of <strong>{domain}</strong> with <em>one</em> of these, then press check:</p>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
              <li>Add a DNS <strong>TXT</strong> record on {domain}:<code className="mt-1 block break-all rounded-lg bg-paper p-2">rateme-verification={dnsCh.challenge}</code></li>
              <li>Or upload a file to <code className="break-all">https://{domain}/.well-known/rateme-verification.txt</code> containing:<code className="mt-1 block break-all rounded-lg bg-paper p-2">{fileCh.challenge}</code></li>
            </ol>
            <form action={checkDomain} className="mt-4"><input type="hidden" name="id" value={b.id} /><SubmitButton className="btn btn-ink" pendingText="Checking…">Check now</SubmitButton></form>
          </section>
        )}
        <section className="card p-5 lg:col-span-2">
          <h3 className="font-sans text-lg font-bold tracking-normal">{domain && !contested ? 'No business email or website? Manual check' : 'Manual verification'}</h3>
          {manualOpen ? (
            <p className="mt-2 text-sm text-ink-2">Your request from {formatDate(manualOpen.created_at)} is with our team. We aim to respond within 2 working days.</p>
          ) : (
            <form action={requestManual} className="mt-3 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={b.id} />
              <label className="field sm:col-span-2"><span className="label">How are you connected to the business?</span>
                <textarea name="evidence" className="textarea" required minLength={20} maxLength={2000} placeholder="e.g. I’m the sole trader / director. Our CRO number is… You can see my name on our Facebook page… Our Google listing shows the same phone number." /></label>
              <label className="field"><span className="label">Business phone we can call</span><input name="phone" className="input" required maxLength={30} inputMode="tel" /><span className="hint">Ideally the number customers use. We may call to confirm.</span></label>
              <label className="field"><span className="label">CRO / RBN number <span className="font-normal text-muted">(optional)</span></span><input name="cro" className="input" maxLength={20} defaultValue={b.cro_number ?? ''} /></label>
              <div className="sm:col-span-2"><SubmitButton pendingText="Sending…">Request manual verification</SubmitButton></div>
            </form>
          )}
          <p className="mt-3 text-xs text-muted">Sole traders without a website are welcome — manual checks use public records such as the CRO register, your existing online presence and a call-back.</p>
        </section>
      </div>
      {!domain && !contested && <p className="mt-4 text-sm text-muted">Tip: add your website on the listing to unlock instant email or domain verification. <Link className="underline" href="/contact">Contact us</Link> if your listing’s website is wrong.</p>}
    </div>
  );
}
