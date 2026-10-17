import type { Metadata } from 'next';
import { AuthShell } from '@/components/AuthShell';
import { ResetForm } from '@/components/AuthForms';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return <AuthShell title="Choose a new password"><ResetForm token={token} /></AuthShell>;
}
