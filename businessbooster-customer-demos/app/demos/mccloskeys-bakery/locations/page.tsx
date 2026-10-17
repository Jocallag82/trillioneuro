import Link from "next/link";
import { PageHeader } from "../_components/ui";
import { BASE, LOCATIONS, mapsUrl, telHref } from "../_data/content";

export const metadata = { title: "Cafés & shops" };

const TOWNS = ["All", "Drogheda", "Dundalk", "Navan"] as const;

export default async function Locations({ searchParams }: { searchParams: Promise<{ town?: string }> }) {
  const town = (await searchParams).town;
  const active = TOWNS.find((t) => t === town) ?? "All";
  const list = active === "All" ? LOCATIONS : LOCATIONS.filter((l) => l.town === active);

  return (
    <>
      <PageHeader eyebrow="Cafés & shops" title="Find your nearest McCloskey’s." intro="Bakery cafés and shops in Drogheda, Dundalk and Navan — every one a collection point for celebration cakes." />
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <nav aria-label="Filter by town" className="flex flex-wrap gap-2">
          {TOWNS.map((t) => (
            <Link
              key={t}
              href={t === "All" ? `${BASE}/locations` : `${BASE}/locations?town=${t}`}
              aria-current={t === active ? "true" : undefined}
              className="min-h-11 rounded-full border border-rye/20 px-5 py-2.5 text-sm hover:border-rye aria-[current=true]:border-rye aria-[current=true]:bg-rye aria-[current=true]:text-cream"
            >
              {t}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-sm text-cocoa" aria-live="polite">{list.length} {list.length === 1 ? "location" : "locations"}</p>

        <ul className="mt-8 grid gap-px border border-rye/10 bg-rye/10 md:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => (
            <li key={l.slug} className="flex flex-col bg-flour p-6">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-crust-deep">{l.kind} · {l.town}</p>
              <h2 className="mt-3 font-serif text-2xl">
                <Link href={`${BASE}/locations/${l.slug}`} className="hover:text-crust-deep">{l.name}</Link>
              </h2>
              <address className="mt-3 text-sm not-italic leading-relaxed text-cocoa">
                {l.address.map((a) => <span key={a} className="block">{a}</span>)}
                {l.eircode && <span className="block">{l.eircode}</span>}
              </address>
              {l.hours.length > 0 && (
                <dl className="mt-4 space-y-1 text-sm">
                  {l.hours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4">
                      <dt className="text-cocoa">{h.days}</dt>
                      <dd className="tabular-nums">{h.time}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-6 text-sm">
                <a href={mapsUrl(l)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-rye px-4 text-cream hover:bg-crust-deep">
                  Directions<span className="sr-only"> to {l.name} (opens Google Maps)</span>
                </a>
                {l.phone && (
                  <a href={telHref(l.phone)} className="inline-flex min-h-11 items-center rounded-full border border-rye/25 px-4 hover:border-rye">
                    Call {l.phone}
                  </a>
                )}
                <Link href={`${BASE}/locations/${l.slug}`} className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
                  Details
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-cocoa">Opening hours as published on mccloskeysbakery.ie. Holiday hours may differ.</p>
      </section>
    </>
  );
}
