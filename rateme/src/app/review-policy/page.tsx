import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';

export const metadata: Metadata = { title: 'Review policy', alternates: { canonical: '/review-policy' } };

export default function ReviewPolicy() {
  return (
    <LegalPage title="Review policy" intro="The rules every review, response and business on RateMe.ie must follow — and how they are enforced automatically and equally.">
      <h2>1. Principles</h2>
      <ul>
        <li>The same rules apply to every business, whether or not it pays for membership.</li>
        <li>Membership fees never affect ratings, review order or review visibility.</li>
        <li>We don’t remove a review because a business disagrees with it or because it’s negative.</li>
        <li>We never write, buy, generate or invent reviews, reviewers or testimonials.</li>
      </ul>
      <h2>2. What reviews must be</h2>
      <ul>
        <li>About the reviewer’s <strong>own, genuine, previous experience</strong> of the business’s products or services, within roughly the last three years.</li>
        <li>Written by someone with no conflict of interest — not the owner, staff, their relatives, or a competitor.</li>
        <li>Not given in exchange for any incentive (discounts, gifts, refunds, prize draws or payment).</li>
      </ul>
      <h2>3. What isn’t allowed</h2>
      <ul>
        <li>Personal information: phone numbers, email or home addresses, or details that identify staff or other customers beyond first names.</li>
        <li>Harassment, threats, hate speech or discriminatory content.</li>
        <li>Statements presented as fact that are false and damaging (possible defamation), or other unlawful content.</li>
        <li>Spam, advertising, links, or automated or bulk submissions.</li>
        <li>Duplicate reviews of the same experience, or reviews of a different business.</li>
      </ul>
      <h2>4. How enforcement works — fully automated</h2>
      <ol>
        <li>Every review is confirmed by email before publication.</li>
        <li>Reviews containing phone numbers, email addresses, links, threats or abusive language can’t be submitted — the reviewer is told what to fix.</li>
        <li>On confirmation, rating-blind rules reject reviews with a conflict of interest (for example an email on the business’s own domain, or a registered member of the business) and repeat reviews of the same business from the same network within 30 days.</li>
        <li>Verified owners can dispute up to 5 reviews every 30 days. Anyone can report a review; three reports from different people count as a dispute.</li>
        <li>A dispute automatically asks the reviewer to reconfirm. Reconfirmed reviews stay and can’t be disputed again by the business. Reviews not reconfirmed within 14 days are removed automatically.</li>
        <li>Every automated decision and its reason is logged.</li>
      </ol>
      <h2>5. Decisions and reasons</h2>
      <p>When a rule rejects or removes a review, we tell the reviewer which rule applied. When a dispute closes, the business is shown the outcome in its dashboard.</p>
      <h2>6. Restoring and complaints</h2>
      <p>A reviewer can restore a removed review at any time by reconfirming it from their private link, or write a new review that follows this policy. To object to an automated decision, or for anything the rules don’t cover, use our <Link href="/contact">complaints form</Link>. You may also have rights to take a complaint to an out-of-court dispute settlement body or to the courts.</p>
      <h2>7. Business responses</h2>
      <p>Responses must be professional and truthful. They must not reveal customer information, threaten (including legal threats), harass, or pressure a reviewer. Responses with contact details or abusive language can’t be published.</p>
      <h2>8. Soliciting reviews</h2>
      <p>Businesses may invite all customers to leave honest reviews. They must not: offer incentives; ask only satisfied customers; filter, gate or redirect dissatisfied customers; write reviews themselves; or ask staff, friends or family to. Serious or repeated breaches can lead to a public notice on the profile or suspension of membership without refund.</p>
      <h2>9. Legal notices</h2>
      <p>If you believe content is illegal (for example defamatory), use the report button on the review or our <Link href="/data-request">legal & privacy request form</Link>, explaining which content and why. We act on valid legal notices and tell you what we did.</p>
      <h2>10. Removing your own review</h2>
      <p>Reviewers can withdraw their own review at any time using their private manage link.</p>
    </LegalPage>
  );
}
