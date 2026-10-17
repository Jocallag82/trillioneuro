import Link from "next/link";
import { notFound } from "next/navigation";
import { Art } from "../../_components/Art";
import { DemoNotice } from "../../_components/DemoNotice";
import { ButtonLink, Eyebrow } from "../../_components/ui";
import { BASE, LOCATIONS, getLocation, mapsUrl, telHref } from "../../_data/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const l = getLocation((await params).slug);
  return { title: l ? `${l.name}, ${l.town}` : "Location not found" };
}

export default async function LocationDetail({ params }: Props) {
  const l = getLocation((await params).slug);
  if (!l) notFound();
  const isTrade = l.kind === "Bakery & trade office";
  const nearby = LOCATIONS.filter((x) => x.slug !== l.slug && x.kind !== "Bakery & trade office").slice(0, 3);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-5 pt-8 text-sm text-cocoa sm:px-8">
        <ol className="flex gap-2">
          <li><Link href={`${BASE}/locations`} className="hover:text-rye">Cafés &amp; shops</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-rye">{l.name}</li>
        </ol>
      </nav>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pt-10 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <Eyebrow>{l.kind} · {l.town}</Eyebrow>
          <h1 className="mt-4 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">{l.name}</h1>
          {l.note && <p className="mt-5 text-lg text-cocoa">{l.note}</p>}

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em]">Address</h2>
              <address className="mt-3 not-italic leading-relaxed">
                {l.address.map((a) => <span key={a} className="block">{a}</span>)}
                {l.eircode && <span className="block">{l.eircode}</span>}
              </address>
            </div>
            {l.hours.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em]">Opening hours</h2>
                <dl className="mt-3 space-y-1">
                  {l.hours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4">
                      <dt className="text-cocoa">{h.days}</dt>
                      <dd className="tabular-nums">{h.time}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a href={mapsUrl(l)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-full bg-rye px-6 text-sm font-medium text-cream hover:bg-crust-deep">
              Get directions<span className="sr-only"> (opens Google Maps)</span>
            </a>
            {l.phone && (
              <a href={telHref(l.phone)} className="inline-flex min-h-12 items-center rounded-full border border-rye/25 px-6 text-sm font-medium hover:border-rye">
                Call {l.phone}
              </a>
            )}
          </div>
          {!l.phone && <p className="mt-4 text-sm text-cocoa">Phone number to be confirmed.</p>}

          <div className="mt-12 border-t border-rye/10 pt-8">
            {isTrade ? (
              <ButtonLink href={`${BASE}/trade#enquire`}>Make a trade enquiry <span aria-hidden>→</span></ButtonLink>
            ) : (
              <>
                <p className="font-serif text-2xl">Collect your celebration cake here.</p>
                <div className="mt-4"><ButtonLink href={`${BASE}/cakes`}>Browse cakes <span aria-hidden>→</span></ButtonLink></div>
              </>
            )}
          </div>
          <DemoNotice className="mt-10 text-cocoa" />
        </div>
        <div className="lg:col-span-6">
          <Art kind={isTrade ? "trade" : l.kind === "Café" ? "cafe" : "loaf"} label={`Illustration for ${l.name}`} className="aspect-[4/5] w-full" />
        </div>
      </section>

      {!isTrade && (
        <section className="mx-auto mt-24 max-w-7xl px-5 sm:px-8">
          <h2 className="font-serif text-3xl">Other locations</h2>
          <ul className="mt-6 grid gap-px border border-rye/10 bg-rye/10 sm:grid-cols-3">
            {nearby.map((n) => (
              <li key={n.slug} className="bg-flour">
                <Link href={`${BASE}/locations/${n.slug}`} className="block p-5 hover:bg-cream">
                  <span className="block text-xs uppercase tracking-[0.18em] text-cocoa">{n.town}</span>
                  <span className="mt-1 block font-serif text-xl">{n.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
