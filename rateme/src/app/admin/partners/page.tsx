import { requireStaff } from '@/lib/auth';
import { partnerReport, rewardDue } from '@/lib/attribution';
import { formatEuro } from '@/lib/format';
import { env } from '@/lib/env';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { CopyButton } from '@/components/CopyButton';
import { savePartner, togglePartner } from '../outreach/actions';

export const metadata = { title: 'Partners' };

export default async function Partners({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff('admin');
  const sp = await searchParams;
  const rows = await partnerReport();
  return (
    <div>
      <h1 className="text-3xl font-semibold">Partners & referrals</h1>
      <p className="mt-1 text-sm text-muted">Accountants, bookkeepers, chambers and associations. Rewards are calculated here; nothing is paid automatically. Pay manually after the 14-day refund window.</p>
      <div className="mt-3">{sp.msg && <Notice kind="ok">{sp.msg}</Notice>}{sp.err && <Notice kind="error">{sp.err}</Notice>}</div>
      <div className="mt-6 overflow-x-auto"><table className="table-rm">
        <thead><tr><th>Partner</th><th>Link</th><th>Sign-ups</th><th>Claims</th><th>Paying</th><th>First payments</th><th>Reward due</th><th></th></tr></thead>
        <tbody>{rows.map((p) => {
          const due = rewardDue(p.reward, p.first_payments_cents, p.paying);
          const link = `${env.appUrl}/p/${p.code}`;
          return (
            <tr key={p.id}><td><strong>{p.name}</strong><br /><span className="text-xs text-muted">{p.kind} · {p.code}{p.active ? '' : ' · inactive'}</span></td>
              <td><CopyButton text={link} label="Copy link" /></td><td>{p.referred}</td><td>{p.claimed}</td><td>{p.paying}</td><td>{formatEuro(p.first_payments_cents)}</td>
              <td>{'cents' in due ? formatEuro(due.cents ?? 0) : 'months' in due ? `${due.months} month(s)` : '—'}<br /><span className="text-xs text-muted">{due.text}</span></td>
              <td><form action={togglePartner}><input type="hidden" name="id" value={p.id} /><button className="btn btn-ghost btn-sm">{p.active ? 'Deactivate' : 'Activate'}</button></form></td></tr>
          );
        })}</tbody>
      </table></div>
      {!rows.length && <p className="mt-3 text-sm text-muted">No partners yet.</p>}
      <form action={savePartner} className="card mt-8 grid max-w-xl gap-3 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Add or update a partner</h2>
        <label className="field"><span className="label">Code</span><input name="code" className="input uppercase" required pattern="[A-Za-z0-9]{4,16}" placeholder="MURPHYACCTS" /></label>
        <label className="field"><span className="label">Name</span><input name="name" className="input" required maxLength={120} /></label>
        <label className="field"><span className="label">Type</span><select name="kind" className="select">{['accountant', 'bookkeeper', 'adviser', 'chamber', 'association', 'other'].map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="field"><span className="label">Contact email (used to block self-referrals)</span><input name="contact_email" type="email" className="input" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field"><span className="label">Reward</span><select name="reward_type" className="select"><option value="none">None</option><option value="percent_first_payment">% of first payment</option><option value="free_months">Free months per paying referral</option></select></label>
          <label className="field"><span className="label">Value</span><input name="reward_value" type="number" min={1} max={50} className="input" /></label>
        </div>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">Save partner</SubmitButton>
      </form>
    </div>
  );
}
