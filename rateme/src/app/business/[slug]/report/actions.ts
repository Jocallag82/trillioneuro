'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { REPORT_REASONS } from '@/lib/reviews';
import { clientIp, hashIp, ipRateLimit, looksAutomated } from '@/lib/security';
import { currentUser } from '@/lib/auth';
import { slugify } from '@/lib/util';

export async function reportReview(form: FormData) {
  const reviewId = String(form.get('review_id') ?? '');
  const slug = slugify(String(form.get('slug') ?? ''));
  const back = `/business/${slug}/report?review=${encodeURIComponent(reviewId)}`;
  const reason = String(form.get('reason') ?? '');
  if (looksAutomated(form) || !(reason in REPORT_REASONS) || !/^[0-9a-f-]{36}$/i.test(reviewId)) redirect(`${back}&error=${encodeURIComponent('Please choose a reason.')}`);
  if (!(await ipRateLimit('report', 10, 3600))) redirect(`${back}&error=${encodeURIComponent('Too many reports from this connection. Try again later.')}`);
  const email = String(form.get('email') ?? '').trim().slice(0, 200) || null;
  const details = String(form.get('details') ?? '').trim().slice(0, 2000) || null;
  const ipHash = hashIp(await clientIp());
  const user = await currentUser();
  const [r] = await sql<{ business_id: string }[]>`select business_id from reviews where id = ${reviewId} and status = 'published'`;
  if (!r) redirect(`/business/${slug}`);
  // One open report per review per connection is enough.
  const [dupe] = await sql`select 1 from reports where review_id = ${reviewId} and ip_hash = ${ipHash} and status = 'open'`;
  if (!dupe) {
    await sql`insert into reports (kind, review_id, business_id, reason, details, reporter_email, reporter_user_id, ip_hash)
              values ('review', ${reviewId}, ${r.business_id}, ${reason}, ${details}, ${email && email.includes('@') ? email : null}, ${user?.id ?? null}, ${ipHash})`;
    await sql`insert into moderation_actions (review_id, action, reason) values (${reviewId}, 'reported', ${REPORT_REASONS[reason as keyof typeof REPORT_REASONS]})`;
  }
  redirect(`${back}&sent=1`);
}
