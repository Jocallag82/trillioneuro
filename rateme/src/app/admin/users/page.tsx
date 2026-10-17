import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Notice } from '@/components/ui';
import { setUserState } from '../actions';

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string }> }) {
  await requireStaff('admin');
  const { q, msg } = await searchParams;
  const rows = await sql<{ id: string; email: string; display_name: string; role: string; status: string; created_at: Date; email_verified_at: Date | null }[]>`
    select id, email, display_name, role, status, created_at, email_verified_at from users
    ${q ? sql`where email ilike ${'%' + q + '%'} or display_name ilike ${'%' + q + '%'}` : sql``} order by created_at desc limit 100`;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Users</h1>
      {msg && <div className="mt-4"><Notice kind="info">{msg}</Notice></div>}
      <form className="mt-4 flex gap-2"><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Email or name" aria-label="Search" /><button className="btn btn-ghost">Search</button></form>
      <div className="mt-6 overflow-x-auto"><table className="table-rm">
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id}><td>{u.display_name}<br /><span className="text-xs text-muted">{u.email}{u.email_verified_at ? '' : ' (unverified)'}</span></td><td>{u.role}</td><td>{u.status}</td><td>{formatDate(u.created_at)}</td>
            <td><form action={setUserState} className="flex flex-wrap gap-1"><input type="hidden" name="user_id" value={u.id} /><input name="reason" className="input w-36 py-1 text-sm" placeholder="Reason" aria-label="Reason" />
              {u.status === 'active' ? <button name="action" value="suspend" className="btn btn-ghost btn-sm">Suspend</button> : u.status === 'suspended' ? <button name="action" value="reactivate" className="btn btn-ghost btn-sm">Reactivate</button> : null}
              {u.role !== 'moderator' && <button name="action" value="moderator" className="btn btn-ghost btn-sm">Make moderator</button>}
              {u.role !== 'user' && <button name="action" value="user" className="btn btn-ghost btn-sm">Make user</button>}</form></td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
