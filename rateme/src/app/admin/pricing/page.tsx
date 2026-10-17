import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { paymentsStatus } from '@/lib/env';
import { Notice } from '@/components/ui';
import { savePlan, saveMembershipSettings } from '../actions';

export default async function Pricing({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff('admin');
  const { msg } = await searchParams;
  const plans = await sql<{ id: number; code: string; name: string; description: string | null; amount_cents: number; billing_interval: string; is_founding: boolean; active: boolean }[]>`select * from plans order by sort_order`;
  const [s] = await sql<{ value: { grace_days: number; public_plan: string } }[]>`select value from settings where key = 'membership'`;
  const pay = paymentsStatus();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Pricing & membership</h1>
      {msg && <Notice kind="info">{msg}</Notice>}
      <Notice kind={pay.mode === 'live' ? 'warn' : 'info'}>Payments: <strong>{pay.mode}</strong>{pay.reason ? ` — ${pay.reason}` : ''}</Notice>
      <form action={saveMembershipSettings} className="card grid gap-3 p-5 sm:grid-cols-3 sm:items-end">
        <label className="field"><span className="label">Plan offered at checkout</span><select name="public_plan" defaultValue={s?.value.public_plan} className="select">{plans.map((p) => <option key={p.code} value={p.code}>{p.name}{p.active ? '' : ' (inactive)'}</option>)}</select></label>
        <label className="field"><span className="label">Grace period after failed payment (days)</span><input name="grace_days" type="number" min={0} max={60} defaultValue={s?.value.grace_days ?? 14} className="input" /></label>
        <button className="btn btn-primary">Save settings</button>
      </form>
      {plans.map((p) => (
        <form key={p.id} action={savePlan} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={p.id} />
          <p className="font-mono text-xs text-muted sm:col-span-2">{p.code} · billed per {p.billing_interval}</p>
          <label className="field"><span className="label">Name</span><input name="name" defaultValue={p.name} className="input" required /></label>
          <label className="field"><span className="label">Price (€ incl. any VAT)</span><input name="amount" defaultValue={(p.amount_cents / 100).toFixed(2)} className="input" inputMode="decimal" required /></label>
          <label className="field sm:col-span-2"><span className="label">Description</span><input name="description" defaultValue={p.description ?? ''} className="input" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Active</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_founding" defaultChecked={p.is_founding} /> Founding plan (price locked while membership renews)</label>
          <button className="btn btn-ghost sm:col-span-2 sm:w-fit">Save plan</button>
        </form>
      ))}
      <p className="text-sm text-muted">New prices apply to new checkouts only. Existing subscriptions keep the price they were created with. Don’t present the founding price with deadlines or scarcity unless they are real.</p>
    </div>
  );
}
