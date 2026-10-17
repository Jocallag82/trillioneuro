import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';

export const metadata: Metadata = { title: 'Review & moderation policy', alternates: { canonical: '/review-policy' } };

export default function ReviewPolicy() {
  return (
    <LegalPage title="Review & moderation policy" intro="The rules every review, response and business on RateMe.ie must follow — and how we enforce them fairly.">
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
      <h2>4. How moderation works</h2>
      <ol>
        <li>Every review is confirmed by email before publication.</li>
        <li>Automated checks (blind to the star rating) may hold a review for a moderator.</li>
        <li>Anyone can report a published review. Reports don’t remove reviews automatically.</li>
        <li>Verified business owners can dispute a review. The dispute is treated as an allegation; the review remains visible until a moderator makes a finding.</li>
        <li>Moderators record the reason, evidence considered and outcome. Every decision is logged.</li>
      </ol>
      <h2>5. Decisions and reasons</h2>
      <p>If we reject or remove a review, we tell the reviewer which part of this policy it breached. If we decide on a business’s dispute, we tell the business our finding. Possible outcomes: publish, keep published, reject, remove, or hide a business response.</p>
      <h2>6. Appeals and reconsideration</h2>
      <p>Reviewers can ask us to reconsider using the private link in their confirmation email. Businesses can raise a new dispute with new information. Where possible a different moderator handles the reconsideration. You may also have rights to take a complaint to an out-of-court dispute settlement body or to the courts.</p>
      <h2>7. Business responses</h2>
      <p>Responses must be professional and truthful. They must not reveal customer information, threaten (including legal threats), harass, or pressure a reviewer. Responses breaking these rules can be hidden.</p>
      <h2>8. Soliciting reviews</h2>
      <p>Businesses may invite all customers to leave honest reviews. They must not: offer incentives; ask only satisfied customers; filter, gate or redirect dissatisfied customers; write reviews themselves; or ask staff, friends or family to. We may remove affected reviews, add a public notice to the profile, or suspend a membership without refund for serious or repeated breaches.</p>
      <h2>9. Legal notices</h2>
      <p>If you believe content is illegal (for example defamatory), use the report button on the review or our <Link href="/data-request">legal & privacy request form</Link>, explaining which content and why. We assess notices diligently and objectively and tell you what we decided.</p>
      <h2>10. Removing your own review</h2>
      <p>Reviewers can withdraw their own review at any time using their private manage link.</p>
    </LegalPage>
  );
}
