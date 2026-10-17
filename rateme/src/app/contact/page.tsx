import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';
import { RequestForm } from '@/components/RequestForm';
import { operator } from '@/lib/legal';

export const metadata: Metadata = { title: 'Complaints & contact', alternates: { canonical: '/contact' } };

export default async function Contact({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <LegalPage legal={false} title="Complaints & contact" intro={<>Questions, complaints or concerns about a listing, a review or our service. Email <a className="text-sea underline" href={`mailto:${operator.email}`}>{operator.email}</a> or use the form.</>}>
      <p>To report a specific review, use the “Report this review” link under it. To fix a listing’s details, use “Report incorrect information” on the business page. For anything else:</p>
      <RequestForm back="/contact" sent={sp.sent} error={sp.error} kinds={[['complaint', 'Complaint about RateMe.ie or a moderation decision'], ['legal_removal', 'Notice of illegal content (e.g. defamation)'], ['rectification', 'Correct information about me']]} />
    </LegalPage>
  );
}
