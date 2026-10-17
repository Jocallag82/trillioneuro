import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { updateDataRequest } from '../actions';

export default async function DataRequests() {
  await requireStaff();
  const rows = await sql<{ id: string; email: string; kind: string; details: string; status: string; notes: string | null; created_at: Date }[]>`
    select * from data_requests order by (status = 'closed'), created_at limit 200`;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Privacy, legal & complaint requests</h1>
      <p className="mt-1 text-sm text-muted">GDPR requests must be answered within one month. Verify the requester’s identity before disclosing or erasing data. Legal removal notices: record the legal basis in notes.</p>
      <ul className="mt-6 space-y-3">
        {rows.length === 0 && <li className="text-muted">No requests.</li>}
        {rows.map((r) => {
          const due = new Date(new Date(r.created_at).getTime() + 30 * 86400000);
          return (
            <li key={r.id} className="card p-4">
              <p><span className="badge badge-muted">{r.kind}</span> <strong>{r.email}</strong> · {formatDate(r.created_at)} · status {r.status}{r.status !== 'closed' && <> · <span className={due < new Date() ? 'text-danger' : ''}>respond by {formatDate(due)}</span></>}</p>
              <p className="mt-2 whitespace-pre-line text-sm">{r.details}</p>
              <form action={updateDataRequest} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="id" value={r.id} />
                <select name="status" defaultValue={r.status} className="select w-auto py-2" aria-label="Status"><option value="open">open</option><option value="in_progress">in progress</option><option value="closed">closed</option></select>
                <input name="notes" defaultValue={r.notes ?? ''} className="input max-w-md" placeholder="Notes" aria-label="Notes" /><button className="btn btn-ghost btn-sm">Save</button></form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
