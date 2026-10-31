import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { claimLink, claimQrSvg } from '@/lib/outreach';
import { publicPlan } from '@/lib/membership';
import { formatEuro } from '@/lib/format';
import { operator } from '@/lib/legal';
import { LogoMark } from '@/components/Logo';
import { PrintButton } from '@/components/PrintButton';

export const metadata = { title: 'Print outreach material' };

export default async function PrintOutreach({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  await requireStaff('admin');
  const { id } = await params; const kind = (await searchParams).kind === 'flyer' ? 'flyer' : 'letter';
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [b] = await sql<{ name: string; slug: string; rating_count: number; contact_name: string | null; claim_token: string | null }[]>`
    select b.name, b.slug, b.rating_count, p.contact_name, p.claim_token from businesses b join outreach_prospects p on p.business_id = b.id where b.id = ${id}`;
  if (!b?.claim_token) notFound();
  const [svg, plan] = await Promise.all([claimQrSvg(b.claim_token), publicPlan()]);
  const link = claimLink(b.claim_token).replace(/^https?:\/\//, '');
  const price = plan ? formatEuro(plan.amount_cents) : null;
  const brand = <span className="inline-flex items-center gap-2"><LogoMark size={30} /><span className="display text-xl font-semibold">RateMe<span className="text-sea">.ie</span></span></span>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex justify-between"><p className="text-sm text-muted">Print on A4 at 100%. Scan the QR yourself before posting.</p><PrintButton /></div>
      {kind === 'letter' ? (
        <article className="bg-white p-10 leading-relaxed">
          {brand}
          <p className="mt-10">{b.contact_name ? `Dear ${b.contact_name},` : `To the owner of ${b.name},`}</p>
          <p className="mt-4"><strong>{b.name}</strong> has a listing on RateMe.ie, an independent Irish site where customers rate local businesses{b.rating_count > 0 ? `. It already has ${b.rating_count} published customer ${b.rating_count === 1 ? 'review' : 'reviews'}` : ''}.</p>
          <p className="mt-4">You can claim it <strong>free</strong>: check the details are right, see how many people view your profile, and dispute any review you believe isn’t genuine. Nobody can pay to change a rating, including us.</p>
          <p className="mt-4">If you want help collecting more reviews, membership{price ? ` is ${price} a year` : ''} and adds a permanent QR code with a printed kit (poster, counter cards, invoice slips, van artwork), public replies to reviews, and a dashboard showing which invitations work. It’s optional and you can cancel at any time.</p>
          <div className="mt-8 flex items-center gap-6 rounded-2xl border border-line p-5">
            <div className="w-36 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR code to claim this listing" />
            <div><p className="font-semibold">Scan to claim {b.name}</p><p className="mt-1 break-all text-sm text-muted">or visit {link}</p></div>
          </div>
          <p className="mt-8">Kind regards,</p><p className="mt-8">{operator.complete ? operator.name : 'RateMe.ie'}</p>
          <p className="mt-10 text-xs text-muted">Don’t want to hear from us again? Email {operator.email} and we’ll mark your business “do not contact”. Listing details can be corrected or removed on request.</p>
        </article>
      ) : (
        <article className="rounded-[1.5rem] border-2 border-ink bg-white p-10 text-center">
          {brand}
          <p className="display mt-8 text-4xl font-semibold leading-tight">{b.name} is on RateMe.ie</p>
          <p className="mt-3 text-lg">Claim your free listing. See who’s viewing it. Reply to customers.</p>
          <div className="mx-auto mt-8 w-56" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR code to claim this listing" />
          <p className="mt-4 text-sm text-muted">{link}</p>
          <ul className="mx-auto mt-8 max-w-md space-y-2 text-left">
            <li>✓ Free to claim and verify</li><li>✓ No one can pay for a better rating</li>
            <li>✓ Optional membership{price ? ` ${price}/year` : ''}: QR review kit, replies, full dashboard</li>
          </ul>
        </article>
      )}
    </div>
  );
}
