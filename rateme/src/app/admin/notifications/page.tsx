import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { notifySettings } from '@/lib/notify';
import { aiSettings, aiConfigured } from '@/lib/ai';
import { emailConfigured } from '@/lib/email';
import { formatDate } from '@/lib/format';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { saveNotificationSettings, addSuppression } from '../outreach/actions';

export const metadata = { title: 'Automation' };
export const dynamic = 'force-dynamic';

export default async function Notifications({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff('admin');
  const sp = await searchParams;
  const [s, ai] = await Promise.all([notifySettings(), aiSettings()]);
  const [stats, recent, runs] = await Promise.all([
    sql<{ kind: string; status: string; n: number }[]>`select kind, status, count(*)::int n from notifications group by 1, 2 order by 1, 2`,
    sql<{ kind: string; status: string; reason: string | null; recipient_class: string | null; name: string | null; created_at: Date }[]>`
      select n.kind, n.status, n.reason, n.recipient_class, b.name, n.created_at from notifications n left join businesses b on b.id = n.business_id order by n.created_at desc limit 50`,
    sql<{ job: string; started_at: Date; ok: boolean | null; error: string | null }[]>`select job, started_at, ok, error from job_runs order by started_at desc limit 20`,
  ]);
  const sw: [keyof typeof s, string, string][] = [
    ['claim_invite_enabled', '“You’ve been reviewed” claim invitations', 'Unsolicited. Only role mailboxes on a business domain (info@, hello@…). Personal and webmail addresses are always suppressed. Needs solicitor sign-off before enabling.'],
    ['renewal_enabled', 'Renewal reminders (30 and 7 days)', 'Service messages to paying customers about their own subscription.'],
    ['digest_enabled', 'Weekly activity digest (Mondays)', 'Members only, only when there was activity, opt-out in account settings.'],
    ['kit_nudge_enabled', 'Unused QR kit reminder', 'Once per business, 21 days after a kit download with zero scans.'],
  ];
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold">Automation & email</h1>
      <div className="mt-3 space-y-2">{sp.msg && <Notice kind="ok">{sp.msg}</Notice>}{sp.err && <Notice kind="error">{sp.err}</Notice>}
        {!emailConfigured() && <Notice kind="warn">No email provider configured (RESEND_API_KEY). Messages are written to the outbox only.</Notice>}</div>
      <form action={saveNotificationSettings} className="card mt-6 space-y-4 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Switches (all off by default)</h2>
        {sw.map(([k, t, h]) => (
          <label key={k} className="flex items-start gap-3"><input type="checkbox" name={k} defaultChecked={!!s[k]} className="mt-1 h-5 w-5" />
            <span><span className="font-semibold">{t}</span><span className="block text-sm text-muted">{h}</span></span></label>
        ))}
        <label className="flex items-start gap-3"><input type="checkbox" name="reply_drafts_enabled" defaultChecked={ai.reply_drafts_enabled} className="mt-1 h-5 w-5" />
          <span><span className="font-semibold">AI reply drafts for members</span><span className="block text-sm text-muted">Claude Haiku 5.5. {ai.drafts_per_business_per_month} drafts per business per month, ${ai.monthly_budget_usd} monthly cap. {aiConfigured() ? 'API key present.' : 'ANTHROPIC_API_KEY not set, so this stays off.'}</span></span></label>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">Save switches</SubmitButton>
      </form>
      <h2 className="mt-10 text-xl font-semibold">Queue & delivery</h2>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">{stats.map((x) => <li key={x.kind + x.status} className="badge badge-muted">{x.kind} · {x.status}: {x.n}</li>)}{!stats.length && <li className="text-muted">Nothing queued yet.</li>}</ul>
      <div className="mt-3 overflow-x-auto"><table className="table-rm">
        <thead><tr><th>When</th><th>Type</th><th>Business</th><th>Status</th><th>Recipient type</th><th>Reason</th></tr></thead>
        <tbody>{recent.map((r, i) => <tr key={i}><td>{formatDate(r.created_at)}</td><td>{r.kind}</td><td>{r.name ?? '—'}</td><td>{r.status}</td><td>{r.recipient_class ?? '—'}</td><td>{r.reason ?? '—'}</td></tr>)}</tbody>
      </table></div>
      <h2 className="mt-10 text-xl font-semibold">Scheduled job runs</h2>
      <ul className="mt-3 space-y-1 text-sm">{runs.map((r, i) => <li key={i}>{formatDate(r.started_at)} · {r.job} · {r.ok == null ? 'running' : r.ok ? 'ok' : `failed: ${r.error}`}</li>)}{!runs.length && <li className="text-muted">No runs yet. The daily job runs at 03:17 UTC.</li>}</ul>
      <form action={addSuppression} className="card mt-10 flex max-w-xl flex-col gap-2 p-5 sm:flex-row">
        <label className="sr-only" htmlFor="sup">Email to suppress</label>
        <input id="sup" name="email" type="email" required className="input" placeholder="email to never contact" />
        <SubmitButton className="btn btn-ghost shrink-0" pendingText="…">Add to suppression list</SubmitButton>
      </form>
    </div>
  );
}
