import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';

export default async function Audit() {
  await requireStaff('admin');
  const rows = await sql<{ id: string; action: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown>; created_at: Date; email: string | null }[]>`
    select a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at, u.email from audit_events a left join users u on u.id = a.actor_user_id order by a.created_at desc limit 300`;
  const mods = await sql<{ action: string; created_at: Date; email: string | null; review_id: string | null; to_status: string | null; reason: string | null }[]>`
    select m.action, m.created_at, u.email, m.review_id, m.to_status, m.reason from moderation_actions m left join users u on u.id = m.actor_user_id
    where m.actor_user_id is not null order by m.created_at desc limit 100`;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-muted">Sensitive actions. Passwords, tokens and card data are never recorded.</p>
      <h2 className="mt-6 text-xl font-semibold">Moderator decisions</h2>
      <div className="mt-2 overflow-x-auto"><table className="table-rm"><thead><tr><th>When</th><th>Moderator</th><th>Action</th><th>Review</th><th>Outcome</th></tr></thead>
        <tbody>{mods.map((m, i) => <tr key={i}><td>{formatDate(m.created_at)}</td><td>{m.email}</td><td>{m.action}</td><td>{m.review_id && <a className="text-sea underline" href={`/admin/reviews/${m.review_id}`}>open</a>}</td><td>{m.to_status ?? ''} {m.reason ?? ''}</td></tr>)}</tbody></table></div>
      <h2 className="mt-8 text-xl font-semibold">All events</h2>
      <div className="mt-2 overflow-x-auto"><table className="table-rm"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="whitespace-nowrap">{formatDate(r.created_at)}</td><td>{r.email ?? 'system'}</td><td>{r.action}</td><td className="font-mono text-xs">{r.entity_type}:{r.entity_id?.slice(0, 8)}</td><td className="text-xs text-muted">{JSON.stringify(r.metadata)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
