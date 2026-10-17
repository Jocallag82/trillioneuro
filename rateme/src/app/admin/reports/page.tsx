import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Notice } from '@/components/ui';
import { resolveReport } from '../actions';

export default async function Reports({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff();
  const { msg } = await searchParams;
  const rows = await sql<{ id: string; reason: string; details: string | null; reporter_email: string | null; created_at: Date; business_id: string; business: string }[]>`
    select r.id, r.reason, r.details, r.reporter_email, r.created_at, b.id business_id, b.name business from reports r join businesses b on b.id = r.business_id
    where r.kind = 'business_info' and r.status = 'open' and r.reason <> 'suggestion' order by r.created_at`;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Corrections & information reports</h1>
      <p className="mt-1 text-sm text-muted">Review reports are handled in <Link className="underline" href="/admin/reviews?status=reported">Reviews → Reported</Link>. Make changes on the business page, then mark the report actioned.</p>
      {msg && <div className="mt-4"><Notice kind="ok">{msg}</Notice></div>}
      <ul className="mt-6 space-y-3">
        {rows.length === 0 && <li className="text-muted">Nothing open.</li>}
        {rows.map((r) => (
          <li key={r.id} className="card p-4">
            <p><Link className="font-semibold text-sea underline" href={`/admin/businesses/${r.business_id}`}>{r.business}</Link> · <span className="badge badge-muted">{r.reason}</span> · <span className="text-sm text-muted">{formatDate(r.created_at)}{r.reporter_email ? ` · ${r.reporter_email}` : ''}</span></p>
            {r.details && <p className="mt-2 text-sm">{r.details}</p>}
            <form action={resolveReport} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="report_id" value={r.id} /><input name="notes" className="input max-w-md" placeholder="Notes" aria-label="Notes" />
              <button name="outcome" value="actioned" className="btn btn-primary btn-sm">Actioned</button><button name="outcome" value="dismissed" className="btn btn-ghost btn-sm">Dismiss</button></form>
          </li>
        ))}
      </ul>
    </div>
  );
}
