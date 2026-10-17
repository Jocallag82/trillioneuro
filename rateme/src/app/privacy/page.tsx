import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';
import { operator } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy notice', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" intro="What personal data RateMe.ie collects, why, how long we keep it, and your rights under the GDPR.">
      <h2>Who we are</h2>
      <p>The data controller is {operator.name}{operator.address ? `, ${operator.address}` : ''}{operator.cro ? ` (CRO ${operator.cro})` : ''}. Contact us about privacy at <a href={`mailto:${operator.privacyEmail}`}>{operator.privacyEmail}</a>.</p>
      <h2>Reviewers</h2>
      <table className="table-rm"><thead><tr><th>Data</th><th>Why</th><th>Lawful basis</th><th>Kept</th></tr></thead><tbody>
        <tr><td>Email address</td><td>Confirm the review, let you manage it, tell you about automated decisions and ask you to reconfirm if your review is disputed</td><td>Legitimate interests (review integrity); contract</td><td>While the review exists, then up to 12 months</td></tr>
        <tr><td>Display name, rating, review text, experience month/type</td><td>Publishing your review</td><td>Contract (our terms)</td><td>Until you withdraw it or it’s removed</td></tr>
        <tr><td>Keyed hash of your IP address</td><td>Preventing spam, fake and duplicate reviews</td><td>Legitimate interests</td><td>90 days</td></tr>
        <tr><td>Unconfirmed reviews</td><td>Waiting for email confirmation</td><td>Legitimate interests</td><td>Deleted after 14 days</td></tr>
      </tbody></table>
      <p>Your email is never published or shown to the business. Please don’t include sensitive personal data (for example health information) in a review.</p>
      <h2>Business account holders</h2>
      <table className="table-rm"><thead><tr><th>Data</th><th>Why</th><th>Lawful basis</th><th>Kept</th></tr></thead><tbody>
        <tr><td>Name, email, password (hashed)</td><td>Your account</td><td>Contract</td><td>Until you delete your account</td></tr>
        <tr><td>Verification evidence, phone number</td><td>Checking you own or manage the business</td><td>Legitimate interests (preventing impersonation)</td><td>Up to 2 years after the decision</td></tr>
        <tr><td>Billing records (no card numbers)</td><td>Membership, invoices, tax law</td><td>Contract; legal obligation</td><td>6 years (Irish tax rules)</td></tr>
        <tr><td>Audit records of sensitive actions</td><td>Security and accountability</td><td>Legitimate interests</td><td>Up to 2 years</td></tr>
      </tbody></table>
      <h2>Business listings</h2>
      <p>Listings contain business information. Sole traders’ listings may include their name. We don’t publish home addresses unless the business chooses to; you can ask us to correct or remove inaccurate details via the listing’s “report incorrect information” link.</p>
      <h2>Processors we use</h2>
      <ul>
        <li>Vercel Inc. — hosting.</li>
        <li>Supabase Inc. — database, hosted in the EU (Ireland).</li>
        <li>Stripe Payments Europe Ltd — payment processing. Card details go directly to Stripe; we never see or store them.</li>
        <li>Our transactional email provider — sending account and review emails.</li>
      </ul>
      <p>Some processors may transfer data outside the EEA under the European Commission’s standard contractual clauses or adequacy decisions.</p>
      <h2>Cookies</h2>
      <p>We use one strictly necessary cookie to keep you signed in. See the <Link href="/cookies">cookie policy</Link>.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct, erase, restrict or port your data, and object to processing based on legitimate interests. Account holders can download their data and delete their account from Account settings. Anyone can use our <Link href="/data-request">privacy request form</Link>. We reply within one month. You can also complain to the Data Protection Commission (dataprotection.ie).</p>
      <h2>Automated decisions</h2>
      <p>Reviews are moderated automatically, without human review. Automated rules can reject a review (for example a conflict of interest) or remove it if the reviewer doesn’t reconfirm it after a dispute. We always tell you which rule applied, and you can restore a removed review by reconfirming it, write a new review, or contact us to object to an automated decision.</p>
    </LegalPage>
  );
}
