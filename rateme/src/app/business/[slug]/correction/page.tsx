import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/lib/businesses';
import { BotFields, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { reportCorrection } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Report incorrect information', robots: { index: false } };

const CORRECTION_REASONS: Record<string, string> = {
  wrong_details: 'Contact details, address or website are wrong',
  closed: 'The business has closed permanently',
  not_a_business: 'This isn’t a legitimate business',
  private_address: 'It shows a private home address',
  duplicate: 'It’s a duplicate of another listing',
  impersonation: 'Someone is impersonating this business',
  other: 'Something else',
};

export default async function Correction({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { slug } = await params; const { sent, error } = await searchParams;
  const { business: b } = await getBusinessBySlug(slug);
  if (!b || b.status !== 'published') notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Report incorrect information</h1>
      <p className="mt-2 text-ink-2">Help us keep <strong>{b.name}</strong>’s listing accurate. We review every correction before changing anything.</p>
      {sent ? (
        <div className="mt-6 space-y-4"><Notice kind="ok">Thanks — we’ll review this.</Notice><Link className="btn btn-ghost" href={`/business/${slug}`}>Back to the business</Link></div>
      ) : (
        <form action={reportCorrection} className="mt-6 space-y-5">
          {error && <Notice kind="error">{error}</Notice>}
          <input type="hidden" name="business_id" value={b.id} /><input type="hidden" name="slug" value={slug} />
          <BotFields />
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">What’s wrong?</legend>
            {Object.entries(CORRECTION_REASONS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3"><input type="radio" name="reason" value={k} required className="h-4 w-4 accent-[#1d4a35]" />{v}</label>
            ))}
          </fieldset>
          <label className="field"><span className="label">Details</span><textarea name="details" className="textarea" required minLength={5} maxLength={2000} /></label>
          <label className="field"><span className="label">Your email <span className="font-normal text-muted">(optional)</span></span><input name="email" type="email" className="input" /></label>
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
        </form>
      )}
    </div>
  );
}
