import type { Metadata } from 'next';
import { AuthShell } from '@/components/AuthShell';
import { ForgotForm } from '@/components/AuthForms';
export const metadata: Metadata = { title: 'Reset password', robots: { index: false } };
export default function Forgot() { return <AuthShell title="Reset your password"><ForgotForm /></AuthShell>; }
