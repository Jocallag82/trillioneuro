import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';
import { operator } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms of service', alternates: { canonical: '/terms' } };

export default function Terms() {
  return (
    <LegalPage title="Terms of service">
      <h2>1. About these terms</h2>
      <p>These terms apply to everyone who uses RateMe.ie, operated by {operator.name}. Business members also agree to the <Link href="/membership-terms">membership terms</Link>. Our <Link href="/review-policy">review policy</Link> forms part of these terms.</p>
      <h2>2. The service</h2>
      <p>RateMe.ie lets people find Irish businesses and publish ratings and reviews of their own experiences, and lets businesses manage a profile. Ratings are users’ opinions — not statements, endorsements or guarantees by us.</p>
      <h2>3. Reviewers</h2>
      <ul>
        <li>You must be 16 or over.</li>
        <li>You must only review genuine, personal, previous experiences, with no conflict of interest and no incentive.</li>
        <li>You keep ownership of your review and give us a non-exclusive, royalty-free licence to publish, display and moderate it on RateMe.ie and in search results while it is live.</li>
        <li>You’re responsible for what you write. Don’t post anything false, defamatory, abusive or that infringes others’ rights.</li>
      </ul>
      <h2>4. Businesses</h2>
      <ul>
        <li>Only people who own or are authorised to manage a business may claim it. Impersonation leads to removal and may be reported.</li>
        <li>Only legitimate businesses operating in the Republic of Ireland may be listed. We may refuse, suspend or remove listings that are misleading, duplicated or not genuine businesses.</li>
        <li>Businesses must not manipulate reviews — see section 8 of the review policy.</li>
      </ul>
      <h2>5. Our role</h2>
      <p>We host content provided by users and moderate it under our review policy. We act on notices of illegal content and explain our decisions. We don’t check every review in advance beyond the steps described in <Link href="/how-it-works">How ratings work</Link>.</p>
      <h2>6. Acceptable use</h2>
      <p>No scraping at scale, automated submissions, attempts to bypass rate limits or security, or use of the service to harass anyone.</p>
      <h2>7. Liability</h2>
      <p>Nothing in these terms limits liability that can’t be limited by law, or your statutory rights as a consumer. Otherwise, the service is provided as is, and we’re not liable for decisions made on the basis of users’ reviews.</p>
      <h2>8. Complaints and law</h2>
      <p>Contact us via the <Link href="/contact">complaints form</Link>. These terms are governed by Irish law and the Irish courts have jurisdiction, without affecting consumers’ rights to bring proceedings where they live in the EU.</p>
    </LegalPage>
  );
}
