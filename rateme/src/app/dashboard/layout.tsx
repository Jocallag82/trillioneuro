import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return <div className="container-x py-8 sm:py-10">{children}</div>;
}
