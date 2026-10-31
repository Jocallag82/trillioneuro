import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { campaignReport } from '@/lib/outreach';
import { formatEuro } from '@/lib/format';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createCampaign } from '../actions';

export const metadata = { title: 'Campaigns' };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export default async function Campaigns({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff('admin');
  const sp = await searchParams;
  const rows = await campaignReport();
  return (
    <div>
      <Link href="/admin/outreach" className="text-sm text-muted hover:underline">← Outreach</Link>
      <h1 className="mt-2 text-3xl font-semibold">Campaigns & results</h1>
      <div className="mt-3">{sp.msg && <Notice kind="ok">{sp.msg}</Notice>}{sp.err && <Notice kind="error">{sp.err}</Notice>}</div>
      <div className="mt-6 overflow-x-auto"><table className="table-rm">
        <thead><tr><th>Campaign</th><th>Channel</th><th>Businesses</th><th>Contacted</th><th>Claims</th><th>Verified (free)</th><th>Paying</th><th>Claim → paid</th><th>Revenue (gross)</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.channel}</td><td>{c.prospects}</td><td>{c.contacted}</td><td>{c.claims}</td><td>{c.verified}</td><td>{c.paid}</td><td>{pct(c.paid, c.claims)}</td><td>{formatEuro(c.revenue_cents)}</td></tr>)}</tbody>
      </table></div>
      {!rows.length && <p className="mt-3 text-sm text-muted">No campaigns yet.</p>}
      <p className="mt-2 text-xs text-muted">Claims count only businesses claimed through this campaign’s personal claim links. Revenue is paid invoices excluding refunded subscriptions, including any VAT charged.</p>
      <form action={createCampaign} className="card mt-8 grid max-w-xl gap-3 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">New campaign</h2>
        <label className="field"><span className="label">Name</span><input name="name" className="input" required minLength={2} maxLength={80} placeholder="Cork trades — November" /></label>
        <label className="field"><span className="label">Channel</span><select name="channel" className="select">{['in_person', 'phone', 'post', 'partner', 'event', 'other'].map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></label>
        <label className="field"><span className="label">Notes</span><textarea name="notes" className="textarea" maxLength={1000} /></label>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">Create campaign</SubmitButton>
      </form>
    </div>
  );
}
