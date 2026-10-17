import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Stars } from '@/components/Stars';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { formatDate, formatMonth } from '@/lib/format';
import { HOLD_REASON_LABELS, type HoldReason } from '@/lib/screening';
import { REPORT_REASONS, DISPUTE_REASONS, STATUS_LABELS } from '@/lib/reviews';
import { moderateReview, resolveDispute, decideAppeal, moderateResponse } from './actions';

const REJECT_REASONS = [
  'Not about a genuine customer experience', 'Conflict of interest (owner, staff, competitor or connected person)', 'Contains personal information',
  'Harassment, threats or hate speech', 'Likely defamatory or unlawful content', 'Incentivised or manipulated review', 'Spam, advertising or automated submission',
  'Duplicate review', 'Legally valid removal notice',
];

export default async function ReviewDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  await requireStaff();
  const { id } = await params; const { msg } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [r] = await sql<{ id: string; rating: number; title: string | null; body: string | null; status: string; hold_reasons: string[]; experience_type: string | null; experience_month: Date;
    reviewer_name: string; reviewer_email: string; ip_hash: string | null; source: string; created_at: Date; confirmed_at: Date | null; business_id: string; business: string; slug: string; is_member: boolean }[]>`
    select r.*, b.name business, b.slug,
      exists(select 1 from subscriptions s where s.business_id = b.id and s.status in ('active','trialing','past_due')) is_member
    from reviews r join businesses b on b.id = r.business_id where r.id = ${id}`;
  if (!r) notFound();
  const [reports, disputes, appeals, history, related, response] = await Promise.all([
    sql<{ id: string; reason: string; details: string | null; status: string; created_at: Date }[]>`select id, reason, details, status, created_at from reports where review_id = ${id} order by created_at`,
    sql<{ id: string; reason: string; allegation: string; status: string; finding: string | null; created_at: Date }[]>`select id, reason, allegation, status, finding, created_at from disputes where review_id = ${id} order by created_at`,
    sql<{ id: string; appellant: string; body: string; status: string; decision_notes: string | null; created_at: Date }[]>`select id, appellant, body, status, decision_notes, created_at from appeals where review_id = ${id} order by created_at`,
    sql<{ action: string; from_status: string | null; to_status: string | null; reason: string | null; notes: string | null; created_at: Date; actor: string | null }[]>`
      select m.action, m.from_status, m.to_status, m.reason, m.notes, m.created_at, u.email actor from moderation_actions m left join users u on u.id = m.actor_user_id where m.review_id = ${id} order by m.created_at`,
    sql<{ same_email: number; same_ip_business: number; same_ip_all: number }[]>`select
      (select count(*)::int from reviews where reviewer_email = ${r.reviewer_email} and id <> ${id}) same_email,
      (select count(*)::int from reviews where ip_hash = ${r.ip_hash} and business_id = ${r.business_id} and id <> ${id}) same_ip_business,
      (select count(*)::int from reviews where ip_hash = ${r.ip_hash} and id <> ${id}) same_ip_all`,
    sql<{ id: string; body: string; status: string }[]>`select id, body, status from review_responses where review_id = ${id}`,
  ]);
  const rel = related[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <Link href="/admin/reviews" className="text-sm text-muted hover:underline">← Queue</Link>
        {msg && <Notice kind="ok">{msg}</Notice>}
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3"><Stars value={r.rating} size={14} /><span className="badge badge-muted">{STATUS_LABELS[r.status]}</span>{r.is_member && <span className="badge badge-gorse">Business is a member — irrelevant to the decision</span>}</div>
          <p className="mt-2 text-sm">For <Link className="text-sea underline" href={`/business/${r.slug}`}>{r.business}</Link></p>
          {r.title && <h1 className="mt-3 font-sans text-xl font-bold tracking-normal">{r.title}</h1>}
          <p className="mt-2 whitespace-pre-line">{r.body ?? <em className="text-muted">Rating only</em>}</p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Display name</dt><dd>{r.reviewer_name}</dd></div>
            <div><dt className="text-muted">Email (private)</dt><dd className="break-all">{r.reviewer_email}</dd></div>
            <div><dt className="text-muted">Experience</dt><dd>{formatMonth(r.experience_month)}{r.experience_type ? ` · ${r.experience_type}` : ''}</dd></div>
            <div><dt className="text-muted">Source</dt><dd>{r.source === 'qr' ? 'QR code' : 'Website'}</dd></div>
            <div><dt className="text-muted">Submitted / confirmed</dt><dd>{formatDate(r.created_at)} / {r.confirmed_at ? formatDate(r.confirmed_at) : '—'}</dd></div>
            <div><dt className="text-muted">Signals</dt><dd>{rel.same_email} other reviews by this email · {rel.same_ip_business} from same network for this business · {rel.same_ip_all} from same network overall</dd></div>
          </dl>
          {r.hold_reasons.length > 0 && <p className="mt-3 text-sm"><strong>Automated flags:</strong> {r.hold_reasons.map((h) => HOLD_REASON_LABELS[h as HoldReason] ?? h).join(' · ')}</p>}
        </div>

        {reports.length > 0 && (
          <section className="card p-5"><h2 className="font-sans text-lg font-bold tracking-normal">Reports</h2>
            <ul className="mt-2 space-y-2 text-sm">{reports.map((p) => <li key={p.id}><span className="badge badge-muted">{p.status}</span> {REPORT_REASONS[p.reason as keyof typeof REPORT_REASONS] ?? p.reason} · {formatDate(p.created_at)}{p.details && <p className="mt-1 text-ink-2">{p.details}</p>}</li>)}</ul></section>
        )}
        {disputes.map((d) => (
          <section key={d.id} className="card p-5">
            <h2 className="font-sans text-lg font-bold tracking-normal">Business dispute <span className="badge badge-muted">{d.status}</span></h2>
            <p className="mt-1 text-sm text-muted">Allegation by the business (not a finding): {DISPUTE_REASONS[d.reason as keyof typeof DISPUTE_REASONS] ?? d.reason}</p>
            <p className="mt-2 whitespace-pre-line text-sm">{d.allegation}</p>
            {d.finding && <p className="mt-2 text-sm"><strong>Moderator finding:</strong> {d.finding}</p>}
            {d.status === 'open' && (
              <form action={resolveDispute} className="mt-4 space-y-2">
                <input type="hidden" name="dispute_id" value={d.id} /><input type="hidden" name="review_id" value={id} />
                <textarea name="finding" className="textarea" required minLength={10} placeholder="Finding: what you checked and concluded. Sent to the business." aria-label="Finding" />
                <div className="flex flex-wrap gap-2">
                  <SubmitButton name="outcome" value="rejected" className="btn btn-ghost btn-sm">Reject dispute — keep review</SubmitButton>
                  <SubmitButton name="outcome" value="upheld" className="btn btn-danger btn-sm">Uphold — remove review</SubmitButton>
                </div>
              </form>
            )}
          </section>
        ))}
        {appeals.map((a) => (
          <section key={a.id} className="card p-5">
            <h2 className="font-sans text-lg font-bold tracking-normal">Appeal by {a.appellant} <span className="badge badge-muted">{a.status}</span></h2>
            <p className="mt-2 whitespace-pre-line text-sm">{a.body}</p>
            {a.decision_notes && <p className="mt-2 text-sm"><strong>Decision:</strong> {a.decision_notes}</p>}
            {a.status === 'open' && (
              <form action={decideAppeal} className="mt-3 space-y-2">
                <input type="hidden" name="appeal_id" value={a.id} /><input type="hidden" name="review_id" value={id} />
                <textarea name="notes" className="textarea" required minLength={5} aria-label="Decision notes" />
                <div className="flex gap-2"><SubmitButton name="outcome" value="granted" className="btn btn-primary btn-sm">Grant (publish review)</SubmitButton><SubmitButton name="outcome" value="denied" className="btn btn-ghost btn-sm">Deny</SubmitButton></div>
              </form>
            )}
          </section>
        ))}
        {response[0] && (
          <section className="card p-5"><h2 className="font-sans text-lg font-bold tracking-normal">Business response <span className="badge badge-muted">{response[0].status}</span></h2>
            <p className="mt-2 text-sm">{response[0].body}</p>
            <form action={moderateResponse} className="mt-3 flex gap-2"><input type="hidden" name="response_id" value={response[0].id} /><input type="hidden" name="review_id" value={id} />
              <SubmitButton name="to" value={response[0].status === 'published' ? 'hidden' : 'published'} className="btn btn-ghost btn-sm">{response[0].status === 'published' ? 'Hide response (policy breach)' : 'Restore response'}</SubmitButton></form>
          </section>
        )}
        <section className="card p-5">
          <h2 className="font-sans text-lg font-bold tracking-normal">Audit trail</h2>
          <ol className="mt-2 space-y-1.5 text-sm">{history.map((h, i) => <li key={i}><span className="text-muted">{formatDate(h.created_at)}</span> · <strong>{h.action}</strong>{h.to_status ? ` (${h.from_status ?? '—'} → ${h.to_status})` : ''} · {h.actor ?? 'system'}{h.reason ? ` — ${h.reason}` : ''}{h.notes ? ` [${h.notes}]` : ''}</li>)}</ol>
        </section>
      </div>
      <aside className="card h-fit p-5 lg:sticky lg:top-20">
        <h2 className="font-sans text-lg font-bold tracking-normal">Decision</h2>
        <form action={moderateReview} className="mt-3 space-y-3">
          <input type="hidden" name="review_id" value={id} />
          <label className="field"><span className="label">Policy reason (for reject/remove)</span>
            <select name="reason" className="select" defaultValue=""><option value="">—</option>{REJECT_REASONS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field"><span className="label">Moderator notes (internal)</span><textarea name="notes" className="textarea" maxLength={2000} /></label>
          <div className="grid gap-2">
            {r.status !== 'published' && <SubmitButton name="to" value="published" className="btn btn-primary">Publish</SubmitButton>}
            {r.status === 'held' && <SubmitButton name="to" value="rejected" className="btn btn-danger">Reject</SubmitButton>}
            {r.status === 'published' && <SubmitButton name="to" value="removed" className="btn btn-danger">Remove from public view</SubmitButton>}
            {r.status === 'published' && reports.some((p) => p.status === 'open') && <SubmitButton name="to" value="keep" className="btn btn-ghost">Keep — dismiss reports</SubmitButton>}
          </div>
          <p className="text-xs text-muted">Rejecting or removing needs a policy reason. Every decision is logged with your account.</p>
        </form>
      </aside>
    </div>
  );
}
