import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { OUTREACH_STATUSES, effectiveStatus, prospectColumns, claimLink, type ProspectRow } from '@/lib/outreach';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { CopyButton } from '@/components/CopyButton';
import { saveProspect, makeClaimLink } from '../actions';

export const metadata = { title: 'Outreach record' };

export default async function Prospect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff('admin');
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [r] = await sql<ProspectRow[]>`select ${prospectColumns} from businesses b join counties co on co.id = b.county_id join categories c on c.id = b.category_id
    left join outreach_prospects p on p.business_id = b.id where b.id = ${id}`;
  if (!r) notFound();
  const campaigns = await sql<{ id: number; name: string }[]>`select id, name from outreach_campaigns where active order by name`;
  const [attr] = await sql<{ source: string; partner: string | null; campaign: string | null }[]>`
    select a.source, p.name partner, c.name campaign from business_attribution a left join partners p on p.id = a.partner_id left join outreach_campaigns c on c.id = a.campaign_id where a.business_id = ${id}`;
  const eff = effectiveStatus(r.manual_status, r.claim_pending, r.verified, r.paying);
  return (
    <div className="max-w-3xl">
      <Link href="/admin/outreach" className="text-sm text-muted hover:underline">← Outreach</Link>
      <h1 className="mt-2 text-3xl font-semibold">{r.name}</h1>
      <p className="text-muted">{r.category} · Co. {r.county} · {r.rating_count} published reviews · listing {r.status}</p>
      <p className="mt-2 text-sm">Current status: <strong>{OUTREACH_STATUSES[eff]}</strong>{eff !== (r.manual_status ?? 'not_contacted') && ' (set automatically from claim / payment records)'}{attr && <> · Attributed to {attr.source === 'partner' ? `partner ${attr.partner}` : `campaign ${attr.campaign ?? '(none)'}`}</>}</p>
      <div className="mt-3 space-y-2">{sp.msg && <Notice kind="ok">{sp.msg}</Notice>}{sp.err && <Notice kind="error">{sp.err}</Notice>}</div>

      <section className="card mt-6 space-y-3 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Sales kit</h2>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-ghost btn-sm" href={`/business/${r.slug}`} target="_blank">Public profile</Link>
          <Link className="btn btn-ghost btn-sm" href={`/for-business${r.claim_token ? `?claim=${r.slug}&ct=${r.claim_token}` : ''}`} target="_blank">Business intro page</Link>
          {r.claim_token && <><Link className="btn btn-ghost btn-sm" href={`/admin/outreach/${id}/print?kind=letter`}>Print letter</Link><Link className="btn btn-ghost btn-sm" href={`/admin/outreach/${id}/print?kind=flyer`}>Print flyer</Link></>}
        </div>
        {r.claim_token ? (
          <div className="text-sm"><p>Personal claim link (attributes the claim to this record):</p><p className="mt-1 break-all font-mono text-xs">{claimLink(r.claim_token)}</p><div className="mt-2"><CopyButton text={claimLink(r.claim_token)} label="Copy claim link" /></div></div>
        ) : (
          <form action={makeClaimLink}><input type="hidden" name="business_id" value={id} /><SubmitButton className="btn btn-primary btn-sm" pendingText="…">Create claim link, letter and flyer</SubmitButton></form>
        )}
        {(r.phone || r.public_email) && <p className="text-xs text-muted">Public contact on listing: {[r.phone, r.public_email].filter(Boolean).join(' / ')}. Phone a business only if it isn’t on the National Directory Database opt-out; don’t send marketing email to sole traders without consent.</p>}
      </section>

      <form action={saveProspect} className="card mt-6 grid gap-3 p-5 sm:grid-cols-2">
        <input type="hidden" name="business_id" value={id} />
        <h2 className="font-sans text-lg font-bold tracking-normal sm:col-span-2">Outreach record</h2>
        <label className="field"><span className="label">Status</span><select name="status" className="select" defaultValue={r.manual_status ?? 'not_contacted'}>{Object.entries(OUTREACH_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span className="label">Campaign</span><select name="campaign_id" className="select" defaultValue={r.campaign_id ?? ''}><option value="">None</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field"><span className="label">Contact name</span><input name="contact_name" className="input" defaultValue={r.contact_name ?? ''} maxLength={120} /></label>
        <label className="field"><span className="label">Contact phone</span><input name="contact_phone" className="input" defaultValue={r.contact_phone ?? ''} maxLength={40} /></label>
        <label className="field sm:col-span-2"><span className="label">Notes (private)</span><textarea name="notes" className="textarea" defaultValue={r.notes ?? ''} maxLength={4000} /></label>
        <label className="field"><span className="label">Next action</span><input name="next_action" className="input" defaultValue={r.next_action ?? ''} maxLength={200} placeholder="e.g. Call back Tuesday" /></label>
        <label className="field"><span className="label">Next action date</span><input type="date" name="next_action_at" className="input" defaultValue={r.next_action_at ? new Date(r.next_action_at).toISOString().slice(0, 10) : ''} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="log_contact" value="yes" /> I contacted them today (updates last contact date)</label>
        <SubmitButton className="btn btn-primary sm:col-span-2" pendingText="Saving…">Save outreach record</SubmitButton>
      </form>
    </div>
  );
}
