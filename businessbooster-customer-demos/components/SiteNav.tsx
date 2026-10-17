"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
}

/** Generic responsive header. Brand text arrives as props so no prospect data lives in the client bundle. */
export function SiteNav({ home, brand, brandSub, items, cta }: { home: string; brand: string; brandSub: string; items: NavItem[]; cta: NavItem }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === home ? pathname === home : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-rye/10 bg-flour/90 backdrop-blur supports-[backdrop-filter]:bg-flour/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href={home} className="group flex flex-col leading-none" aria-label={`${brand} home`}>
          <span className="font-serif text-[1.35rem] font-semibold tracking-tight text-rye">{brand}</span>
          <span className="mt-1 text-[0.62rem] font-medium uppercase tracking-[0.22em] text-cocoa">{brandSub}</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={isActive(i.href) ? "page" : undefined}
                  className="rounded-full px-3.5 py-2 text-sm text-cocoa transition-colors hover:bg-oat hover:text-rye aria-[current=page]:text-crust-deep aria-[current=page]:font-medium"
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={cta.href}
            className="hidden rounded-full bg-rye px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-crust-deep sm:inline-flex"
          >
            {cta.label}
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-rye hover:bg-oat lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto border-t border-rye/10 bg-flour lg:hidden">
          <nav aria-label="Mobile" className="px-5 pb-10 pt-4">
            <ul className="divide-y divide-rye/10 border-y border-rye/10">
              {[{ href: home, label: "Home" }, ...items].map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={isActive(i.href) ? "page" : undefined}
                    className="flex items-center justify-between py-4 font-serif text-2xl text-rye aria-[current=page]:text-crust-deep"
                  >
                    {i.label}
                    <span aria-hidden className="text-base text-cocoa">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={cta.href} className="mt-8 flex justify-center rounded-full bg-rye px-5 py-4 text-base font-medium text-cream">
              {cta.label}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
