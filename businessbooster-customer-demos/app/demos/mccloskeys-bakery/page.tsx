import Link from "next/link";
import { Art } from "./_components/Art";
import { ButtonLink, Eyebrow } from "./_components/ui";
import { BASE, CAKE_PROMISE, CAKES, LOCATIONS, TRADE } from "./_data/content";

const towns = ["Drogheda", "Dundalk", "Navan"] as const;

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-12 lg:items-end lg:gap-14 lg:pt-16">
        <div className="lg:col-span-6 lg:pb-8">
          <Eyebrow>Family bakers in Drogheda since 1940</Eyebrow>
          <h1 className="mt-5 font-serif text-[3rem] leading-[0.98] tracking-tight sm:text-7xl lg:text-[5.4rem]">
            Baked fresh in the north-east, <em className="font-normal text-crust-deep">every single day.</em>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-cocoa">
            Three generations of McCloskeys have baked for Louth and Meath. Order a celebration cake for same-day
            delivery to your nearest store, visit one of our bakery cafés, or supply your business from our Drogheda bakery.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href={`${BASE}/cakes`}>Order a celebration cake <span aria-hidden>→</span></ButtonLink>
            <ButtonLink href={`${BASE}/locations`} variant="ghost">Find a café or shop</ButtonLink>
          </div>
        </div>
        <div className="relative lg:col-span-6">
          <div className="overflow-hidden rounded-[2px] shadow-[0_30px_80px_-40px_rgba(42,31,23,0.55)]">
            <Art kind="hero" label="Illustration of a scored loaf beside a cup of coffee" className="aspect-[4/3] w-full" />
          </div>
          <div className="absolute -bottom-6 left-5 right-5 grid grid-cols-3 divide-x divide-rye/10 bg-cream text-center shadow-lg sm:left-auto sm:right-6 sm:w-[26rem]">
            {[
              ["1940", "Established"],
              ["3", "Generations"],
              ["3", "Towns"],
            ].map(([v, l]) => (
              <div key={l} className="px-3 py-4">
                <p className="font-serif text-2xl font-semibold">{v}</p>
                <p className="mt-1 text-[0.68rem] uppercase tracking-[0.18em] text-cocoa">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick paths */}
      <section aria-label="Explore" className="mx-auto mt-10 max-w-7xl px-5 sm:px-8">
        <ul className="grid gap-px overflow-hidden border border-rye/10 bg-rye/10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: `${BASE}/cakes`, k: "01", t: "Celebration cakes", d: "Order online, collect in store" },
            { href: `${BASE}/bakery`, k: "02", t: "Bread & bakery", d: "Brown breads, soda, rolls & more" },
            { href: `${BASE}/locations`, k: "03", t: "Cafés & shops", d: "Drogheda · Dundalk · Navan" },
            { href: `${BASE}/trade`, k: "04", t: "Trade & wholesale", d: "Fresh, frozen & par-baked supply" },
          ].map((p) => (
            <li key={p.href} className="bg-flour">
              <Link href={p.href} className="group flex h-full flex-col justify-between gap-10 p-6 transition-colors hover:bg-cream">
                <span className="text-xs tabular-nums text-cocoa">{p.k}</span>
                <span>
                  <span className="flex items-center justify-between font-serif text-2xl">
                    {p.t}
                    <span aria-hidden className="text-base text-crust transition-transform group-hover:translate-x-1">→</span>
                  </span>
                  <span className="mt-1 block text-sm text-cocoa">{p.d}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Cakes */}
      <section className="mx-auto mt-28 max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Celebration cakes</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">A cake for every occasion, ready the same day.</h2>
          </div>
          <Link href={`${BASE}/cakes`} className="text-sm font-medium underline decoration-crust underline-offset-4 hover:text-crust-deep">View all cakes</Link>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-cocoa">
          {CAKE_PROMISE.map((p) => (
            <li key={p} className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-crust" />{p}</li>
          ))}
        </ul>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {CAKES.map((c) => (
            <li key={c.slug}>
              <Link href={`${BASE}/cakes/${c.slug}`} className="group block">
                <div className="overflow-hidden">
                  <Art kind={c.art} label={`Illustration of a ${c.name}`} className="aspect-[4/5] w-full transition-transform duration-700 group-hover:scale-[1.03]" />
                </div>
                <p className="mt-4 text-[0.7rem] uppercase tracking-[0.2em] text-cocoa">{c.category}</p>
                <p className="mt-1 font-serif text-xl group-hover:text-crust-deep">{c.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Heritage band */}
      <section className="mt-28 bg-rye text-oat">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-5">
            <Eyebrow><span className="text-[#e3b98c]">Our story</span></Eyebrow>
            <h2 className="mt-5 font-serif text-4xl leading-tight text-cream sm:text-5xl">It began on Trinity Street in 1940.</h2>
          </div>
          <div className="space-y-6 text-lg leading-relaxed lg:col-span-6 lg:col-start-7">
            <p>
              Paddy McCloskey Sr bought Lyons Bakery on Trinity Street, Drogheda, in 1940. With his wife Vera he opened the
              family’s first bread shop and tea rooms a few years later.
            </p>
            <p>
              Today the bakery is run by his grandson, Patrick, from a purpose-built bakery at Ballymakenny — still baking
              for our own cafés and for shops and supermarkets across the north-east.
            </p>
            <Link href={`${BASE}/our-story`} className="inline-flex items-center gap-2 text-sm font-medium text-cream underline decoration-[#e3b98c] underline-offset-4">
              Read the full story <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Locations */}
      <section className="mx-auto mt-28 max-w-7xl px-5 sm:px-8">
        <Eyebrow>Visit us</Eyebrow>
        <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">Bakery cafés &amp; shops</h2>
        <div className="mt-10 grid gap-px border border-rye/10 bg-rye/10 md:grid-cols-3">
          {towns.map((town) => (
            <div key={town} className="bg-flour p-6">
              <p className="font-serif text-3xl">{town}</p>
              <ul className="mt-5 space-y-3">
                {LOCATIONS.filter((l) => l.town === town && l.kind !== "Bakery & trade office").map((l) => (
                  <li key={l.slug}>
                    <Link href={`${BASE}/locations/${l.slug}`} className="group flex items-baseline justify-between gap-4">
                      <span className="group-hover:text-crust-deep">{l.name}</span>
                      <span className="text-xs uppercase tracking-wider text-cocoa">{l.kind}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Trade */}
      <section className="mx-auto mt-28 grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
        <div className="overflow-hidden">
          <Art kind="trade" label="Illustration of loaves in a bakery crate" className="aspect-[4/3] w-full" />
        </div>
        <div>
          <Eyebrow>Trade &amp; wholesale</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">Supplying the north-east, daily.</h2>
          <p className="mt-6 text-lg leading-relaxed text-cocoa">{TRADE.proposition}</p>
          <div className="mt-8"><ButtonLink href={`${BASE}/trade`}>Become a trade customer <span aria-hidden>→</span></ButtonLink></div>
        </div>
      </section>
    </>
  );
}
