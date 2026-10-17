'use server';
import { z } from 'zod';
import { submitReview, EXPERIENCE_TYPES } from '@/lib/reviews';
import { screenText } from '@/lib/screening';
import { clientIp, hashIp, ipRateLimit, looksAutomated } from '@/lib/security';

export type ReviewFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; delivered?: boolean; email?: string };

const schema = z.object({
  business_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1, 'Choose a star rating.').max(5),
  title: z.string().trim().max(120, 'Keep the headline under 120 characters.').optional(),
  body: z.string().trim().max(4000, 'Keep your review under 4,000 characters.').optional(),
  experience_type: z.string().optional(),
  experience_month: z.string().regex(/^\d{4}-\d{2}$/, 'Tell us roughly when this happened.'),
  reviewer_name: z.string().trim().min(1, 'Add the name you’d like shown.').max(60),
  reviewer_email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
  declaration: z.literal('yes', { message: 'Please confirm this is your own genuine experience.' }),
  source: z.enum(['web', 'qr']).default('web'),
});

export async function submitReviewAction(_prev: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  if (looksAutomated(form)) return { error: 'Something went wrong. Please try again.' };
  if (!(await ipRateLimit('review-submit', 10, 3600))) return { error: 'Too many attempts. Please wait a while and try again.' };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: 'Please check the highlighted fields.', fieldErrors };
  }
  const d = parsed.data;
  // Policy breaches are blocked here, instantly and automatically, so the reviewer can fix them.
  const flags = screenText(d.title ?? null, d.body ?? null);
  if (flags.length) {
    const msg = flags.includes('threat') || flags.includes('abusive_language')
      ? 'Please remove threatening or abusive language — reviews must describe your experience.'
      : flags.includes('contact_details')
        ? 'Please remove phone numbers and email addresses — personal contact details can’t be published.'
        : 'Please remove web links — reviews can’t contain links.';
    return { error: msg, fieldErrors: { body: msg } };
  }
  // The experience must be in the past (up to 3 years) — this is about real, previous experiences.
  const [y, m] = d.experience_month.split('-').map(Number);
  const month = new Date(Date.UTC(y, m - 1, 1));
  const now = new Date();
  const earliest = new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), 1));
  if (month > now || month < earliest) return { error: 'Please choose a month within the last three years.', fieldErrors: { experience_month: 'Choose a month within the last three years.' } };
  const experienceType = d.experience_type && (EXPERIENCE_TYPES as readonly string[]).includes(d.experience_type) ? d.experience_type : null;
  const res = await submitReview({
    businessId: d.business_id, rating: d.rating, title: d.title || null, body: d.body || null, experienceType,
    experienceMonth: month.toISOString().slice(0, 10), reviewerName: d.reviewer_name, reviewerEmail: d.reviewer_email,
    declaration: true, source: d.source, ipHash: hashIp(await clientIp()),
  });
  if (!res.ok) return { error: res.error };
  return { ok: true, delivered: res.delivered, email: d.reviewer_email };
}
