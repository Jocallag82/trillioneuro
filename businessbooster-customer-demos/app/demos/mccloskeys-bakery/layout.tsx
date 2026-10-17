import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { BASE, CONTACT, LOCATIONS } from "./_data/content";
import { DemoNotice } from "./_components/DemoNotice";

export const dynamic = "force-dynamic";

// Deliberately no Open Graph, canonical or structured data: the concept must never present as the official site.
export const metadata: Metadata = {
  title: { default: "McCloskey’s Bakery — website concept", template: "%s — McCloskey’s concept" },
  description: "Private website concept by BusinessBooster.ie. Not the official McCloskey’s Bakery website.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

const NAV = [
  { href: `${BASE}/cakes`, label: "Celebration cakes" },
  { href: `${BASE}/bakery`, label: "Bread & bakery" },
  { href: `${BASE}/locations`, label: "Cafés & shops" },
  { href: `${BASE}/trade`, label: "Trade" },
  { href: `${BASE}/our-story`, label: "Our story" },
];

export default function BakeryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-flour font-sans text-rye selection:bg-crust/20">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-rye focus:px-4 focus:py-2 focus:text-cream">
        Skip to content
      </a>
      <div className="bg-rye text-oat">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2 sm:px-8">
          <DemoNotice />
          {/* POST form, not a link: link prefetching must never be able to end the session. */}
          <form action="/logout" method="post" className="shrink-0">
            <button type="submit" className="text-[0.78rem] underline underline-offset-2 hover:text-cream">
              Exit preview
            </button>
          </form>
        </div>
      </div>
      <SiteNav home={BASE} brand="McCloskey’s" brandSub="Bakery · Since 1940" items={NAV} cta={{ href: `${BASE}/cakes`, label: "Order a cake" }} />
      <main id="main">{children}</main>
      <footer className="mt-24 border-t border-rye/10 bg-oat/60">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="font-serif text-2xl font-semibold">McCloskey’s</p>
            <p className="mt-3 max-w-xs text-sm text-cocoa">A family bakery in Drogheda since 1940. Bakery cafés in Drogheda, Dundalk and Navan.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm md:col-span-5">
            <div>
              <p className="font-medium">Shop</p>
              <ul className="mt-3 space-y-2 text-cocoa">
                {NAV.slice(0, 3).map((n) => (
                  <li key={n.href}><Link className="hover:text-crust-deep" href={n.href}>{n.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">Company</p>
              <ul className="mt-3 space-y-2 text-cocoa">
                {NAV.slice(3).map((n) => (
                  <li key={n.href}><Link className="hover:text-crust-deep" href={n.href}>{n.label}</Link></li>
                ))}
                <li><Link className="hover:text-crust-deep" href={`${BASE}/contact`}>Contact</Link></li>
              </ul>
            </div>
          </nav>
          <div className="text-sm text-cocoa md:col-span-3">
            <p className="font-medium text-rye">Get in touch</p>
            <p className="mt-3">{CONTACT.email}</p>
            <p className="mt-1">{LOCATIONS.length - 1} cafés &amp; shops</p>
          </div>
        </div>
        <div className="border-t border-rye/10">
          <div className="mx-auto max-w-7xl px-5 py-6 text-cocoa sm:px-8">
            <DemoNotice />
            <p className="mt-2 text-[0.72rem] text-cocoa">
              Illustrations are provisional placeholders for photography. Product listings marked “to be confirmed” are illustrative.
              No orders, payments or enquiries are processed. BusinessBooster.ie is operated by Conjora.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
