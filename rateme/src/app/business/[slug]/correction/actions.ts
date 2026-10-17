'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { clientIp, hashIp, ipRateLimit, looksAutomated } from '@/lib/security';
import { currentUser } from '@/lib/auth';
import { slugify } from '@/lib/util';

const REASONS = ['wrong_details', 'closed', 'not_a_business', 'private_address', 'duplicate', 'impersonation', 'other'];

export async function reportCorrection(form: FormData) {
  const businessId = String(form.get('business_id') ?? '');
  const slug = slugify(String(form.get('slug') ?? ''));
  const reason = String(form.get('reason') ?? '');
  const details = String(form.get('details') ?? '').trim().slice(0, 2000);
  const back = `/business/${slug}/correction`;
  if (looksAutomated(form) || !REASONS.includes(reason) || details.length < 5 || !/^[0-9a-f-]{36}$/i.test(businessId)) redirect(`${back}?error=${encodeURIComponent('Please choose a reason and add some details.')}`);
  if (!(await ipRateLimit('correction', 10, 3600))) redirect(`${back}?error=${encodeURIComponent('Too many requests. Try again later.')}`);
  const email = String(form.get('email') ?? '').trim().slice(0, 200);
  const user = await currentUser();
  await sql`insert into reports (kind, business_id, reason, details, reporter_email, reporter_user_id, ip_hash)
            values ('business_info', ${businessId}, ${reason}, ${details}, ${email.includes('@') ? email : null}, ${user?.id ?? null}, ${hashIp(await clientIp())})`;
  redirect(`${back}?sent=1`);
}
