import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';

export const metadata: Metadata = { title: 'How ratings work', description: 'How RateMe.ie collects, checks, moderates and displays customer ratings of Irish businesses.', alternates: { canonical: '/how-it-works' } };

export default function HowItWorks() {
  return (
    <LegalPage legal={false} title="How ratings work" intro="Plain answers about where ratings come from, what we check, and what we can’t promise.">
      <h2>Who can leave a rating</h2>
      <p>Anyone who has personally used an Irish business listed on RateMe.ie can rate it — free, without creating an account. Before submitting, every reviewer declares that the review is based on their own genuine experience, that they aren’t connected to the business or a competitor, and that they weren’t given anything in return.</p>

      <h2>What we check — and what we don’t</h2>
      <ul>
        <li><strong>Email confirmation.</strong> A review is only published after the reviewer clicks a link sent to their email address. One person can have one live review per business.</li>
        <li><strong>Automated, rating-blind checks.</strong> We look for personal information, links, threats and abusive language, conflicts of interest (for example a reviewer email on the business’s own domain), unusual bursts of reviews and repeated submissions from the same network. These checks treat a 1-star review and a 5-star review in exactly the same way.</li>
        <li><strong>Human moderation.</strong> Anything flagged, reported or disputed is reviewed by a moderator against our <Link href="/review-policy">review policy</Link>.</li>
        <li><strong>What we don’t do:</strong> we don’t independently verify that a purchase or visit took place. That’s why you won’t see a “verified purchase” badge on RateMe.ie. A reviewer’s declaration is not the same as independent proof, and we say so.</li>
      </ul>

      <h2>How the score is calculated</h2>
      <p>A business’s score is the simple average of all its <strong>published</strong> star ratings, shown to one decimal place, together with the number of ratings and how they’re distributed. Every published rating counts equally. We don’t weight, round up, hide or reorder ratings for anyone. If a business has no published ratings, we show no score at all.</p>
      <p>Reviews are shown newest first. Membership never changes the score, the order of reviews or whether a review appears.</p>

      <h2 id="badges">What the labels mean</h2>
      <ul>
        <li><strong>Owner verified</strong> — we’ve checked that a person managing the profile is connected to the business, using a business email address, control of the business’s website or domain, or a manual check of public records. It is not an endorsement of the business’s quality or a guarantee about its products or services.</li>
        <li><strong>Unclaimed listing</strong> — nobody has verified ownership yet. Listings can be suggested by customers so they can rate a business; we check suggestions before publishing them.</li>
        <li><strong>Paid member</strong> — the business pays an annual RateMe.ie membership for tools such as a QR code, replying to reviews and profile editing. It has no effect on ratings.</li>
      </ul>

      <h2>Businesses can reply, not remove</h2>
      <p>Verified owners can reply publicly to reviews and can ask a moderator to check a review they believe breaks the policy. A dispute is the business’s allegation — not a finding. The review stays visible while it’s checked and is only removed if a moderator concludes it breaks the policy. Reviewers are told the outcome and can ask for reconsideration.</p>

      <h2>Asking customers for reviews</h2>
      <p>Businesses may invite customers to rate them, for example with their QR code. They must ask customers fairly — not just the happy ones — and must not offer incentives for reviews or pressure anyone to change a rating. Every customer sees the same form; there is no route that sends unhappy customers somewhere private instead.</p>

      <h2>Not an endorsement</h2>
      <p>Ratings and reviews are the opinions of individual customers. They aren’t an endorsement, recommendation or guarantee by RateMe.ie.</p>
    </LegalPage>
  );
}
