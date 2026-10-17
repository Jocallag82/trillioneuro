import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getEntitlement } from '@/lib/membership';
import { formatDate } from '@/lib/format';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { setBusinessStatus, renameBusiness, revokeMember } from '../../actions';

export default async function AdminBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  await requireStaff();
  const { id } = await params; const { msg } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [b] = await sql<{ id: string; name: string; slug: string; status: string; source: string; website: string | null; cro_number: string | null; phone: string | null; created_at: Date; county: string; category: string; rating_count: number; created_by_email: string | null }[]>`
    select b.*, co.name county, c.name category, u.email created_by_email from businesses b join counties co on co.id = b.county_id join categories c on c.id = b.category_id
    left join users u on u.id = b.created_by where b.id = ${id}`;
  if (!b) notFound();
  const [members, subs, reports, audits] = await Promise.all([
    sql<{ id: string; email: string; role: string; status: string; created_at: Date }[]>`select m.id, u.email, m.role, m.status, m.created_at from business_members m join users u on u.id = m.user_id where m.business_id = ${id} order by m.created_at`,
    sql<{ stripe_subscription_id: string; status: string; current_period_end: Date | null; cancel_at_period_end: boolean; refunded_at: Date | null; disputed_at: Date | null }[]>`select stripe_subscription_id, status, current_period_end, cancel_at_period_end, refunded_at, disputed_at from subscriptions where business_id = ${id} order by created_at desc`,
    sql<{ id: string; reason: string; details: string | null; status: string; created_at: Date }[]>`select id, reason, details, status, created_at from reports where business_id = ${id} and kind = 'business_info' order by created_at desc limit 20`,
    sql<{ action: string; created_at: Date; email: string | null; metadata: Record<string, unknown> }[]>`select a.action, a.created_at, u.email, a.metadata from audit_events a left join users u on u.id = a.actor_user_id where a.entity_type = 'business' and a.entity_id = ${id} order by a.created_at desc limit 30`,
  ]);
  const ent = await getEntitlement(id);
  return (
    <div className="space-y-6">
      <Link href="/admin/businesses" className="text-sm text-muted hover:underline">← Businesses</Link>
      {msg && <Notice kind="info">{msg}</Notice>}
      <div className="card p-5">
        <h1 className="text-2xl font-semibold">{b.name}</h1>
        <p className="text-sm text-muted">{b.category} · Co. {b.county} · status <strong>{b.status}</strong> · source {b.source} · created {formatDate(b.created_at)}{b.created_by_email ? ` by ${b.created_by_email}` : ''}</p>
        <p className="mt-2 text-sm">Website: {b.website ?? '—'} · CRO: {b.cro_number ?? '—'} · Phone: {b.phone ?? '—'} · Reviews: {b.rating_count} · Membership: {ent.state}</p>
        <Link className="mt-2 inline-block text-sm text-sea underline" href={`/business/${b.slug}`}>Open profile</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={setBusinessStatus} className="card space-y-3 p-5">
          <h2 className="font-sans text-lg font-bold tracking-normal">Listing status</h2>
          <input type="hidden" name="business_id" value={id} />
          <input name="reason" className="input" placeholder="Reason (required except when publishing)" aria-label="Reason" />
          <div className="flex flex-wrap gap-2">
            {b.status !== 'published' && <SubmitButton name="to" value="published" className="btn btn-primary btn-sm">Publish</SubmitButton>}
            {b.status !== 'suspended' && <SubmitButton name="to" value="suspended" className="btn btn-ghost btn-sm">Suspend</SubmitButton>}
            {b.status !== 'removed' && <SubmitButton name="to" value="removed" className="btn btn-danger btn-sm">Remove</SubmitButton>}
          </div>
          <p className="text-xs text-muted">Removing a listing hides its reviews too. Only do this for non-businesses, duplicates, impersonation or legal reasons — never because of negative reviews.</p>
        </form>
        <form action={renameBusiness} className="card space-y-3 p-5">
          <h2 className="font-sans text-lg font-bold tracking-normal">Rename (verified requests only)</h2>
          <input type="hidden" name="business_id" value={id} />
          <input name="name" className="input" defaultValue={b.name} required minLength={2} maxLength={120} aria-label="New name" />
          <SubmitButton className="btn btn-ghost btn-sm">Rename</SubmitButton>
        </form>
      </div>
      <section className="card p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Authorised users</h2>
        <table className="table-rm mt-2"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Since</th><th /></tr></thead>
          <tbody>{members.map((m) => <tr key={m.id}><td>{m.email}</td><td>{m.role}</td><td>{m.status}</td><td>{formatDate(m.created_at)}</td>
            <td>{m.status !== 'revoked' && <form action={revokeMember}><input type="hidden" name="member_id" value={m.id} /><input type="hidden" name="business_id" value={id} /><button className="text-sm text-danger underline">Revoke</button></form>}</td></tr>)}</tbody></table>
      </section>
      <section className="card p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Subscriptions</h2>
        {subs.length ? <table className="table-rm mt-2"><thead><tr><th>Stripe ID</th><th>Status</th><th>Period end</th><th>Flags</th></tr></thead>
          <tbody>{subs.map((s) => <tr key={s.stripe_subscription_id}><td className="font-mono text-xs">{s.stripe_subscription_id}</td><td>{s.status}</td><td>{s.current_period_end ? formatDate(s.current_period_end) : '—'}</td>
            <td>{[s.cancel_at_period_end && 'cancelling', s.refunded_at && 'refunded', s.disputed_at && 'disputed'].filter(Boolean).join(', ') || '—'}</td></tr>)}</tbody></table> : <p className="mt-2 text-sm text-muted">None. Membership state is managed by Stripe events; issue refunds in the Stripe dashboard.</p>}
      </section>
      <section className="card p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Information reports</h2>
        <ul className="mt-2 space-y-1 text-sm">{reports.map((r) => <li key={r.id}><span className="badge badge-muted">{r.status}</span> {r.reason} — {r.details} ({formatDate(r.created_at)})</li>)}{!reports.length && <li className="text-muted">None.</li>}</ul>
      </section>
      <section className="card p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Audit</h2>
        <ul className="mt-2 space-y-1 text-sm">{audits.map((a, i) => <li key={i}>{formatDate(a.created_at)} · <strong>{a.action}</strong> · {a.email ?? 'system'} <span className="text-muted">{JSON.stringify(a.metadata)}</span></li>)}</ul>
      </section>
    </div>
  );
}
