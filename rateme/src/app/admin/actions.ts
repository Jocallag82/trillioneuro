'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { approveMembership, notifyVerification } from '@/lib/verification';
import { audit } from '@/lib/audit';
import { uniqueSlug } from '@/lib/businesses';
import { slugify } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);

export async function decideVerification(form: FormData) {
  const staff = await requireStaff();
  const id = str(form, 'request_id'); const outcome = str(form, 'outcome'); const notes = str(form, 'notes');
  if (!uuid(id)) redirect('/admin/verifications');
  const [v] = await sql<{ member_id: string; business_id: string; user_id: string }[]>`select member_id, business_id, user_id from verification_requests where id = ${id} and status = 'pending'`;
  if (!v) redirect('/admin/verifications');
  if (outcome === 'approve') {
    const res = await sql.begin((tx) => approveMembership(tx, { memberId: v.member_id, requestId: id, actorId: staff.id, method: 'manual', notes }));
    if (res) await notifyVerification(res.email, res.name, v.business_id, true, null);
  } else {
    await sql`update verification_requests set status = 'rejected', decided_by = ${staff.id}, decided_at = now(), decision_notes = ${notes} where id = ${id}`;
    await audit(staff.id, 'business.verification_rejected', 'business', v.business_id, { request: id });
    const [i] = await sql<{ email: string; name: string }[]>`select u.email, b.name from users u, businesses b where u.id = ${v.user_id} and b.id = ${v.business_id}`;
    await notifyVerification(i.email, i.name, v.business_id, false, notes);
  }
  redirect('/admin/verifications?msg=' + encodeURIComponent('Decision recorded.'));
}

export async function setBusinessStatus(form: FormData) {
  const staff = await requireStaff();
  const id = str(form, 'business_id'); const to = str(form, 'to'); const reason = str(form, 'reason', 500);
  if (!uuid(id) || !['published', 'suspended', 'removed', 'pending'].includes(to)) redirect('/admin/businesses');
  if (to !== 'published' && reason.length < 3) redirect(`/admin/businesses/${id}?msg=${encodeURIComponent('A reason is required.')}`);
  const [prev] = await sql<{ status: string }[]>`select status from businesses where id = ${id}`;
  await sql`update businesses set status = ${to}, published_at = case when ${to} = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = ${id}`;
  await audit(staff.id, 'business.status_changed', 'business', id, { from: prev?.status, to, reason });
  if (to === 'published' && prev?.status === 'pending') {
    const notify = await sql<{ id: string; reporter_email: string }[]>`select id, reporter_email from reports where business_id = ${id} and reason = 'suggestion' and status = 'open' and reporter_email is not null`;
    for (const n of notify) {
      const [b] = await sql<{ name: string; slug: string }[]>`select name, slug from businesses where id = ${id}`;
      await sendEmail({ to: n.reporter_email, template: 'suggestion_published', subject: `${b.name} is now on RateMe.ie`, text: `Thanks for your suggestion. ${b.name} is now listed and you can rate it here:\n${env.appUrl}/business/${b.slug}/review` });
    }
    await sql`update reports set status = 'actioned', resolved_by = ${staff.id}, resolved_at = now() where business_id = ${id} and reason = 'suggestion' and status = 'open'`;
  }
  redirect(`/admin/businesses/${id}?msg=${encodeURIComponent(`Status set to ${to}.`)}`);
}

export async function renameBusiness(form: FormData) {
  const staff = await requireStaff();
  const id = str(form, 'business_id'); const name = str(form, 'name', 120);
  if (!uuid(id) || name.length < 2) redirect('/admin/businesses');
  const [b] = await sql<{ slug: string; name: string }[]>`select slug, name from businesses where id = ${id}`;
  const slug = await uniqueSlug(slugify(name));
  try {
    await sql.begin(async (tx) => {
      await tx`insert into business_slug_history (slug, business_id) values (${b.slug}, ${id}) on conflict do nothing`;
      await tx`update businesses set name = ${name}, slug = ${slug}, updated_at = now() where id = ${id}`;
    });
  } catch {
    redirect(`/admin/businesses/${id}?msg=${encodeURIComponent('Rename failed — a business with that name exists in the same area.')}`);
  }
  await audit(staff.id, 'business.renamed', 'business', id, { from: b.name, to: name });
  redirect(`/admin/businesses/${id}?msg=${encodeURIComponent('Renamed. The old URL redirects permanently.')}`);
}

export async function revokeMember(form: FormData) {
  const staff = await requireStaff();
  const memberId = str(form, 'member_id'); const businessId = str(form, 'business_id');
  if (!uuid(memberId) || !uuid(businessId)) redirect('/admin/businesses');
  await sql`update business_members set status = 'revoked' where id = ${memberId} and business_id = ${businessId}`;
  const [left] = await sql`select 1 from business_members where business_id = ${businessId} and status = 'verified'`;
  if (!left) await sql`update businesses set ownership_verified_at = null where id = ${businessId}`;
  await audit(staff.id, 'business.member_revoked', 'business', businessId, { member: memberId });
  redirect(`/admin/businesses/${businessId}?msg=${encodeURIComponent('Access revoked.')}`);
}

export async function resolveReport(form: FormData) {
  const staff = await requireStaff();
  const id = str(form, 'report_id'); const outcome = str(form, 'outcome') === 'actioned' ? 'actioned' : 'dismissed'; const notes = str(form, 'notes');
  if (!uuid(id)) redirect('/admin/reports');
  await sql`update reports set status = ${outcome}, resolution_notes = ${notes || null}, resolved_by = ${staff.id}, resolved_at = now() where id = ${id}`;
  await audit(staff.id, 'report.resolved', 'report', id, { outcome });
  redirect('/admin/reports?msg=' + encodeURIComponent('Report resolved.'));
}

export async function updateDataRequest(form: FormData) {
  const staff = await requireStaff();
  const id = str(form, 'id'); const status = str(form, 'status'); const notes = str(form, 'notes');
  if (!uuid(id) || !['open', 'in_progress', 'closed'].includes(status)) redirect('/admin/data-requests');
  await sql`update data_requests set status = ${status}, notes = ${notes || null}, closed_at = case when ${status} = 'closed' then now() end where id = ${id}`;
  await audit(staff.id, 'data_request.updated', 'data_request', id, { status });
  redirect('/admin/data-requests');
}

// ── Admin-only ─────────────────────────────────────────────────────────────────
export async function saveCategory(form: FormData) {
  const staff = await requireStaff('admin');
  const id = Number(form.get('id') || 0);
  const name = str(form, 'name', 80); const slug = slugify(str(form, 'slug', 80) || name);
  const parent = Number(form.get('parent_id') || 0) || null; const sort = Number(form.get('sort_order') || 100); const active = form.get('active') === 'on';
  const description = str(form, 'description', 300) || null;
  if (name.length < 2 || !slug) redirect('/admin/categories?msg=' + encodeURIComponent('Name is required.'));
  try {
    if (id) await sql`update categories set name = ${name}, slug = ${slug}, parent_id = ${parent === id ? null : parent}, sort_order = ${sort}, active = ${active}, description = ${description} where id = ${id}`;
    else await sql`insert into categories (name, slug, parent_id, sort_order, description) values (${name}, ${slug}, ${parent}, ${sort}, ${description})`;
  } catch {
    redirect('/admin/categories?msg=' + encodeURIComponent('That slug is already in use.'));
  }
  await audit(staff.id, id ? 'category.updated' : 'category.created', 'category', String(id || slug), { name, slug, active });
  redirect('/admin/categories?msg=' + encodeURIComponent('Saved.'));
}

export async function savePlan(form: FormData) {
  const staff = await requireStaff('admin');
  const id = Number(form.get('id'));
  const euros = Number(String(form.get('amount') ?? '').replace(',', '.'));
  const name = str(form, 'name', 80); const description = str(form, 'description', 400);
  const active = form.get('active') === 'on'; const founding = form.get('is_founding') === 'on';
  if (!id || !(euros >= 1 && euros <= 10000) || name.length < 2) redirect('/admin/pricing?msg=' + encodeURIComponent('Enter a valid name and price.'));
  const cents = Math.round(euros * 100);
  await sql`update plans set name = ${name}, description = ${description}, amount_cents = ${cents}, active = ${active}, is_founding = ${founding}, updated_at = now() where id = ${id}`;
  await audit(staff.id, 'pricing.plan_updated', 'plan', String(id), { amount_cents: cents, active, is_founding: founding });
  redirect('/admin/pricing?msg=' + encodeURIComponent('Plan saved. Existing members keep the price they signed up at.'));
}

export async function saveMembershipSettings(form: FormData) {
  const staff = await requireStaff('admin');
  const grace = Math.max(0, Math.min(60, Number(form.get('grace_days') || 14)));
  const publicPlan = str(form, 'public_plan', 60);
  const [p] = await sql`select 1 from plans where code = ${publicPlan} and active`;
  if (!p) redirect('/admin/pricing?msg=' + encodeURIComponent('The plan offered at checkout must be active.'));
  await sql`update settings set value = ${sql.json({ grace_days: grace, public_plan: publicPlan })}, updated_at = now() where key = 'membership'`;
  await audit(staff.id, 'pricing.settings_updated', 'settings', 'membership', { grace_days: grace, public_plan: publicPlan });
  redirect('/admin/pricing?msg=' + encodeURIComponent('Settings saved.'));
}

export async function setUserState(form: FormData) {
  const staff = await requireStaff('admin');
  const id = str(form, 'user_id'); const action = str(form, 'action'); const reason = str(form, 'reason', 300);
  if (!uuid(id) || id === staff.id) redirect('/admin/users?msg=' + encodeURIComponent('You can’t change your own account here.'));
  if (action === 'suspend') {
    await sql`update users set status = 'suspended', suspended_reason = ${reason || null} where id = ${id} and status = 'active'`;
    await sql`delete from sessions where user_id = ${id}`;
  } else if (action === 'reactivate') {
    await sql`update users set status = 'active', suspended_reason = null where id = ${id} and status = 'suspended'`;
  } else if (['user', 'moderator', 'admin'].includes(action)) {
    await sql`update users set role = ${action} where id = ${id}`;
  } else redirect('/admin/users');
  await audit(staff.id, `user.${action}`, 'user', id, { reason });
  redirect('/admin/users?msg=' + encodeURIComponent('Updated.'));
}
