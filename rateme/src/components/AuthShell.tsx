import type { ReactNode } from 'react';
export function AuthShell({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="container-x grid gap-10 py-12 lg:grid-cols-[1fr_26rem] lg:py-20">
      <div className="hidden lg:block">{aside}</div>
      <div className="card p-6 sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
