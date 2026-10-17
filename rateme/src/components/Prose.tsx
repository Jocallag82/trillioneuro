import type { ReactNode } from 'react';
import { operator, LEGAL_UPDATED } from '@/lib/legal';

export function LegalPage({ title, intro, children, legal = true }: { title: string; intro?: ReactNode; children: ReactNode; legal?: boolean }) {
  return (
    <div className="container-x py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold">{title}</h1>
        {legal && <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>}
        {legal && !operator.complete && (
          <p className="notice notice-warn mt-4 text-sm">Pre-launch draft. The operator’s legal name and registered address will be published here before RateMe.ie accepts payments from the public.</p>
        )}
        {intro && <div className="mt-4 text-lg text-ink-2">{intro}</div>}
        <div className="prose-rm mt-6">{children}</div>
      </div>
    </div>
  );
}
