'use client';
import Link from 'next/link';
import { useState } from 'react';

export function MobileMenu({ nav, signedIn, staff }: { nav: { href: string; label: string }[]; signedIn: boolean; staff: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="lg:hidden">
      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : 'Menu'}
      </button>
      {open && (
        <div id="mobile-nav" className="absolute inset-x-0 top-16 border-b border-line bg-paper shadow-lg">
          <nav aria-label="Mobile" className="container-x flex flex-col py-3">
            {nav.map((n) => <Link key={n.href} href={n.href} onClick={close} className="rounded-lg px-2 py-3 text-lg font-medium">{n.label}</Link>)}
            <div className="mt-2 flex gap-2 border-t border-line pt-4">
              {signedIn ? (
                <>
                  <Link href="/dashboard" onClick={close} className="btn btn-ink flex-1">Dashboard</Link>
                  {staff && <Link href="/admin" onClick={close} className="btn btn-ghost">Admin</Link>}
                </>
              ) : (
                <>
                  <Link href="/login" onClick={close} className="btn btn-ghost flex-1">Sign in</Link>
                  <Link href="/for-business" onClick={close} className="btn btn-primary flex-1">List your business</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
