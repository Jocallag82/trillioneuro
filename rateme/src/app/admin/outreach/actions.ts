'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { OUTREACH_STATUSES, ensureClaimToken } from '@/lib/outreach';
import { normPartnerCode } from '@/lib/attribution';

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const str = (f: FormData, k: string, max = 2000) => { const v = String(f.get(k) ?? '').trim().slice(0, max); return v || null; };

export async function saveProspect(form: FormData) {
  const staff = await requireStaff('admin');
  const id = String(form.get('business_id') ?? '');
  if (!uuid(id)) redirect('/admin/outreach');
  const status = String(form.get('status') ?? 'not_contacted');
  if (!(status in OUTREACH_STATUSES)) redirect(`/admin/outreach/${id}?err=Invalid+status`);
  const campaign = Number(form.get('campaign_id')) || null;
  const nextAt = str(form, 'next_action_at', 10);
  const touched = form.get('log_contact') === 'yes';
  await sql`insert into outreach_prospects (business_id, status, campaign_id, contact_name, contact_phone, notes, next_action, next_action_at, last_contact_at, updated_by)
    values (${id}, ${status}, ${campaign}, ${str(form, 'contact_name', 120)}, ${str(form, 'contact_phone', 40)}, ${str(form, 'notes', 4000)},
      ${str(form, 'next_action', 200)}, ${nextAt && /^\d{4}-\d{2}-\d{2}$/.test(nextAt) ? nextAt : null}, ${touched ? sql`now()` : null}, ${staff.id})
    on conflict (business_id) do update set status = excluded.status, campaign_id = excluded.campaign_id, contact_name = excluded.contact_name,
      contact_phone = excluded.contact_phone, notes = excluded.notes, next_action = excluded.next_action, next_action_at = excluded.next_action_at,
      last_contact_at = coalesce(excluded.last_contact_at, outreach_prospects.last_contact_at), updated_by = excluded.updated_by, updated_at = now()`;
  await audit(staff.id, 'outreach.updated', 'business', id, { status, campaign, contact_logged: touched });
  redirect(`/admin/outreach/${id}?msg=Saved`);
}

export async function makeClaimLink(form: FormData) {
  const staff = await requireStaff('admin');
  const id = String(form.get('business_id') ?? '');
  if (!uuid(id)) redirect('/admin/outreach');
  await ensureClaimToken(id, staff.id);
  await audit(staff.id, 'outreach.claim_link_created', 'business', id);
  redirect(`/admin/outreach/${id}?msg=Claim+link+ready`);
}

export async function createCampaign(form: FormData) {
  const staff = await requireStaff('admin');
  const name = str(form, 'name', 80); const channel = String(form.get('channel') ?? 'in_person');
  if (!name || name.length < 2 || !['in_person', 'phone', 'post', 'partner', 'event', 'other'].includes(channel)) redirect('/admin/outreach/campaigns?err=Enter+a+name');
  await sql`insert into outreach_campaigns (name, channel, notes) values (${name}, ${channel}, ${str(form, 'notes', 1000)}) on conflict (name) do nothing`;
  await audit(staff.id, 'outreach.campaign_created', 'campaign', name!);
  redirect('/admin/outreach/campaigns?msg=Campaign+saved');
}

const rewardSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('percent_first_payment'), value: z.number().min(1).max(50) }),
  z.object({ type: z.literal('free_months'), value: z.number().int().min(1).max(12) }),
]);

export async function savePartner(form: FormData) {
  const staff = await requireStaff('admin');
  const code = normPartnerCode(form.get('code'));
  const name = str(form, 'name', 120); const kind = String(form.get('kind') ?? 'other');
  const email = str(form, 'contact_email', 200)?.toLowerCase() ?? null;
  const rt = String(form.get('reward_type') ?? 'none');
  const reward = rewardSchema.safeParse(rt === 'none' ? { type: 'none' } : { type: rt, value: Number(form.get('reward_value')) });
  if (code.length < 4 || !name || !['accountant', 'bookkeeper', 'adviser', 'chamber', 'association', 'other'].includes(kind) || !reward.success)
    redirect('/admin/partners?err=' + encodeURIComponent('Check the code (4–16 letters/numbers), name and reward.'));
  const [u] = email ? await sql<{ id: string }[]>`select id from users where email = ${email}` : [];
  await sql`insert into partners (code, name, kind, contact_email, user_id, reward) values (${code}, ${name}, ${kind}, ${email}, ${u?.id ?? null}, ${sql.json(reward.data)})
    on conflict (code) do update set name = excluded.name, kind = excluded.kind, contact_email = excluded.contact_email, user_id = excluded.user_id, reward = excluded.reward`;
  await audit(staff.id, 'partner.saved', 'partner', code, { reward: reward.data });
  redirect('/admin/partners?msg=Partner+saved');
}

export async function togglePartner(form: FormData) {
  const staff = await requireStaff('admin');
  const id = Number(form.get('id'));
  await sql`update partners set active = not active where id = ${id}`;
  await audit(staff.id, 'partner.toggled', 'partner', String(id));
  redirect('/admin/partners');
}

const SWITCHES = ['claim_invite_enabled', 'digest_enabled', 'renewal_enabled', 'kit_nudge_enabled'] as const;
export async function saveNotificationSettings(form: FormData) {
  const staff = await requireStaff('admin');
  const patch: Record<string, boolean> = {};
  for (const k of SWITCHES) patch[k] = form.get(k) === 'on';
  const ai = form.get('reply_drafts_enabled') === 'on';
  await sql`update settings set value = value || ${sql.json(patch)}, updated_at = now() where key = 'notifications'`;
  await sql`update settings set value = value || ${sql.json({ reply_drafts_enabled: ai })}, updated_at = now() where key = 'ai'`;
  await audit(staff.id, 'settings.automation_changed', 'settings', 'notifications', { ...patch, reply_drafts_enabled: ai });
  redirect('/admin/notifications?msg=Saved');
}

export async function addSuppression(form: FormData) {
  const staff = await requireStaff('admin');
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(form.get('email'));
  if (!email.success) redirect('/admin/notifications?err=Enter+a+valid+email');
  await sql`insert into email_suppressions (email, reason, scope, source) values (${email.data}, 'do_not_contact', 'non_essential', 'admin') on conflict (email) do nothing`;
  await audit(staff.id, 'email.suppressed', 'email', email.data);
  redirect('/admin/notifications?msg=Suppressed');
}
