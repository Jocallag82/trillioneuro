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
        <li><strong>Rating-blind checks.</strong> We check for personal information, links, threats and abusive language, conflicts of interest (for example a reviewer email on the business’s own domain) and repeat reviews from the same network. A 1-star review and a 5-star review are treated in exactly the same way.</li>
        <li><strong>Automated screening, human disputes.</strong> Reviews containing personal contact details, links, threats or abuse can’t be submitted. Reviews from people connected to the business are rejected automatically. Nobody at RateMe.ie picks which reviews appear.</li>
        <li><strong>What we don’t do:</strong> we don’t independently verify that a purchase or visit took place. That’s why you won’t see a “verified purchase” badge on RateMe.ie. A reviewer’s declaration is not the same as independent proof, and we say so.</li>
      </ul>

      <h2>How the score is calculated</h2>
      <p>A business’s score is the simple average of all its <strong>published</strong> star ratings, shown to one decimal place, together with the number of ratings and how they’re distributed. Every published rating counts equally. We don’t weight, round up, hide or reorder ratings for anyone. If a business has no published ratings, we show no score at all.</p>
      <p>Reviews are shown newest first. Membership never changes the score, the order of reviews or whether a review appears.</p>

      <h2 id="ranking">How lists are ordered</h2>
      <ul>
        <li><strong>Most reviewed</strong> (the default on category and county pages): most published reviews first. Businesses without reviews are still listed, after those with reviews, and are never shown as badly rated.</li>
        <li><strong>Highest rated</strong>: highest average first, but only for businesses with at least 5 published reviews, so a single review can’t put a business at the top.</li>
        <li><strong>Recently reviewed</strong>: businesses with the newest published review first.</li>
        <li><strong>Newly listed</strong>: the most recently added listings first.</li>
        <li><strong>Best match</strong> (search): closest name or service match first.</li>
      </ul>
      <p>Paid membership is never an input to any of these orders, and nobody can pay for placement.</p>

      <h2 id="badges">What the labels mean</h2>
      <ul>
        <li><strong>Owner verified</strong> — we’ve checked that a person managing the profile is connected to the business, using a business email address, control of the business’s website or domain, or a manual check of public records. It is not an endorsement of the business’s quality or a guarantee about its products or services.</li>
        <li><strong>Unclaimed listing</strong> — nobody has verified ownership yet. Listings can be suggested by customers so they can rate a business; we check suggestions before publishing them.</li>
        <li><strong>Paid member</strong> — the business pays an annual RateMe.ie membership for tools such as a QR code, replying to reviews and profile editing. It has no effect on ratings.</li>
      </ul>

      <h2 id="confidence">Score confidence</h2>
      <p>Next to every score we show how much weight it can bear, using only the number and age of published reviews: <strong>Early score</strong> (fewer than 5 reviews — one more can change it a lot), <strong>Building</strong> (5–19) and <strong>Established</strong> (20 or more). If there has been no new review for 12 months we say so, because the score may not reflect the business today. This indicator is not a statistical guarantee and says nothing about whether any individual review is genuine. Membership never affects it.</p>

      <h2 id="disputes">Disputes are fair to both sides</h2>
      <p>Verified owners can reply publicly and can dispute a review, choosing a specific reason and adding evidence. A dispute doesn’t remove anything by itself and the review stays published while it’s looked at. We email the reviewer, who can stand by the review (adding their side for our moderators) or withdraw it. If the reviewer stands by it and the business gave no evidence, the review stays. If the business supplied evidence, the allegation is a policy breach such as personal information or abuse, or the reviewer doesn’t reply within 14 days, a RateMe.ie moderator decides. A reviewer not replying is not treated as proof the review is fake. Every decision comes with a written finding sent to both sides, and either side can appeal once within 30 days. When several visitors report the same review, the same process runs. Businesses can dispute up to 5 reviews every 30 days, and membership plays no part.</p>

      <h2>Asking customers for reviews</h2>
      <p>Businesses may invite customers to rate them, for example with their QR code. They must ask customers fairly — not just the happy ones — and must not offer incentives for reviews or pressure anyone to change a rating. Every customer sees the same form; there is no route that sends unhappy customers somewhere private instead.</p>

      <h2>Not an endorsement</h2>
      <p>Ratings and reviews are the opinions of individual customers. They aren’t an endorsement, recommendation or guarantee by RateMe.ie.</p>
    </LegalPage>
  );
}
