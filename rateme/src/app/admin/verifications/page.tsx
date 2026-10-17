import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { SubmitButton } from '@/components/SubmitButton';
import { Notice } from '@/components/ui';
import { decideVerification } from '../actions';

export default async function Verifications({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff();
  const { msg } = await searchParams;
  const rows = await sql<{ id: string; method: string; evidence: string | null; contact_phone: string | null; target: string | null; created_at: Date; business: string; slug: string; business_id: string;
    website: string | null; cro_number: string | null; user_email: string; user_name: string; contested: boolean; source: string }[]>`
    select v.id, v.method, v.evidence, v.contact_phone, v.target, v.created_at, b.name business, b.slug, b.id business_id, b.website, b.cro_number, b.source,
      u.email user_email, u.display_name user_name,
      exists(select 1 from business_members m where m.business_id = b.id and m.status = 'verified' and m.user_id <> v.user_id) contested
    from verification_requests v join businesses b on b.id = v.business_id join users u on u.id = v.user_id
    where v.status = 'pending' and v.method = 'manual' order by v.created_at`;
  const recent = await sql<{ business: string; method: string; email: string; decided_at: Date }[]>`
    select b.name business, v.method, u.email, v.decided_at from verification_requests v join businesses b on b.id = v.business_id join users u on u.id = v.user_id
    where v.status = 'approved' order by v.decided_at desc limit 15`;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Ownership claims</h1>
      <p className="mt-1 text-sm text-muted">Check public records (core.cro.ie, the business’s website and social profiles, Google listing) and call the business number when in doubt. Payment is never evidence of ownership.</p>
      {msg && <div className="mt-4"><Notice kind="ok">{msg}</Notice></div>}
      <ul className="mt-6 space-y-4">
        {rows.length === 0 && <li className="text-muted">No manual claims waiting.</li>}
        {rows.map((v) => (
          <li key={v.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2"><Link className="text-lg font-semibold text-sea underline" href={`/admin/businesses/${v.business_id}`}>{v.business}</Link>
              {v.contested && <span className="badge badge-danger">Already has a verified owner</span>}<span className="badge badge-muted">listing source: {v.source}</span><span className="text-sm text-muted">{formatDate(v.created_at)}</span></div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Applicant</dt><dd>{v.user_name} · {v.user_email}</dd></div>
              <div><dt className="text-muted">Phone to call</dt><dd>{v.contact_phone}</dd></div>
              <div><dt className="text-muted">CRO / RBN given</dt><dd>{v.target ?? v.cro_number ?? '—'}</dd></div>
              <div><dt className="text-muted">Website</dt><dd className="break-all">{v.website ?? '—'}</dd></div>
            </dl>
            <p className="mt-3 whitespace-pre-line rounded-xl bg-paper p-3 text-sm">{v.evidence}</p>
            <form action={decideVerification} className="mt-3 space-y-2">
              <input type="hidden" name="request_id" value={v.id} />
              <input name="notes" className="input" placeholder="What you checked (sent to applicant if rejected)" required minLength={5} aria-label="Notes" />
              <div className="flex gap-2"><SubmitButton name="outcome" value="approve" className="btn btn-primary btn-sm">Approve ownership</SubmitButton><SubmitButton name="outcome" value="reject" className="btn btn-ghost btn-sm">Reject</SubmitButton></div>
            </form>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 text-xl font-semibold">Recently verified (all methods)</h2>
      <table className="table-rm mt-3"><thead><tr><th>Business</th><th>Method</th><th>User</th><th>When</th></tr></thead>
        <tbody>{recent.map((r, i) => <tr key={i}><td>{r.business}</td><td>{r.method}</td><td>{r.email}</td><td>{formatDate(r.decided_at)}</td></tr>)}</tbody></table>
    </div>
  );
}
