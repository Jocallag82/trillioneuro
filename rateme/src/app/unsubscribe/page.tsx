import type { Metadata } from 'next';
import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { unsubscribeToken } from '@/lib/notify';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

const valid = (e: string, t: string) => {
  const a = Buffer.from(unsubscribeToken(e)); const b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
};

async function unsubscribe(form: FormData) {
  'use server';
  const e = String(form.get('e') ?? '').trim().toLowerCase().slice(0, 200); const t = String(form.get('t') ?? '');
  if (!e || !valid(e, t)) redirect('/unsubscribe?bad=1');
  await sql`insert into email_suppressions (email, reason, scope, source) values (${e}, 'unsubscribed', 'non_essential', 'link')
            on conflict (email) do nothing`;
  await sql`update users set digest_opt_out = true where email = ${e}`;
  redirect('/unsubscribe?done=1');
}

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ e?: string; t?: string; done?: string; bad?: string }> }) {
  const sp = await searchParams;
  const e = (sp.e ?? '').toLowerCase();
  return (
    <div className="container-x py-16"><div className="mx-auto max-w-lg">
      <h1 className="text-3xl font-semibold">Unsubscribe</h1>
      {sp.done ? <div className="mt-6"><Notice kind="ok">Done. We won’t send this address invitations, summaries or reminders. Essential messages about an account or payment you hold may still be sent.</Notice></div>
        : sp.bad || !e || !valid(e, sp.t ?? '') ? <div className="mt-6"><Notice kind="error">This link is invalid or incomplete. Use the link from the email, or contact us to be removed.</Notice></div>
        : (
          <form action={unsubscribe} className="card mt-6 p-6">
            <input type="hidden" name="e" value={e} /><input type="hidden" name="t" value={sp.t} />
            <p>Stop non-essential emails from RateMe.ie to <strong className="break-all">{e}</strong>?</p>
            <SubmitButton className="btn btn-primary mt-4" pendingText="Unsubscribing…">Unsubscribe</SubmitButton>
          </form>
        )}
    </div></div>
  );
}
