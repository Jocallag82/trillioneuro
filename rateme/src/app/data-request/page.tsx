import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';
import { RequestForm } from '@/components/RequestForm';

export const metadata: Metadata = { title: 'Privacy & legal requests', alternates: { canonical: '/data-request' } };

export default async function DataRequest({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <LegalPage legal={false} title="Privacy & legal requests" intro="Exercise your data-protection rights or send a legal notice about content.">
      <p>Account holders can download or delete their data instantly from Account settings. Reviewers can withdraw a review from their private manage link. For everything else, tell us what you need. We may ask you to confirm your identity before acting.</p>
      <RequestForm back="/data-request" sent={sp.sent} error={sp.error} kinds={[['access', 'Access — a copy of my data'], ['erasure', 'Erasure — delete my data'], ['rectification', 'Rectification — correct my data'], ['objection', 'Objection to processing'], ['legal_removal', 'Notice of illegal content']]} />
    </LegalPage>
  );
}
