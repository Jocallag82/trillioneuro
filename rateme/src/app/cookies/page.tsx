import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';
export const metadata: Metadata = { title: 'Cookie policy', alternates: { canonical: '/cookies' } };
export default function Cookies() {
  return (
    <LegalPage title="Cookie policy">
      <p>RateMe.ie uses only cookies that are strictly necessary for the service you ask for, so no consent banner is needed.</p>
      <table className="table-rm"><thead><tr><th>Name</th><th>Purpose</th><th>Duration</th></tr></thead>
        <tbody><tr><td><code>rm_session</code></td><td>Keeps you signed in to your account. Set only when you sign in.</td><td>30 days, or until you sign out</td></tr></tbody></table>
      <p>We don’t use advertising, tracking or third-party analytics cookies. Business activity numbers (profile views, QR scans) are counted on our server without cookies. If we ever add non-essential cookies, we will ask for your consent first.</p>
    </LegalPage>
  );
}
