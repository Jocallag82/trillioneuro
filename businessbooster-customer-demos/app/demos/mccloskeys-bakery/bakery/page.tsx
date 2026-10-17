import { Art, type ArtKind } from "../_components/Art";
import { ButtonLink, PageHeader } from "../_components/ui";
import { BAKERY_RANGE, BASE } from "../_data/content";

export const metadata = { title: "Bread & bakery" };

const ART: Record<string, ArtKind> = { loaves: "loaf", soda: "soda", rolls: "rolls", seasonal: "brack" };

export default function Bakery() {
  return (
    <>
      <PageHeader
        eyebrow="Bread & bakery"
        title="The daily bread of the north-east."
        intro="From Cottage Brown to Tiger Bread, soda breads to bagels — baked at our Drogheda bakery and found in our own cafés and in shops and supermarkets across the north-east."
      />
      <nav aria-label="Bakery categories" className="sticky top-16 z-30 border-y border-rye/10 bg-flour/95 backdrop-blur">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2 sm:px-8">
          {BAKERY_RANGE.map((c) => (
            <li key={c.id} className="shrink-0">
              <a href={`#${c.id}`} className="block rounded-full px-4 py-2 text-sm hover:bg-oat">{c.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {BAKERY_RANGE.map((cat, i) => (
          <section key={cat.id} id={cat.id} className="grid scroll-mt-32 gap-8 border-b border-rye/10 py-16 lg:grid-cols-12 lg:gap-14">
            <div className={`lg:col-span-5 ${i % 2 ? "lg:order-2 lg:col-start-8" : ""}`}>
              <Art kind={ART[cat.id] ?? "loaf"} label={`Illustration for ${cat.title}`} className="aspect-[4/3] w-full" />
            </div>
            <div className="lg:col-span-6">
              <h2 className="font-serif text-4xl tracking-tight">{cat.title}</h2>
              <p className="mt-3 text-cocoa">{cat.intro}</p>
              <ul className="mt-8 divide-y divide-rye/10 border-y border-rye/10">
                {cat.items.map((it) => (
                  <li key={it.name} className="flex items-baseline justify-between gap-6 py-4">
                    <span className="font-serif text-xl">{it.name}</span>
                    <span className="text-right text-xs uppercase tracking-[0.16em] text-cocoa">{it.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
        <div className="mt-16 flex flex-col items-start gap-6 bg-oat px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="max-w-xl font-serif text-2xl">Stocking McCloskey’s bread in your shop, café or restaurant?</p>
          <ButtonLink href={`${BASE}/trade`}>Trade enquiries <span aria-hidden>→</span></ButtonLink>
        </div>
      </div>
    </>
  );
}
